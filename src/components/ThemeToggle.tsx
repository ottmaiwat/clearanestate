import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../lib/theme';

export const ThemeToggle: React.FC = () => {
  const [theme, toggle] = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggle}
      className="p-2 rounded-xl border bg-stone-100 dark:bg-stone-900 text-stone-700 dark:text-amber-300 border-stone-200 dark:border-stone-800 hover:bg-amber-100/60 dark:hover:bg-stone-800 transition-colors"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      id="theme-toggle-btn"
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
};
