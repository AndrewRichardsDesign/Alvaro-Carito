import { useEffect, useState } from 'react';
import { ContentProvider } from '@/content/ContentContext';
import { AdminBar } from '@/content/AdminBar';
import { AdminToggle } from '@/components/AdminToggle';
import { ThemeStyle } from '@/components/ThemeStyle';
import { Nav } from '@/components/Nav';
import { SectionCanvas } from '@/sections/SectionCanvas';
import { SharePage } from '@/pages/Share';
import { ADMIN_CHANGE_EVENT, isAdminUnlocked, unlockAdminSession } from '@/lib/adminAuth';

/**
 * Two routes on one page: the wedding site itself, and the guest upload page
 * the QR code points at. Hash routing, so the whole thing stays a static
 * bundle that can be dropped on GitHub Pages with no server rewrites.
 */
function parseLocation(): { route: string; urlAdmin: boolean } {
  const hash = window.location.hash;
  const path = hash.startsWith('#/') ? hash.slice(2).split('?')[0] : '';
  const query = hash.split('?')[1] ?? '';
  const urlAdmin = path === 'admin' || new URLSearchParams(query).has('admin');
  return { route: path === 'admin' ? '' : path, urlAdmin };
}

export default function App() {
  const [route, setRoute] = useState(() => parseLocation().route);
  const [isAdmin, setIsAdmin] = useState(() => parseLocation().urlAdmin || isAdminUnlocked());

  useEffect(() => {
    const sync = () => {
      const { route: next, urlAdmin } = parseLocation();
      if (urlAdmin) unlockAdminSession();
      setRoute(next);
      setIsAdmin(urlAdmin || isAdminUnlocked());
    };
    window.addEventListener('hashchange', sync);
    window.addEventListener(ADMIN_CHANGE_EVENT, sync);
    sync();
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener(ADMIN_CHANGE_EVENT, sync);
    };
  }, []);

  // Landing on #/share shouldn't leave you halfway down the wedding page.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  return (
    <ContentProvider isAdmin={isAdmin}>
      <ThemeStyle />
      <div id="top" className="min-h-svh bg-canvas text-ink">
        {route === 'share' ? (
          <SharePage />
        ) : (
          <>
            <Nav />
            <main>
              <SectionCanvas />
            </main>
            <AdminToggle isAdmin={isAdmin} />
          </>
        )}
      </div>
      <AdminBar />
    </ContentProvider>
  );
}
