import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Settings2 } from 'lucide-react';
import type { Section } from '@/content/types';
import { useContent } from '@/content/ContentContext';
import { cn } from '@/lib/utils';

/**
 * Per-section settings: colours, spacing, width, and whatever that particular
 * section type needs. Kept in a popover on the section itself rather than in a
 * global panel, so what you are changing is always the thing you are looking at.
 */
export function SectionSettings({ section, base }: { section: Section; base: string }) {
  const { setValue } = useContent();
  const style = section.style;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          title="Section settings"
          className="rounded-md border border-border bg-background/95 p-1.5 text-muted-foreground shadow-sm backdrop-blur hover:text-foreground"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="z-[130] max-h-[70vh] w-72 space-y-4 overflow-y-auto">
        <p className="text-xs font-semibold capitalize">{section.type} section</p>

        <Row label="Nav label — blank keeps it out of the menu">
          <Input
            value={section.navLabel}
            onChange={(e) => setValue(`${base}.navLabel`, e.target.value)}
            placeholder="e.g. Schedule"
            className="h-8 text-xs"
          />
        </Row>

        <div className="grid grid-cols-2 gap-2">
          <Color label="Background" value={style.bg} onChange={(v) => setValue(`${base}.style.bg`, v)} />
          <Color label="Accent" value={style.accent} onChange={(v) => setValue(`${base}.style.accent`, v)} />
          <Color label="Body text" value={style.ink} onChange={(v) => setValue(`${base}.style.ink`, v)} />
          <Color label="Headings" value={style.display} onChange={(v) => setValue(`${base}.style.display`, v)} />
        </div>

        <Choice
          label="Width"
          value={style.width}
          options={['narrow', 'normal', 'wide', 'full']}
          onChange={(v) => setValue(`${base}.style.width`, v)}
        />
        <Choice
          label="Spacing"
          value={style.padding}
          options={['tight', 'normal', 'roomy']}
          onChange={(v) => setValue(`${base}.style.padding`, v)}
        />
        <Choice
          label="Alignment"
          value={style.align}
          options={['left', 'center']}
          onChange={(v) => setValue(`${base}.style.align`, v)}
        />

        <TypeSettings section={section} base={base} />
      </PopoverContent>
    </Popover>
  );
}

/** The settings that only make sense for one kind of section. */
function TypeSettings({ section, base }: { section: Section; base: string }) {
  const { setValue } = useContent();

  switch (section.type) {
    case 'hero':
      return (
        <>
          <Toggle label="Fill gaps with guest photos" value={section.useGuestPhotos}
            onChange={(v) => setValue(`${base}.useGuestPhotos`, v)} />
          <Row label="Photos in the collage">
            <Input type="number" min={1} max={8} value={section.collageCount}
              onChange={(e) => setValue(`${base}.collageCount`, Number(e.target.value))}
              className="h-8 text-xs" />
          </Row>
          <Row label="Button link">
            <Input value={section.ctaHref} onChange={(e) => setValue(`${base}.ctaHref`, e.target.value)}
              placeholder="#sec-rsvp or https://…" className="h-8 text-xs" />
          </Row>
        </>
      );
    case 'countdown':
      return (
        <Row label="Counting down to">
          <Input type="datetime-local" value={section.target}
            onChange={(e) => setValue(`${base}.target`, e.target.value)} className="h-8 text-xs" />
        </Row>
      );
    case 'story':
      return (
        <Choice label="Photo side" value={section.imageSide} options={['left', 'right']}
          onChange={(v) => setValue(`${base}.imageSide`, v)} />
      );
    case 'banner':
      return (
        <Choice label="Height" value={section.height} options={['short', 'tall', 'full']}
          onChange={(v) => setValue(`${base}.height`, v)} />
      );
    case 'gallery':
      return (
        <>
          <Choice label="Columns" value={String(section.columns)} options={['2', '3', '4']}
            onChange={(v) => setValue(`${base}.columns`, Number(v))} />
          <Toggle label="Include guest photos" value={section.useGuestPhotos}
            onChange={(v) => setValue(`${base}.useGuestPhotos`, v)} />
          <Toggle label="Let people download them" value={section.allowDownload}
            onChange={(v) => setValue(`${base}.allowDownload`, v)} />
        </>
      );
    case 'rsvp':
      return (
        <Row label="RSVP form link">
          <Input value={section.buttonHref} onChange={(e) => setValue(`${base}.buttonHref`, e.target.value)}
            placeholder="https://forms.gle/…" className="h-8 text-xs" />
        </Row>
      );
    case 'map':
      return (
        <>
          <Row label="Directions link">
            <Input value={section.mapHref} onChange={(e) => setValue(`${base}.mapHref`, e.target.value)}
              placeholder="https://maps.google.com/…" className="h-8 text-xs" />
          </Row>
          <Row label="Embedded map URL (optional)">
            <Input value={section.embedSrc} onChange={(e) => setValue(`${base}.embedSrc`, e.target.value)}
              placeholder="https://www.google.com/maps/embed?…" className="h-8 text-xs" />
          </Row>
        </>
      );
    case 'details':
      return (
        <div className="space-y-2">
          {section.cards.map((card, i) => (
            <Row key={i} label={`Link for “${card.title || `card ${i + 1}`}”`}>
              <Input value={card.linkHref} onChange={(e) => setValue(`${base}.cards.${i}.linkHref`, e.target.value)}
                placeholder="https://…" className="h-8 text-xs" />
            </Row>
          ))}
        </div>
      );
    case 'registry':
      return (
        <div className="space-y-2">
          {section.items.map((item, i) => (
            <Row key={i} label={`Link for “${item.name || `option ${i + 1}`}”`}>
              <Input value={item.linkHref} onChange={(e) => setValue(`${base}.items.${i}.linkHref`, e.target.value)}
                placeholder="https://…" className="h-8 text-xs" />
            </Row>
          ))}
        </div>
      );
    case 'links':
      return (
        <div className="space-y-2">
          {section.items.map((item, i) => (
            <Row key={i} label={`Link for “${item.label || `link ${i + 1}`}”`}>
              <Input value={item.href} onChange={(e) => setValue(`${base}.items.${i}.href`, e.target.value)}
                placeholder="https://…" className="h-8 text-xs" />
            </Row>
          ))}
        </div>
      );
    default:
      return null;
  }
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={value || '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-7 flex-none cursor-pointer rounded border border-border bg-transparent p-0.5"
          aria-label={label}
        />
        <button
          type="button"
          onClick={() => onChange('')}
          title="Use the site theme"
          className={cn(
            'flex-1 rounded border px-1.5 py-1 text-[10px] transition-colors',
            value
              ? 'border-border text-muted-foreground hover:text-foreground'
              : 'border-primary/40 bg-primary/10 text-primary'
          )}
        >
          {value ? 'Reset' : 'Theme'}
        </button>
      </div>
    </div>
  );
}

function Choice<T extends string>({
  label, value, options, onChange,
}: { label: string; value: T; options: T[]; onChange: (v: T) => void }) {
  return (
    <div className="space-y-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-[11px] capitalize transition-colors',
              value === option
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={cn(
          'relative h-5 w-9 flex-none rounded-full transition-colors',
          value ? 'bg-primary' : 'bg-border'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
            value ? 'translate-x-[1.125rem]' : 'translate-x-0.5'
          )}
        />
      </button>
    </label>
  );
}
