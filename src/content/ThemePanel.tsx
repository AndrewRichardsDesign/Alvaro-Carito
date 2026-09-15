import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BODY_FONTS, DISPLAY_FONTS, PALETTES } from '@/lib/theme';
import { getPhotoAdminKey, setPhotoAdminKey } from '@/lib/photoKey';
import { useContent } from './ContentContext';
import type { ThemeContent } from './types';
import { cn } from '@/lib/utils';

const COLOR_FIELDS: { key: keyof ThemeContent['colors']; label: string; hint: string }[] = [
  { key: 'canvas', label: 'Page background', hint: 'Behind everything' },
  { key: 'surface', label: 'Card background', hint: 'Cards and panels' },
  { key: 'display', label: 'Headings', hint: 'The big serif type' },
  { key: 'ink', label: 'Body text', hint: 'Paragraphs' },
  { key: 'muted', label: 'Quiet text', hint: 'Captions and labels' },
  { key: 'accent', label: 'Accent', hint: 'Buttons, rules, small caps' },
  { key: 'accentInk', label: 'Text on accent', hint: 'Inside filled buttons' },
  { key: 'line', label: 'Hairlines', hint: 'Borders and dividers' },
];

/**
 * The look of the site: one palette for everything, and two typefaces.
 *
 * Individual sections can still override any of these in their own settings —
 * this is the default that the whole page inherits.
 */
export function ThemePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { content, setValue } = useContent();
  const theme = content.theme;
  const [photoKey, setKey] = useState(() => getPhotoAdminKey());

  if (!open) return null;

  const applyPalette = (colors: ThemeContent['colors']) => setValue('theme.colors', colors);

  return (
    <div className="fixed inset-0 z-[115] flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="admin-surface relative flex h-full w-full max-w-md flex-col bg-background shadow-2xl">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">Look and feel</h2>
            <p className="text-xs text-muted-foreground">Colours and type for the whole site.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="flex-1 space-y-7 overflow-y-auto px-5 py-5">
          <Group title="Palettes" note="A starting point — every colour stays editable below.">
            <div className="grid grid-cols-2 gap-2">
              {PALETTES.map((palette) => {
                const active = palette.colors.canvas === theme.colors.canvas
                  && palette.colors.accent === theme.colors.accent;
                return (
                  <button
                    key={palette.name}
                    type="button"
                    onClick={() => applyPalette(palette.colors)}
                    className={cn(
                      'rounded-lg border p-2.5 text-left transition-colors',
                      active ? 'border-primary ring-1 ring-primary/30' : 'border-border hover:border-primary/40'
                    )}
                  >
                    <span className="flex gap-1">
                      {['canvas', 'accent', 'display', 'line'].map((k) => (
                        <span
                          key={k}
                          className="h-5 w-5 rounded-full ring-1 ring-black/10"
                          style={{ background: palette.colors[k as keyof ThemeContent['colors']] }}
                        />
                      ))}
                    </span>
                    <span className="mt-2 block text-[11px] font-medium">{palette.name}</span>
                  </button>
                );
              })}
            </div>
          </Group>

          <Group title="Colours">
            <div className="space-y-2.5">
              {COLOR_FIELDS.map((field) => (
                <div key={field.key} className="flex items-center gap-3">
                  <input
                    type="color"
                    value={theme.colors[field.key]}
                    onChange={(e) => setValue(`theme.colors.${field.key}`, e.target.value)}
                    aria-label={field.label}
                    className="h-8 w-8 flex-none cursor-pointer rounded border border-border bg-transparent p-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium">{field.label}</p>
                    <p className="text-[11px] text-muted-foreground">{field.hint}</p>
                  </div>
                  <Input
                    value={theme.colors[field.key]}
                    onChange={(e) => setValue(`theme.colors.${field.key}`, e.target.value)}
                    spellCheck={false}
                    className="h-7 w-24 font-mono text-[11px]"
                  />
                </div>
              ))}
            </div>
          </Group>

          <Group title="Typefaces">
            <FontPicker
              label="Headings"
              value={theme.fonts.display}
              options={DISPLAY_FONTS}
              onChange={(v) => setValue('theme.fonts.display', v)}
            />
            <FontPicker
              label="Body text"
              value={theme.fonts.body}
              options={BODY_FONTS}
              onChange={(v) => setValue('theme.fonts.body', v)}
            />
            <Slider
              label="Corner rounding"
              min={0}
              max={2}
              step={0.05}
              value={theme.radius}
              onChange={(v) => setValue('theme.radius', v)}
              format={(v) => `${v.toFixed(2)}rem`}
            />
          </Group>

          <Group title="Guest photos" note="How people send their photographs in.">
            <Field label="Public address of this site — used for the QR code">
              <Input
                value={content.guestPhotos.shareUrl}
                onChange={(e) => setValue('guestPhotos.shareUrl', e.target.value)}
                placeholder="https://alvaroandcarito.com (blank = wherever this page is)"
                className="h-8 text-xs"
              />
            </Field>
            <Field label="WhatsApp number — international format, digits only">
              <Input
                value={content.guestPhotos.whatsappNumber}
                onChange={(e) => setValue('guestPhotos.whatsappNumber', e.target.value)}
                placeholder="573001234567"
                className="h-8 text-xs"
              />
            </Field>
            <Field label="Moderation key — must match PHOTO_ADMIN_KEY in Supabase">
              <Input
                type="password"
                value={photoKey}
                onChange={(e) => {
                  setKey(e.target.value);
                  setPhotoAdminKey(e.target.value);
                }}
                className="h-8 font-mono text-xs"
              />
            </Field>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Stored only in this browser. It is what lets you hide or delete a guest's photo.
            </p>
          </Group>
        </div>
      </div>
    </div>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        {note && <p className="mt-0.5 text-[11px] text-muted-foreground">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function FontPicker({
  label, value, options, onChange,
}: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-xs outline-none focus:border-primary"
      >
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function Slider({
  label, min, max, step, value, onChange, format,
}: {
  label: string; min: number; max: number; step: number;
  value: number; onChange: (v: number) => void; format: (v: number) => string;
}) {
  return (
    <label className="block space-y-1">
      <span className="flex items-center text-[11px] font-medium text-muted-foreground">
        {label}
        <span className="ml-auto tabular-nums">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary"
      />
    </label>
  );
}
