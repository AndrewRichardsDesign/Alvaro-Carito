import { PreviewContentProvider } from '@/content/ContentContext';
import type { Section } from '@/content/types';
import { SectionView } from './renderers';

/**
 * A live thumbnail of a section template.
 *
 * It renders the real section component at full desktop width and scales the
 * whole thing down, rather than drawing a simplified wireframe. That costs a
 * little performance and buys the one thing a wireframe can't: the preview is
 * always exactly what you are about to get, in the couple's own palette and
 * typefaces, and it cannot fall out of step with the section it depicts.
 */

/** The width the section is laid out at before being scaled down. */
const LAYOUT_WIDTH = 1280;

export function SectionPreview({
  section,
  width = 400,
  height = 300,
}: {
  section: Section;
  width?: number;
  height?: number;
}) {
  const scale = width / LAYOUT_WIDTH;

  return (
    <div
      className="ac-section-preview relative overflow-hidden rounded-lg bg-canvas ring-1 ring-border"
      style={{ width, height }}
      aria-hidden
    >
      <div
        style={{
          width: LAYOUT_WIDTH,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          // Tall sections (the hero, a full-bleed photo) are simply cropped at
          // the bottom of the card, which still reads as what they are.
          height: height / scale,
        }}
      >
        <PreviewContentProvider section={section}>
          <SectionView section={section} base="sections.0" />
        </PreviewContentProvider>
      </div>
      {/* A soft fade at the bottom so a cropped section looks deliberate. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/10 to-transparent" />
    </div>
  );
}
