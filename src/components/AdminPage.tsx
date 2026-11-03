import React, { useState } from 'react';
import { Listing, PendingSubmission, QuoteRequest, ClaimRequest } from '../types';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Sparkles,
  Trash2,
  PlusCircle,
  Building,
  Search,
  Check,
  ExternalLink,
  Award,
  LogOut,
  Lock,
  Mail,
  UserCheck,
  Upload,
  AlertTriangle,
  Copy,
  CreditCard,
  Download
} from 'lucide-react';
import { motion } from 'motion/react';
import { adminLogin, BulkImportRow, BulkImportResult, Subscription, sendTestEmailAdmin, TestEmailResult } from '../lib/api';
import { listingPath } from '../lib/slug';
import { toCsv, downloadCsv } from '../lib/csv';
import { TrafficPanel } from './TrafficPanel';
import { ThemeToggle } from './ThemeToggle';
import { MonthlyReportsPanel } from './MonthlyReportsPanel';

const CATEGORIES = [
  'Estate Cleanouts',
  'Senior Move Management',
  'Junk Removal & Hauling',
  'Liquidation & Estate Sales',
  'Content Appraisal & Downsizing',
];

const AI_IMPORT_PROMPT = `Find real businesses for ClearAnEstate.com's directory in [CITY, STATE].

Search for businesses in these categories (use exactly these category names, nothing else):
- Estate Cleanouts
- Senior Move Management
- Junk Removal & Hauling
- Liquidation & Estate Sales
- Content Appraisal & Downsizing

Rules:
1. Source info from general web search and each business's own website only. Do NOT pull listings from Yelp, Angi, Google Business Profile, HomeAdvisor, or Thumbtack — their Terms of Service prohibit scraping/reusing their business data elsewhere.
2. Only include a phone number if you found it directly in a search result or on the business's own site. Never guess or invent one — leave it blank if unsure.
3. Get the website URL from the business's own domain, not a directory listing page.
4. Aim for 3-5 businesses per category if available. Skip a category for this city if you can't find legitimate results.
5. Flag anything that looks stale (e.g. a site that seems dead, conflicting info) rather than including it silently.

Output format: plain text, one business per line, pipe-delimited, ready to paste directly into ClearAnEstate's Admin Portal Bulk Import tab:

Name | Category | City | State | Phone | Website

Example:
Hearthstone Estate Cleanouts | Estate Cleanouts | Denver | CO | (303) 555-0100 | https://example.com
GreenPath Estate Haulers | Junk Removal & Hauling | Denver | CO | | https://example.com

No extra commentary in the output block itself — just the pipe-delimited lines. Summarize sourcing/caveats separately, after the list.`;

