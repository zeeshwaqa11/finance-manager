import { useCallback, useEffect, useState } from 'react';

export const THEME_KEY = 'fm-theme';

function readStored() {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function useTheme() {
  const [choice, setChoice] = useState(readStored);
  const theme = choice ?? (systemPrefersDark() ? 'dark' : 'light');

  useEffect(() => {
    if (choice) document.documentElement.dataset.theme = choice;
    else delete document.documentElement.dataset.theme;
  }, [choice]);

  const toggle = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
    setChoice(next);
  }, [theme]);

  return { theme, toggle };
}
