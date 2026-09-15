import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RotateCcw, RotateCw, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Crop and adjust a photograph before it goes on the site.
 *
 * The preview is a plain <img> under a CSS transform — cheap, and smooth on a
 * phone — and the export replays exactly the same transform onto a canvas at
 * full output resolution. Keeping one source of truth for the geometry is what
 * stops the classic "the crop moved when I saved it" bug.
 */

const ASPECTS = [
  { id: 'free', label: 'Original', value: 0 },
  { id: 'square', label: '1:1', value: 1 },
  { id: 'portrait', label: '4:5', value: 4 / 5 },
  { id: 'landscape', label: '3:2', value: 3 / 2 },
  { id: 'wide', label: '16:9', value: 16 / 9 },
] as const;

/** Longest edge of the exported image — plenty for retina, small enough to commit. */
const MAX_OUTPUT = 2000;

export interface CropResult {
  blob: Blob;
  width: number;
  height: number;
}

interface Adjustments {
  brightness: number;
  contrast: number;
  saturation: number;
}

const NEUTRAL: Adjustments = { brightness: 100, contrast: 100, saturation: 100 };

export function ImageCropper({
  file,
  onCancel,
  onApply,
  busy = false,
}: {
  /** The picked file, or a URL of an image already on the site. */
  file: File | string;
  onCancel: () => void;
  onApply: (result: CropResult) => void;
  busy?: boolean;
}) {
  const src = useMemo(() => (typeof file === 'string' ? file : URL.createObjectURL(file)), [file]);
  useEffect(() => {
    return () => {
      if (typeof file !== 'string') URL.revokeObjectURL(src);
    };
  }, [file, src]);

  const frameRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [aspect, setAspect] = useState<number>(0);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [adjust, setAdjust] = useState<Adjustments>(NEUTRAL);
  const [exporting, setExporting] = useState(false);

  const pan = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // The frame the crop is previewed in, measured so the export can match it.
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const effectiveAspect = aspect || (natural ? natural.w / natural.h : 1);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => {
      const width = el.clientWidth;
      setFrame({ w: width, h: width / effectiveAspect });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [effectiveAspect]);

  /** Scale at which the (possibly rotated) image just covers the frame. */
  const baseScale = useMemo(() => {
    if (!natural || !frame.w || !frame.h) return 1;
    const turned = rotation % 180 !== 0;
    const w = turned ? natural.h : natural.w;
    const h = turned ? natural.w : natural.h;
    return Math.max(frame.w / w, frame.h / h);
  }, [natural, frame, rotation]);

  const reset = useCallback(() => {
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
    setAdjust(NEUTRAL);
  }, []);

  const filter = `brightness(${adjust.brightness}%) contrast(${adjust.contrast}%) saturate(${adjust.saturation}%)`;

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    pan.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const p = pan.current;
    if (!p) return;
    setOffset({ x: p.ox + (e.clientX - p.x), y: p.oy + (e.clientY - p.y) });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pan.current = null;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const apply = async () => {
    if (!natural || !frame.w) return;
    setExporting(true);
    try {
      const image = await loadImage(src);

      // Export at the frame's aspect, capped on the longest edge.
      const ratio = frame.w / frame.h;
      const outW = Math.round(ratio >= 1 ? MAX_OUTPUT : MAX_OUTPUT * ratio);
      const outH = Math.round(ratio >= 1 ? MAX_OUTPUT / ratio : MAX_OUTPUT);
      const sf = outW / frame.w; // preview px → output px

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable.');

      // A white floor keeps transparent PNGs from exporting as black JPEGs.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, outW, outH);
      ctx.imageSmoothingQuality = 'high';
      ctx.filter = filter;

      ctx.translate(outW / 2 + offset.x * sf, outH / 2 + offset.y * sf);
      ctx.rotate((rotation * Math.PI) / 180);
      const scale = baseScale * zoom * sf;
      ctx.scale(scale, scale);
      ctx.drawImage(image, -natural.w / 2, -natural.h / 2);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.88)
      );
      if (!blob) throw new Error('Could not export the image.');
      onApply({ blob, width: outW, height: outH });
    } finally {
      setExporting(false);
    }
  };

  const working = exporting || busy;

  return (
    <div className="space-y-4">
      <div
        ref={frameRef}
        className="relative w-full select-none overflow-hidden rounded-xl bg-neutral-900"
        style={{ aspectRatio: String(effectiveAspect) }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          src={src}
          alt=""
          draggable={false}
          onLoad={(e) =>
            setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
          }
          className="pointer-events-none absolute left-1/2 top-1/2 max-w-none origin-center"
          style={{
            transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scale(${baseScale * zoom})`,
            width: natural?.w,
            height: natural?.h,
            filter,
          }}
        />
        {/* Rule-of-thirds guides, shown only while adjusting. */}
        <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-40">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="border border-white/25" />
          ))}
        </div>
        <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-[11px] text-white/90">
          Drag to reposition
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {ASPECTS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAspect(a.value)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs transition-colors',
              aspect === a.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
            )}
          >
            {a.label}
          </button>
        ))}
        <div className="ml-auto flex gap-1">
          <Button type="button" size="sm" variant="outline" className="h-7 w-7 p-0"
            onClick={() => setRotation((r) => (r - 90 + 360) % 360)} title="Rotate left">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-7 w-7 p-0"
            onClick={() => setRotation((r) => (r + 90) % 360)} title="Rotate right">
            <RotateCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <Range label="Zoom" icon={<ZoomIn className="h-3.5 w-3.5" />} min={1} max={4} step={0.01}
        value={zoom} onChange={setZoom} format={(v) => `${v.toFixed(2)}×`} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Range label="Brightness" min={50} max={150} step={1} value={adjust.brightness}
          onChange={(v) => setAdjust((a) => ({ ...a, brightness: v }))} format={(v) => `${v}%`} />
        <Range label="Contrast" min={50} max={150} step={1} value={adjust.contrast}
          onChange={(v) => setAdjust((a) => ({ ...a, contrast: v }))} format={(v) => `${v}%`} />
        <Range label="Warmth" min={0} max={200} step={1} value={adjust.saturation}
          onChange={(v) => setAdjust((a) => ({ ...a, saturation: v }))} format={(v) => `${v}%`} />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button type="button" size="sm" onClick={apply} disabled={working || !natural} className="gap-1.5">
          {working ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {working ? 'Uploading…' : 'Use this photo'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={reset} disabled={working}>
          Reset
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={working} className="ml-auto">
          Cancel
        </Button>
      </div>
    </div>
  );
}

function Range({
  label, icon, min, max, step, value, onChange, format,
}: {
  label: string;
  icon?: React.ReactNode;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <label className="block space-y-1">
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        {icon}
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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Needed so a photo served from Supabase storage doesn't taint the canvas.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load that image.'));
    img.src = src;
  });
}
