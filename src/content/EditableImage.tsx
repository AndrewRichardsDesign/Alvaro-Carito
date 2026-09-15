import { useRef, useState } from 'react';
import { Crop, ImageIcon, Loader2, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ImageCropper } from '@/components/ImageCropper';
import type { CropResult } from '@/components/ImageCropper';
import { cn } from '@/lib/utils';
import { getByPath } from '@/lib/paths';
import { useContent } from './ContentContext';
import type { PhotoRef } from './types';

interface EditableImageProps {
  /** Dot path to a PhotoRef object, e.g. "sections.2.image". */
  path: string;
  className?: string;
  wrapperClassName?: string;
  /** Rendered instead of the photo when the source is blank. */
  fallback?: React.ReactNode;
  loading?: 'lazy' | 'eager';
}

/**
 * A photograph on the page. Outside admin mode it is a plain <img> honouring
 * the stored focal point; inside admin mode it gains a corner button that opens
 * the crop-and-adjust editor, alt text, caption and focal-point controls.
 */
export function EditableImage({ path, className, wrapperClassName, fallback, loading = 'lazy' }: EditableImageProps) {
  const { content, isAdmin, setValue, uploadAsset } = useContent();
  const photo = (getByPath(content, path) as PhotoRef | undefined) ?? {
    src: '', alt: '', caption: '', focusX: 50, focusY: 50,
  };
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<File | string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const objectPosition = `${photo.focusX ?? 50}% ${photo.focusY ?? 50}%`;

  const img = photo.src ? (
    <img
      src={photo.src}
      alt={photo.alt}
      loading={loading}
      decoding="async"
      className={className}
      style={{ objectPosition }}
    />
  ) : (
    fallback ?? (
      <div className={cn('flex items-center justify-center bg-line/40 text-muted', className)}>
        <ImageIcon className="h-6 w-6" />
      </div>
    )
  );

  // The wrapper carries the aspect ratio and rounding, so it has to be there
  // in both modes — otherwise the page the editor sees is not the page a
  // guest sees.
  if (!isAdmin) return <div className={wrapperClassName}>{img}</div>;

  const applyCrop = async ({ blob }: CropResult) => {
    setUploading(true);
    setError(null);
    try {
      const src = await uploadAsset(blob, 'photo.jpg');
      setValue(`${path}.src`, src);
      setPending(null);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={cn('group/photo relative', wrapperClassName)}>
      {img}

      <button
        type="button"
        onClick={() => setOpen(true)}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute right-2 top-2 z-20 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1.5 text-[11px] font-medium text-foreground opacity-0 shadow-lg ring-1 ring-border backdrop-blur transition-opacity group-hover/photo:opacity-100 focus-visible:opacity-100"
      >
        <Crop className="h-3.5 w-3.5" />
        Edit photo
      </button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setPending(null); setError(null); } }}>
        <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Photograph</DialogTitle>
            <DialogDescription>
              Replace it, crop it, or nudge which part stays in view when the frame is a different shape.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
          )}

          {pending ? (
            <ImageCropper
              file={pending}
              busy={uploading}
              onCancel={() => setPending(null)}
              onApply={applyCrop}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4" /> Choose a photo
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={!photo.src}
                  onClick={() => setPending(photo.src)}
                >
                  <Crop className="h-4 w-4" /> Crop the current one
                </Button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setPending(file);
                  e.target.value = '';
                }}
              />

              <Field label="Image URL or path">
                <Input
                  value={photo.src}
                  onChange={(e) => setValue(`${path}.src`, e.target.value)}
                  placeholder="./uploads/photo.jpg or https://…"
                  spellCheck={false}
                  className="h-9 text-xs"
                />
              </Field>

              <Field label="Alt text — describes the photo for screen readers">
                <Input
                  value={photo.alt}
                  onChange={(e) => setValue(`${path}.alt`, e.target.value)}
                  placeholder="Alvaro and Carito on the terrace"
                  className="h-9 text-xs"
                />
              </Field>

              <Field label="Caption (optional)">
                <Input
                  value={photo.caption ?? ''}
                  onChange={(e) => setValue(`${path}.caption`, e.target.value)}
                  placeholder="Shown under the photo in galleries"
                  className="h-9 text-xs"
                />
              </Field>

              <Field label="Focal point — click the part that must always stay in frame">
                <FocalPicker
                  src={photo.src}
                  x={photo.focusX ?? 50}
                  y={photo.focusY ?? 50}
                  onChange={(x, y) => {
                    setValue(`${path}.focusX`, x);
                    setValue(`${path}.focusY`, y);
                  }}
                />
              </Field>

              {uploading && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function FocalPicker({
  src, x, y, onChange,
}: { src: string; x: number; y: number; onChange: (x: number, y: number) => void }) {
  if (!src) return <p className="text-xs text-muted-foreground">Add a photo first.</p>;
  const pick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onChange(
      Math.round(((e.clientX - rect.left) / rect.width) * 100),
      Math.round(((e.clientY - rect.top) / rect.height) * 100)
    );
  };
  return (
    <div
      onClick={pick}
      className="relative h-40 w-full cursor-crosshair overflow-hidden rounded-lg bg-muted"
    >
      <img src={src} alt="" className="h-full w-full object-contain" />
      <span
        className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary/70 shadow"
        style={{ left: `${x}%`, top: `${y}%` }}
      />
    </div>
  );
}