interface AdminPageProps {
  listings: Listing[];
  pending: PendingSubmission[];
  quotes: QuoteRequest[];
  claims: ClaimRequest[];
  subscriptions: Subscription[];
  onApproveClaim: (claimId: string) => void;
  onRejectClaim: (claimId: string) => void;
  onApprovePending: (submissionId: string) => void;
  onRejectPending: (submissionId: string) => void;
  onToggleFeatured: (listingId: string) => void;
  onUnclaimListing: (listingId: string) => void;
  onDeleteListing: (listingId: string) => void;
  onResetData: () => void;
  onBulkImport: (rows: BulkImportRow[]) => Promise<BulkImportResult>;
  dbConfigured: boolean;
  adminPassword: string | null;
  requiresLogin: boolean;
  onLoginSuccess: (password: string) => void;
  onLogout: () => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({
  listings,
  pending,
  quotes,
  claims,
  subscriptions,
  onApproveClaim,
  onRejectClaim,
  onApprovePending,
  onRejectPending,
  onToggleFeatured,
  onUnclaimListing,
  onDeleteListing,
  onResetData,
  onBulkImport,
  dbConfigured,
  adminPassword,
  requiresLogin,
  onLoginSuccess,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'live' | 'quotes' | 'claims' | 'import' | 'subscriptions' | 'stats'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState('');
  const [testSmtpPassword, setTestSmtpPassword] = useState('');
  const [testEmailResult, setTestEmailResult] = useState<TestEmailResult | null>(null);
  const [testEmailError, setTestEmailError] = useState<string | null>(null);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);

  const handleSendTestEmail = async () => {
    setIsSendingTestEmail(true);
    setTestEmailResult(null);
    setTestEmailError(null);
    try {
      setTestEmailResult(await sendTestEmailAdmin(adminPassword, testEmailTo.trim(), testSmtpPassword));
    } catch (err: any) {
      setTestEmailError(err?.message || 'Test email request failed.');
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(AI_IMPORT_PROMPT);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
  };

  const unclaimedListings = listings.filter((l) => !l.claimed);

  const handleExportUnclaimed = () => {
    const csv = toCsv(
      ['Business Name', 'Category', 'City', 'State', 'Phone', 'Website', 'Listing URL', 'Date Added'],
      unclaimedListings.map((l) => [
        l.name,
        l.category,
        l.city,
        l.state,
        l.phone || '',
        l.website || '',
        `${window.location.origin}${listingPath(l)}`,
        l.createdAt,
      ])
    );
    downloadCsv(`clearanestate-unclaimed-listings-${new Date().toISOString().split('T')[0]}.csv`, csv);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError(null);
    try {
      await adminLogin(passwordInput);
      onLoginSuccess(passwordInput);
      setPasswordInput('');
    } catch (err: any) {
      setLoginError(err.message || 'Login failed.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError(null);
    setImportResult(null);

    const rows: BulkImportRow[] = importText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, category, city, state, phone, website] = line.split('|').map((v) => (v || '').trim());
        return { name, category, city, state, phone, website };
      });

    if (rows.length === 0) {
      setImportError('Paste at least one line first.');
      return;
    }

    setIsImporting(true);
    try {
      const result = await onBulkImport(rows);
      setImportResult(result);
      if (result.imported.length > 0) {
        setImportText('');
      }
    } catch (err: any) {
      setImportError(err.message || 'Import failed.');
    } finally {
      setIsImporting(false);
    }
  };

  // Only count claims still needing action in the tab badge - approved/rejected ones are
  // kept for the record but shouldn't make the badge look like there's outstanding work.
  const pendingClaimsCount = claims.filter((c) => c.status === 'pending').length;

  // Pending claims float to the top; resolved ones (approved/rejected) sink to the bottom,
  // so the list stays easy to act on even as rejected/approved history accumulates.
  const sortedClaims = [...claims].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return 0;
  });

  // Login screen
  if (requiresLogin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-stone-100 dark:from-stone-900 dark:to-stone-950 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm bg-white dark:bg-stone-900 border-2 border-stone-300 dark:border-stone-700 rounded-3xl shadow-2xl p-8 text-stone-900 dark:text-stone-100"
        >
          <div className="flex items-center justify-center mb-6">
            <Lock className="w-8 h-8 text-amber-600 mr-3" />
            <h1 className="text-3xl font-bold font-serif">Admin Portal</h1>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-2">Password</label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter admin password"
                className="w-full px-4 py-2 rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-600"
                disabled={loggingIn}
              />
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-red-100/80 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-900 dark:text-red-200 text-sm">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full py-2 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition-colors disabled:opacity-50"
            >
              {loggingIn ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-stone-300 dark:border-stone-700">
            <a href="/" className="text-amber-600 hover:text-amber-700 font-bold text-sm">
              ← Back to Directory
            </a>
          </div>
        </motion.div>
      </div>
    );
  }

  // Admin dashboard
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-stone-100 dark:from-stone-900 dark:to-stone-950">
      {/* Header */}
      <div className="bg-white dark:bg-stone-900 border-b-2 border-stone-200 dark:border-stone-700 p-6 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-amber-600" />
            <h1 className="text-3xl font-bold font-serif text-stone-900 dark:text-stone-100">Admin Portal</h1>
          </div>
          <div className="flex items-center gap-4">
            {dbConfigured && <span className="text-sm text-green-600 font-bold">Database Connected</span>}
            <ThemeToggle />
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors font-bold"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-700 p-6">
        <div className="max-w-7xl mx-auto flex gap-2 flex-wrap">
          {[
            { id: 'pending' as const, label: 'Pending Submissions', count: pending.length },
            { id: 'live' as const, label: 'Live Listings', count: listings.length },
            { id: 'quotes' as const, label: 'Quote Requests', count: quotes.length },
            { id: 'claims' as const, label: 'Claim Requests', count: pendingClaimsCount },
            { id: 'import' as const, label: 'Bulk Import', count: null },
            { id: 'subscriptions' as const, label: 'Subscriptions', count: subscriptions.length },
            { id: 'stats' as const, label: 'Traffic', count: null },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl font-bold transition-colors flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-amber-600 text-white'
                  : 'bg-stone-200/80 dark:bg-stone-700 text-stone-700 dark:text-stone-300 hover:bg-amber-200/60'
              }`}
            >
              {tab.label}
              {tab.count !== null && (
                <span className="bg-stone-400/50 px-2 py-1 rounded text-xs font-bold">{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-6">
        {/* Pending Submissions */}
        {activeTab === 'pending' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-4">Pending Submissions</h2>
            {pending.length === 0 ? (
              <p className="text-stone-500 dark:text-stone-400">No pending submissions</p>
            ) : (
              pending.map((sub) => (
                <motion.div key={sub.id} className="bg-white dark:bg-stone-800 rounded-xl p-6 border border-stone-200 dark:border-stone-700">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-stone-900 dark:text-stone-100">{sub.name}</h3>
                      <p className="text-stone-600 dark:text-stone-400">{sub.email}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onApprovePending(sub.id)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors font-bold text-sm"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Approve
                      </button>
                      <button
                        onClick={() => onRejectPending(sub.id)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors font-bold text-sm"
                      >
                        <XCircle className="w-4 h-4" /> Reject
                      </button>
                    </div>
                  </div>
                  <p className="text-stone-700 dark:text-stone-300">{sub.description}</p>
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* Live Listings */}
        {activeTab === 'live' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="text-2xl font-bold text-stone-900 dark:text-stone-100">Live Listings ({listings.length})</h2>
              <button
                onClick={handleExportUnclaimed}
                disabled={unclaimedListings.length === 0}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-300 dark:hover:bg-stone-600 transition-colors font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" /> Export Unclaimed ({unclaimedListings.length}) CSV
              </button>
            </div>
            {listings.map((listing) => (
              <motion.div key={listing.id} className="bg-white dark:bg-stone-800 rounded-xl p-6 border border-stone-200 dark:border-stone-700">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-xl font-bold text-stone-900 dark:text-stone-100">{listing.name}</h3>
                      {listing.featured && <Sparkles className="w-5 h-5 text-amber-500" />}
                    </div>
                    <p className="text-stone-600 dark:text-stone-400">{listing.city}, {listing.state}</p>
                  </div>
                  <div className="flex gap-2">
                    {listing.claimed && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Remove the claim on ${listing.name}? It goes back to unclaimed, and edit links sent to the claimant stop working.`)) {
                            onUnclaimListing(listing.id);
                          }
                        }}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-stone-100 dark:bg-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-600 transition-colors font-bold text-sm"
                        id={`unclaim-btn-${listing.id}`}
                      >
                        <UserCheck className="w-4 h-4" /> Remove claim
                      </button>
                    )}
                    <button
                      onClick={() => onToggleFeatured(listing.id)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors font-bold text-sm"
                    >
                      <Sparkles className="w-4 h-4" /> {listing.featured ? 'Unfeature' : 'Feature'}
                    </button>
                    <button
                      onClick={() => onDeleteListing(listing.id)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors font-bold text-sm"
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Quote Requests */}
        {activeTab === 'quotes' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-stone-800 rounded-xl p-4 border border-stone-200 dark:border-stone-700" id="test-email-panel">
              <h3 className="font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2"><Mail className="w-4 h-4" /> Email check</h3>
              <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">Sends a test email using the site's email settings and shows the exact error if it fails.</p>
              <div className="flex flex-col sm:flex-row gap-2 mt-3">
                <input
                  type="email"
                  value={testEmailTo}
                  onChange={(e) => setTestEmailTo(e.target.value)}
                  placeholder="Send test to (your email)"
                  className="flex-1 px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 text-sm"
                  id="test-email-to"
                />
                <input
                  type="password"
                  value={testSmtpPassword}
                  onChange={(e) => setTestSmtpPassword(e.target.value)}
                  placeholder="Mailbox password to try (optional)"
                  autoComplete="new-password"
                  className="flex-1 px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 text-sm"
                  id="test-email-password"
                />
                <button
                  onClick={handleSendTestEmail}
                  disabled={isSendingTestEmail || !testEmailTo.trim()}
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-bold"
                  id="send-test-email-btn"
                >
                  {isSendingTestEmail ? 'Sending…' : 'Send test email'}
                </button>
              </div>
              {testEmailError && <p className="text-sm text-red-600 mt-3">{testEmailError}</p>}
              {testEmailResult && (
                <div className="mt-3 text-sm">
                  <p className={testEmailResult.ok ? 'text-green-700 dark:text-green-400 font-bold' : 'text-red-600 font-bold'}>
                    {testEmailResult.ok ? '✓ Sent. Check that inbox (and Spam).' : `✗ Failed: ${testEmailResult.error}`}
                  </p>
                  <ul className="mt-2 font-mono text-xs text-stone-600 dark:text-stone-400 space-y-0.5">
                    {Object.entries(testEmailResult.settings).map(([name, value]) => (
                      <li key={name}>{name}: {value}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <h2 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-4">Quote Requests ({quotes.length})</h2>
            {quotes.length === 0 ? (
              <p className="text-stone-500 dark:text-stone-400">No quote requests</p>
            ) : (
              quotes.map((quote) => (
                <motion.div key={quote.id} className="bg-white dark:bg-stone-800 rounded-xl p-6 border border-stone-200 dark:border-stone-700">
                  <div>
                    <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">{quote.listingName}</h3>
                    <p className="text-stone-600 dark:text-stone-400">From: {quote.requesterName} ({quote.requesterEmail})</p>
                    <p className="text-stone-700 dark:text-stone-300 mt-2">{quote.notes}</p>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-2">
                      {quote.emailed ? '✓ Emailed to business' : 'Not yet emailed'}
                    </p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* Claim Requests */}
        {activeTab === 'claims' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-4">
              Claim Requests ({pendingClaimsCount} pending, {claims.length} total)
            </h2>
            {claims.length === 0 ? (
              <p className="text-stone-500 dark:text-stone-400">No claim requests</p>
            ) : (
              sortedClaims.map((claim) => (
                <motion.div key={claim.id} className="bg-white dark:bg-stone-800 rounded-xl p-6 border border-stone-200 dark:border-stone-700">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">{claim.listingName}</h3>
                      <p className="text-stone-600 dark:text-stone-400">{claim.claimantName} ({claim.claimantEmail})</p>
                      {claim.proofDetails && <p className="text-stone-700 dark:text-stone-300 mt-2">{claim.proofDetails}</p>}
                    </div>
                    {claim.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => onApproveClaim(claim.id)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors font-bold text-sm"
                        >
                          <Check className="w-4 h-4" /> Approve
                        </button>
                        <button
                          onClick={() => onRejectClaim(claim.id)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors font-bold text-sm"
                        >
                          <XCircle className="w-4 h-4" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* Bulk Import */}
        {activeTab === 'import' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-4">Bulk Import Real Businesses</h2>

            <div className="p-4 rounded-xl bg-amber-100/80 dark:bg-stone-800/80 border border-amber-300 dark:border-stone-700 text-amber-900 dark:text-amber-200 text-sm flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>
                Use this for businesses you've found yourself (e.g. from public research), not self-submitted. Imported listings are marked <strong>unclaimed and unverified</strong> — no insured/bonded badges or rating are added, since we haven't confirmed those facts with the business. Invite them to claim their listing to fill in the rest.
              </span>
            </div>

            <form onSubmit={handleImport} className="space-y-3 bg-white dark:bg-stone-800 rounded-xl p-6 border border-stone-200 dark:border-stone-700">
              <label className="block text-sm font-bold text-stone-600 dark:text-stone-400">
                One business per line: <code className="bg-stone-200 dark:bg-stone-700 px-1.5 py-0.5 rounded text-xs">Name | Category | City | State | Phone | Website</code>
                <br />
                <span className="font-normal text-xs">Phone and Website are optional. Category must match one of: {CATEGORIES.join(', ')}</span>
              </label>
              <textarea
                rows={8}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={`Example Estate Co | Estate Cleanouts | Denver | CO | (303) 555-0100 | https://example.com\nAnother Business | Junk Removal & Hauling | Austin | TX | |`}
                className="w-full px-4 py-2 rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-950 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
              {importError && (
                <div className="p-3 rounded-xl bg-red-100/80 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-900 dark:text-red-200 text-sm">
                  {importError}
                </div>
              )}
              <button
                type="submit"
                disabled={isImporting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition-colors disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {isImporting ? 'Importing...' : 'Import Listings'}
              </button>
            </form>

            {importResult && (
              <div className="bg-white dark:bg-stone-800 rounded-xl p-6 border border-stone-200 dark:border-stone-700 space-y-2">
                <p className="font-bold text-green-700 dark:text-green-400">
                  {importResult.imported.length} imported
                  {importResult.skipped.length > 0 && `, ${importResult.skipped.length} skipped`}
                </p>
                {importResult.skipped.length > 0 && (
                  <ul className="text-sm text-stone-600 dark:text-stone-300 space-y-1">
                    {importResult.skipped.map((s) => (
                      <li key={s.row}>Line {s.row}: {s.reason}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="bg-white dark:bg-stone-800 rounded-xl p-6 border border-stone-200 dark:border-stone-700 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-stone-600 dark:text-stone-400">
                  Reusable AI Prompt Template
                </h3>
                <button
                  onClick={handleCopyPrompt}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-700 hover:bg-stone-200 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-200 font-semibold text-xs transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {promptCopied ? 'Copied!' : 'Copy Prompt'}
                </button>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Paste this into Claude (or another AI) with a city/state swapped in for <code className="bg-stone-200 dark:bg-stone-700 px-1 py-0.5 rounded">[CITY, STATE]</code> to source a new batch in the format above.
              </p>
              <pre className="w-full p-4 rounded-xl border border-stone-300 dark:border-stone-600 bg-stone-50 dark:bg-stone-950 font-mono text-xs whitespace-pre-wrap text-stone-700 dark:text-stone-300 max-h-64 overflow-y-auto">
                {AI_IMPORT_PROMPT}
              </pre>
            </div>
          </div>
        )}

        {/* Subscriptions */}
        {activeTab === 'subscriptions' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-4">Subscriptions ({subscriptions.length})</h2>

            <MonthlyReportsPanel adminPassword={adminPassword} />

            <div className="p-4 rounded-xl bg-amber-100/80 dark:bg-stone-800/80 border border-amber-300 dark:border-stone-700 text-amber-900 dark:text-amber-200 text-sm flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>
                This is read-only visibility into who's paying for Featured — it doesn't send anything. For renewal/payment-failed reminder emails, turn those on in your Stripe Dashboard under Settings → Billing → Customer emails; Stripe sends those automatically.
              </span>
            </div>

            {subscriptions.length === 0 ? (
              <p className="text-stone-500 dark:text-stone-400">No businesses have subscribed to Featured yet.</p>
            ) : (
              subscriptions.map((sub) => (
                <motion.div key={sub.subscriptionId} className="bg-white dark:bg-stone-800 rounded-xl p-6 border border-stone-200 dark:border-stone-700">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">{sub.listingName}</h3>
                        {sub.featured && <Sparkles className="w-4 h-4 text-amber-500" />}
                      </div>
                      <p className="text-stone-600 dark:text-stone-400 text-sm">{sub.city}, {sub.state}</p>
                    </div>

                    {sub.error ? (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-200">
                        Couldn't load from Stripe
                      </span>
                    ) : (
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                          sub.status === 'active'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-200'
                            : 'bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        {sub.status || 'unknown'}
                      </span>
                    )}
                  </div>

                  {sub.error ? (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-2">{sub.error}</p>
                  ) : (
                    <div className="flex flex-wrap gap-4 mt-3 text-sm text-stone-600 dark:text-stone-300">
                      {sub.amount !== null && (
                        <span className="flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5 text-amber-600" />
                          ${(sub.amount / 100).toFixed(2)}/{sub.interval === 'year' ? 'yr' : 'mo'}
                        </span>
                      )}
                      {sub.currentPeriodEnd && (
                        <span>
                          {sub.cancelAtPeriodEnd ? 'Cancels on' : 'Renews on'} <strong>{sub.currentPeriodEnd}</strong>
                        </span>
                      )}
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </div>
        )}

        {activeTab === 'stats' && <TrafficPanel adminPassword={adminPassword} dbConfigured={dbConfigured} />}
      </div>
    </div>
  );
};
