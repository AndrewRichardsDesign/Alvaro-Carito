import { useEffect, useState } from 'react';
import { Copy, Download, GripVertical, Loader2, Plus, QrCode as QrIcon, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SortableItem, SortableList } from '@/components/Sortable';
import { QrCode } from '@/components/QrCode';
import { moveWithKeyboard } from '@/lib/reorder';
import { downloadQr } from '@/lib/qr';
import { shareUrl, whatsappUrl } from '@/lib/share';
import { eventAdmin, photoAdmin, useEvents } from '@/lib/photos';
import type { PendingPhoto, WeddingEvent } from '@/lib/photos';
import { getPhotoAdminKey } from '@/lib/photoKey';
import { useContent } from './ContentContext';
import { cn } from '@/lib/utils';

/**
 * The parts of the weekend guests can file photographs under.
 *
 * This is the list the WhatsApp picker is built from, so it is also where the
 * per-event QR codes live: print the one for the welcome drinks, put it on the
 * table, and every photo scanned from it arrives already filed — nobody is
 * asked anything.
 */
export function EventsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { content } = useContent();
  const { events, loading, error } = useEvents(open);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [showQr, setShowQr] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingPhoto[] | null>(null);

  const key = getPhotoAdminKey();
  const config = content.guestPhotos;

  // Photos whose sender never answered are invisible to the site's own reads,
  // so they have to be fetched through the moderation function.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    photoAdmin
      .pending(key)
      .then((rows) => !cancelled && setPending(rows))
      .catch(() => !cancelled && setPending([]));
    return () => {
      cancelled = true;
    };
  }, [open, key, events]);

  if (!open) return null;

  const run = async (id: string, action: () => Promise<void>) => {
    setBusy(id);
    setProblem(null);
    try {
      await action();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'That did not work.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[115] flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="admin-surface relative flex h-full w-full max-w-md flex-col bg-background shadow-2xl">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">Parts of the weekend</h2>
            <p className="text-xs text-muted-foreground">
              What guests choose between when they send photographs.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {problem && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{problem}</p>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
          {loading && !events.length && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </p>
          )}

          {events.length === 0 && !loading && (
            <p className="rounded-lg border border-dashed border-border p-4 text-xs leading-relaxed text-muted-foreground">
              No events yet. With none, guests are never asked anything and every photograph simply
              goes in the album — which is exactly right for a single-day wedding.
            </p>
          )}

          <SortableList
            axis="y"
            count={events.length}
            onReorder={(from, to) => {
              const order = events.map((e) => e.id);
              const [moved] = order.splice(from, 1);
              order.splice(to, 0, moved);
              void run('order', () => eventAdmin.reorder(order, key));
            }}
          >
            <div className="space-y-2">
              {events.map((event, index) => (
                <SortableItem key={event.id} index={index}>
                  {({ handleProps }) => (
                    <EventCard
                      event={event}
                      busy={busy === event.id}
                      handleProps={handleProps}
                      onKeyDown={(e) =>
                        moveWithKeyboard(e, index, events.length, (from, to) => {
                          const order = events.map((x) => x.id);
                          const [moved] = order.splice(from, 1);
                          order.splice(to, 0, moved);
                          void run('order', () => eventAdmin.reorder(order, key));
                        })
                      }
                      qrOpen={showQr === event.id}
                      onToggleQr={() => setShowQr(showQr === event.id ? null : event.id)}
                      shareLink={shareUrl(config.shareUrl, event.slug)}
                      whatsappLink={whatsappUrl(config.whatsappNumber, config.whatsappMessage, event.slug)}
                      onPatch={(patch) => run(event.id, () => eventAdmin.update(event.id, patch, key))}
                      onDelete={() =>
                        confirm(
                          `Delete “${event.name}”? Photographs filed under it are kept, but they stop being grouped.`
                        ) && run(event.id, () => eventAdmin.remove(event.id, key))
                      }
                    />
                  )}
                </SortableItem>
              ))}
            </div>
          </SortableList>

          <Button
            size="sm"
            variant="outline"
            className="w-full gap-1.5"
            disabled={busy !== null}
            onClick={() => {
              const name = prompt('What is this part of the weekend called? (max 24 characters)');
              if (name?.trim()) void run('new', () => eventAdmin.create({ name: name.trim() }, key));
            }}
          >
            <Plus className="h-4 w-4" /> Add an event
          </Button>

          {pending && pending.length > 0 && (
            <section className="space-y-3 border-t border-border pt-5">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Waiting for an answer — {pending.length}
                </h3>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                  Sent on WhatsApp by somebody who never said which event they meant. They stay off
                  the site until they are filed.
                </p>
              </div>
              <div className="space-y-2">
                {pending.map((photo) => (
                  <div key={photo.id} className="flex gap-3 rounded-lg border border-border p-2">
                    <img
                      src={photo.url}
                      alt=""
                      className="h-16 w-16 flex-none rounded object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium">
                        {photo.uploader || 'Anonymous'}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {events
                          .filter((e) => e.active)
                          .map((event) => (
                            <button
                              key={event.id}
                              type="button"
                              disabled={busy === photo.id}
                              onClick={() =>
                                run(photo.id, async () => {
                                  await photoAdmin.assign(photo.id, event.id, key);
                                  setPending((rows) => rows?.filter((r) => r.id !== photo.id) ?? null);
                                })
                              }
                              className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:border-primary hover:text-primary"
                            >
                              {event.name}
                            </button>
                          ))}
                        <button
                          type="button"
                          disabled={busy === photo.id}
                          onClick={() =>
                            run(photo.id, async () => {
                              await photoAdmin.remove(photo.id, key);
                              setPending((rows) => rows?.filter((r) => r.id !== photo.id) ?? null);
                            })
                          }
                          className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:border-destructive hover:text-destructive"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function EventCard({
  event, busy, handleProps, onKeyDown, qrOpen, onToggleQr, shareLink, whatsappLink, onPatch, onDelete,
}: {
  event: WeddingEvent;
  busy: boolean;
  handleProps: { onPointerDown: (e: React.PointerEvent) => void; style: React.CSSProperties };
  onKeyDown: (e: React.KeyboardEvent) => void;
  qrOpen: boolean;
  onToggleQr: () => void;
  shareLink: string;
  whatsappLink: string;
  onPatch: (patch: Partial<Omit<WeddingEvent, 'id'>>) => void;
  onDelete: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      /* clipboard blocked — the link is on screen to copy by hand */
    }
  };

  return (
    <div className={cn('rounded-lg border border-border p-3', !event.active && 'opacity-55')}>
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...handleProps}
          onKeyDown={onKeyDown}
          aria-label={`Move “${event.name}”. Use the arrow keys to reorder.`}
          className="mt-1 rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1 space-y-1.5">
          <Input
            defaultValue={event.name}
            key={`name-${event.name}`}
            maxLength={24}
            onBlur={(e) => e.target.value.trim() !== event.name && onPatch({ name: e.target.value.trim() })}
            className="h-8 text-xs font-medium"
          />
          <Input
            defaultValue={event.description}
            key={`desc-${event.description}`}
            maxLength={72}
            placeholder="A line of detail, shown under the name in WhatsApp"
            onBlur={(e) => e.target.value !== event.description && onPatch({ description: e.target.value })}
            className="h-7 text-[11px]"
          />
          <p className="text-[10px] text-muted-foreground">
            Hashtag <code className="rounded bg-muted px-1">#{event.slug}</code>
          </p>
        </div>

        <div className="flex flex-none flex-col gap-1">
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <>
              <IconBtn title="QR code and links" onClick={onToggleQr} active={qrOpen}>
                <QrIcon className="h-3.5 w-3.5" />
              </IconBtn>
              <IconBtn title="Delete this event" onClick={onDelete} danger>
                <Trash2 className="h-3.5 w-3.5" />
              </IconBtn>
            </>
          )}
        </div>
      </div>

      <label className="mt-2 flex items-center gap-2 pl-6">
        <input
          type="checkbox"
          checked={event.active}
          onChange={(e) => onPatch({ active: e.target.checked })}
          className="h-3 w-3 accent-primary"
        />
        <span className="text-[10px] text-muted-foreground">
          Offer this one to guests {event.active ? '' : '(retired)'}
        </span>
      </label>

      {qrOpen && (
        <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
          <div className="flex items-start gap-3">
            <div className="rounded bg-white p-2 ring-1 ring-border">
              <QrCode value={shareLink} size={96} />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-[10px] leading-snug text-muted-foreground">
                Print this for the {event.name.toLowerCase()} tables. Anything scanned from it
                arrives already filed under this event.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-[11px]"
                onClick={() => void downloadQr(shareLink, `qr-${event.slug}.png`)}
              >
                <Download className="h-3 w-3" /> Download PNG
              </Button>
            </div>
          </div>

          <LinkRow
            label="Upload page"
            value={shareLink}
            copied={copied === 'share'}
            onCopy={() => copy('share', shareLink)}
          />
          {whatsappLink ? (
            <LinkRow
              label="WhatsApp, pre-filled"
              value={whatsappLink}
              copied={copied === 'wa'}
              onCopy={() => copy('wa', whatsappLink)}
            />
          ) : (
            <p className="text-[10px] text-muted-foreground">
              Add a WhatsApp number under <span className="font-medium">Look → Guest photos</span> to
              get a pre-filled WhatsApp link for this event too.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function LinkRow({
  label, value, copied, onCopy,
}: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="space-y-1">
      <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-[10px]">{value}</code>
        <button
          type="button"
          onClick={onCopy}
          className="flex-none rounded border border-border p-1 text-muted-foreground hover:text-foreground"
          title="Copy"
        >
          <Copy className="h-3 w-3" />
        </button>
      </div>
      {copied && <span className="text-[10px] text-primary">Copied</span>}
    </div>
  );
}

function IconBtn({
  title, onClick, children, danger, active,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        'rounded border border-border p-1 transition-colors',
        active ? 'border-primary text-primary' : 'text-muted-foreground',
        danger ? 'hover:text-destructive' : 'hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}
