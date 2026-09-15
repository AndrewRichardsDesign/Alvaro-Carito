import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SECTION_TEMPLATES } from '@/content/sectionTemplates';
import type { SectionTemplate } from '@/content/sectionTemplates';
import { useContent } from '@/content/ContentContext';
import { cn } from '@/lib/utils';

const GROUPS: SectionTemplate['group'][] = ['Essentials', 'Story', 'Guests', 'Photos', 'Layout'];

/**
 * The section palette. Adding a section drops a fully-written template into the
 * page at the given position and scrolls to it, so the next thing the editor
 * sees is their new section, ready to be typed over.
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

  const add = (template: SectionTemplate) => {
    const id = addSection(template.type, index);
    setOpen(false);
    // The section mounts on the next paint, so wait a frame before scrolling.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      })
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} className="z-[130] max-h-[60vh] w-80 overflow-y-auto p-2">
        <p className="px-2 py-1.5 text-[11px] text-muted-foreground">
          Every template is editable once it is on the page.
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
                  className="block w-full rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted"
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
