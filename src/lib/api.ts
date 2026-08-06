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

export async function deleteListingAdmin(id: string, password: string): Promise<void> {
  const res = await fetch(`/api/admin/listings/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'x-admin-password': password },
  });
  await parseJsonOrThrow(res);
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
