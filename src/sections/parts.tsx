import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Editable } from '@/content/Editable';
import { useContent } from '@/content/ContentContext';
import { cn } from '@/lib/utils';

/** The small letterspaced label above a section title. */
export function Eyebrow({ path, className }: { path: string; className?: string }) {
  return <Editable path={path} as="p" className={cn('eyebrow', className)} placeholder="Eyebrow" hideWhenEmpty />;
}

/** A section's main heading. */
export function Heading({ path, className, as = 'h2' }: { path: string; className?: string; as?: 'h1' | 'h2' | 'h3' }) {
  return (
    <Editable
      path={path}
      as={as}
      className={cn('display-lg mt-4 text-balance', className)}
      placeholder="Section title"
      hideWhenEmpty
    />
  );
}

/** Optional supporting copy under a heading. */
export function Intro({ path, className }: { path: string; className?: string }) {
  return (
    <Editable
      path={path}
      as="p"
      multiline
      hideWhenEmpty
      placeholder="Add an introduction…"
      className={cn('mx-auto mt-5 max-w-xl text-[0.95rem] leading-relaxed text-muted', className)}
    />
  );
}

export function Flourish({ className }: { className?: string }) {
  return (
    <div className={cn('flourish mt-8', className)} aria-hidden>
      <span className="text-[0.7rem]">✦</span>
    </div>
  );
}

/**
 * A call-to-action. The label and the destination are both editable, and in
 * admin mode the link never navigates — clicking it starts editing instead.
 */
export function ActionLink({
  labelPath,
  href,
  className,
  variant = 'solid',
}: {
  labelPath: string;
  href: string;
  className?: string;
  variant?: 'solid' | 'outline';
}) {
  const { isAdmin } = useContent();
  const styles =
    variant === 'solid'
      ? 'bg-accent text-accent-ink hover:brightness-110'
      : 'border border-accent/40 text-accent hover:border-accent hover:bg-accent/10';

  const inner = (
    <>
      <Editable path={labelPath} as="span" placeholder="Button label" />
      <ArrowUpRight className="h-4 w-4 opacity-80 transition-transform group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5" />
    </>
  );

  const classes = cn(
    'group/cta inline-flex items-center gap-2 rounded-full px-7 py-3 text-[0.8rem] font-medium uppercase tracking-[0.18em] transition-all',
    styles,
    className
  );

  // Without a destination there is nothing to navigate to — but the label must
  // still be editable, so it renders as a button rather than a dead link.
  if (isAdmin || !href) {
    return <span className={classes}>{inner}</span>;
  }

  const external = /^https?:/i.test(href);
  return (
    <a
      href={href}
      className={classes}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {inner}
    </a>
  );
}

/** A centred header block: eyebrow, title, intro. */
export function SectionHeader({
  base,
  align = 'center',
  children,
}: {
  /** Path prefix, e.g. "sections.4". */
  base: string;
  align?: 'left' | 'center';
  children?: ReactNode;
}) {
  return (
    <header className={align === 'center' ? 'text-center' : 'text-left'}>
      <Eyebrow path={`${base}.eyebrow`} />
      <Heading path={`${base}.title`} />
      {children}
    </header>
  );
}
