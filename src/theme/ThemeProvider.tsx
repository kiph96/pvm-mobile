import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';

import { palettes, ThemeContext, type ThemePreference } from './index';

const STORAGE_KEY = 'pvm.theme';

/**
 * Light / dark theme: follows the device by default ("system"), or the user's choice,
 * remembered on this device. Every component reads colors through useTheme(), so switching
 * re-renders the whole app in the new palette.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark' || saved === 'system') setPreferenceState(saved);
      })
      .catch(() => undefined);
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => undefined);
  }, []);

  const scheme: 'light' | 'dark' = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

  // Web: match the page background and native controls (scrollbars, inputs) to the theme,
  // so there is no white flash around the app or mismatched form controls.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const bg = palettes[scheme].background;
    document.documentElement.style.colorScheme = scheme;
    document.documentElement.style.backgroundColor = bg;
    document.body.style.backgroundColor = bg;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
  }, [scheme]);

  const value = useMemo(() => ({ preference, setPreference, scheme }), [preference, setPreference, scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
