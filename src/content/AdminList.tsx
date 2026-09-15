import { GripVertical, Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { SortableItem, SortableList } from '@/components/Sortable';
import { moveWithKeyboard } from '@/lib/reorder';
import { cn } from '@/lib/utils';
import { getByPath } from '@/lib/paths';
import { useContent } from './ContentContext';

/**
 * Any repeating list on the page — schedule entries, cards, questions, photos.
 *
 * Outside admin mode this is just the markup the section wanted. Inside it,
 * every item gains a drag handle and a delete button, and a discreet "add"
 * control appears at the end. Reordering is the same pointer-driven drag used
 * for whole sections, so the gesture is identical wherever you are on the page.
 */
export function AdminList({
  path,
  axis = 'y',
  newItem,
  addLabel,
  className,
  itemClassName,
  handleClassName,
  renderItem,
  min = 1,
}: {
  /** Dot path to the array, e.g. "sections.4.items". */
  path: string;
  axis?: 'y' | 'grid';
  /** Builds a fresh entry when "add" is pressed. */
  newItem: () => unknown;
  addLabel: string;
  className?: string;
  itemClassName?: string;
  handleClassName?: string;
  renderItem: (index: number) => ReactNode;
  /** Below this many items the delete buttons disappear. */
  min?: number;
}) {
  const { content, isAdmin, moveItem, addItem, removeItem } = useContent();
  const items = (getByPath(content, path) as unknown[] | undefined) ?? [];

  if (!isAdmin) {
    return <div className={className}>{items.map((_, i) => <div key={i} className={itemClassName}>{renderItem(i)}</div>)}</div>;
  }

  return (
    <>
      <SortableList
        axis={axis}
        count={items.length}
        onReorder={(from, to) => moveItem(path, from, to)}
      >
        <div className={className}>
          {items.map((_, index) => (
            <SortableItem key={index} index={index} className={itemClassName}>
              {({ handleProps, isDragging }) => (
                <div className={cn('relative', isDragging && 'pointer-events-none')}>
                  <div
                    className={cn(
                      'absolute -left-1 -top-1 z-30 flex -translate-x-full items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/list:opacity-100 max-md:translate-x-0 max-md:opacity-100',
                      handleClassName
                    )}
                  >
                    <button
                      type="button"
                      {...handleProps}
                      onKeyDown={(e) => moveWithKeyboard(e, index, items.length, (from, to) => moveItem(path, from, to))}
                      aria-label={`Move item ${index + 1}. Use the arrow keys to reorder.`}
                      className="rounded-md border border-border bg-background/95 p-1 text-muted-foreground shadow-sm backdrop-blur hover:text-foreground"
                    >
                      <GripVertical className="h-3.5 w-3.5" />
                    </button>
                    {items.length > min && (
                      <button
                        type="button"
                        onClick={() => removeItem(path, index)}
                        aria-label={`Delete item ${index + 1}`}
                        className="rounded-md border border-border bg-background/95 p-1 text-muted-foreground shadow-sm backdrop-blur hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {renderItem(index)}
                </div>
              )}
            </SortableItem>
          ))}
        </div>
      </SortableList>

      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={() => addItem(path, newItem())}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-accent/50 px-4 py-1.5 text-xs font-medium text-accent transition-colors hover:border-accent hover:bg-accent/10"
        >
          <Plus className="h-3.5 w-3.5" />
          {addLabel}
        </button>
      </div>
    </>
  );
}
