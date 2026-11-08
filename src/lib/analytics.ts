// Google Analytics 4. The server writes the Measurement ID into the page from the
// GA_MEASUREMENT_ID environment variable; with no ID set, nothing here runs.
//
// GA's own "enhanced measurement" (on by default in GA4) counts page views, including
// moving between pages inside the app, so this only loads the tag and forwards a few
// events. It never loads on private pages: an owner's edit page has their private edit
// link in its address, and the admin portal is ours, not visitors'.

declare global {
  interface Window {
    GA_MEASUREMENT_ID?: string;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function isPrivatePage(): boolean {
  return window.location.pathname.replace(/\/+$/, '') === '/edit-listing' || window.location.hash.startsWith('#/admin');
}

export function initAnalytics(): void {
  const id = window.GA_MEASUREMENT_ID;
  if (!id || !/^G-[A-Z0-9]{4,20}$/.test(id) || isPrivatePage()) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // gtag.js expects the arguments object itself, not an array.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', id);

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);
}

// Sends a custom event to GA if it's loaded. Never throws.
export function analyticsEvent(name: string, params?: Record<string, string>): void {
  try {
    if (window.gtag && !isPrivatePage()) window.gtag('event', name, params);
  } catch {
    // Analytics must never break the page.
  }
}
