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
  UserCheck
} from 'lucide-react';
import { motion } from 'motion/react';
import { adminLogin } from '../lib/api';

interface AdminPageProps {
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

export const AdminPage: React.FC<AdminPageProps> = ({
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
            { id: 'claims' as const, label: 'Claim Requests', count: claims.length },
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
              <span className="bg-stone-400/50 px-2 py-1 rounded text-xs font-bold">{tab.count}</span>
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
            <h2 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-4">Live Listings ({listings.length})</h2>
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
            <h2 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-4">Quote Requests ({quotes.length})</h2>
            {quotes.length === 0 ? (
              <p className="text-stone-500 dark:text-stone-400">No quote requests</p>
            ) : (
              quotes.map((quote) => (
                <motion.div key={quote.id} className="bg-white dark:bg-stone-800 rounded-xl p-6 border border-stone-200 dark:border-stone-700">
                  <div>
                    <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">{quote.listing_name}</h3>
                    <p className="text-stone-600 dark:text-stone-400">From: {quote.requester_name} ({quote.requester_email})</p>
                    <p className="text-stone-700 dark:text-stone-300 mt-2">{quote.notes}</p>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-2">
                      {quote.emailed_to_business ? '✓ Emailed to business' : 'Not yet emailed'}
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
            <h2 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-4">Claim Requests ({claims.length})</h2>
            {claims.length === 0 ? (
              <p className="text-stone-500 dark:text-stone-400">No claim requests</p>
            ) : (
              claims.map((claim) => (
                <motion.div key={claim.id} className="bg-white dark:bg-stone-800 rounded-xl p-6 border border-stone-200 dark:border-stone-700">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">{claim.listing_name}</h3>
                      <p className="text-stone-600 dark:text-stone-400">{claim.claimant_name} ({claim.claimant_email})</p>
                      {claim.proof_details && <p className="text-stone-700 dark:text-stone-300 mt-2">{claim.proof_details}</p>}
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
      </div>
    </div>
  );
};
