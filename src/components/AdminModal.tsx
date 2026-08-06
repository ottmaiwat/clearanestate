import React, { useState } from 'react';
import { Listing, PendingSubmission, QuoteRequest, ClaimRequest } from '../types';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Sparkles,
  Trash2,
  RotateCcw,
  PlusCircle,
  Building,
  Search,
  Check,
  ExternalLink,
  Award,
  LogOut,
  Lock,
  Mail,
  UserCheck
} from 'lucide-react';
import { motion } from 'motion/react';
import { adminLogin } from '../lib/api';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  listings: Listing[];
  pending: PendingSubmission[];
  quotes: QuoteRequest[];
  claims: ClaimRequest[];
  onApproveClaim: (claimId: string) => void;
  onRejectClaim: (claimId: string) => void;
  onApprovePending: (submissionId: string) => void;
  onRejectPending: (submissionId: string) => void;
  onToggleFeatured: (listingId: string) => void;
  onDeleteListing: (listingId: string) => void;
  onResetData: () => void;
  dbConfigured: boolean;
  requiresLogin: boolean;
  onLoginSuccess: (password: string) => void;
  onLogout: () => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  listings,
  pending,
  quotes,
  claims,
  onApproveClaim,
  onRejectClaim,
  onApprovePending,
  onRejectPending,
  onToggleFeatured,
  onDeleteListing,
  onResetData,
  dbConfigured,
  requiresLogin,
  onLoginSuccess,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'live' | 'quotes' | 'claims' | 'stats'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  if (!isOpen) return null;

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

  if (requiresLogin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-sm bg-amber-50/95 dark:bg-stone-900 border-2 border-stone-300 dark:border-stone-700 rounded-3xl shadow-2xl overflow-hidden text-stone-900 dark:text-stone-100"
          id="admin-login-modal"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-stone-200/80 dark:bg-stone-700 hover:bg-stone-300 transition-colors"
            id="close-admin-login-btn"
          >
            <X className="w-5 h-5" />
          </button>
          <form onSubmit={handleLogin} className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-amber-900 dark:text-amber-400 font-bold">
              <Lock className="w-4 h-4" /> Admin Portal Login
            </div>
            <h2 className="text-xl font-serif font-bold">Enter Admin Password</h2>
            <input
              type="password"
              autoFocus
              required
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Admin password"
              className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 focus:ring-2 focus:ring-amber-500 outline-hidden text-sm"
              id="admin-password-input"
            />
            {loginError && <p className="text-xs text-red-600 dark:text-red-400">{loginError}</p>}
            <button
              type="submit"
              disabled={loggingIn}
              className="w-full px-4 py-2.5 rounded-xl font-bold bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white transition-colors shadow-xs text-sm"
              id="admin-login-submit-btn"
            >
              {loggingIn ? 'Checking...' : 'Log In'}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  const filteredPending = pending.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.state.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredLive = listings.filter(
    (l) =>
      l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.state.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-4xl bg-amber-50/95 dark:bg-stone-900 border-2 border-stone-300 dark:border-stone-700 rounded-3xl shadow-2xl overflow-hidden my-8 text-stone-900 dark:text-stone-100"
        id="admin-portal-modal"
      >
        {/* Admin Header */}
        <div className="bg-stone-900 text-stone-100 p-6 border-b border-stone-800 relative">
          <div className="absolute top-4 right-4 flex items-center gap-2">
            {dbConfigured && (
              <button
                onClick={onLogout}
                className="p-2 rounded-full bg-stone-800 hover:bg-stone-700 transition-colors text-stone-300"
                title="Log out of Admin Portal"
                id="admin-logout-btn"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-stone-800 hover:bg-stone-700 transition-colors text-stone-300"
              id="close-admin-btn"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-amber-400 font-bold mb-1">
            <ShieldCheck className="w-4 h-4 text-amber-500" /> ClearAnEstate Directory Management Portal
          </div>
          <h2 className="text-2xl font-serif font-bold">Directory Admin Dashboard</h2>

          {/* Admin Subtabs */}
          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                activeTab === 'pending'
                  ? 'bg-amber-500 text-stone-950'
                  : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
              }`}
              id="admin-tab-pending"
            >
              Pending Submissions
              {pending.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-stone-950 text-amber-300 font-mono">
                  {pending.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('live')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                activeTab === 'live'
                  ? 'bg-amber-500 text-stone-950'
                  : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
              }`}
              id="admin-tab-live"
            >
              Live Grid Listings ({listings.length})
            </button>

            <button
              onClick={() => setActiveTab('quotes')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                activeTab === 'quotes'
                  ? 'bg-amber-500 text-stone-950'
                  : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
              }`}
              id="admin-tab-quotes"
            >
              Quote Requests ({quotes.length})
            </button>

            <button
              onClick={() => setActiveTab('claims')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                activeTab === 'claims'
                  ? 'bg-amber-500 text-stone-950'
                  : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
              }`}
              id="admin-tab-claims"
            >
              Claim Requests
              {claims.filter((c) => c.status === 'pending').length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-stone-950 text-amber-300 font-mono">
                  {claims.filter((c) => c.status === 'pending').length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('stats')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                activeTab === 'stats'
                  ? 'bg-amber-500 text-stone-950'
                  : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
              }`}
              id="admin-tab-stats"
            >
              System Stats
            </button>
          </div>
        </div>

        {/* Search Bar for Admin */}
        <div className="px-6 pt-4 flex items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Filter listings or submissions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 text-xs focus:ring-2 focus:ring-amber-500 outline-hidden"
              id="admin-search-input"
            />
          </div>

          <button
            onClick={() => {
              if (confirm('Reset directory data to default 18 seed listings?')) {
                onResetData();
              }
            }}
            className="px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 transition-colors flex items-center gap-1"
            title="Reset to 18 initial seed listings"
            id="reset-seed-data-btn"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Seed Data
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
          {activeTab === 'pending' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  Submissions Queue ({filteredPending.length})
                </h3>
                <p className="text-xs text-stone-500">
                  Approve listings to publish them immediately to the live estate cleanout grid.
                </p>
              </div>

              {filteredPending.length === 0 ? (
                <div className="p-8 text-center bg-stone-100 dark:bg-stone-800/50 rounded-2xl border border-dashed border-stone-300 dark:border-stone-700">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="font-serif font-bold text-base">All caught up!</p>
                  <p className="text-xs text-stone-500 mt-1">No pending business submissions requiring review.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredPending.map((sub) => (
                    <div
                      key={sub.id}
                      className="p-4 bg-white dark:bg-stone-950 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs space-y-2"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-stone-800 text-amber-900 dark:text-amber-300">
                            {sub.category}
                          </span>
                          <h4 className="text-base font-serif font-bold mt-1">{sub.name}</h4>
                          <p className="text-xs text-stone-500">
                            Submitted on {sub.submittedAt} by {sub.contactName} ({sub.email})
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onApprovePending(sub.id)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-1"
                            id={`approve-btn-${sub.id}`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            Approve & Publish
                          </button>

                          <button
                            onClick={() => onRejectPending(sub.id)}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-red-100 hover:text-red-600 transition-colors"
                            id={`reject-btn-${sub.id}`}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-stone-600 dark:text-stone-300">{sub.description}</p>

                      <div className="flex flex-wrap gap-2 text-xs text-stone-500 pt-1 border-t border-stone-100 dark:border-stone-900">
                        <span>📍 {sub.city}, {sub.state}</span>
                        {sub.phone && <span>📞 {sub.phone}</span>}
                        {sub.website && <span>🌐 {sub.website}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'live' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  Live Published Listings ({filteredLive.length})
                </h3>
                <span className="text-xs text-stone-500">
                  Toggle Featured status ($30/mo promo) or remove outdated listings.
                </span>
              </div>

              <div className="space-y-2">
                {filteredLive.map((lst) => (
                  <div
                    key={lst.id}
                    className="p-3 bg-white dark:bg-stone-950 rounded-xl border border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold truncate">{lst.name}</span>
                        {lst.featured && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-stone-950">
                            FEATURED
                          </span>
                        )}
                      </div>
                      <p className="text-stone-500 truncate">
                        {lst.category} • {lst.city}, {lst.state} • Rating: {lst.rating}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onToggleFeatured(lst.id)}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-colors flex items-center gap-1 ${
                          lst.featured
                            ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300 hover:bg-amber-50'
                        }`}
                        title="Toggle Featured Badge"
                        id={`toggle-featured-btn-${lst.id}`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {lst.featured ? 'Featured' : 'Make Featured'}
                      </button>

                      <button
                        onClick={() => {
                          if (confirm(`Delete listing "${lst.name}"?`)) {
                            onDeleteListing(lst.id);
                          }
                        }}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                        title="Delete Listing"
                        id={`delete-btn-${lst.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'quotes' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  Estimate Requests ({quotes.length})
                </h3>
                <p className="text-xs text-stone-500">
                  Requests sent by families/executors to listed businesses via "Request Estimate."
                </p>
              </div>

              {quotes.length === 0 ? (
                <div className="p-8 text-center bg-stone-100 dark:bg-stone-800/50 rounded-2xl border border-dashed border-stone-300 dark:border-stone-700">
                  <Mail className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                  <p className="font-serif font-bold text-base">No estimate requests yet.</p>
                  <p className="text-xs text-stone-500 mt-1">Requests submitted through listing pages will show up here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {quotes.map((q) => (
                    <div
                      key={q.id}
                      className="p-4 bg-white dark:bg-stone-950 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs space-y-2"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h4 className="text-base font-serif font-bold">{q.requesterName}</h4>
                          <p className="text-xs text-stone-500">
                            For {q.listingName} • {q.requesterEmail}{q.requesterPhone ? ` • ${q.requesterPhone}` : ''}
                          </p>
                        </div>
                        <span className="text-xs text-stone-400">{q.submittedAt}</span>
                      </div>

                      <p className="text-xs text-stone-600 dark:text-stone-300">{q.notes || 'No additional details provided.'}</p>

                      <div className="flex flex-wrap gap-2 text-xs text-stone-500 pt-1 border-t border-stone-100 dark:border-stone-900">
                        <span>🏠 {q.propertyType}</span>
                        <span>🎯 {q.projectScope}</span>
                        <span>⏱ {q.timeline}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'claims' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  Claim Requests ({claims.length})
                </h3>
                <p className="text-xs text-stone-500">
                  Requests where the claimant's email domain didn't match the listing's website need manual review.
                </p>
              </div>

              {claims.length === 0 ? (
                <div className="p-8 text-center bg-stone-100 dark:bg-stone-800/50 rounded-2xl border border-dashed border-stone-300 dark:border-stone-700">
                  <UserCheck className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                  <p className="font-serif font-bold text-base">No claim requests yet.</p>
                  <p className="text-xs text-stone-500 mt-1">Requests submitted through "Claim This Listing" will show up here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {claims.map((c) => (
                    <div
                      key={c.id}
                      className="p-4 bg-white dark:bg-stone-950 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs space-y-2"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              c.status === 'approved'
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                : c.status === 'rejected'
                                ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'
                                : 'bg-amber-100 dark:bg-stone-800 text-amber-900 dark:text-amber-300'
                            }`}
                          >
                            {c.status.toUpperCase()}
                          </span>
                          <h4 className="text-base font-serif font-bold mt-1">{c.claimantName}</h4>
                          <p className="text-xs text-stone-500">
                            Claiming {c.listingName} • {c.claimantEmail}{c.claimantPhone ? ` • ${c.claimantPhone}` : ''}
                          </p>
                        </div>

                        {c.status === 'pending' && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => onApproveClaim(c.id)}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-1"
                              id={`approve-claim-btn-${c.id}`}
                            >
                              <Check className="w-3.5 h-3.5" />
                              Approve
                            </button>
                            <button
                              onClick={() => onRejectClaim(c.id)}
                              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-red-100 hover:text-red-600 transition-colors"
                              id={`reject-claim-btn-${c.id}`}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {c.proofDetails && (
                        <p className="text-xs text-stone-600 dark:text-stone-300">{c.proofDetails}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 text-center">
                <span className="text-3xl font-serif font-black text-amber-600">{listings.length}</span>
                <span className="block text-xs font-bold text-stone-500 uppercase mt-1">Live Verified Listings</span>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 text-center">
                <span className="text-3xl font-serif font-black text-amber-500">
                  {listings.filter((l) => l.featured).length}
                </span>
                <span className="block text-xs font-bold text-stone-500 uppercase mt-1">Featured Subscribers</span>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 text-center">
                <span className="text-3xl font-serif font-black text-emerald-600">{pending.length}</span>
                <span className="block text-xs font-bold text-stone-500 uppercase mt-1">Pending Review Queue</span>
              </div>

              <div className="sm:col-span-3 p-4 bg-amber-100/60 dark:bg-stone-800/80 rounded-2xl border border-amber-200 dark:border-stone-700 text-xs text-stone-700 dark:text-stone-300 leading-relaxed">
                <h4 className="font-bold text-amber-950 dark:text-amber-200 mb-1 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-600" /> SEO & Directory Marketing Insight
                </h4>
                Estate cleanouts and senior move management are high-intent localized services. Families and estate attorneys look for transparent credentials (insured, bonded, years in business) and direct phone numbers.
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
