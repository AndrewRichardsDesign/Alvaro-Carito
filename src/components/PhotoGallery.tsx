import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, EyeOff, Loader2, Trash2, X } from 'lucide-react';
import { EditableImage } from '@/content/EditableImage';
import { AdminList } from '@/content/AdminList';
import { useContent } from '@/content/ContentContext';
import { photo as blankPhoto } from '@/content/sectionTemplates';
import type { PhotoRef } from '@/content/types';
import { downloadAll, downloadPhoto, photoAdmin, photoFilename, useEvents, useGuestPhotos } from '@/lib/photos';
import { getPhotoAdminKey } from '@/lib/photoKey';
import { cn } from '@/lib/utils';

interface Viewable {
  src: string;
  alt: string;
  caption: string;
  credit: string;
}

/** "All" plus one tab per event that actually has photographs in it. */
const ALL = '__all__';

const COLUMNS: Record<number, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
};

/**
 * The album. The couple's own photographs first — editable, reorderable — then
 * everything guests have sent in, newest first, with a download on every one.
 */
export function PhotoGallery({
  basePath,
  photos,
  useGuests,
  allowDownload,
  columns,
}: {
  basePath: string;
  photos: PhotoRef[];
  useGuests: boolean;
  allowDownload: boolean;
  columns: number;
}) {
  const { isAdmin } = useContent();
  const { photos: guests, refresh } = useGuestPhotos(useGuests);
  const { events } = useEvents(useGuests);
  const [filter, setFilter] = useState<string>(ALL);
  const [viewing, setViewing] = useState<number | null>(null);
  const [zipping, setZipping] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Only offer a filter for events that have something in them — an empty tab
  // is just a promise the page can't keep.
  const tabs = useMemo(() => {
    if (!useGuests) return [];
    const counts = new Map<string, number>();
    for (const g of guests) if (g.eventId) counts.set(g.eventId, (counts.get(g.eventId) ?? 0) + 1);
    return events
      .filter((e) => e.active && counts.has(e.id))
      .map((e) => ({ id: e.id, name: e.name, count: counts.get(e.id) ?? 0 }));
  }, [events, guests, useGuests]);

  // A filter that no longer exists (its event was deleted) would show nothing
  // at all, with no way back.
  const active = filter !== ALL && tabs.some((t) => t.id === filter) ? filter : ALL;

  const own: Viewable[] = useMemo(
    () =>
      // The couple's own photographs belong to the album as a whole, not to
      // any one part of the weekend, so a filtered view leaves them out.
      active !== ALL
        ? []
        : photos
            .filter((p) => p.src)
            .map((p) => ({ src: p.src, alt: p.alt, caption: p.caption ?? '', credit: '' })),
    [photos, active]
  );
  const guestViewables: Viewable[] = useMemo(
    () =>
      useGuests
        ? guests
            .filter((g) => active === ALL || g.eventId === active)
            .map((g) => ({
              src: g.url,
              alt: g.caption || 'A guest photograph',
              caption: g.caption,
              credit: g.uploader,
            }))
        : [],
    [guests, useGuests, active]
  );
  // Memoised because the "download everything" callback closes over it.
  const all = useMemo(() => [...own, ...guestViewables], [own, guestViewables]);

  const grid = cn('grid grid-cols-2 gap-3 sm:gap-4', COLUMNS[columns] ?? COLUMNS[3]);

  const downloadEverything = useCallback(async () => {
    setZipping('Preparing…');
    try {
      await downloadAll(
        all.map((p, i) => ({ url: p.src, name: photoFilename({ url: p.src, caption: p.caption }, i) })),
        'wedding-photographs.zip',
        (done, total) => setZipping(`${done} of ${total}…`)
      );
    } catch (e) {
      setZipping(e instanceof Error ? e.message : 'Download failed.');
      setTimeout(() => setZipping(null), 4000);
      return;
    }
    setZipping(null);
  }, [all]);

  const moderate = async (id: string, action: 'hide' | 'delete') => {
    setBusyId(id);
    try {
      const key = getPhotoAdminKey();
      if (action === 'hide') await photoAdmin.hide(id, key);
      else await photoAdmin.remove(id, key);
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'That did not work.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mt-12">
      {tabs.length > 1 && !isAdmin && (
        <div className="no-scrollbar mb-8 flex flex-wrap justify-center gap-2 overflow-x-auto">
          <FilterTab label="Everything" active={active === ALL} onClick={() => setFilter(ALL)} />
          {tabs.map((tab) => (
            <FilterTab
              key={tab.id}
              label={tab.name}
              count={tab.count}
              active={active === tab.id}
              onClick={() => setFilter(tab.id)}
            />
          ))}
        </div>
      )}

      {/* The couple's own photographs. */}
      {isAdmin ? (
        <div className="group/list">
          <AdminList
            path={`${basePath}.photos`}
            axis="grid"
            className={grid}
            newItem={() => blankPhoto('')}
            addLabel="Add a photograph"
            min={0}
            renderItem={(i) => (
              <figure className="overflow-hidden rounded-[var(--radius)] bg-surface ring-1 ring-line/70">
                <EditableImage
                  path={`${basePath}.photos.${i}`}
                  className="h-full w-full object-cover"
                  wrapperClassName="aspect-[4/5]"
                />
              </figure>
            )}
          />
        </div>
      ) : (
        <div className={grid}>
          {own.map((p, i) => (
            <Tile key={`own-${i}`} photo={p} onOpen={() => setViewing(i)} />
          ))}
          {guestViewables.map((p, i) => (
            <Tile key={`guest-${i}`} photo={p} onOpen={() => setViewing(own.length + i)} />
          ))}
        </div>
      )}

      {/* Guest photographs, shown separately in admin so they can be moderated. */}
      {isAdmin && useGuests && guests.length > 0 && (
        <div className="mt-10">
          <p className="eyebrow mb-3 text-left">From your guests — {guests.length}</p>
          <div className={grid}>
            {guests.map((g) => (
              <figure key={g.id} className="group/guest relative overflow-hidden rounded-[var(--radius)] bg-surface ring-1 ring-line/70">
                <img src={g.url} alt={g.caption || 'Guest photograph'} loading="lazy" className="aspect-[4/5] h-full w-full object-cover" />
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2 text-left text-[11px] text-white/90">
                  {g.uploader || 'Anonymous'}
                  {g.source === 'whatsapp' && <span className="ml-1 opacity-70">· WhatsApp</span>}
                </figcaption>
                <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover/guest:opacity-100">
                  <button
                    type="button"
                    onClick={() => moderate(g.id, 'hide')}
                    disabled={busyId === g.id}
                    title="Hide from the site"
                    className="rounded-md bg-background/90 p-1.5 text-muted-foreground shadow ring-1 ring-border hover:text-foreground"
                  >
                    {busyId === g.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Delete this photograph for good?')) void moderate(g.id, 'delete');
                    }}
                    disabled={busyId === g.id}
                    title="Delete permanently"
                    className="rounded-md bg-background/90 p-1.5 text-muted-foreground shadow ring-1 ring-border hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </figure>
            ))}
          </div>
        </div>
      )}

      {allowDownload && all.length > 0 && (
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={downloadEverything}
            disabled={zipping !== null}
            className="inline-flex items-center gap-2 rounded-full border border-accent/40 px-6 py-2.5 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-accent transition-colors hover:border-accent hover:bg-accent/10 disabled:opacity-60"
          >
            {zipping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {zipping ?? `Download all ${all.length}`}
          </button>
        </div>
      )}

      {viewing !== null && all[viewing] && (
        <Lightbox
          photos={all}
          index={viewing}
          allowDownload={allowDownload}
          onClose={() => setViewing(null)}
          onIndex={setViewing}
        />
      )}
    </div>
  );
}

function FilterTab({
  label, count, active, onClick,
}: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'whitespace-nowrap rounded-full border px-4 py-1.5 text-[0.7rem] uppercase tracking-[0.16em] transition-colors',
        active
          ? 'border-accent bg-accent text-accent-ink'
          : 'border-line text-muted hover:border-accent/60 hover:text-accent'
      )}
    >
      {label}
      {count != null && <span className="ml-2 opacity-60 tabular-nums">{count}</span>}
    </button>
  );
}

