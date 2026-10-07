import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'dd-theme';

const prefersDark = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

const resolve = (mode: ThemeMode) => (mode === 'system' ? (prefersDark() ? 'dark' : 'light') : mode);

/** Writes the class the token definitions hang off, plus a data attribute for CSS hooks. */
function paint(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.toggle('dark', resolve(mode) === 'dark');
  root.dataset.theme = mode;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Private browsing: the theme simply does not persist.
  }
}

const stored = (): ThemeMode => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    // ignored
  }
  return 'system';
};

interface ThemeState {
  mode: ThemeMode;
  resolved: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
  cycle: () => void;
}

export const useTheme = create<ThemeState>((set, get) => ({
  mode: stored(),
  resolved: resolve(stored()),
  setMode: (mode) => {
    paint(mode);
    set({ mode, resolved: resolve(mode) });
  },
  // Keyboard shortcut and the single-button toggle walk the three modes.
  cycle: () => {
    const order: ThemeMode[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(get().mode) + 1) % order.length] as ThemeMode;
    get().setMode(next);
  },
}));

/** Keeps "system" honest when the OS theme changes while the app is open. */
export function watchSystemTheme(): () => void {
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => {
    const { mode, setMode } = useTheme.getState();
    if (mode === 'system') setMode('system');
  };
  query.addEventListener('change', handler);
  return () => query.removeEventListener('change', handler);
}

export { resolve as resolveTheme };
