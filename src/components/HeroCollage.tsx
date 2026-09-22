import { useEffect, useRef, useState } from 'react';
import { EditableImage } from '@/content/EditableImage';
import { useContent } from '@/content/ContentContext';
import { useGuestPhotos } from '@/lib/photos';
import type { PhotoRef } from '@/content/types';
import { cn } from '@/lib/utils';

/**
 * The scattered photographs behind the couple's names.
 *
 * Slots are hand-placed percentages rather than a generated scatter: a random
 * layout looks random, and this one is composed to leave the centre of the
 * frame clear for the type at every breakpoint. The couple's own photographs
 * fill the slots first; whatever is left over is filled automatically with the
 * most recent guest uploads, so the collage keeps growing through the day
 * without anybody arranging anything.
 */

interface Slot {
  top: string;
  left: string;
  width: string;
  rotate: number;
  /** How strongly this tile drifts on scroll. */
  depth: number;
}

const SLOTS: Slot[] = [
  { top: '6%', left: '4%', width: '17cqw', rotate: -6, depth: 0.16 },
  { top: '46%', left: '1%', width: '14cqw', rotate: 4, depth: 0.3 },
  { top: '10%', left: '77%', width: '18cqw', rotate: 5, depth: 0.2 },
  { top: '52%', left: '81%', width: '15cqw', rotate: -4, depth: 0.34 },
  { top: '70%', left: '15%', width: '13cqw', rotate: 7, depth: 0.44 },
  { top: '74%', left: '64%', width: '12cqw', rotate: -7, depth: 0.4 },
  { top: '24%', left: '88%', width: '11cqw', rotate: -3, depth: 0.52 },
  { top: '30%', left: '-3%', width: '11cqw', rotate: 8, depth: 0.5 },
];

export function HeroCollage({
  basePath,
  collage,
  useGuests,
  count,
}: {
  /** Path of the hero section, e.g. "sections.0". */
  basePath: string;
  collage: PhotoRef[];
  useGuests: boolean;
  count: number;
}) {
  const { isAdmin } = useContent();
  const { photos: guests } = useGuestPhotos(useGuests);
  const containerRef = useRef<HTMLDivElement>(null);
  const [drift, setDrift] = useState(0);

  // A slow parallax drift. Cheap: one rAF-throttled scroll listener writing a
  // single number, with the per-tile offset done in CSS transforms.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setDrift(window.scrollY);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const own = collage.filter((p) => p.src || isAdmin);
  const spare = Math.max(0, Math.min(count, SLOTS.length) - own.length);
  const guestTiles = useGuests ? guests.slice(0, spare) : [];

  const tiles = [
    ...own.map((_, i) => ({ kind: 'own' as const, index: i, key: `own-${i}` })),
    ...guestTiles.map((g) => ({ kind: 'guest' as const, photo: g, key: `guest-${g.id}` })),
  ].slice(0, SLOTS.length);

  return (
    <>
      {/* Desktop: the scattered composition. Tile widths are given in `cqw`,
          so they measure this box rather than the browser window. Full-bleed on
          the real page the two are identical; inside the section palette's
          scaled-down preview, only this one is right. */}
      <div
        ref={containerRef}
        aria-hidden={!isAdmin}
        className="pointer-events-none absolute inset-0 hidden md:block"
        style={{ containerType: 'inline-size' }}
      >
        {tiles.map((tile, i) => {
          const slot = SLOTS[i];
          return (
            <figure
              key={tile.key}
              className={cn(
                'absolute overflow-hidden rounded-[var(--radius)] bg-surface shadow-[0_22px_50px_-24px_rgba(0,0,0,0.5)] ring-1 ring-line/60',
                'animate-fade-rise',
                isAdmin && 'pointer-events-auto'
              )}
              style={{
                top: slot.top,
                left: slot.left,
                width: slot.width,
                minWidth: '110px',
                animationDelay: `${300 + i * 110}ms`,
                transform: `rotate(${slot.rotate}deg) translate3d(0, ${-drift * slot.depth * 0.12}px, 0)`,
              }}
            >
              {tile.kind === 'own' ? (
                <EditableImage
                  path={`${basePath}.collage.${tile.index}`}
                  className="h-full w-full object-cover"
                  wrapperClassName="aspect-[4/5]"
                  loading="eager"
                />
              ) : (
                <img
                  src={tile.photo.url}
                  alt={tile.photo.caption || 'A photograph sent in by a guest'}
                  loading="lazy"
                  className="aspect-[4/5] h-full w-full object-cover"
                />
              )}
            </figure>
          );
        })}
      </div>

      {/* Phones: a single quiet strip under the type, rather than a collage
          squeezed into 380px where it would only fight with the names. */}
      <div className="no-scrollbar mt-12 flex gap-3 overflow-x-auto px-6 pb-2 md:hidden">
        {tiles.map((tile) => (
          <figure
            key={`m-${tile.key}`}
            className="h-32 w-24 flex-none overflow-hidden rounded-[var(--radius)] bg-surface shadow-lg ring-1 ring-line/60"
          >
            {tile.kind === 'own' ? (
              <EditableImage
                path={`${basePath}.collage.${tile.index}`}
                className="h-full w-full object-cover"
                wrapperClassName="h-full w-full"
              />
            ) : (
              <img
                src={tile.photo.url}
                alt={tile.photo.caption || 'A photograph sent in by a guest'}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            )}
          </figure>
        ))}
      </div>
    </>
  );
}