function Tile({ photo, onOpen }: { photo: Viewable; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group/tile relative block overflow-hidden rounded-[var(--radius)] bg-surface ring-1 ring-line/70 transition-transform duration-500 hover:-translate-y-1"
    >
      <img
        src={photo.src}
        alt={photo.alt}
        loading="lazy"
        className="aspect-[4/5] h-full w-full object-cover transition-transform duration-700 ease-out group-hover/tile:scale-[1.04]"
      />
      {(photo.caption || photo.credit) && (
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-3 py-2 text-left text-[11px] text-white/95">
          {photo.caption || `From ${photo.credit}`}
        </span>
      )}
    </button>
  );
}

function Lightbox({
  photos, index, allowDownload, onClose, onIndex,
}: {
  photos: Viewable[];
  index: number;
  allowDownload: boolean;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const [saving, setSaving] = useState(false);
  const photo = photos[index];

  const go = useCallback(
    (delta: number) => onIndex((index + delta + photos.length) % photos.length),
    [index, photos.length, onIndex]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    // Stop the page behind from scrolling under the lightbox.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [go, onClose]);

  const save = async () => {
    setSaving(true);
    try {
      await downloadPhoto(photo.src, photoFilename({ url: photo.src, caption: photo.caption }, index));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not download that photo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photograph"
      className="fixed inset-0 z-[120] flex flex-col bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex justify-end p-4">
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 pb-4" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => go(-1)} aria-label="Previous" className="hidden rounded-full p-3 text-white/70 hover:bg-white/10 hover:text-white sm:block">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <figure className="flex max-h-full min-w-0 flex-1 flex-col items-center gap-3">
          <img src={photo.src} alt={photo.alt} className="max-h-[70vh] w-auto max-w-full rounded-lg object-contain" />
          <figcaption className="text-center text-xs text-white/70">
            {photo.caption}
            {photo.credit && <span className="ml-2 opacity-70">— {photo.credit}</span>}
            <span className="ml-3 tabular-nums opacity-50">{index + 1} / {photos.length}</span>
          </figcaption>
          {allowDownload && (
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full border border-white/25 px-5 py-2 text-[0.7rem] uppercase tracking-[0.18em] text-white/90 hover:bg-white/10"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Download
            </button>
          )}
        </figure>
        <button type="button" onClick={() => go(1)} aria-label="Next" className="hidden rounded-full p-3 text-white/70 hover:bg-white/10 hover:text-white sm:block">
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
