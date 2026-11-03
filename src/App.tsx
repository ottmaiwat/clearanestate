import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { Listing, PendingSubmission, QuoteRequest, ClaimRequest, ListingCategory, FilterState } from './types';
import { INITIAL_LISTINGS, INITIAL_PENDING } from './data/seedListings';
import { listingPath } from './lib/slug';
import { useDocumentMeta } from './lib/useDocumentMeta';
import {
  parseLandingPath,
  landingTitle,
  landingDescription,
  stateName,
  statePath,
  stateSlug,
  citySlug,
  serviceForCategory,
  ALL_SERVICES_SLUG,
  servicePath,
} from './lib/locations';
import { LocationLinks } from './components/LocationLinks';
import { Header } from './components/Header';
import { PriceTagCard } from './components/PriceTagCard';
import { ListingDetailModal } from './components/ListingDetailModal';
import { SubmitListingModal } from './components/SubmitListingModal';
import { AdvertisePage } from './components/AdvertisePage';
import { GuidePage } from './components/GuidePage';
import { EditListingPage } from './components/EditListingPage';
import { HomeStats, BrowseByService, GuidesSection } from './components/HomeSections';
import { parseGuidePath, guidePath } from './lib/guides';
import { AdminPage } from './components/AdminPage';
import { ClaimModal } from './components/ClaimModal';
import { QuoteModal } from './components/QuoteModal';
import { Footer } from './components/Footer';
import { LegalModal } from './components/LegalModal';
import { ShareButton } from './components/ShareButton';
import { Search, Filter, MapPin, Sparkles, SlidersHorizontal, Tag, RotateCcw, CheckCircle2, Bookmark, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  getListingsStatus,
  fetchLiveListings,
  fetchPendingAdmin,
  approvePendingAdmin,
  rejectPendingAdmin,
  toggleFeaturedAdmin,
  deleteListingAdmin,
  fetchQuoteRequestsAdmin,
  fetchClaimsAdmin,
  approveClaimAdmin,
  rejectClaimAdmin,
  bulkImportListingsAdmin,
  BulkImportRow,
  BulkImportResult,
  fetchSubscriptionsAdmin,
  Subscription,
  trackEvent,
} from './lib/api';

const CATEGORIES: ListingCategory[] = [
  'Estate Cleanouts',
  'Senior Move Management',
  'Junk Removal & Hauling',
  'Liquidation & Estate Sales',
  'Content Appraisal & Downsizing'
];

// Cards shown before "Show more", and how many each click adds.
const FIRST_PAGE_SIZE = 12;
const MORE_PAGE_SIZE = 24;

