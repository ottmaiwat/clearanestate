import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Sparkles, Search, MapPin, ShieldCheck, TrendingUp, Trophy, Lock, CheckCircle2, XCircle, ArrowRight, Loader2 } from 'lucide-react';
import { Listing } from '../types';
import { PriceTagCard } from './PriceTagCard';
import { fetchPricing, fetchPublicStats, startFeaturedCheckout, PricingInfo, PublicStats } from '../lib/api';
import { dollars, pricingFor, TIER_SIZE, CITY_CAP, GUARANTEE_CONTACTS } from '../lib/pricing';
import { CONTACT_EMAIL } from '../lib/site';

interface AdvertisePageProps {
  listings: Listing[];
}

// Only show live audience numbers once they're big enough to help the pitch - a brand
// new tracker showing "12 visitors" would do the opposite.
const MIN_VISITORS_TO_SHOW = 200;

const noop = () => {};

const Section: React.FC<{ title: string; kicker?: string; children: React.ReactNode; id?: string }> = ({ title, kicker, children, id }) => (
  <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14" id={id}>
    {kicker && <p className="text-xs font-mono font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400 mb-2">{kicker}</p>}
    <h2 className="text-2xl sm:text-3xl font-serif font-black tracking-tight text-stone-900 dark:text-stone-50 mb-6">{title}</h2>
    {children}
  </section>
);

const FAQS: { q: string; a: string }[] = [
  {
    q: 'My business is already listed. Do I need to do anything first?',
    a: 'No. Find your listing below and get featured from there. If you also want to correct your details, use "Is this your business? Claim it free" on your listing and we’ll update them.',
  },
  {
    q: 'Will my price go up later?',
    a: 'No. You keep the yearly price you signed up at for as long as your subscription stays active. The price only goes up for businesses that join after you.',
  },
  {
    q: 'Where exactly does my listing appear?',
    a: 'At the top of your city’s page and your state’s page, above every standard listing, in the order featured businesses signed up. It also gets a Featured badge everywhere it appears on the site.',
  },
  {
    q: 'Why only 3 featured spots per city?',
    a: 'So the top of the page stays worth paying for. When a city’s 3 spots are taken, new businesses there go on a waitlist until one opens up.',
  },
  {
    q: 'What counts as a contact for the guarantee?',
    a: `A tap on your phone number, a click through to your website, or an estimate request sent from your listing. If you get fewer than ${GUARANTEE_CONTACTS} in your first 12 months, email ${CONTACT_EMAIL} and we’ll refund the full year.`,
  },
  {
    q: 'How do I cancel?',
    a: `Email ${CONTACT_EMAIL} any time. Your listing stays featured until the end of the year you’ve paid for, and you won’t be charged again.`,
  },
];

