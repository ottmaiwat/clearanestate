import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ArrowRight, Clock } from 'lucide-react';
import { Guide, GUIDES, guidePath } from '../lib/guides';
import { servicePath } from '../lib/locations';

export const GuidePage: React.FC<{ guide: Guide }> = ({ guide }) => {
  const others = GUIDES.filter((g) => g.slug !== guide.slug);

  return (
    <article className="text-stone-900 dark:text-stone-100" id="guide-page">
      <header className="bg-gradient-to-b from-amber-100/70 via-amber-50/50 to-stone-100 dark:from-stone-900 dark:via-stone-900/60 dark:to-stone-950 border-b border-stone-200 dark:border-stone-800 py-10 sm:py-14 px-4">
        <div className="max-w-3xl mx-auto space-y-4">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-semibold text-stone-500">
            <Link to="/" className="hover:text-amber-700">Home</Link>
            <span>›</span>
            <span className="text-stone-700 dark:text-stone-300">Guides</span>
          </nav>
          <h1 className="text-3xl sm:text-4xl font-serif font-black tracking-tight leading-tight">{guide.title}</h1>
          <p className="text-sm sm:text-base text-stone-600 dark:text-stone-300 font-serif">{guide.description}</p>
          <p className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> {guide.readMinutes} min read
          </p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        {guide.sections.map((section) => (
          <section key={section.heading} className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-serif font-bold">{section.heading}</h2>
            {section.paragraphs?.map((p) => (
              <p key={p} className="text-sm sm:text-base leading-relaxed text-stone-700 dark:text-stone-300">{p}</p>
            ))}
            {section.bullets && (
              <ul className="space-y-2 list-disc pl-5 marker:text-amber-600">
                {section.bullets.map((b) => (
                  <li key={b} className="text-sm sm:text-base leading-relaxed text-stone-700 dark:text-stone-300">{b}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <div className="bg-stone-900 dark:bg-stone-800 text-stone-50 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="font-serif font-bold text-lg">Ready to get quotes?</p>
            <p className="text-sm text-stone-300">Pick your state and city, then call or request a free estimate. Free to use, no sign-up.</p>
          </div>
          <Link
            to={servicePath(guide.serviceSlug)}
            className="shrink-0 inline-flex items-center gap-1.5 px-5 py-3 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-400 text-stone-950 transition-colors"
            id="guide-cta"
          >
            {guide.serviceCta}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <aside className="space-y-3 pt-4 border-t border-stone-200 dark:border-stone-800">
          <h2 className="text-lg font-serif font-bold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-600" /> More guides
          </h2>
          <ul className="grid sm:grid-cols-2 gap-3">
            {others.map((g) => (
              <li key={g.slug}>
                <Link
                  to={guidePath(g.slug)}
                  className="block h-full p-4 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-amber-500 transition-colors"
                >
                  <span className="block font-serif font-bold text-sm">{g.title}</span>
                  <span className="block text-xs text-stone-600 dark:text-stone-400 mt-1">{g.summary}</span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </article>
  );
};
