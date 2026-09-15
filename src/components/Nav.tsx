import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useContent } from '@/content/ContentContext';
import { Editable } from '@/content/Editable';
import { cn } from '@/lib/utils';

/**
 * The page navigation, built from whichever sections have been given a nav
 * label. Nothing here is a separate list to maintain: name a section in its
 * settings and it appears, blank the name and it goes.
 */
export function Nav() {
  const { content, isAdmin } = useContent();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // A menu that stays open behind you after a jump is just in the way.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('hashchange', close);
    return () => window.removeEventListener('hashchange', close);
  }, [open]);

  if (!content.nav.enabled) return null;

  const links = content.sections
    .filter((section) => !section.hidden && section.navLabel.trim())
    .map((section) => ({ id: section.id, label: section.navLabel }));

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-500',
        scrolled ? 'bg-canvas/90 shadow-[0_1px_0_0_rgb(var(--ac-line))] backdrop-blur-lg' : 'bg-transparent'
      )}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <a href="#top" className="font-display text-lg tracking-wide text-display">
          <Editable path="nav.brand" as="span" placeholder="A & C" />
        </a>

        <ul className="hidden items-center gap-7 md:flex">
          {links.map((link) => (
            <li key={link.id}>
              <a
                href={`#${link.id}`}
                className="text-[0.7rem] uppercase tracking-[0.18em] text-muted transition-colors hover:text-accent"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <a
            href={content.nav.ctaHref || '#'}
            className={cn(
              'hidden rounded-full border border-accent/40 px-5 py-2 text-[0.68rem] uppercase tracking-[0.18em] text-accent transition-colors hover:border-accent hover:bg-accent/10 sm:inline-block',
              isAdmin && 'pointer-events-auto'
            )}
            onClick={(e) => isAdmin && e.preventDefault()}
          >
            <Editable path="nav.ctaLabel" as="span" placeholder="RSVP" />
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close the menu' : 'Open the menu'}
            aria-expanded={open}
            className="rounded-full p-2 text-ink md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-line bg-canvas/95 backdrop-blur-lg md:hidden">
          <ul className="flex flex-col px-6 py-3">
            {links.map((link) => (
              <li key={link.id}>
                <a
                  href={`#${link.id}`}
                  onClick={() => setOpen(false)}
                  className="block py-2.5 text-[0.75rem] uppercase tracking-[0.18em] text-muted"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