export default function App() {
  // Load listings from localStorage or fallback to initial 18 seed listings
  const [listings, setListings] = useState<Listing[]>(() => {
    const saved = localStorage.getItem('clearanestate_listings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved listings', e);
      }
    }
    return INITIAL_LISTINGS;
  });

  // Load pending submissions from localStorage or fallback
  const [pending, setPending] = useState<PendingSubmission[]>(() => {
    const saved = localStorage.getItem('clearanestate_pending');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved pending', e);
      }
    }
    return INITIAL_PENDING;
  });

  // Quote requests and claim requests only exist once a database is configured - there's
  // no local-only fallback since neither used to be stored anywhere at all.
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [claims, setClaims] = useState<ClaimRequest[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);


  // Bookmarks state
  const [bookmarks, setBookmarks] = useState<string[]>(() => {
    const saved = localStorage.getItem('clearanestate_bookmarks');
    return saved ? JSON.parse(saved) : [];
  });

  // Whether a real backend database is configured on the server. When false, everything
  // falls back to the original localStorage-only demo behavior.
  const [dbConfigured, setDbConfigured] = useState(false);

  // Admin session - the password is only kept in memory (sessionStorage) for this tab,
  // never persisted to localStorage.
  const [adminPassword, setAdminPassword] = useState<string | null>(() =>
    sessionStorage.getItem('clearanestate_admin_password')
  );
  const [adminError, setAdminError] = useState<string | null>(null);

  // Filters State
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    category: 'All',
    state: 'All States',
    featuredOnly: false,
    sortBy: 'featured',
  });

  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Routing - check if we're on the /admin page
  const [isAdminPage, setIsAdminPage] = useState(() => window.location.hash === '#/admin');

  // Which listing (if any) is open, driven by the URL rather than local state - this is
  // what gives each listing its own real, shareable, crawlable URL instead of a modal that
  // only exists in memory.
  const { id: routeListingId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const selectedListing = routeListingId ? listings.find((l) => l.id === routeListingId) || null : null;
  // Exactly one <h1> per view: the hero is the page's h1 on the homepage, but demotes to
  // h2 whenever a listing's own name is the h1 (see ListingDetailModal).
  const HeroHeadingTag = selectedListing ? 'h2' : 'h1';

  // The page behind an open listing: a listing opened from a landing page keeps that page
  // (passed via router state) underneath it, and closing the listing returns there.
  const backgroundPath: string = routeListingId ? (location.state as any)?.from || '/' : location.pathname;

  // State / city / service landing pages (/estate-cleanouts/missouri/kansas-city), derived
  // from the URL so each one is its own real, indexable page.
  const isAdvertisePage = backgroundPath.replace(/\/+$/, '') === '/advertise';
  const guide = parseGuidePath(backgroundPath);
  const isEditListingPage = backgroundPath.replace(/\/+$/, '') === '/edit-listing';
  const landing = parseLandingPath(backgroundPath);
  const landingListings = landing
    ? listings.filter(
        (l) =>
          (!landing.stateCode || l.state === landing.stateCode) &&
          (!landing.service.category || l.category === landing.service.category) &&
          (!landing.citySlug || citySlug(l.city) === landing.citySlug)
      )
    : [];
  const landingCityName = landing?.citySlug ? landingListings[0]?.city ?? null : null;

  // One source of truth for the document title/description, so the listing page and the
  // landing page behind it never fight over it.
  const pageMeta = selectedListing
    ? {
        title: `${selectedListing.name} - ${selectedListing.category} in ${selectedListing.city}, ${selectedListing.state} | ClearAnEstate.com`,
        // Lead with the business name so two unclaimed listings sharing the same category/city
        // (whose tagline is a generic "{category} serving {city}, {state}" placeholder) never
        // end up with byte-identical meta descriptions.
        description: `${selectedListing.name} - ${selectedListing.tagline || selectedListing.description || `${selectedListing.category} services in ${selectedListing.city}, ${selectedListing.state}`}`.slice(0, 160),
        path: listingPath(selectedListing),
      }
    : landing && landingListings.length > 0
    ? {
        title: `${landingTitle(landing, landingCityName)} | ClearAnEstate.com`,
        description: landingDescription(landing, landingCityName, landingListings.length),
        path: backgroundPath.toLowerCase().replace(/\/+$/, ''),
      }
    : isEditListingPage
    ? { title: 'Edit your listing | ClearAnEstate.com', description: '', path: '/edit-listing' }
    : guide
    ? {
        title: `${guide.title} | ClearAnEstate.com`,
        description: guide.description,
        path: guidePath(guide.slug),
      }
    : isAdvertisePage
    ? {
        title: 'Get Your Estate Business Featured | ClearAnEstate.com',
        description: 'Put your estate cleanout, senior move or estate sale business at the top of your city’s page. One flat yearly price, locked while you stay, with only 3 spots per city.',
        path: '/advertise',
      }
    : null;
  useDocumentMeta(pageMeta?.title ?? null, pageMeta?.description ?? null, pageMeta?.path ?? null);

  // The same place (state, or state + city) under a different service.
  const landingPathFor = (serviceSlug: string) => {
    if (!landing) return '/';
    if (!landing.stateCode) return servicePath(serviceSlug);
    if (!landing.citySlug) return statePath(landing.stateCode, serviceSlug);
    return `/${serviceSlug}/${stateSlug(landing.stateCode)}/${landing.citySlug}`;
  };

  // Count a page view on every route change (but not inside the admin portal).
  useEffect(() => {
    if (!isAdminPage) trackEvent('page_view');
  }, [location.pathname, isAdminPage]);

  // Moving between landing pages via internal links should start at the top of the new page.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [backgroundPath]);

  // Modal States
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [claimingListing, setClaimingListing] = useState<Listing | null>(null);
  const [quoteListing, setQuoteListing] = useState<Listing | null>(null);
  const [featuredSuccessBanner, setFeaturedSuccessBanner] = useState(false);
  const [legalModal, setLegalModal] = useState<{ open: boolean; tab: 'privacy' | 'terms' }>({
    open: false,
    tab: 'privacy',
  });

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem('clearanestate_listings', JSON.stringify(listings));
  }, [listings]);

  useEffect(() => {
    localStorage.setItem('clearanestate_pending', JSON.stringify(pending));
  }, [pending]);

  useEffect(() => {
    localStorage.setItem('clearanestate_bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  // On load, check whether the server has a database configured. If it does, pull the
  // real live listings from the API instead of relying on the local seed/localStorage copy.
  useEffect(() => {
    getListingsStatus()
      .then(({ configured }) => {
        setDbConfigured(configured);
        if (configured) {
          fetchLiveListings()
            .then(setListings)
            .catch((e) => console.warn('Failed to load live listings from API', e));
        }
      })
      .catch((e) => console.warn('Failed to reach listings status endpoint', e));
  }, []);

  // Handle the redirect back from Stripe Checkout. The webhook (not this code) is what
  // actually marks the listing featured in the database - we just give the webhook a
  // moment to land, then refresh the grid so the new badge shows up, and surface a banner.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('featured_success') === 'true') {
      setFeaturedSuccessBanner(true);
      window.history.replaceState({}, '', window.location.pathname);

      const timer = setTimeout(() => {
        getListingsStatus()
          .then(({ configured }) => {
            if (configured) {
              fetchLiveListings().then(setListings).catch(() => {});
            }
          })
          .catch(() => {});
      }, 2500);

      return () => clearTimeout(timer);
    } else if (params.get('featured_cancel') === 'true') {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Attempt to load the pending queue and quote requests from the server whenever the
  // admin is authenticated.
  useEffect(() => {
    if (dbConfigured && adminPassword) {
      fetchPendingAdmin(adminPassword)
        .then(setPending)
        .catch((e) => {
          console.warn('Failed to load pending submissions from API', e);
          setAdminPassword(null);
          sessionStorage.removeItem('clearanestate_admin_password');
        });

      fetchQuoteRequestsAdmin(adminPassword)
        .then(setQuotes)
        .catch((e) => console.warn('Failed to load quote requests from API', e));

      fetchClaimsAdmin(adminPassword)
        .then(setClaims)
        .catch((e) => console.warn('Failed to load claim requests from API', e));

      fetchSubscriptionsAdmin(adminPassword)
        .then(setSubscriptions)
        .catch((e) => console.warn('Failed to load subscriptions from API', e));
    }
  }, [dbConfigured, adminPassword]);

  // Handle route changes (hash-based routing)
  useEffect(() => {
    const handleHashChange = () => {
      setIsAdminPage(window.location.hash === '#/admin');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Handle admin login success - navigate to /admin
  const handleAdminLoginSuccess = (password: string) => {
    setAdminPassword(password);
    sessionStorage.setItem('clearanestate_admin_password', password);
    window.location.hash = '#/admin';
    setIsAdminPage(true);
  };

  // Handle admin logout - navigate back to home
  const handleAdminLogout = () => {
    setAdminPassword(null);
    sessionStorage.removeItem('clearanestate_admin_password');
    window.location.hash = '';
    setIsAdminPage(false);
  };

  // Bookmark Handler
  const toggleBookmark = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBookmarks((prev) =>
      prev.includes(id) ? prev.filter((bId) => bId !== id) : [...prev, id]
    );
  };

  // Submit Listing Handler - SubmitListingModal already calls the API itself and passes
  // back either the real server record or a local-only fallback record; either way we
  // just need to add it to the pending queue shown in the Admin Portal.
  const handleAddSubmission = (submission: PendingSubmission) => {
    setPending((prev) => [submission, ...prev]);
  };

  // Reset all data to initial state
  const resetAllData = () => {
    setListings(INITIAL_LISTINGS);
    setPending(INITIAL_PENDING);
    setQuotes([]);
    setClaims([]);
  };

  // Approve Pending Submission -> move to Live Grid
  const handleApprovePending = async (submissionId: string) => {
    if (dbConfigured && adminPassword) {
      try {
        const newListing = await approvePendingAdmin(submissionId, adminPassword);
        setListings((prev) => [newListing, ...prev]);
        setPending((prev) => prev.filter((p) => p.id !== submissionId));
      } catch (e) {
        console.error('Failed to approve submission via API', e);
        alert('Could not approve this submission. Please try again.');
      }
      return;
    }

    const target = pending.find((p) => p.id === submissionId);
    if (!target) return;

    const newListing: Listing = {
      id: 'l-' + Date.now(),
      name: target.name,
      tagline: `Professional ${target.category} in ${target.city}, ${target.state}`,
      category: target.category,
      city: target.city,
      state: target.state,
      phone: target.phone,
      website: target.website,
      description: target.description,
      services: target.services.length > 0 ? target.services : ['Estate Cleanout', 'Downsizing'],
      featured: false,
      rating: 5.0,
      reviewCount: 1,
      insured: true,
      bonded: true,
      hours: 'Mon-Fri: 8:00 AM - 6:00 PM',
      claimed: true,
      createdAt: new Date().toISOString().split('T')[0],
    };

    setListings((prev) => [newListing, ...prev]);
    setPending((prev) => prev.filter((p) => p.id !== submissionId));
  };

  // Reject Pending Submission
  const handleRejectPending = async (submissionId: string) => {
    if (dbConfigured && adminPassword) {
      try {
        await rejectPendingAdmin(submissionId, adminPassword);
      } catch (e) {
        console.error('Failed to reject submission via API', e);
        alert('Could not reject this submission. Please try again.');
        return;
      }
    }
    setPending((prev) => prev.filter((p) => p.id !== submissionId));
  };

  // Approve Pending Claim Request
  const handleApproveClaim = async (claimId: string) => {
    if (!dbConfigured || !adminPassword) return;
    try {
      await approveClaimAdmin(claimId, adminPassword);
      const claim = claims.find((c) => c.id === claimId);
      setClaims((prev) => prev.map((c) => (c.id === claimId ? { ...c, status: 'approved' } : c)));
      if (claim) {
        setListings((prev) => prev.map((l) => (l.id === claim.listingId ? { ...l, claimed: true } : l)));
      }
    } catch (e) {
      console.error('Failed to approve claim via API', e);
      alert('Could not approve this claim. Please try again.');
    }
  };

  // Reject Pending Claim Request
  const handleRejectClaim = async (claimId: string) => {
    if (!dbConfigured || !adminPassword) return;
    try {
      await rejectClaimAdmin(claimId, adminPassword);
      setClaims((prev) => prev.map((c) => (c.id === claimId ? { ...c, status: 'rejected' } : c)));
    } catch (e) {
      console.error('Failed to reject claim via API', e);
      alert('Could not reject this claim. Please try again.');
    }
  };

  // Toggle Featured Status
  const handleToggleFeatured = async (listingId: string) => {
    if (dbConfigured && adminPassword) {
      try {
        const updated = await toggleFeaturedAdmin(listingId, adminPassword);
        setListings((prev) => prev.map((l) => (l.id === listingId ? updated : l)));
      } catch (e) {
        console.error('Failed to toggle featured status via API', e);
        alert('Could not update this listing. Please try again.');
      }
      return;
    }

    setListings((prev) =>
      prev.map((l) => (l.id === listingId ? { ...l, featured: !l.featured } : l))
    );
  };

  // Delete Listing
  const handleDeleteListing = async (listingId: string) => {
    if (dbConfigured && adminPassword) {
      try {
        await deleteListingAdmin(listingId, adminPassword);
      } catch (e) {
        console.error('Failed to delete listing via API', e);
        alert('Could not delete this listing. Please try again.');
        return;
      }
    }
    setListings((prev) => prev.filter((l) => l.id !== listingId));
  };

  // Bulk Import Real Businesses (admin-researched, not self-submitted - inserted as
  // unclaimed/unverified rather than stamped with fake insured/bonded/rating values)
  const handleBulkImport = async (rows: BulkImportRow[]): Promise<BulkImportResult> => {
    if (!dbConfigured || !adminPassword) {
      throw new Error('Bulk import requires a configured database and admin login.');
    }
    const result = await bulkImportListingsAdmin(rows, adminPassword);
    if (result.imported.length > 0) {
      fetchLiveListings().then(setListings).catch(() => {});
    }
    return result;
  };

  // Confirm Claiming
  const handleConfirmClaim = (listingId: string) => {
    setListings((prev) =>
      prev.map((l) => (l.id === listingId ? { ...l, claimed: true } : l))
    );
  };

  // State filter options - derived from whatever states actually have listings, rather
  // than a fixed list, so newly imported/approved listings in a new state show up here too.
  const availableStates = ['All States', ...Array.from(new Set(listings.map((l) => l.state))).sort()];

  // Filter & Search Logic
  const filteredListings = listings.filter((item) => {
    if (showFavoritesOnly && !bookmarks.includes(item.id)) {
      return false;
    }

    // On a landing page the URL decides state/city/service; the dropdown and pills navigate
    // between landing pages instead of filtering.
    if (landing) {
      if (!landingListings.includes(item)) return false;
    } else {
      if (filters.category !== 'All' && item.category !== filters.category) {
        return false;
      }

      if (filters.state !== 'All States' && item.state !== filters.state) {
        return false;
      }
    }

    if (filters.featuredOnly && !item.featured) {
      return false;
    }

    if (filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchCity = item.city.toLowerCase().includes(q);
      const matchState = item.state.toLowerCase().includes(q);
      const matchCat = item.category.toLowerCase().includes(q);
      const matchDesc = item.description.toLowerCase().includes(q);
      const matchServices = item.services.some((s) => s.toLowerCase().includes(q));

      if (!matchName && !matchCity && !matchState && !matchCat && !matchDesc && !matchServices) {
        return false;
      }
    }

    return true;
  });

  // Sorting logic
  const sortedListings = [...filteredListings].sort((a, b) => {
    if (filters.sortBy === 'featured') {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      // Featured listings keep their sign-up order: first to feature stays on top.
      if (a.featured && b.featured) return (a.featuredAt || '').localeCompare(b.featuredAt || '');
      return b.rating - a.rating;
    }
    if (filters.sortBy === 'rating') {
      return b.rating - a.rating;
    }
    if (filters.sortBy === 'name') {
      return a.name.localeCompare(b.name);
    }
    return 0;
  });

  // Show a page of cards at a time so the sections below the grid (locations, guides)
  // stay reachable. Starts over whenever the search, filters or page change; opening a
  // listing keeps the background page, so coming back keeps your place.
  const [visibleCount, setVisibleCount] = useState(FIRST_PAGE_SIZE);
  useEffect(() => {
    setVisibleCount(FIRST_PAGE_SIZE);
  }, [backgroundPath, filters, showFavoritesOnly]);
  const visibleListings = sortedListings.slice(0, visibleCount);
  const remainingCount = sortedListings.length - visibleListings.length;

  // Show admin page if on /admin route
  if (isAdminPage) {
    return (
      <AdminPage
        listings={listings}
        pending={pending}
        quotes={quotes}
        claims={claims}
        subscriptions={subscriptions}
        onApproveClaim={handleApproveClaim}
        onRejectClaim={handleRejectClaim}
        onApprovePending={handleApprovePending}
        onRejectPending={handleRejectPending}
        onToggleFeatured={handleToggleFeatured}
        onDeleteListing={handleDeleteListing}
        onResetData={resetAllData}
        onBulkImport={handleBulkImport}
        dbConfigured={dbConfigured}
        adminPassword={adminPassword}
        requiresLogin={!adminPassword}
        onLoginSuccess={handleAdminLoginSuccess}
        onLogout={handleAdminLogout}
      />
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 dark:bg-stone-950 text-stone-900 dark:text-stone-100 font-sans selection:bg-amber-400 selection:text-stone-950 flex flex-col justify-between">
      <div>
        {/* Header Navigation */}
        <Header
          onOpenSubmitModal={() => setIsSubmitOpen(true)}
          onOpenAdvertise={() => navigate('/advertise')}
          showAdvertiseBanner={!isAdvertisePage}
          bookmarkCount={bookmarks.length}
          onToggleFavoritesOnly={() => setShowFavoritesOnly(!showFavoritesOnly)}
          showFavoritesOnly={showFavoritesOnly}
        />

        {featuredSuccessBanner && (
          <div className="bg-emerald-600 text-white text-center text-xs sm:text-sm font-bold py-2.5 px-4 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Payment received! Your listing will show as Featured shortly.
            <button
              onClick={() => setFeaturedSuccessBanner(false)}
              className="ml-2 underline underline-offset-2 font-semibold"
              id="dismiss-featured-banner-btn"
            >
              Dismiss
            </button>
          </div>
        )}

        {isAdvertisePage ? (
          <AdvertisePage listings={listings} />
        ) : isEditListingPage ? (
          <EditListingPage onSaved={(updated) => setListings((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))} />
        ) : guide ? (
          <GuidePage guide={guide} />
        ) : (
        <>
        {/* Hero Section styled as Estate Sale Price Tag Theme */}
        <section className="bg-gradient-to-b from-amber-100/70 via-amber-50/50 to-stone-100 dark:from-stone-900 dark:via-stone-900/60 dark:to-stone-950 border-b border-stone-200 dark:border-stone-800 py-10 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto text-center space-y-4">
            {landing ? (
              <>
                <nav aria-label="Breadcrumb" className="flex flex-wrap items-center justify-center gap-1.5 text-xs font-semibold text-stone-500">
                  <Link to="/" className="hover:text-amber-700">Home</Link>
                  <span>›</span>
                  {landing.stateCode ? (
                    <Link to={statePath(landing.stateCode, landing.service.slug)} className="hover:text-amber-700">
                      {stateName(landing.stateCode)}
                    </Link>
                  ) : (
                    <span className="text-stone-700 dark:text-stone-300">{landing.service.label}</span>
                  )}
                  {landingCityName && (
                    <>
                      <span>›</span>
                      <span className="text-stone-700 dark:text-stone-300">{landingCityName}</span>
                    </>
                  )}
                </nav>

                <HeroHeadingTag className="text-3xl sm:text-5xl font-serif font-black tracking-tight text-stone-900 dark:text-stone-50 leading-tight">
                  {landingListings.length > 0 || !landing.stateCode ? landingTitle(landing, landingCityName) : `${landing.service.plural} in ${stateName(landing.stateCode)}`}
                </HeroHeadingTag>

                <p className="text-sm sm:text-base text-stone-600 dark:text-stone-300 max-w-2xl mx-auto font-serif">
                  {landingListings.length > 0
                    ? `${landingListings.length} ${landing.stateCode ? 'local ' : ''}${landingListings.length === 1 ? 'company' : 'companies'} listed${landing.stateCode ? '' : '. Pick your state below to see the ones near you'}. Compare services, then call, visit their website, or request a free estimate. Free to use, no sign-up.`
                    : 'We don’t have listings for this area yet. Browse nearby areas below, or add your business for free.'}
                </p>
              </>
            ) : (
              <>
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-serif font-bold bg-amber-200 dark:bg-amber-950/80 text-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800 shadow-2xs">
                  <Tag className="w-3.5 h-3.5 text-amber-700" />
                  {listings.length}+ Estate Cleanout & Senior Downsizing Services Listed
                </div>

                <HeroHeadingTag className="text-3xl sm:text-5xl font-serif font-black tracking-tight text-stone-900 dark:text-stone-50 leading-tight">
                  Find Trusted <span className="text-amber-700 dark:text-amber-500">Estate Cleanout</span> Pros
                </HeroHeadingTag>

                <p className="text-sm sm:text-base text-stone-600 dark:text-stone-300 max-w-2xl mx-auto font-serif">
                  Connecting probate executors, attorneys, and families with insured estate sale liquidators, senior move managers, and whole-house cleanout services.
                </p>
              </>
            )}

            {/* Main Search & Filter Control Bar */}
            <div className="mt-6 bg-white dark:bg-stone-900 p-2.5 sm:p-3 rounded-2xl shadow-xl border-2 border-stone-300 dark:border-stone-700 max-w-3xl mx-auto flex flex-col sm:flex-row items-center gap-2">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  placeholder="Search by city, state, or service name..."
                  value={filters.searchQuery}
                  onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl text-xs sm:text-sm bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 focus:ring-2 focus:ring-amber-500 outline-hidden font-medium"
                  id="main-search-input"
                />
              </div>

              {/* State Filter Dropdown */}
              <div className="w-full sm:w-44">
                <select
                  value={landing ? landing.stateCode ?? 'All States' : filters.state}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === 'All States') {
                      setFilters({ ...filters, state: value });
                      if (landing) navigate(servicePath(landing.service.slug));
                    } else {
                      // Picking a state opens that state's own page.
                      navigate(statePath(value, landing?.service.slug));
                    }
                  }}
                  className="w-full py-2.5 px-3 rounded-xl text-xs sm:text-sm bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 focus:ring-2 focus:ring-amber-500 outline-hidden font-bold"
                  id="main-state-select"
                >
                  {availableStates.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              {/* Reset Search Button if filtering */}
              {(filters.searchQuery || (!landing && (filters.category !== 'All' || filters.state !== 'All States')) || filters.featuredOnly || showFavoritesOnly) && (
                <button
                  onClick={() => {
                    setFilters({
                      searchQuery: '',
                      category: 'All',
                      state: 'All States',
                      featuredOnly: false,
                      sortBy: 'featured',
                    });
                    setShowFavoritesOnly(false);
                  }}
                  className="p-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-600 dark:text-stone-300 transition-colors"
                  title="Clear filters"
                  id="clear-filters-btn"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </div>
            {!landing && <HomeStats listings={listings} />}
          </div>
        </section>

        {!landing && <BrowseByService listings={listings} />}

        {/* Categories Bar & Grid Section */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" id="search-anchor">
          {/* Category Pills & Sorting Bar */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6 pb-4 border-b border-stone-200 dark:border-stone-800">
            {/* Category Pills */}
            <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1 max-w-full">
              <button
                onClick={() => (landing ? navigate(landingPathFor(ALL_SERVICES_SLUG)) : setFilters({ ...filters, category: 'All' }))}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                  (landing ? !landing.service.category : filters.category === 'All')
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-stone-200/80 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-amber-100'
                }`}
                id="cat-pill-all"
              >
                All Categories
              </button>

              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() =>
                    landing ? navigate(landingPathFor(serviceForCategory(cat).slug)) : setFilters({ ...filters, category: cat })
                  }
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                    (landing ? landing.service.category === cat : filters.category === cat)
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-stone-200/80 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-amber-100'
                  }`}
                  id={`cat-pill-${cat.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Sort & Toggle Controls */}
            <div className="flex items-center gap-3 self-end lg:self-auto text-xs font-semibold">
              <label className="flex items-center gap-1.5 cursor-pointer text-stone-700 dark:text-stone-300">
                <input
                  type="checkbox"
                  checked={filters.featuredOnly}
                  onChange={(e) => setFilters({ ...filters, featuredOnly: e.target.checked })}
                  className="rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                  id="featured-only-checkbox"
                />
                <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-bold">
                  <Sparkles className="w-3.5 h-3.5" /> Featured Only
                </span>
              </label>

              <div className="flex items-center gap-1 text-stone-500">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Sort:</span>
                <select
                  value={filters.sortBy}
                  onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as any })}
                  className="bg-transparent font-bold text-stone-800 dark:text-stone-200 outline-hidden cursor-pointer"
                  id="sort-select"
                >
                  <option value="featured">Featured First</option>
                  <option value="rating">Highest Rated</option>
                  <option value="name">Alphabetical</option>
                </select>
              </div>
            </div>
          </div>

          {/* Results Summary Count */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-stone-500">
              Showing {visibleListings.length}
              {remainingCount > 0 ? ` of ${sortedListings.length}` : ''} Price Tag Listings {showFavoritesOnly ? '(Bookmarked)' : ''}
            </span>

            {showFavoritesOnly && (
              <span className="text-xs text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1">
                <Bookmark className="w-3.5 h-3.5 fill-amber-500" /> Showing saved favorites
              </span>
            )}
          </div>

          {/* Grid of Price Tag Cards */}
          {sortedListings.length === 0 ? (
            <div className="p-12 text-center bg-amber-50/50 dark:bg-stone-900/40 rounded-3xl border-2 border-dashed border-stone-300 dark:border-stone-800 my-8 space-y-3">
              <Tag className="w-10 h-10 text-stone-400 mx-auto" />
              <h3 className="text-xl font-serif font-bold">No Estate Service Listings Found</h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                No cleanout businesses matched your criteria. Try adjusting your search query, state selection, or category filter.
              </p>
              <button
                onClick={() => {
                  setFilters({
                    searchQuery: '',
                    category: 'All',
                    state: 'All States',
                    featuredOnly: false,
                    sortBy: 'featured',
                  });
                  setShowFavoritesOnly(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-colors"
                id="empty-reset-btn"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleListings.map((listing) => (
                <PriceTagCard
                  key={listing.id}
                  listing={listing}
                  onSelect={(item) => navigate(listingPath(item), { state: { from: backgroundPath } })}
                  onClaim={(item) => setClaimingListing(item)}
                  isBookmarked={bookmarks.includes(listing.id)}
                  onToggleBookmark={toggleBookmark}
                />
              ))}
            </div>
            {remainingCount > 0 && (
              <div className="flex flex-col items-center gap-2 mt-8">
                <button
                  onClick={() => setVisibleCount((n) => n + MORE_PAGE_SIZE)}
                  className="px-6 py-3 rounded-xl text-sm font-bold bg-stone-900 hover:bg-amber-600 text-stone-50 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-amber-500 transition-colors shadow-sm"
                  id="show-more-listings-btn"
                >
                  Show {Math.min(MORE_PAGE_SIZE, remainingCount)} more
                </button>
                <span className="text-xs text-stone-500 dark:text-stone-400">
                  {remainingCount} more {remainingCount === 1 ? 'listing' : 'listings'}. Or narrow it down with the search, state or service above.
                </span>
              </div>
            )}
            </>
          )}
        </main>

        <LocationLinks listings={listings} landing={landing} cityName={landingCityName} />
        {!landing && <GuidesSection />}
        </>
        )}
      </div>

      {/* Modals Container */}
      <ListingDetailModal
        listing={selectedListing}
        onClose={() => navigate(backgroundPath)}
        onClaim={(item) => {
          navigate(backgroundPath);
          setClaimingListing(item);
        }}
        onRequestQuote={(item) => {
          navigate(backgroundPath);
          setQuoteListing(item);
        }}
        onGetFeatured={(item) => navigate(`/advertise?listing=${encodeURIComponent(item.id)}`)}
      />

      <SubmitListingModal
        isOpen={isSubmitOpen}
        onClose={() => setIsSubmitOpen(false)}
        onSubmit={handleAddSubmission}
      />

      <ClaimModal
        listing={claimingListing}
        onClose={() => setClaimingListing(null)}
        onConfirmClaim={handleConfirmClaim}
      />

      <QuoteModal
        listing={quoteListing}
        onClose={() => setQuoteListing(null)}
      />

      {/* Footer with Admin Portal Link */}
      <Footer
        onOpenAdmin={() => { window.location.hash = '#/admin'; setIsAdminPage(true); }}
        onOpenSubmitModal={() => setIsSubmitOpen(true)}
        onOpenAdvertise={() => navigate('/advertise')}
        onOpenLegal={(tab) => setLegalModal({ open: true, tab })}
      />

      <LegalModal
        isOpen={legalModal.open}
        onClose={() => setLegalModal((prev) => ({ ...prev, open: false }))}
        initialTab={legalModal.tab}
      />

      {/* The advertise page renders its own share button above its sticky pricing bar. The
          owner edit page has none: its address contains the private edit link. */}
      {!isAdvertisePage && !isEditListingPage && (
        <div className="fixed bottom-4 right-4 z-30">
          <ShareButton />
        </div>
      )}
    </div>
  );
}
