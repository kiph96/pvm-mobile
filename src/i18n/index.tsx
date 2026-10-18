import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { en, type Dict } from './en';
import { vi } from './vi';

export type Lang = 'vi' | 'en';
export const LANGUAGES: { value: Lang; label: string; flag: string }[] = [
  { value: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { value: 'en', label: 'English', flag: '🇬🇧' },
];
const DICTS: Record<Lang, Dict> = { vi, en };
const STORAGE_KEY = 'pvm.lang';

/** Vietnamese is the main language; English is the alternative. */
let current: Lang = 'vi';

export function currentLang(): Lang {
  return current;
}

type Params = Record<string, string | number | null | undefined>;

/**
 * Translate a dotted key (e.g. "owner.needsOk"). {name} placeholders are filled
 * from params; when params.n === 1 a "<key>_one" variant is preferred.
 * Usable outside React (formatters, demo API) because it reads the current language.
 */
export function t(key: string, params?: Params): string {
  const dict = DICTS[current] as unknown as Record<string, unknown>;
  const lookup = (k: string) => k.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown> | undefined)?.[p], dict);
  let value = params?.n === 1 ? lookup(`${key}_one`) : undefined;
  if (typeof value !== 'string') value = lookup(key);
  if (typeof value !== 'string') return key;
  return params ? value.replace(/\{(\w+)\}/g, (m, p) => (params[p] == null ? m : String(params[p]))) : value;
}

/** Translate an enum-like value (status, role, code) with a readable fallback. */
export function tv(group: 'status' | 'storeStatus' | 'role' | 'code', value: string): string {
  const r = t(`${group}.${value}`);
  return r === `${group}.${value}` ? value.replace(/_/g, ' ').toLowerCase() : r;
}

interface I18nValue { lang: Lang; setLang: (l: Lang) => void; t: typeof t; ready: boolean }
const I18nContext = createContext<I18nValue>({ lang: current, setLang: () => undefined, t, ready: true });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(current);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'vi' || saved === 'en') {
          current = saved;
          setLangState(saved);
        }
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  const setLang = useCallback((l: Lang) => {
    current = l;
    setLangState(l);
    AsyncStorage.setItem(STORAGE_KEY, l).catch(() => undefined);
  }, []);

  // `t` reads the module-level language, so a new object per language re-renders consumers.
  const value = useMemo(() => ({ lang, setLang, t: (k: string, p?: Params) => t(k, p), ready }), [lang, setLang, ready]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
