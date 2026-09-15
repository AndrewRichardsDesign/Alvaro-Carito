import { Copy, Eye, EyeOff, GripVertical, Trash2 } from 'lucide-react';
import { SortableItem, SortableList } from '@/components/Sortable';
import { moveWithKeyboard } from '@/lib/reorder';
import { useContent } from '@/content/ContentContext';
import { sectionLabel } from '@/content/sectionTemplates';
import { SectionView } from './renderers';
import { SectionSettings } from './SectionSettings';
import { AddSectionLine } from './AddSectionMenu';
import { cn } from '@/lib/utils';

/**
 * The page.
 *
 * Every section is an entry in `content.sections`, so the running order is data
 * rather than markup — which is what makes "drag this above that" a one-line
 * change to a JSON array instead of a code edit.
 *
 * Arrange mode adds the drag handles and the insertion lines. It is deliberately
 * a mode rather than always-on: with handles showing all the time, clicking into
 * a paragraph to edit it becomes a game of millimetres.
 */
export function SectionCanvas() {
  const { content, isAdmin, arrangeMode, moveSection, removeSection, duplicateSection, setValue } =
    useContent();
  const sections = content.sections;

  if (!isAdmin) {
    return (
      <>
        {sections
          .filter((section) => !section.hidden)
          .map((section) => (
            <SectionView
              key={section.id}
              section={section}
              base={`sections.${sections.indexOf(section)}`}
            />
          ))}
      </>
    );
  }

  return (
    <SortableList axis="y" count={sections.length} enabled={arrangeMode} onReorder={moveSection}>
      {arrangeMode && <AddSectionLine index={0} />}
      {sections.map((section, index) => (
        <SortableItem key={section.id} index={index}>
          {({ handleProps, isDragging, listDragging }) => (
            <>
              <div
                className={cn(
                  'relative',
                  section.hidden && 'opacity-40',
                  arrangeMode && !isDragging && 'ring-1 ring-inset ring-primary/20',
                  isDragging && 'rounded-2xl'
                )}
              >
                {/* Section chrome. Hidden while something is being dragged so
                    the floating toolbars don't smear across the screen. */}
                {!listDragging && (
                  <div className="absolute left-3 top-3 z-40 flex items-center gap-1">
                    {arrangeMode && (
                      <button
                        type="button"
                        {...handleProps}
                        onKeyDown={(e) => moveWithKeyboard(e, index, sections.length, moveSection)}
                        aria-label={`Move “${sectionLabel(section)}”. Use the arrow keys to reorder.`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-background/95 px-2 py-1.5 text-[11px] font-medium text-primary shadow-sm backdrop-blur"
                      >
                        <GripVertical className="h-3.5 w-3.5" />
                        <span className="max-w-[10rem] truncate">{sectionLabel(section)}</span>
                      </button>
                    )}
                    <SectionSettings section={section} base={`sections.${index}`} />
                    <IconButton
                      title={section.hidden ? 'Show this section' : 'Hide this section'}
                      onClick={() => setValue(`sections.${index}.hidden`, !section.hidden)}
                    >
                      {section.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </IconButton>
                    <IconButton title="Duplicate this section" onClick={() => duplicateSection(index)}>
                      <Copy className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton
                      title="Delete this section"
                      danger
                      onClick={() => {
                        if (confirm(`Delete the “${sectionLabel(section)}” section?`)) removeSection(index);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconButton>
                  </div>
                )}

                <SectionView section={section} base={`sections.${index}`} />
              </div>

              {arrangeMode && !listDragging && <AddSectionLine index={index + 1} />}
            </>
          )}
        </SortableItem>
      ))}
    </SortableList>
  );
}

function IconButton({
  title, onClick, danger, children,
}: {
  title: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      className={cn(
        'rounded-md border border-border bg-background/95 p-1.5 text-muted-foreground shadow-sm backdrop-blur transition-colors',
        danger ? 'hover:text-destructive' : 'hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}
