import { useCallback, useRef, useState } from 'react';
import { ArrowLeft, Check, ImagePlus, Loader2, MessageCircle, X } from 'lucide-react';
import { useContent } from '@/content/ContentContext';
import { whatsappUrl } from '@/lib/share';
import { uploadGuestPhoto } from '@/lib/photos';
import { hasPhotoBackend } from '@/lib/config';
import { cn } from '@/lib/utils';

/**
 * Where the QR code lands: the page a guest uses to put their photographs on
 * the website.
 *
 * Written for somebody standing up, holding a drink, on a patchy 4G connection.
 * No account, no app, nothing required but a name if they feel like giving one.
 * Uploads run one at a time with per-file state, so a single failure in a batch
 * of twenty doesn't lose the other nineteen.
 */

type Status = 'queued' | 'uploading' | 'done' | 'failed';

interface Item {
  id: string;
  file: File;
  preview: string;
  status: Status;
  error?: string;
}

export function SharePage() {
  const { content } = useContent();
  const config = content.guestPhotos;
  const [items, setItems] = useState<Item[]>([]);
  const [uploader, setUploader] = useState('');
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const wa = whatsappUrl(config.whatsappNumber, config.whatsappMessage);
  const done = items.filter((i) => i.status === 'done').length;

  const addFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files)
      .filter((file) => file.type.startsWith('image/'))
      .map((file) => ({
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        preview: URL.createObjectURL(file),
        status: 'queued' as Status,
      }));
    setItems((prev) => [...prev, ...next]);
  }, []);

  const upload = async () => {
    setBusy(true);
    // Sequential rather than parallel: twenty simultaneous uploads on a phone
    // at a wedding venue is how you get twenty timeouts.
    for (const item of items) {
      if (item.status === 'done' || item.status === 'uploading') continue;
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: 'uploading' } : i)));
      try {
        await uploadGuestPhoto(item.file, { uploader, caption });
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: 'done' } : i)));
      } catch (e) {
        const error = e instanceof Error ? e.message : 'Upload failed';
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: 'failed', error } : i)));
      }
    }
    setBusy(false);
  };

  const remove = (id: string) =>
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((i) => i.id !== id);
    });

  const pending = items.some((i) => i.status === 'queued' || i.status === 'failed');

  return (
    <main className="paper min-h-svh bg-canvas px-6 py-14 text-ink">
      <div className="mx-auto w-full max-w-lg">
        <a
          href="#top"
          className="inline-flex items-center gap-1.5 text-[0.68rem] uppercase tracking-[0.2em] text-muted transition-colors hover:text-accent"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to the website
        </a>

        <h1 className="display-lg mt-8 text-balance">{config.headline}</h1>
        <p className="mt-4 text-[0.95rem] leading-relaxed text-muted">{config.intro}</p>

        {!hasPhotoBackend ? (
          <p className="mt-8 rounded-[var(--radius)] border border-line bg-surface px-5 py-4 text-sm text-muted">
            Photo sharing hasn't been switched on for this site yet.
          </p>
        ) : (
          <>
            {done > 0 && !pending && (
              <div className="mt-8 flex items-start gap-3 rounded-[var(--radius)] border border-accent/30 bg-accent/10 px-5 py-4">
                <Check className="mt-0.5 h-5 w-5 flex-none text-accent" />
                <p className="text-sm leading-relaxed text-ink">{config.thanks}</p>
              </div>
            )}

            <div className="mt-8 space-y-4">
              <label className="block space-y-1.5">
                <span className="eyebrow">Your name — optional</span>
                <input
                  value={uploader}
                  onChange={(e) => setUploader(e.target.value)}
                  placeholder="So we know who to thank"
                  maxLength={80}
                  className="w-full rounded-[var(--radius)] border border-line bg-surface px-4 py-3 text-sm outline-none transition-colors focus:border-accent"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="eyebrow">A caption — optional</span>
                <input
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="What was happening"
                  maxLength={280}
                  className="w-full rounded-[var(--radius)] border border-line bg-surface px-4 py-3 text-sm outline-none transition-colors focus:border-accent"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-6 flex w-full flex-col items-center gap-3 rounded-[var(--radius)] border-2 border-dashed border-line bg-surface/60 px-6 py-12 transition-colors hover:border-accent/60"
            >
              <ImagePlus className="h-7 w-7 text-accent" />
              <span className="text-sm font-medium text-ink">Choose photographs</span>
              <span className="text-xs text-muted">Or take one now — as many as you like</span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = '';
              }}
            />

            {items.length > 0 && (
              <>
                <ul className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {items.map((item) => (
                    <li key={item.id} className="relative aspect-square overflow-hidden rounded-[var(--radius)] bg-surface ring-1 ring-line">
                      <img src={item.preview} alt="" className="h-full w-full object-cover" />
                      <span
                        className={cn(
                          'absolute inset-0 flex items-center justify-center transition-opacity',
                          item.status === 'done' ? 'bg-black/45' : item.status === 'uploading' ? 'bg-black/35' : 'bg-transparent'
                        )}
                      >
                        {item.status === 'uploading' && <Loader2 className="h-5 w-5 animate-spin text-white" />}
                        {item.status === 'done' && <Check className="h-6 w-6 text-white" />}
                      </span>
                      {item.status === 'failed' && (
                        <span className="absolute inset-x-0 bottom-0 bg-red-600/90 px-1 py-0.5 text-center text-[9px] text-white">
                          Failed — try again
                        </span>
                      )}
                      {item.status !== 'uploading' && item.status !== 'done' && (
                        <button
                          type="button"
                          onClick={() => remove(item.id)}
                          aria-label="Remove this photo"
                          className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={upload}
                  disabled={busy || !pending}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-7 py-4 text-[0.75rem] font-medium uppercase tracking-[0.18em] text-accent-ink transition-all hover:brightness-110 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {busy ? `Sending ${done + 1} of ${items.length}…` : pending ? 'Send them' : 'All sent'}
                </button>
              </>
            )}
          </>
        )}

        {wa && (
          <div className="mt-10 border-t border-line pt-8 text-center">
            <p className="text-xs text-muted">{config.whatsappLabel}</p>
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-accent/40 px-6 py-3 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-accent transition-colors hover:border-accent hover:bg-accent/10"
            >
              <MessageCircle className="h-4 w-4" />
              Open WhatsApp
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
