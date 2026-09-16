import { createClient } from '@supabase/supabase-js';
import { useMemo, useSyncExternalStore } from 'react';
import { GUEST_PREFIX, PHOTO_BUCKET, SUPABASE_KEY, SUPABASE_URL, hasPhotoBackend } from './config';
import { createZip, saveBlob } from './zip';

/**
 * Guest photographs.
 *
 * Site *content* lives in a JSON file in the repo, but guest photos can't:
 * they arrive from strangers at two in the morning, and nobody is going to be
 * committing them by hand. So they live in Supabase, where the row-level
 * security policies allow anyone to add one and nobody to quietly alter or
 * delete somebody else's. Moderation goes through the `photo-admin` edge
 * function, which holds the only credential that can.
 */

export const supabase = hasPhotoBackend
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
  : null;

export interface GuestPhoto {
  id: string;
  createdAt: string;
  storagePath: string;
  url: string;
  caption: string;
  uploader: string;
  source: 'web' | 'whatsapp' | 'admin';
  width: number | null;
  height: number | null;
  featured: boolean;
  sortOrder: number;
  /** Which part of the weekend this is from; null when it was never said. */
  eventId: string | null;
}

/**
 * One occasion guests can file photographs under.
 *
 * The same list drives three things, which is why it lives in the database
 * rather than in the content file: the WhatsApp picker the guest taps, the
 * filter on the album, and the per-event QR codes on the tables.
 */
export interface WeddingEvent {
  id: string;
  /** URL- and hashtag-safe, and what the QR deep links carry. */
  slug: string;
  /** At most 24 characters — a WhatsApp list row cannot show more. */
  name: string;
  /** At most 72 characters, shown under the name in the picker. */
  description: string;
  startsAt: string | null;
  sortOrder: number;
  active: boolean;
}

interface PhotoRow {
  id: string;
  created_at: string;
  storage_path: string;
  caption: string | null;
  uploader: string | null;
  source: string | null;
  width: number | null;
  height: number | null;
  featured: boolean | null;
  sort_order: number | null;
  event_id: string | null;
}

interface EventRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  starts_at: string | null;
  sort_order: number | null;
  active: boolean | null;
}

