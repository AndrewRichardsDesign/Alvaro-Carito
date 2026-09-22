import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SECTION_TEMPLATES } from '@/content/sectionTemplates';
import type { SectionTemplate } from '@/content/sectionTemplates';
import type { Section, SectionType } from '@/content/types';
import { useContent } from '@/content/ContentContext';
import { SectionPreview } from './SectionPreview';
import { cn } from '@/lib/utils';

const GROUPS: SectionTemplate['group'][] = ['Essentials', 'Story', 'Guests', 'Photos', 'Layout'];

const PREVIEW_WIDTH = 400;
const PREVIEW_HEIGHT = 300;
const GAP = 12;

interface PreviewPosition {
  left: number;
  top: number;
}

/**
 * Work out where the preview card sits relative to the open list.
 *
 * It prefers the right, flips to the left when the list is near the right edge
 * of the screen, and gives up entirely when neither side has room — a preview
 * overlapping the list it describes is worse than no preview.
 */
function positionBeside(anchor: DOMRect): PreviewPosition | null {
  let left = anchor.right + GAP;
  if (left + PREVIEW_WIDTH > window.innerWidth - 8) left = anchor.left - PREVIEW_WIDTH - GAP;
  if (left < 8) return null;

  const top = Math.min(Math.max(anchor.top, 8), Math.max(8, window.innerHeight - PREVIEW_HEIGHT - 8));
  return { left, top };
}

/**
 * The section palette. Adding a section drops a fully-written template into the
 * page at the given position and scrolls to it, so the next thing the editor
 * sees is their new section, ready to be typed over. Hovering a template shows
 * it rendered, beside the list.
 */
export function AddSectionMenu({
  index,
  trigger,
  align = 'center',
}: {
  /** Where the new section goes. Omitted, it lands just above the footer. */
  index?: number;
  trigger: React.ReactNode;
  align?: 'start' | 'center' | 'end';
}) {
  const { addSection } = useContent();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<{ template: SectionTemplate; section: Section } | null>(null);
  const [position, setPosition] = useState<PreviewPosition | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Each template is built once, on hover, and kept. `create()` mints a fresh
  // id, so rebuilding it would remount the preview and make it flicker.
  const built = useRef(new Map<SectionType, Section>());

  const place = useCallback(() => {
    const rect = listRef.current?.getBoundingClientRect();
    setPosition(rect ? positionBeside(rect) : null);
  }, []);

  // The list can move under the preview: the page scrolls, or the window is
  // resized with the palette open.
  useEffect(() => {
    if (!open || !hovered) return;
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, hovered, place]);

  const showPreview = (template: SectionTemplate) => {
    let section = built.current.get(template.type);
    if (!section) {
      section = template.create();
      built.current.set(template.type, section);
    }
    setHovered({ template, section });
    place();
  };

  const add = (template: SectionTemplate) => {
    const id = addSection(template.type, index);
    setOpen(false);
    setHovered(null);
    // The section mounts on the next paint, so wait a frame before scrolling.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      })
    );
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setHovered(null);
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        ref={listRef}
        align={align}
        className="z-[130] max-h-[60vh] w-80 overflow-y-auto p-2"
        onMouseLeave={() => setHovered(null)}
      >
        <p className="px-2 py-1.5 text-[11px] text-muted-foreground">
          Hover to see one. Every template is editable once it is on the page.
        </p>
        {GROUPS.map((group) => {
          const templates = SECTION_TEMPLATES.filter((t) => t.group === group);
          if (!templates.length) return null;
          return (
            <div key={group} className="mt-1">
              <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group}
              </p>
              {templates.map((template) => (
                <button
                  key={template.type + template.label}
                  type="button"
                  onClick={() => add(template)}
                  onMouseEnter={() => showPreview(template)}
                  // Keyboard users get the preview too, as they tab the list.
                  onFocus={() => showPreview(template)}
                  className={cn(
                    'block w-full rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted',
                    hovered?.template.type === template.type && 'bg-muted'
                  )}
                >
                  <span className="block text-xs font-medium text-foreground">{template.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                    {template.description}
                  </span>
                </button>
              ))}
            </div>
          );
        })}
      </PopoverContent>

      {open &&
        hovered &&
        position &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[140] overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
            style={{ left: position.left, top: position.top, width: PREVIEW_WIDTH }}
          >
            <div className="flex items-baseline justify-between gap-2 px-3 py-2">
              <span className="text-xs font-medium text-foreground">{hovered.template.label}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {hovered.template.group}
              </span>
            </div>
            <SectionPreview section={hovered.section} width={PREVIEW_WIDTH} height={PREVIEW_HEIGHT} />
          </div>,
          document.body
        )}
    </Popover>
  );
}

/** The slim "add a section here" line shown between sections in arrange mode. */
export function AddSectionLine({ index, className }: { index: number; className?: string }) {
  return (
    <div className={cn('relative z-30 flex items-center gap-3 px-6 py-2', className)}>
      <span className="h-px flex-1 bg-primary/25" />
      <AddSectionMenu
        index={index}
        trigger={
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-primary/50 bg-background/90 px-3 py-1 text-[11px] font-medium text-primary shadow-sm backdrop-blur transition-colors hover:border-primary hover:bg-primary/10"
          >
            <Plus className="h-3 w-3" />
            Add a section here
          </button>
        }
      />
      <span className="h-px flex-1 bg-primary/25" />
    </div>
  );
}
