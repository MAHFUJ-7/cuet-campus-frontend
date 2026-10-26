// Theme controller — port of lib/theme/theme_controller.dart (ThemeMode).
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { KEYS, readInt, writeInt } from '../lib/storage.js';

const ThemeContext = createContext(null);

/** Index-compatible with Flutter's ThemeMode.values positions. */
export const MODES = ['system', 'light', 'dark'];

function resolveDark(mode) {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(() => MODES[readInt(KEYS.themeMode, 0)] ?? 'system');
  const [isDark, setIsDark] = useState(() => resolveDark(MODES[readInt(KEYS.themeMode, 0)] ?? 'system'));

  useEffect(() => {
    setIsDark(resolveDark(mode));
    writeInt(KEYS.themeMode, Math.max(0, MODES.indexOf(mode)));

    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (mode === 'system') setIsDark(media.matches);
    };
    media?.addEventListener?.('change', onChange);
    return () => media?.removeEventListener?.('change', onChange);
  }, [mode]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isDark ? '#0A1628' : '#1A3A6B');
  }, [isDark]);

  const setMode = useCallback((next) => {
    if (MODES.includes(next)) setModeState(next);
  }, []);

  /** Flutter toggleTheme(): light -> dark -> system -> light. */
  const toggleTheme = useCallback(() => {
    setModeState((current) => {
      if (current === 'light') return 'dark';
      if (current === 'dark') return 'system';
      return 'light';
    });
  }, []);

  const value = useMemo(
    () => ({ mode, setMode, toggleTheme, isDark }),
    [mode, setMode, toggleTheme, isDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
