import { useEffect } from 'react';

// Captured once, at module load, from the real index.html values - this is what we restore
// to whenever a page-specific title/description isn't active (e.g. back on the homepage).
const DEFAULT_TITLE = document.title;
const DEFAULT_DESCRIPTION = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';

// Updates document.title, the meta description, and a canonical <link> tag for as long as
// a page-specific value is passed in, and restores the site defaults otherwise. This is a
// client-side-only technique - it helps Google (which renders JS before indexing) treat
// each listing as its own page with its own title/description, but it does NOT help
// non-JS crawlers like social-share link unfurlers; that would require server-side
// rendering, which is a separate, larger project.
export function useDocumentMeta(title: string | null, description: string | null, canonicalPath?: string | null) {
  useEffect(() => {
    if (title && description) {
      document.title = title;

      let metaTag = document.querySelector('meta[name="description"]');
      if (!metaTag) {
        metaTag = document.createElement('meta');
        metaTag.setAttribute('name', 'description');
        document.head.appendChild(metaTag);
      }
      metaTag.setAttribute('content', description);
    } else {
      document.title = DEFAULT_TITLE;
      const metaTag = document.querySelector('meta[name="description"]');
      if (metaTag) metaTag.setAttribute('content', DEFAULT_DESCRIPTION);
    }

    if (canonicalPath) {
      let linkTag = document.querySelector('link[rel="canonical"]');
      if (!linkTag) {
        linkTag = document.createElement('link');
        linkTag.setAttribute('rel', 'canonical');
        document.head.appendChild(linkTag);
      }
      linkTag.setAttribute('href', window.location.origin + canonicalPath);
    } else {
      document.querySelector('link[rel="canonical"]')?.remove();
    }
  }, [title, description, canonicalPath]);

  // Defensive cleanup in case this component ever does unmount somewhere it's used.
  useEffect(() => {
    return () => {
      document.title = DEFAULT_TITLE;
      const metaTag = document.querySelector('meta[name="description"]');
      if (metaTag) metaTag.setAttribute('content', DEFAULT_DESCRIPTION);
      document.querySelector('link[rel="canonical"]')?.remove();
    };
  }, []);
}
