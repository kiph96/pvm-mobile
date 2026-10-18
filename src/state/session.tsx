import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { createAuthApi, createHttpApi, type Actor, type Api, type AuthTokens } from '@/api/http';
import { createMockApi } from '@/api/mock';
import type { OrgRole } from '@/api/types';
import { loadTokens, saveTokens, type StoredTokens } from './tokens';

const STORAGE_KEY = 'pvm.session.v1';
// EXPO_PUBLIC_API_URL is inlined at build time (set by the Docker build / .env); app.json is the fallback.
export const DEFAULT_SERVER = process.env.EXPO_PUBLIC_API_URL
  || (Constants.expoConfig?.extra?.apiUrl as string | undefined)
  || 'http://localhost:8080';

export type AuthMethod = 'google' | 'facebook' | 'dev';

export interface Workspace {
  id: string;
  name: string;
  role: OrgRole;
}

export interface Session {
  mode: 'demo' | 'server';
  serverUrl: string;
  userId: string;
  displayName: string;
  /** first name for greetings (Google given_name / Facebook first_name); absent for demo and older sessions */
  givenName?: string;
  /** How a server session was signed in (absent for demo). */
  method?: AuthMethod;
  workspace: Workspace | null;
}

interface SessionContextValue {
  ready: boolean;
  session: Session | null;
  api: Api;
  isManager: boolean;
  /** Demo sign-in (no tokens). */
  signIn: (s: Omit<Session, 'workspace'>) => Promise<void>;
  /** Server sign-in with tokens returned by /api/auth/*. */
  signInWithTokens: (serverUrl: string, method: AuthMethod, tokens: AuthTokens) => Promise<void>;
  chooseWorkspace: (w: Workspace | null) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const toStored = (t: AuthTokens): StoredTokens => ({
  accessToken: t.accessToken, refreshToken: t.refreshToken, expiresAt: Date.now() + t.expiresIn * 1000,
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;
  // Tokens live outside React state: refreshing them must not re-render or clear caches.
  const tokensRef = useRef<StoredTokens | null>(null);
  const refreshing = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(STORAGE_KEY), loadTokens()])
      .then(([raw, tokens]) => {
        tokensRef.current = tokens;
        if (raw) setSession(JSON.parse(raw));
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  const persist = useCallback(async (next: Session | null) => {
    setSession(next);
    sessionRef.current = next;
    queryClient.clear();
    try {
      if (next) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage unavailable (private browsing); the session still works in memory
    }
  }, [queryClient]);

  const setTokens = useCallback(async (tokens: StoredTokens | null) => {
    tokensRef.current = tokens;
    await saveTokens(tokens);
  }, []);

  const signOut = useCallback(async () => {
    const s = sessionRef.current;
    const t = tokensRef.current;
    if (s?.mode === 'server' && t) createAuthApi(s.serverUrl).logout(t.refreshToken);
    await setTokens(null);
    await persist(null);
  }, [persist, setTokens]);

  /** Single-flight refresh: concurrent 401s share one /api/auth/refresh call. */
  const refresh = useCallback((): Promise<string | null> => {
    if (!refreshing.current) {
      const s = sessionRef.current;
      const t = tokensRef.current;
      refreshing.current = (async () => {
        if (!s || !t) return null;
        try {
          const next = await createAuthApi(s.serverUrl).refresh(t.refreshToken);
          await setTokens(toStored(next));
          return next.accessToken;
        } catch {
          await signOut(); // refresh token expired or revoked: back to sign-in
          return null;
        }
      })().finally(() => { refreshing.current = null; });
    }
    return refreshing.current;
  }, [setTokens, signOut]);

  const actor = useCallback((): Actor => ({
    userId: sessionRef.current?.userId ?? null,
    organizationId: sessionRef.current?.workspace?.id ?? null,
    accessToken: sessionRef.current?.mode === 'server' ? tokensRef.current?.accessToken ?? null : null,
  }), []);

  // The demo API keeps its in-memory data for the whole app run.
  const demoApi = useMemo(() => createMockApi(actor), [actor]);
  const mode = session?.mode ?? 'demo';
  const serverUrl = session?.serverUrl ?? DEFAULT_SERVER;
  const api = useMemo(
    () => (mode === 'demo' ? demoApi : createHttpApi(serverUrl, actor, refresh)),
    [mode, serverUrl, demoApi, actor, refresh],
  );

  const value = useMemo<SessionContextValue>(() => ({
    ready,
    session,
    api,
    isManager: session?.workspace?.role === 'owner' || session?.workspace?.role === 'admin',
    signIn: async (s) => {
      await setTokens(null);
      await persist({ ...s, workspace: null });
    },
    signInWithTokens: async (url, method, tokens) => {
      await setTokens(toStored(tokens));
      await persist({ mode: 'server', serverUrl: url, userId: tokens.user.id, displayName: tokens.user.displayName,
        givenName: tokens.givenName ?? undefined, method, workspace: null });
    },
    chooseWorkspace: async (w) => {
      if (sessionRef.current) await persist({ ...sessionRef.current, workspace: w });
    },
    signOut,
  }), [ready, session, api, persist, setTokens, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}

export function useApi() {
  return useSession().api;
}

/**
 * Name to greet someone with: their first name when the sign-in provider gave one, otherwise the full name.
 * (Taking a word of the display name is wrong half the time: Google shows "Kiên Phạm Trung", Vietnamese
 * order is "Phạm Trung Kiên".)
 */
export function greetingName(session: Pick<Session, 'displayName' | 'givenName'> | null | undefined) {
  return session?.givenName?.trim() || session?.displayName || '';
}
