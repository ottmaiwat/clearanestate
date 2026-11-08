import { useEffect, useState } from 'react';

// Light/dark theme. The site is light by default; a visitor who switches to dark (or back)
// has that choice remembered in localStorage. index.html applies the same logic in an
// inline script before first paint so the page never flashes the wrong theme.
export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

function savedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => savedTheme() ?? 'light');

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing can block storage; the choice still applies for this visit.
    }
    setTheme(next);
  };

  return [theme, toggle];
}
