// Featured-listing pricing, shared by the server (which charges it) and the advertise page
// (which displays it). One yearly plan; the price steps up after every TIER_SIZE paid
// sign-ups, and each business keeps the price it joined at for as long as it stays.

export const BASE_PRICE_CENTS = 19900; // $199/yr for the first TIER_SIZE businesses
export const STEP_CENTS = 5000; // +$50/yr for each later group
export const TIER_SIZE = 10;
export const CITY_CAP = 3; // featured spots per city
export const GUARANTEE_CONTACTS = 10; // contacts per year, or a full refund

export interface PricingState {
  priceCents: number;
  nextPriceCents: number;
  spotsLeftAtPrice: number; // sign-ups left before the price steps up
  paidCount: number;
}

export function pricingFor(paidCount: number): PricingState {
  const tier = Math.floor(paidCount / TIER_SIZE);
  return {
    priceCents: BASE_PRICE_CENTS + tier * STEP_CENTS,
    nextPriceCents: BASE_PRICE_CENTS + (tier + 1) * STEP_CENTS,
    spotsLeftAtPrice: TIER_SIZE - (paidCount % TIER_SIZE),
    paidCount,
  };
}

export function dollars(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}