export const AdvertisePage: React.FC<AdvertisePageProps> = ({ listings }) => {
  const [searchParams] = useSearchParams();
  const [pricing, setPricing] = useState<PricingInfo | null>(null);
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('listing'));
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [extraJobs, setExtraJobs] = useState(2);
  const [jobValue, setJobValue] = useState(2500);

  const selected = selectedId ? listings.find((l) => l.id === selectedId) || null : null;

  useEffect(() => {
    fetchPublicStats().then(setStats).catch(() => {});
  }, []);

  // Arriving from a listing's "Feature this business" link: jump straight to that listing.
  useEffect(() => {
    if (!searchParams.get('listing')) return;
    const timer = setTimeout(() => document.getElementById('find-your-listing')?.scrollIntoView(), 50);
    return () => clearTimeout(timer);
  }, []);

  // Re-fetch when a listing is picked, so the city's spot count is for that listing's city.
  useEffect(() => {
    fetchPricing(selectedId || undefined)
      .then(setPricing)
      .catch(() => setPricing(null));
  }, [selectedId]);

  // Fall back to the opening price if the pricing API is unreachable (e.g. no database).
  const price = pricing ?? { ...pricingFor(0), cityCap: CITY_CAP, city: null, listingFeatured: false };
  const priceText = dollars(price.priceCents);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return listings
      .filter((l) => `${l.name} ${l.city} ${l.state}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, listings]);

  const cityTaken = price.city?.taken ?? 0;
  const cityFull = !!selected && cityTaken >= price.cityCap;
  const alreadyFeatured = !!selected && (selected.featured || price.listingFeatured);

  const handleCheckout = async () => {
    if (!selected) return;
    setCheckingOut(true);
    setCheckoutError(null);
    try {
      window.location.href = await startFeaturedCheckout(selected.id);
    } catch (e: any) {
      setCheckoutError(e.message || 'Could not start checkout. Please try again.');
      setCheckingOut(false);
    }
  };

  const yearlyReturn = extraJobs * jobValue;
  const multiple = Math.floor(yearlyReturn / (price.priceCents / 100));

  // The current price plus the next three steps, each labelled with how many more
  // sign-ups it takes to get there.
  const tiers = [0, 1, 2, 3].map((i) => ({
    label: i === 0 ? `Now (${price.spotsLeftAtPrice} left)` : `After ${price.spotsLeftAtPrice + (i - 1) * TIER_SIZE} more sign-ups`,
    cents: price.priceCents + i * (price.nextPriceCents - price.priceCents),
    current: i === 0,
  }));

  const scrollToFinder = () => document.getElementById('find-your-listing')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="text-stone-900 dark:text-stone-100">
      {/* Hero */}
      <section className="bg-gradient-to-b from-amber-100/70 via-amber-50/50 to-stone-100 dark:from-stone-900 dark:via-stone-900/60 dark:to-stone-950 border-b border-stone-200 dark:border-stone-800 py-12 sm:py-16 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-5">
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400">
            For estate cleanout, senior move & estate sale businesses
          </p>
          <h1 className="text-3xl sm:text-5xl font-serif font-black tracking-tight leading-tight">
            Be the company families <span className="text-amber-700 dark:text-amber-500">call first.</span>
          </h1>
          <p className="text-sm sm:text-base text-stone-600 dark:text-stone-300 font-serif max-w-2xl mx-auto">
            Families, executors and attorneys pick a city and work down the page from the top. Featured puts your business at the
            top of your city&rsquo;s page, with a Featured badge, for one flat yearly price. No per-lead fees, no ad budget.
          </p>
          <button
            onClick={scrollToFinder}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-600 text-stone-950 shadow-md transition-colors"
            id="advertise-hero-cta"
          >
            <Sparkles className="w-4 h-4" />
            Get featured for {priceText}/year
            <ArrowRight className="w-4 h-4" />
          </button>
          <p className="text-xs text-stone-500 dark:text-stone-400 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <span>Price locked while you stay</span>
            <span aria-hidden="true">·</span>
            <span>Only {CITY_CAP} spots per city</span>
            <span aria-hidden="true">·</span>
            <span>Cancel anytime</span>
          </p>
        </div>
      </section>

      {/* Audience numbers */}
      {stats && (
        <div className="border-b border-stone-200 dark:border-stone-800 bg-white/60 dark:bg-stone-900/40">
          <dl className="max-w-5xl mx-auto px-4 py-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {stats.visitors30d >= MIN_VISITORS_TO_SHOW && (
              <>
                <div>
                  <dt className="text-xs text-stone-500 font-semibold">Visitors, last 30 days</dt>
                  <dd className="text-2xl font-black tabular-nums">{stats.visitors30d.toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-xs text-stone-500 font-semibold">Business contacts, last 30 days</dt>
                  <dd className="text-2xl font-black tabular-nums">{stats.contacts30d.toLocaleString()}</dd>
                </div>
              </>
            )}
            <div>
              <dt className="text-xs text-stone-500 font-semibold">Businesses listed</dt>
              <dd className="text-2xl font-black tabular-nums">{stats.listings.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500 font-semibold">Cities covered</dt>
              <dd className="text-2xl font-black tabular-nums">{stats.cities.toLocaleString()}</dd>
            </div>
          </dl>
        </div>
      )}

      {/* Pricing */}
      <Section kicker="Pricing" title={`One plan. The price goes up every ${TIER_SIZE} businesses.`} id="pricing">
        <div className="grid md:grid-cols-2 gap-6 items-start">
          <div className="bg-white dark:bg-stone-900 border-2 border-amber-400 dark:border-amber-500/60 rounded-3xl p-6 shadow-sm">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-serif font-black">{priceText}</span>
              <span className="text-sm font-bold text-stone-500 uppercase tracking-wider">/ year</span>
            </div>
            <p className="text-sm text-stone-600 dark:text-stone-300 mt-2">
              About {dollars(Math.round(price.priceCents / 12))} a month, billed yearly.{' '}
              <strong className="text-amber-700 dark:text-amber-400">
                {price.spotsLeftAtPrice} {price.spotsLeftAtPrice === 1 ? 'sign-up' : 'sign-ups'} left at this price
              </strong>
              , then {dollars(price.nextPriceCents)}/year for new businesses.
            </p>
            <ul className="mt-5 space-y-2 text-sm">
              {[
                'Top of your city and state pages, above every standard listing',
                'Featured badge everywhere your listing appears',
                'Your price is locked for as long as you stay',
                `${GUARANTEE_CONTACTS} contacts in your first year, or your money back`,
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
            <button
              onClick={scrollToFinder}
              className="mt-6 w-full py-3 rounded-xl text-sm font-bold bg-stone-900 hover:bg-amber-600 text-stone-50 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-amber-500 transition-colors"
            >
              Find my listing
            </button>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-stone-600 dark:text-stone-300">
              The first businesses in pay the least, and keep that price for as long as they stay.
            </p>
            <ol className="space-y-2">
              {tiers.map((t) => (
                <li
                  key={t.label}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm ${
                    t.current
                      ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30 font-bold'
                      : 'border-stone-200 dark:border-stone-800 text-stone-500'
                  }`}
                >
                  <span>{t.label}</span>
                  <span className="tabular-nums">{dollars(t.cents)}/yr</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Section>

      {/* Find your listing + preview + checkout */}
      <div className="bg-stone-200/40 dark:bg-stone-900/40 border-y border-stone-200 dark:border-stone-800">
        <Section kicker="Get started" title="Find your business" id="find-your-listing">
          {!selected ? (
            <div className="max-w-xl">
              <label htmlFor="advertise-search" className="text-sm text-stone-600 dark:text-stone-300 block mb-2">
                Your business is probably already listed. Type its name or city, then pick it from the list.
              </label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  id="advertise-search"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. Legacy Auction Group or Kansas City"
                  className="w-full pl-10 pr-3 py-3 rounded-xl text-sm bg-white dark:bg-stone-950 border-2 border-stone-300 dark:border-stone-700 focus:ring-2 focus:ring-amber-500 outline-hidden"
                  autoComplete="off"
                />
              </div>
              {matches.length > 0 && (
                <ul className="mt-2 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden divide-y divide-stone-100 dark:divide-stone-800">
                  {matches.map((l) => (
                    <li key={l.id}>
                      <button
                        onClick={() => {
                          setSelectedId(l.id);
                          setCheckoutError(null);
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-amber-50 dark:hover:bg-stone-800 transition-colors"
                      >
                        <span className="font-semibold text-sm">{l.name}</span>
                        <span className="block text-xs text-stone-500">
                          {l.category} · {l.city}, {l.state}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {query.trim().length >= 2 && matches.length === 0 && (
                <p className="mt-3 text-sm text-stone-500">
                  No match. Add your business for free with &ldquo;Submit Listing&rdquo; at the top of the page, then come back here.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-lg">{selected.name}</p>
                  <p className="text-sm text-stone-500 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {selected.city}, {selected.state} · {selected.category}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedId(null)}
                  className="text-xs font-semibold text-stone-600 dark:text-stone-300 underline underline-offset-2 hover:text-amber-700"
                >
                  Not your business? Search again
                </button>
              </div>

              {pricing?.city && (
                <div className="flex items-center gap-3" aria-label={`${cityTaken} of ${price.cityCap} featured spots taken`}>
                  <div className="flex gap-1.5">
                    {Array.from({ length: price.cityCap }).map((_, i) => (
                      <span
                        key={i}
                        className={`w-8 h-3 rounded-full ${i < cityTaken ? 'bg-stone-400 dark:bg-stone-600' : 'bg-amber-500'}`}
                      />
                    ))}
                  </div>
                  <p className="text-sm font-semibold">
                    {cityFull
                      ? `All ${price.cityCap} featured spots in ${selected.city} are taken`
                      : `${price.cityCap - cityTaken} of ${price.cityCap} featured spots open in ${selected.city}`}
                  </p>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-mono font-bold uppercase tracking-widest text-stone-500 mb-2">Today: standard listing</p>
                  <div className="pointer-events-none opacity-90">
                    <PriceTagCard listing={{ ...selected, featured: false }} onSelect={noop} onClaim={noop} isBookmarked={false} onToggleBookmark={noop} />
                  </div>
                  <p className="text-xs text-stone-500 mt-2">Listed below every featured business in {selected.city}.</p>
                </div>
                <div>
                  <p className="text-xs font-mono font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400 mb-2">Featured: top of the page</p>
                  <div className="pointer-events-none">
                    <PriceTagCard listing={{ ...selected, featured: true }} onSelect={noop} onClaim={noop} isBookmarked={false} onToggleBookmark={noop} />
                  </div>
                  <p className="text-xs text-stone-500 mt-2">Above every standard listing, with the Featured badge.</p>
                </div>
              </div>

              <div className="bg-white dark:bg-stone-900 border-2 border-amber-400 dark:border-amber-500/60 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {alreadyFeatured ? (
                  <p className="font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" /> This listing is already featured.
                  </p>
                ) : cityFull ? (
                  <>
                    <p className="text-sm">
                      {selected.city} is full right now. Join the waitlist and we&rsquo;ll email you when a spot opens, at today&rsquo;s price.
                    </p>
                    <a
                      href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Featured waitlist: ${selected.name} (${selected.city}, ${selected.state})`)}`}
                      className="shrink-0 px-5 py-3 rounded-xl text-sm font-bold bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 text-center"
                    >
                      Join the waitlist
                    </a>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="font-bold">
                        {priceText}/year, locked for as long as you stay
                      </p>
                      <p className="text-xs text-stone-500">Secure checkout with Stripe. Live within a minute. Cancel anytime.</p>
                    </div>
                    <button
                      onClick={handleCheckout}
                      disabled={checkingOut}
                      className="shrink-0 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-stone-950 shadow-md transition-colors"
                      id="advertise-checkout-btn"
                    >
                      {checkingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {checkingOut ? 'Opening checkout…' : `Feature my business: ${priceText}/yr`}
                    </button>
                  </>
                )}
              </div>
              {checkoutError && <p className="text-sm text-red-600 dark:text-red-400">{checkoutError}</p>}
            </div>
          )}
        </Section>
      </div>

      {/* ROI calculator */}
      <Section kicker="The math" title="One job pays for the whole year.">
        <div className="grid md:grid-cols-2 gap-6 items-center">
          <div className="space-y-6">
            <div>
              <label htmlFor="roi-jobs" className="flex justify-between text-sm font-semibold mb-2">
                <span>Extra jobs a year from being at the top</span>
                <span className="tabular-nums text-amber-700 dark:text-amber-400">{extraJobs}</span>
              </label>
              <input id="roi-jobs" type="range" min={1} max={12} value={extraJobs} onChange={(e) => setExtraJobs(Number(e.target.value))} className="w-full accent-amber-600" />
            </div>
            <div>
              <label htmlFor="roi-value" className="flex justify-between text-sm font-semibold mb-2">
                <span>Your average job</span>
                <span className="tabular-nums text-amber-700 dark:text-amber-400">{dollars(jobValue * 100)}</span>
              </label>
              <input id="roi-value" type="range" min={500} max={10000} step={250} value={jobValue} onChange={(e) => setJobValue(Number(e.target.value))} className="w-full accent-amber-600" />
            </div>
          </div>
          <div className="bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 rounded-3xl p-6 text-center">
            <p className="text-sm opacity-80">
              {extraJobs} extra {extraJobs === 1 ? 'job' : 'jobs'} × {dollars(jobValue * 100)}
            </p>
            <p className="text-4xl font-serif font-black my-1 tabular-nums">{dollars(yearlyReturn * 100)}</p>
            <p className="text-sm opacity-80">for {priceText} a year</p>
            <p className="mt-4 text-2xl font-black text-amber-400 dark:text-amber-600">{multiple}× return</p>
          </div>
        </div>
      </Section>

      {/* Featured vs pay-per-lead */}
      <div className="bg-stone-200/40 dark:bg-stone-900/40 border-y border-stone-200 dark:border-stone-800">
        <Section kicker="Compare" title="Pay once a year, not per lead.">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-5 space-y-2 text-sm">
              <p className="font-bold text-base">Pay-per-lead sites and ad platforms</p>
              {['Charge for every lead, including ones that never hire you', 'The same lead is often sold to several companies', 'Monthly ad budgets that add up fast'].map((t) => (
                <p key={t} className="flex gap-2"><XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />{t}</p>
              ))}
            </div>
            <div className="bg-white dark:bg-stone-900 rounded-2xl border-2 border-amber-400 dark:border-amber-500/60 p-5 space-y-2 text-sm">
              <p className="font-bold text-base">Featured on ClearAnEstate</p>
              {[`One flat price: ${priceText} a year`, 'People contact you directly, with no middleman and no lead fees', `Only ${CITY_CAP} featured businesses per city`].map((t) => (
                <p key={t} className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />{t}</p>
              ))}
            </div>
          </div>
        </Section>
      </div>

      {/* Why early */}
      <Section kicker="Why now" title="The early businesses win.">
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { icon: <TrendingUp className="w-5 h-5" />, title: 'The price only goes up', body: `Every ${TIER_SIZE} sign-ups, the price rises for new businesses. Yours stays where it was when you joined.` },
            { icon: <Trophy className="w-5 h-5" />, title: 'First in, first position', body: 'Featured businesses are shown in the order they signed up. Anyone who features after you goes below you.' },
            { icon: <Lock className="w-5 h-5" />, title: `${CITY_CAP} spots per city`, body: 'When your city’s spots are gone, the next business waits for one to open.' },
          ].map((c) => (
            <div key={c.title} className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-5">
              <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 flex items-center justify-center mb-3">{c.icon}</div>
              <p className="font-bold mb-1">{c.title}</p>
              <p className="text-sm text-stone-600 dark:text-stone-300">{c.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* How it works */}
      <div className="bg-stone-200/40 dark:bg-stone-900/40 border-y border-stone-200 dark:border-stone-800">
        <Section kicker="How it works" title="About two minutes, start to finish.">
          <ol className="grid sm:grid-cols-4 gap-4">
            {[
              ['Find your listing', 'Search your business name or city above.'],
              ['Check your city', `See how many of the ${CITY_CAP} featured spots are open.`],
              ['Pay with Stripe', 'Secure card checkout, billed once a year.'],
              ['You’re on top', 'Your listing moves to the top within a minute.'],
            ].map(([title, body], i) => (
              <li key={title} className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-5">
                <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400">STEP {i + 1}</span>
                <p className="font-bold mt-1">{title}</p>
                <p className="text-sm text-stone-600 dark:text-stone-300">{body}</p>
              </li>
            ))}
          </ol>
        </Section>
      </div>

      {/* Guarantee */}
      <Section kicker="Guarantee" title={`${GUARANTEE_CONTACTS} contacts in your first year, or your money back.`}>
        <div className="flex gap-4 items-start bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-2xl p-5">
          <ShieldCheck className="w-8 h-8 text-emerald-600 shrink-0" />
          <p className="text-sm text-stone-700 dark:text-stone-300">
            We count every tap on your phone number, every click to your website, and every estimate request sent from your listing. If your
            featured listing gets fewer than {GUARANTEE_CONTACTS} in its first 12 months, email us and we&rsquo;ll refund the full year.
          </p>
        </div>
      </Section>

      {/* FAQ */}
      <Section kicker="Questions" title="Straight answers.">
        <div className="space-y-2">
          {FAQS.map((f) => (
            <details key={f.q} className="group bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 px-5 py-3">
              <summary className="cursor-pointer font-semibold text-sm list-none flex justify-between gap-3">
                {f.q}
                <span className="text-amber-600 group-open:rotate-45 transition-transform" aria-hidden="true">+</span>
              </summary>
              <p className="text-sm text-stone-600 dark:text-stone-300 mt-2">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>
    </div>
  );
};
