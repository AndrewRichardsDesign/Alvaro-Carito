import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

/**
 * Pointer-driven drag-and-drop reordering.
 *
 * Built on Pointer Events rather than the HTML5 drag-and-drop API, because
 * HTML5 drag does not fire on touch — and half the people editing a wedding
 * website will be doing it on a phone.
 *
 * Geometry is measured once at drag start and kept in *document* coordinates,
 * so the edge auto-scroll can run without invalidating anything mid-drag.
 * Two layouts are supported:
 *
 *  - `axis="y"`: a vertical stack of variable-height blocks (the page's
 *    sections). Preview positions are computed from cumulative heights, which
 *    is exact even when a tall section swaps with a short one.
 *  - `axis="grid"`: uniformly-sized tiles (photo grids, cards). Items simply
 *    move between the measured slots.
 */

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface SortableContextValue {
  enabled: boolean;
  draggingIndex: number | null;
  register: (index: number, el: HTMLElement | null) => void;
  startDrag: (index: number, e: React.PointerEvent) => void;
}

const SortableCtx = createContext<SortableContextValue | null>(null);

/** Move `from` to `to` in a copy of `list`. */
function reordered<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function SortableList({
  axis = 'y',
  count,
  onReorder,
  enabled = true,
  children,
}: {
  axis?: 'y' | 'grid';
  count: number;
  onReorder: (from: number, to: number) => void;
  enabled?: boolean;
  children: ReactNode;
}) {
  const nodes = useRef(new Map<number, HTMLElement>());
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  // Everything the in-flight drag needs, kept off React state so the pointer
  // handlers never go stale and never trigger a re-render per frame.
  const drag = useRef<{
    from: number;
    preview: number;
    rects: Rect[];
    startX: number;
    startY: number;
    pointerX: number;
    pointerY: number;
    scrollFrame: number | null;
  } | null>(null);

  const register = useCallback((index: number, el: HTMLElement | null) => {
    if (el) nodes.current.set(index, el);
    else nodes.current.delete(index);
  }, []);

  /** Lay the non-dragged items out in the previewed order. */
  const paint = useCallback(
    (axisMode: 'y' | 'grid') => {
      const d = drag.current;
      if (!d) return;
      const { rects, from, preview } = d;
      const order = reordered(
        rects.map((_, i) => i),
        from,
        preview
      );

      if (axisMode === 'y') {
        // Walk the previewed order top-to-bottom, accumulating heights from the
        // first slot's origin. Gaps between blocks are preserved by measuring
        // from the original rects' spacing.
        let cursor = rects[0].top;
        for (const itemIndex of order) {
          const rect = rects[itemIndex];
          if (itemIndex !== from) {
            const el = nodes.current.get(itemIndex);
            if (el) el.style.transform = `translate3d(0, ${cursor - rect.top}px, 0)`;
          }
          cursor += rect.height;
        }
        return;
      }

      // Grid: slot k keeps its measured position; whoever lands there moves to it.
      order.forEach((itemIndex, slot) => {
        if (itemIndex === from) return;
        const el = nodes.current.get(itemIndex);
        const rect = rects[itemIndex];
        const target = rects[slot];
        if (el && rect && target) {
          el.style.transform = `translate3d(${target.left - rect.left}px, ${target.top - rect.top}px, 0)`;
        }
      });
    },
    []
  );

  /** Which slot the pointer is currently over. */
  const resolvePreview = useCallback((axisMode: 'y' | 'grid') => {
    const d = drag.current;
    if (!d) return 0;
    const { rects, from, pointerX, pointerY } = d;

    if (axisMode === 'y') {
      // The dragged block's own top edge, not the raw pointer, decides the
      // slot — that's what the editor sees moving.
      const draggedTop = rects[from].top + (pointerY - d.startY);
      const draggedMid = draggedTop + rects[from].height / 2;
      let index = 0;
      let cursor = rects[0].top;
      for (let i = 0; i < rects.length; i++) {
        if (i === from) continue;
        const height = rects[i].height;
        if (draggedMid > cursor + height / 2) index++;
        cursor += height;
      }
      return Math.max(0, Math.min(index, rects.length - 1));
    }

    let best = 0;
    let bestDistance = Infinity;
    rects.forEach((rect, i) => {
      const dx = pointerX - (rect.left + rect.width / 2);
      const dy = pointerY - (rect.top + rect.height / 2);
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });
    return best;
  }, []);

  const finish = useCallback(() => {
    const d = drag.current;
    if (!d) return;
    if (d.scrollFrame != null) cancelAnimationFrame(d.scrollFrame);

    for (const el of nodes.current.values()) {
      el.style.transform = '';
      el.style.transition = '';
      el.classList.remove('ac-dragging', 'ac-drag-shift');
      el.style.zIndex = '';
    }
    document.body.classList.remove('ac-drag-active');

    const { from, preview } = d;
    drag.current = null;
    setDraggingIndex(null);
    if (from !== preview) onReorder(from, preview);
  }, [onReorder]);

  const startDrag = useCallback(
    (index: number, e: React.PointerEvent) => {
      if (!enabled || drag.current) return;
      e.preventDefault();
      e.stopPropagation();

      const scrollY = window.scrollY;
      const scrollX = window.scrollX;
      const rects: Rect[] = [];
      for (let i = 0; i < count; i++) {
        const el = nodes.current.get(i);
        if (!el) return; // an unmounted item means our geometry would be wrong
        const r = el.getBoundingClientRect();
        rects.push({ top: r.top + scrollY, left: r.left + scrollX, width: r.width, height: r.height });
      }

      drag.current = {
        from: index,
        preview: index,
        rects,
        startX: e.clientX + scrollX,
        startY: e.clientY + scrollY,
        pointerX: e.clientX + scrollX,
        pointerY: e.clientY + scrollY,
        scrollFrame: null,
      };
      setDraggingIndex(index);
      document.body.classList.add('ac-drag-active');

      nodes.current.forEach((el, i) => {
        if (i === index) {
          el.classList.add('ac-dragging');
          el.style.zIndex = '60';
        } else {
          el.classList.add('ac-drag-shift');
        }
      });
    },
    [count, enabled]
  );

  // Window-level listeners: the pointer routinely leaves the dragged element.
  useEffect(() => {
    if (draggingIndex == null) return;

    const applyPointer = () => {
      const d = drag.current;
      if (!d) return;
      const el = nodes.current.get(d.from);
      if (el) {
        const dx = axis === 'grid' ? d.pointerX - d.startX : 0;
        const dy = d.pointerY - d.startY;
        el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      }
      const preview = resolvePreview(axis);
      if (preview !== d.preview) {
        d.preview = preview;
        paint(axis);
      }
    };

    /** Keep scrolling while the pointer sits near a viewport edge. */
    const autoScroll = () => {
      const d = drag.current;
      if (!d) return;
      const viewportY = d.pointerY - window.scrollY;
      const margin = 90;
      let delta = 0;
      if (viewportY < margin) delta = -Math.ceil((margin - viewportY) / 5);
      else if (viewportY > window.innerHeight - margin)
        delta = Math.ceil((viewportY - (window.innerHeight - margin)) / 5);

      if (delta !== 0) {
        const before = window.scrollY;
        window.scrollBy(0, delta);
        // The pointer hasn't moved on screen, but it has in document space.
        d.pointerY += window.scrollY - before;
        applyPointer();
      }
      d.scrollFrame = requestAnimationFrame(autoScroll);
    };

    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      e.preventDefault();
      d.pointerX = e.clientX + window.scrollX;
      d.pointerY = e.clientY + window.scrollY;
      applyPointer();
    };

    const onUp = () => finish();
    const onKey = (e: KeyboardEvent) => {
      // Escape aborts: snap the preview back to where the drag began.
      if (e.key !== 'Escape' || !drag.current) return;
      drag.current.preview = drag.current.from;
      finish();
    };

    drag.current!.scrollFrame = requestAnimationFrame(autoScroll);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKey);
    };
  }, [draggingIndex, axis, finish, paint, resolvePreview]);

  const value = useMemo<SortableContextValue>(
    () => ({ enabled, draggingIndex, register, startDrag }),
    [enabled, draggingIndex, register, startDrag]
  );

  return <SortableCtx.Provider value={value}>{children}</SortableCtx.Provider>;
}

interface SortableItemRenderProps {
  /** Spread onto whatever should start a drag. */
  handleProps: {
    onPointerDown: (e: React.PointerEvent) => void;
    style: { touchAction: 'none'; cursor: string };
  };
  isDragging: boolean;
  /** True while *any* item in this list is being dragged. */
  listDragging: boolean;
}

export function SortableItem({
  index,
  children,
  className,
}: {
  index: number;
  children: (props: SortableItemRenderProps) => ReactNode;
  className?: string;
}) {
  const ctx = useContext(SortableCtx);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ctx?.register(index, ref.current);
    return () => ctx?.register(index, null);
  }, [ctx, index]);

  if (!ctx) throw new Error('SortableItem must be used inside a SortableList');

  return (
    <div ref={ref} className={className}>
      {children({
        handleProps: {
          onPointerDown: (e: React.PointerEvent) => {
            if (e.button !== 0 && e.pointerType === 'mouse') return;
            ctx.startDrag(index, e);
          },
          style: { touchAction: 'none', cursor: ctx.enabled ? 'grab' : 'default' },
        },
        isDragging: ctx.draggingIndex === index,
        listDragging: ctx.draggingIndex != null,
      })}
    </div>
  );
}
