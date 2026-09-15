import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sectionLabel } from './sectionTemplates';
import { useContent } from './ContentContext';

/**
 * A generated form for every field in the content document.
 *
 * Inline editing covers the copy you can see, but not everything is visible
 * copy — link destinations, alt text, a countdown target. Walking the document
 * and rendering an input per leaf guarantees that nothing is uneditable, and
 * costs far less than hand-writing a form that would drift out of date.
 */
export function ContentEditorPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { content } = useContent();

  if (!open) return null;

  // `theme` is deliberately left out: colours and typefaces have their own
  // panel, and a list of raw hex inputs here would only be a worse version of it.
  const rest = Object.fromEntries(
    Object.entries(content as unknown as Record<string, unknown>).filter(
      ([key]) => key !== 'sections' && key !== 'theme'
    )
  );
  const sections = content.sections;

  return (
    <div className="fixed inset-0 z-[115] flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="admin-surface relative flex h-full w-full max-w-md flex-col bg-background shadow-2xl">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">Every field</h2>
            <p className="text-xs text-muted-foreground">
              Including the ones you can't click on the page — links, alt text, dates.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {Object.entries(rest).map(([key, value]) => (
            <details key={key} className="border-b border-border/60 py-2">
              <summary className="cursor-pointer select-none py-2 text-sm font-semibold">
                {prettify(key)}
              </summary>
              <div className="space-y-3 pb-3 pl-1">
                <Node value={value} path={key} label="" depth={0} />
              </div>
            </details>
          ))}

          <p className="pb-2 pt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sections
          </p>
          {sections.map((section, i) => (
            <details key={section.id} className="border-b border-border/60 py-2">
              <summary className="cursor-pointer select-none py-2 text-sm font-semibold">
                {i + 1}. {sectionLabel(section)}
                <span className="ml-2 font-normal text-[11px] text-muted-foreground">{section.type}</span>
              </summary>
              <div className="space-y-3 pb-3 pl-1">
                <Node value={section} path={`sections.${i}`} label="" depth={0} />
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}

function Node({
  value, path, label, depth,
}: { value: unknown; path: string; label: string; depth: number }) {
  if (typeof value === 'boolean') {
    return <BooleanInput path={path} value={value} label={label || prettify(lastKey(path))} />;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return (
      <FieldInput
        path={path}
        value={value}
        label={label || prettify(lastKey(path))}
        numeric={typeof value === 'number'}
      />
    );
  }

  if (Array.isArray(value)) {
    return (
      <div className="space-y-3">
        {value.map((item, i) => {
          const isObject = typeof item === 'object' && item !== null;
          const itemLabel = `${label || prettify(lastKey(path))} ${i + 1}`;
          return (
            <div key={i} className={isObject ? 'rounded-lg border border-border/60 p-3' : ''}>
              {isObject && (
                <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {itemLabel}
                </div>
              )}
              <Node value={item} path={`${path}.${i}`} label={itemLabel} depth={depth + 1} />
            </div>
          );
        })}
      </div>
    );
  }

  if (typeof value === 'object' && value !== null) {
    return (
      <div className={depth > 0 ? 'space-y-3 border-l border-border/40 pl-3' : 'space-y-3'}>
        {Object.entries(value as Record<string, unknown>)
          // `id` and `type` identify the section; changing them by hand only
          // ever breaks anchors.
          .filter(([k]) => k !== 'id' && k !== 'type')
          .map(([k, v]) => (
            <Node key={k} value={v} path={`${path}.${k}`} label={prettify(k)} depth={depth + 1} />
          ))}
      </div>
    );
  }

  return null;
}

function FieldInput({
  path, value, label, numeric,
}: { path: string; value: string | number; label: string; numeric: boolean }) {
  const { setText } = useContent();
  const current = String(value);

  // Uncontrolled (defaultValue + key) so typing never re-renders the whole
  // site; the value is committed on blur. The key remounts the field when the
  // value changes elsewhere, e.g. through inline editing.
  const commit = (raw: string) => {
    if (numeric) {
      const n = Number(raw);
      setText(path, Number.isFinite(n) ? n : 0);
    } else if (raw !== current) {
      setText(path, raw);
    }
  };

  const multiline = !numeric && current.length > 60;
  const baseClass =
    'w-full rounded-md border border-border bg-card/50 px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20';

  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      {multiline ? (
        <textarea
          key={current}
          defaultValue={current}
          rows={3}
          spellCheck={false}
          onBlur={(e) => commit(e.target.value)}
          className={`${baseClass} resize-y`}
        />
      ) : (
        <input
          key={current}
          defaultValue={current}
          type={numeric ? 'number' : 'text'}
          spellCheck={false}
          onBlur={(e) => commit(e.target.value)}
          className={baseClass}
        />
      )}
    </label>
  );
}

function BooleanInput({ path, value, label }: { path: string; value: boolean; label: string }) {
  const { setText } = useContent();
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => setText(path, e.target.checked)}
        className="h-3.5 w-3.5 accent-primary"
      />
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
    </label>
  );
}

function lastKey(path: string): string {
  const parts = path.split('.');
  return parts[parts.length - 1];
}

function prettify(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