export function publicUrl(storagePath: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/${storagePath}`;
}

function toPhoto(row: PhotoRow): GuestPhoto {
  return {
    id: row.id,
    createdAt: row.created_at,
    storagePath: row.storage_path,
    url: publicUrl(row.storage_path),
    caption: row.caption ?? '',
    uploader: row.uploader ?? '',
    source: (row.source as GuestPhoto['source']) ?? 'web',
    width: row.width,
    height: row.height,
    featured: row.featured ?? false,
    sortOrder: row.sort_order ?? 0,
    eventId: row.event_id ?? null,
  };
}

function toEvent(row: EventRow): WeddingEvent {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? '',
    startsAt: row.starts_at,
    sortOrder: row.sort_order ?? 0,
    active: row.active ?? true,
  };
}

export async function fetchEvents(): Promise<WeddingEvent[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('starts_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data as EventRow[]).map(toEvent);
}

export async function fetchGuestPhotos(): Promise<GuestPhoto[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .order('featured', { ascending: false })
    .order('sort_order', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data as PhotoRow[]).map(toPhoto);
}

/** Read a picked file's pixel dimensions, so galleries can lay out without jank. */
async function measure(file: Blob): Promise<{ width: number | null; height: number | null }> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return { width: null, height: null };
  }
}

function extensionFor(file: File | Blob): string {
  const type = file.type.toLowerCase();
  if (type.includes('png')) return 'png';
  if (type.includes('webp')) return 'webp';
  if (type.includes('gif')) return 'gif';
  if (type.includes('heic') || type.includes('heif')) return 'heic';
  return 'jpg';
}

export interface UploadMeta {
  uploader?: string;
  caption?: string;
  /** Which event the photo is from, when the guest has told us. */
  eventId?: string | null;
}

/** Put one photo in the bucket and record it. Returns the stored row. */
export async function uploadGuestPhoto(file: File | Blob, meta: UploadMeta = {}): Promise<GuestPhoto> {
  if (!supabase) throw new Error('Photo sharing is not configured for this site yet.');

  const path = `${GUEST_PREFIX}/${crypto.randomUUID()}.${extensionFor(file)}`;
  const { error: uploadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type || 'image/jpeg', cacheControl: '31536000' });
  if (uploadError) throw new Error(uploadError.message);

  const { width, height } = await measure(file);
  const { data, error } = await supabase
    .from('photos')
    .insert({
      storage_path: path,
      caption: (meta.caption ?? '').slice(0, 280),
      uploader: (meta.uploader ?? '').slice(0, 80),
      source: 'web',
      event_id: meta.eventId ?? null,
      width,
      height,
    })
    .select()
    .single();

  if (error) {
    // Don't leave an orphaned object in the bucket if the row didn't land.
    await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    throw new Error(error.message);
  }
  return toPhoto(data as PhotoRow);
}

/**
 * Live lists of the things that live in the database.
 *
 * Several places on the page want the same list at once — the hero collage,
 * the album, the filter tabs, the admin panels. They share one fetch and one
 * realtime subscription through a module-level store rather than each opening
 * their own: Supabase keys channels by topic, so a second component
 * subscribing to the same topic would attach its callbacks to an
 * already-subscribed channel and throw. It also means one websocket, not six.
 */
interface Snapshot<T> {
  items: T[];
  loading: boolean;
  error: string | null;
}

// A single frozen value, so `useSyncExternalStore` sees a stable snapshot when
// the store is switched off.
const EMPTY = Object.freeze({ items: [], loading: false, error: null }) as Snapshot<never>;

function emptySnapshot<T>(): Snapshot<T> {
  return EMPTY as unknown as Snapshot<T>;
}

function noopSubscribe(): () => void {
  return () => {};
}

function createStore<T>(table: string, fetcher: () => Promise<T[]>, what: string) {
  let state: Snapshot<T> = { items: [], loading: Boolean(supabase), error: null };
  let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
  let loadedOnce = false;
  const listeners = new Set<() => void>();

  function publish(next: Snapshot<T>): void {
    state = next;
    for (const listener of listeners) listener();
  }

  async function load(): Promise<void> {
    if (!supabase) return;
    publish({ ...state, loading: true });
    try {
      publish({ items: await fetcher(), loading: false, error: null });
    } catch (e) {
      publish({
        ...state,
        loading: false,
        error: e instanceof Error ? e.message : `Could not load the ${what}.`,
      });
    }
  }

  return {
    refresh: () => void load(),
    getSnapshot: () => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);

      if (supabase && !loadedOnce) {
        loadedOnce = true;
        void load();
      }
      if (supabase && !channel) {
        channel = supabase
          .channel(`store:${table}`)
          .on('postgres_changes', { event: '*', schema: 'public', table }, () => void load())
          .subscribe();
      }

      return () => {
        listeners.delete(listener);
        // The last consumer leaving takes the websocket with it.
        if (listeners.size === 0 && channel) {
          void supabase?.removeChannel(channel);
          channel = null;
        }
      };
    },
  };
}

const photoStore = createStore('photos', fetchGuestPhotos, 'photographs');
const eventStore = createStore('events', fetchEvents, 'events');

/** Re-read the photographs. Exposed so an upload or a deletion can refresh. */
export function refreshGuestPhotos(): void {
  photoStore.refresh();
}

export function refreshEvents(): void {
  eventStore.refresh();
}

export function useGuestPhotos(enabled = true): {
  photos: GuestPhoto[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const live = useSyncExternalStore(
    enabled && supabase ? photoStore.subscribe : noopSubscribe,
    enabled && supabase ? photoStore.getSnapshot : emptySnapshot<GuestPhoto>,
    emptySnapshot<GuestPhoto>
  );
  return { photos: live.items, loading: live.loading, error: live.error, refresh: photoStore.refresh };
}

export function useEvents(enabled = true): {
  events: WeddingEvent[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const live = useSyncExternalStore(
    enabled && supabase ? eventStore.subscribe : noopSubscribe,
    enabled && supabase ? eventStore.getSnapshot : emptySnapshot<WeddingEvent>,
    emptySnapshot<WeddingEvent>
  );
  return { events: live.items, loading: live.loading, error: live.error, refresh: eventStore.refresh };
}

/** Moderation. The key never leaves the couple's browser except to this function. */
async function moderate<T = void>(
  action: string,
  payload: Record<string, unknown>,
  key: string
): Promise<T> {
  if (!supabase) throw new Error('Photo sharing is not configured.');
  const res = await fetch(`${SUPABASE_URL}/functions/v1/photo-admin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY,
      'x-admin-key': key,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `That did not work (${res.status}).`);
  }
  const body = await res.text();
  try {
    return JSON.parse(body) as T;
  } catch {
    return undefined as T;
  }
}

/** A photo whose sender never said which event it was from. */
export interface PendingPhoto {
  id: string;
  url: string;
  caption: string;
  uploader: string;
  createdAt: string;
}

interface PendingRow {
  id: string;
  storage_path: string;
  caption: string | null;
  uploader: string | null;
  created_at: string;
}

