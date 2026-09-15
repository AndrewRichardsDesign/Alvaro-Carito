import { useEffect } from 'react';
import { useContent } from '@/content/ContentContext';
import { fontHref, themeCss } from '@/lib/theme';

/**
 * Applies the theme from the content document.
 *
 * Colours go in as CSS custom properties on `:root`, so changing a colour in
 * admin mode repaints the site instantly rather than waiting for a rebuild.
 * The Google Fonts stylesheet is swapped in the same way when the couple picks
 * a different family.
 */
export function ThemeStyle() {
  const { content } = useContent();
  const { theme, meta } = content;

  useEffect(() => {
    const href = fontHref(theme.fonts.display, theme.fonts.body);
    const id = 'ac-fonts';
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    if (link.href !== href) link.href = href;
  }, [theme.fonts.display, theme.fonts.body]);

  // Keep the tab title and description in step with the content document.
  useEffect(() => {
    document.title = meta.title || 'Our wedding';
    let tag = document.querySelector('meta[name="description"]');
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute('name', 'description');
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', meta.description || '');
  }, [meta.title, meta.description]);

  return <style>{themeCss(theme)}</style>;
}
