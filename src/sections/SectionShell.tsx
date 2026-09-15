import type { ReactNode } from 'react';
import type { Section } from '@/content/types';
import { sectionVars } from '@/lib/theme';
import { useReveal } from '@/hooks/useReveal';
import { cn } from '@/lib/utils';

const WIDTHS: Record<Section['style']['width'], string> = {
  narrow: 'max-w-2xl',
  normal: 'max-w-4xl',
  wide: 'max-w-6xl',
  full: 'max-w-none',
};

const PADDING: Record<Section['style']['padding'], string> = {
  tight: 'py-14 sm:py-16',
  normal: 'py-20 sm:py-28 lg:py-32',
  roomy: 'py-28 sm:py-36 lg:py-44',
};

/**
 * The frame every section sits in: its own colour scope, its width and its
 * vertical rhythm. Sections that bleed to the edge (`width: 'full'`) opt out of
 * the gutter but keep the colour scope, so a full-bleed photo still inherits
 * whatever palette the section was given.
 */
export function SectionShell({
  section,
  className,
  bleed = false,
  children,
}: {
  section: Section;
  className?: string;
  /** Skip the inner container entirely — the child handles its own layout. */
  bleed?: boolean;
  children: ReactNode;
}) {
  const ref = useReveal<HTMLDivElement>();
  const { style } = section;
  const full = style.width === 'full';

  return (
    <section
      id={section.id}
      data-section-type={section.type}
      style={sectionVars(style)}
      className={cn(
        'relative scroll-mt-24 bg-canvas text-ink',
        !bleed && PADDING[style.padding],
        className
      )}
    >
      {bleed ? (
        children
      ) : (
        <div
          ref={ref}
          className={cn(
            'reveal mx-auto w-full',
            full ? 'px-0' : 'px-6 sm:px-8',
            WIDTHS[style.width],
            style.align === 'center' ? 'text-center' : 'text-left'
          )}
        >
          {children}
        </div>
      )}
    </section>
  );
}
