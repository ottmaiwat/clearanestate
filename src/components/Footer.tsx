import React from 'react';
import { ShieldCheck, Tag, Sparkles, Building, Lock } from 'lucide-react';

interface FooterProps {
  onOpenAdmin: () => void;
  onOpenSubmitModal: () => void;
  onOpenFeaturedModal: () => void;
  onOpenLegal: (tab: 'privacy' | 'terms') => void;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenAdmin,
  onOpenSubmitModal,
  onOpenFeaturedModal,
  onOpenLegal,
}) => {
  return (
    <footer className="bg-stone-900 text-stone-300 border-t-2 border-stone-800 mt-16 text-xs font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Col 1: Brand & Tagline */}
          <div className="md:col-span-1 space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500 text-stone-950 font-serif font-black">
                <Tag className="w-5 h-5" />
              </div>
              <span className="font-serif font-bold text-xl text-stone-100">
                ClearAn<span className="text-amber-500">Estate</span>
              </span>
            </div>
            <p className="text-stone-400 text-xs leading-relaxed">
              The premier national directory connecting probate attorneys, executors, and families with verified estate cleanout, senior downsizing, and liquidation specialists.
            </p>
          </div>

          {/* Col 2: Business Actions */}
          <div>
            <h4 className="font-serif font-bold text-stone-100 text-sm mb-3 uppercase tracking-wider text-amber-500">
              For Business Owners
            </h4>
            <ul className="space-y-2 text-stone-400">
              <li>
                <button
                  onClick={onOpenSubmitModal}
                  className="hover:text-amber-400 transition-colors text-left"
                  id="footer-submit-link"
                >
                  Submit Free Business Listing
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenFeaturedModal}
                  className="hover:text-amber-400 transition-colors text-left flex items-center gap-1 text-amber-400 font-semibold"
                  id="footer-get-featured-link"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Get Featured ($30/mo)
                </button>
              </li>
              <li>
                <a href="#search-anchor" className="hover:text-amber-400 transition-colors">
                  Search by State or Category
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Popular Categories */}
          <div>
            <h4 className="font-serif font-bold text-stone-100 text-sm mb-3 uppercase tracking-wider text-amber-500">
              Directory Categories
            </h4>
            <ul className="space-y-1.5 text-stone-400">
              <li>Whole-House Estate Cleanouts</li>
              <li>Senior Move Management (NASMM)</li>
              <li>Junk Removal & Hauling</li>
              <li>Liquidation & Estate Sales</li>
              <li>Content Appraisal & Buyouts</li>
            </ul>
          </div>

          {/* Col 4: SEO Note */}
          <div>
            <h4 className="font-serif font-bold text-stone-100 text-sm mb-3 uppercase tracking-wider text-amber-500">
              SEO & Executor Guidance
            </h4>
            <p className="text-stone-400 text-xs leading-relaxed">
              When liquidating an estate, verify provider insurance and bond status before signing contract terms. Itemized donation receipts reduce tax liabilities for estate heirs.
            </p>
          </div>
        </div>

        {/* Bottom Bar with Footer Admin Link */}
        <div className="pt-8 border-t border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-stone-500">
          <p>© {new Date().getFullYear()} ClearAnEstate.com — All rights reserved.</p>

          <div className="flex items-center gap-6">
            <button
              onClick={() => onOpenLegal('privacy')}
              className="hover:text-amber-400 transition-colors"
              id="footer-privacy-link"
            >
              Privacy Policy
            </button>
            <button
              onClick={() => onOpenLegal('terms')}
              className="hover:text-amber-400 transition-colors"
              id="footer-terms-link"
            >
              Terms of Service
            </button>

            {/* ADMIN LINK AS REQUESTED */}
            <button
              onClick={onOpenAdmin}
              className="text-stone-400 hover:text-amber-400 font-mono font-bold flex items-center gap-1.5 transition-colors underline underline-offset-4"
              id="footer-admin-portal-link"
            >
              <ShieldCheck className="w-4 h-4 text-amber-500" />
              Admin
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
