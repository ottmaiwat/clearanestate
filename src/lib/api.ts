import { Listing, PendingSubmission, QuoteRequest, ClaimRequest } from '../types';

async function parseJsonOrThrow(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export async function getListingsStatus(): Promise<{ configured: boolean }> {
  const res = await fetch('/api/listings/status');
  return parseJsonOrThrow(res);
}

export async function fetchLiveListings(): Promise<Listing[]> {
  const res = await fetch('/api/listings');
  return parseJsonOrThrow(res);
}

export type SubmitListingPayload = Omit<PendingSubmission, 'id' | 'submittedAt' | 'status'> & { hp?: string };

export async function submitListing(payload: SubmitListingPayload): Promise<PendingSubmission> {
  const res = await fetch('/api/listings/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(res);
}

export async function adminLogin(password: string): Promise<void> {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  await parseJsonOrThrow(res);
}

export async function fetchPendingAdmin(password: string): Promise<PendingSubmission[]> {
  const res = await fetch('/api/admin/pending', {
    headers: { 'x-admin-password': password },
  });
  return parseJsonOrThrow(res);
}

export async function approvePendingAdmin(id: string, password: string): Promise<Listing> {
  const res = await fetch(`/api/admin/pending/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    headers: { 'x-admin-password': password },
  });
  return parseJsonOrThrow(res);
}

export async function rejectPendingAdmin(id: string, password: string): Promise<void> {
  const res = await fetch(`/api/admin/pending/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    headers: { 'x-admin-password': password },
  });
  await parseJsonOrThrow(res);
}

export async function toggleFeaturedAdmin(id: string, password: string): Promise<Listing> {
  const res = await fetch(`/api/admin/listings/${encodeURIComponent(id)}/toggle-featured`, {
    method: 'POST',
    headers: { 'x-admin-password': password },
  });
  return parseJsonOrThrow(res);
}

export async function unclaimListingAdmin(id: string, password: string): Promise<Listing> {
  const res = await fetch(`/api/admin/listings/${encodeURIComponent(id)}/unclaim`, {
    method: 'POST',
    headers: { 'x-admin-password': password },
  });
  return parseJsonOrThrow(res);
}

export async function deleteListingAdmin(id: string, password: string): Promise<void> {
  const res = await fetch(`/api/admin/listings/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'x-admin-password': password },
  });
  await parseJsonOrThrow(res);
}

export type BulkImportRow = {
  name: string;
  category: string;
  city: string;
  state: string;
  phone?: string;
  website?: string;
};

export type BulkImportResult = {
  imported: { row: number; id: string; name: string }[];
  skipped: { row: number; reason: string }[];
};

export async function bulkImportListingsAdmin(rows: BulkImportRow[], password: string): Promise<BulkImportResult> {
  const res = await fetch('/api/admin/listings/bulk-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
    body: JSON.stringify({ listings: rows }),
  });
  return parseJsonOrThrow(res);
}

export type QuoteRequestPayload = {
  listingId: string;
  listingName: string;
  listingEmail?: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone?: string;
  propertyType: string;
  projectScope: string;
  timeline: string;
  notes?: string;
  hp?: string;
};

export async function submitQuoteRequest(payload: QuoteRequestPayload): Promise<{ ok: true; emailed: boolean }> {
  const res = await fetch('/api/listings/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(res);
}

export async function fetchQuoteRequestsAdmin(password: string): Promise<QuoteRequest[]> {
  const res = await fetch('/api/admin/quotes', {
    headers: { 'x-admin-password': password },
  });
  return parseJsonOrThrow(res);
}

export type TestEmailResult = { ok: boolean; error?: string; settings: Record<string, string> };

export async function sendTestEmailAdmin(password: string, to: string, smtpPasswordToTry?: string): Promise<TestEmailResult> {
  const res = await fetch('/api/admin/test-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
    body: JSON.stringify({ to, password: smtpPasswordToTry || undefined }),
  });
  return parseJsonOrThrow(res);
}

export type ClaimRequestPayload = {
  claimantName: string;
  claimantEmail: string;
  claimantPhone?: string;
  proofDetails?: string;
  hp?: string;
};

export async function submitClaimRequest(
  listingId: string,
  payload: ClaimRequestPayload
): Promise<{ status: 'approved' | 'pending' }> {
  const res = await fetch(`/api/listings/${encodeURIComponent(listingId)}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(res);
}

export async function fetchClaimsAdmin(password: string): Promise<ClaimRequest[]> {
  const res = await fetch('/api/admin/claims', {
    headers: { 'x-admin-password': password },
  });
  return parseJsonOrThrow(res);
}

export async function approveClaimAdmin(id: string, password: string): Promise<void> {
  const res = await fetch(`/api/admin/claims/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    headers: { 'x-admin-password': password },
  });
  await parseJsonOrThrow(res);
}

export async function rejectClaimAdmin(id: string, password: string): Promise<void> {
  const res = await fetch(`/api/admin/claims/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    headers: { 'x-admin-password': password },
  });
  await parseJsonOrThrow(res);
}

export type Subscription = {
  listingId: string;
  listingName: string;
  city: string;
  state: string;
  featured: boolean;
  subscriptionId: string;
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean | null;
  amount: number | null;
  interval?: string | null;
  error?: string;
};

export async function fetchSubscriptionsAdmin(password: string): Promise<Subscription[]> {
  const res = await fetch('/api/admin/subscriptions', {
    headers: { 'x-admin-password': password },
  });
  return parseJsonOrThrow(res);
}

export type TrackEventType = 'page_view' | 'listing_view' | 'call' | 'website' | 'directions';

// Fire-and-forget traffic event. sendBeacon survives the page unloading (a tel: link or a
// website click often navigates away immediately), and falls back to a keepalive fetch.
export function trackEvent(type: TrackEventType, listingId?: string): void {
  try {
    const body = JSON.stringify({ type, listingId, path: window.location.pathname });
    const blob = new Blob([body], { type: 'application/json' });
    if (navigator.sendBeacon && navigator.sendBeacon('/api/track', blob)) return;
    fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch {
    // Tracking must never break the page.
  }
}

export type TrafficStats = {
  days: number;
  pageViews: number;
  visitors: number;
  listingViews: number;
  calls: number;
  websiteClicks: number;
  directions: number;
  quoteRequests: number;
  daily: { day: string; visitors: number; contacts: number }[];
  topListings: {
    listingId: string;
    name: string;
    city: string;
    state: string;
    featured: boolean;
    views: number;
    calls: number;
    websiteClicks: number;
    directions: number;
  }[];
  topPages: { path: string; views: number }[];
};

export async function fetchTrafficStatsAdmin(password: string, days = 30): Promise<TrafficStats> {
  const res = await fetch(`/api/admin/stats?days=${days}`, {
    headers: { 'x-admin-password': password },
  });
  return parseJsonOrThrow(res);
}

export type PricingInfo = {
  priceCents: number;
  nextPriceCents: number;
  spotsLeftAtPrice: number;
  paidCount: number;
  cityCap: number;
  city: { name: string; state: string; taken: number } | null;
  listingFeatured: boolean;
};

export async function fetchPricing(listingId?: string): Promise<PricingInfo> {
  const res = await fetch(`/api/pricing${listingId ? `?listingId=${encodeURIComponent(listingId)}` : ''}`);
  return parseJsonOrThrow(res);
}

export type PublicStats = {
  visitors30d: number;
  contacts30d: number;
  listings: number;
  cities: number;
};

export async function fetchPublicStats(): Promise<PublicStats> {
  const res = await fetch('/api/public-stats');
  return parseJsonOrThrow(res);
}

// Starts Stripe Checkout for a listing. The server decides the price and checks the
// city's featured cap; this only returns the Stripe URL to send the browser to.
export async function startFeaturedCheckout(listingId: string): Promise<string> {
  const res = await fetch('/api/stripe/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listingId }),
  });
  const data = await parseJsonOrThrow(res);
  return data.url;
}

export type ListingReport = {
  listingId: string;
  name: string;
  city: string;
  state: string;
  recipient: string | null;
  recipientSource: 'payment' | 'stripe' | 'claim' | 'listing' | null;
  from: string;
  numbers: { views: number; calls: number; websiteClicks: number; directions: number; quotes: number; contacts: number };
  contactsSinceFeatured: number;
  featuredSince: string | null;
  alreadySent: boolean;
  skipReason: string | null;
};

export async function fetchReportsAdmin(password: string, period?: string): Promise<{ period: string; label: string; reports: ListingReport[] }> {
  const res = await fetch(`/api/admin/reports${period ? `?period=${encodeURIComponent(period)}` : ''}`, {
    headers: { 'x-admin-password': password },
  });
  return parseJsonOrThrow(res);
}

export async function sendReportsAdmin(
  password: string,
  period: string
): Promise<{ sent: string[]; skipped: { name: string; reason: string }[]; failed: string[] }> {
  const res = await fetch('/api/admin/reports/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
    body: JSON.stringify({ period }),
  });
  return parseJsonOrThrow(res);
}

export async function requestEditLink(listingId: string, email: string, hp?: string): Promise<{ ok: true }> {
  const res = await fetch(`/api/listings/${encodeURIComponent(listingId)}/edit-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, hp }),
  });
  return parseJsonOrThrow(res);
}

export async function fetchOwnerListing(token: string): Promise<{ listing: Listing; editorEmail: string }> {
  const res = await fetch(`/api/owner/listing?token=${encodeURIComponent(token)}`);
  return parseJsonOrThrow(res);
}

export type OwnerListingEdit = {
  phone: string;
  website: string;
  email: string;
  tagline: string;
  description: string;
  services: string[];
  hours: string;
  address: string;
  yearsInBusiness: string;
  insured: boolean;
  bonded: boolean;
};

export async function saveOwnerListing(token: string, listing: OwnerListingEdit): Promise<{ listing: Listing; changed: number }> {
  const res = await fetch('/api/owner/listing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, listing }),
  });
  return parseJsonOrThrow(res);
}