export const photoAdmin = {
  hide: (id: string, key: string) => moderate('hide', { id }, key),
  restore: (id: string, key: string) => moderate('restore', { id }, key),
  remove: (id: string, key: string) => moderate('delete', { id }, key),
  feature: (id: string, featured: boolean, key: string) => moderate('feature', { id, featured }, key),
  /** File a photo under an event — or under none, with null. */
  assign: async (id: string, eventId: string | null, key: string) => {
    await moderate('assign', { id, eventId }, key);
    refreshGuestPhotos();
  },
  /**
   * Photos still waiting on an answer. They are invisible to everyone —
   * including the anon key the site reads with — so this is the only way to
   * see them.
   */
  pending: async (key: string): Promise<PendingPhoto[]> => {
    const { photos } = await moderate<{ photos: PendingRow[] }>('pending', {}, key);
    return (photos ?? []).map((row) => ({
      id: row.id,
      url: publicUrl(row.storage_path),
      caption: row.caption ?? '',
      uploader: row.uploader ?? '',
      createdAt: row.created_at,
    }));
  },
};

/**
 * Events are read by everybody and written only by the couple, so reads go
 * straight to the table and writes go through the edge function.
 */
export const eventAdmin = {
  create: async (
    event: { name: string; description?: string; slug?: string; startsAt?: string | null },
    key: string
  ) => {
    await moderate('createEvent', { ...event, sortOrder: 999 }, key);
    refreshEvents();
  },
  update: async (id: string, patch: Partial<Omit<WeddingEvent, 'id'>>, key: string) => {
    await moderate(
      'updateEvent',
      {
        id,
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.description !== undefined && { description: patch.description }),
        ...(patch.slug !== undefined && { slug: patch.slug }),
        ...(patch.startsAt !== undefined && { startsAt: patch.startsAt }),
        ...(patch.active !== undefined && { active: patch.active }),
      },
      key
    );
    refreshEvents();
  },
  remove: async (id: string, key: string) => {
    await moderate('deleteEvent', { id }, key);
    refreshEvents();
    // Its photographs survive the event, but they are no longer filed under it.
    refreshGuestPhotos();
  },
  reorder: async (order: string[], key: string) => {
    await moderate('reorderEvents', { order }, key);
    refreshEvents();
  },
};

/** Download a single photo, cross-origin included. */
export async function downloadPhoto(url: string, filename: string): Promise<void> {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`Could not download that photo (${res.status}).`);
  saveBlob(await res.blob(), filename);
}

/** Download a whole set as one zip. */
export async function downloadAll(
  items: { url: string; name: string }[],
  zipName: string,
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const entries = [];
  const seen = new Set<string>();
  for (let i = 0; i < items.length; i++) {
    const res = await fetch(items[i].url, { mode: 'cors' });
    if (!res.ok) continue;
    const bytes = new Uint8Array(await res.arrayBuffer());
    // Two photos called "photo.jpg" would otherwise collide inside the zip.
    let name = items[i].name;
    for (let n = 2; seen.has(name); n++) {
      name = items[i].name.replace(/(\.[^.]+)?$/, (ext) => `-${n}${ext}`);
    }
    seen.add(name);
    entries.push({ name, data: bytes });
    onProgress?.(i + 1, items.length);
  }
  if (!entries.length) throw new Error('None of those photos could be downloaded.');
  saveBlob(createZip(entries), zipName);
}

/** A tidy filename for a downloaded photo. */
export function photoFilename(photo: { url: string; caption?: string; uploader?: string }, index: number): string {
  const ext = photo.url.split('.').pop()?.split('?')[0]?.slice(0, 4) || 'jpg';
  const label = (photo.caption || photo.uploader || `photo-${index + 1}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || `photo-${index + 1}`;
  return `${label}.${ext}`;
}

/** Everything the collage and gallery need, in one shape. */
export interface DisplayPhoto {
  key: string;
  src: string;
  alt: string;
  caption: string;
  credit: string;
  focusX: number;
  focusY: number;
  /** Guest photos can be moderated; the couple's own cannot. */
  guestId?: string;
}

export function useDisplayPhotos(
  own: { src: string; alt: string; caption?: string; focusX?: number; focusY?: number }[],
  includeGuests: boolean
): { photos: DisplayPhoto[]; loading: boolean } {
  const { photos: guests, loading } = useGuestPhotos(includeGuests);
  const merged = useMemo<DisplayPhoto[]>(() => {
    const curated = own
      .filter((p) => p.src)
      .map((p, i) => ({
        key: `own-${i}-${p.src}`,
        src: p.src,
        alt: p.alt || '',
        caption: p.caption ?? '',
        credit: '',
        focusX: p.focusX ?? 50,
        focusY: p.focusY ?? 50,
      }));
    if (!includeGuests) return curated;
    return [
      ...curated,
      ...guests.map((g) => ({
        key: `guest-${g.id}`,
        src: g.url,
        alt: g.caption || 'A photograph sent in by a guest',
        caption: g.caption,
        credit: g.uploader,
        focusX: 50,
        focusY: 50,
        guestId: g.id,
      })),
    ];
  }, [own, guests, includeGuests]);
  return { photos: merged, loading };
}
