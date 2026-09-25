import { useEffect, useState } from 'react';

const readTheme = () => {
  const css = getComputedStyle(document.documentElement);
  const get = (name) => css.getPropertyValue(name).trim();
  return {
    ink: get('--ink'),
    ink2: get('--ink-2'),
    muted: get('--muted'),
    grid: get('--grid'),
    surface: get('--surface'),
    series: Array.from({ length: 8 }, (_, i) => get(`--series-${i + 1}`)),
  };
};

export function useChartTheme() {
  const [theme, setTheme] = useState(readTheme);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setTheme(readTheme());
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return theme;
}

export function assignCategoryColors(categories, theme) {
  const colors = new Map();
  let slot = 0;
  for (const c of [...categories].sort((a, b) => a.id - b.id)) {
    colors.set(c.id, c.kind !== 'income' && slot < 8 ? theme.series[slot++] : theme.muted);
  }
  return colors;
}
