import { oauth } from './config';

/**
 * Web sign-in by full-page redirect (no popup).
 *
 * The popup flow loses its result whenever the browser cuts the popup off from the app window
 * (Google's pages do this), so the first attempt often did nothing. Here the whole tab goes to
 * Google / Facebook and comes back to the site root with the token in the URL fragment;
 * {@link captureRedirectResult} reads it once at startup and the sign-in screen finishes the job.
 * The redirect URI is the site origin, which is what the OAuth clients already list.
 */

export type WebProvider = 'google' | 'facebook';

export type RedirectResult =
  | { provider: WebProvider; token: string }
  | { provider: WebProvider; error: string };

const PENDING_KEY = 'pvm.oauth.pending';

interface Pending { provider: WebProvider; state: string; nonce: string }

const random = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

const redirectUri = () => window.location.origin;

/** Leaves the app for the provider's sign-in page. */
export function startWebSignIn(provider: WebProvider) {
  const pending: Pending = { provider, state: random(), nonce: random() };
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  const url = provider === 'google'
    ? 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id: oauth.googleWebClientId ?? '',
      redirect_uri: redirectUri(),
      response_type: 'id_token',
      scope: 'openid email profile',
      prompt: 'select_account',
      state: pending.state,
      nonce: pending.nonce,
    })
    : 'https://www.facebook.com/v19.0/dialog/oauth?' + new URLSearchParams({
      client_id: oauth.facebookAppId ?? '',
      redirect_uri: redirectUri() + '/',
      response_type: 'token',
      scope: 'public_profile,email',
      state: pending.state,
    });
  window.location.assign(url);
}

let captured: RedirectResult | null = null;

/** Run once at startup, before routing: takes the provider's answer out of the URL. */
export function captureRedirectResult() {
  if (typeof window === 'undefined' || !window.location.hash) return;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const raw = sessionStorage.getItem(PENDING_KEY);
  if (!raw || !params.get('state')) return;
  sessionStorage.removeItem(PENDING_KEY);
  // never leave a token in the address bar or history
  window.history.replaceState(null, '', '/sign-in');
  const pending = JSON.parse(raw) as Pending;
  const { provider } = pending;
  if (params.get('state') !== pending.state) {
    captured = { provider, error: 'state' };
    return;
  }
  const error = params.get('error_description') ?? params.get('error');
  if (error) {
    captured = { provider, error };
    return;
  }
  const token = provider === 'google' ? params.get('id_token') : params.get('access_token');
  if (!token) {
    captured = { provider, error: 'no_token' };
    return;
  }
  if (provider === 'google' && nonceOf(token) !== pending.nonce) {
    captured = { provider, error: 'state' };
    return;
  }
  captured = { provider, token };
}

/** The captured answer, handed out once. */
export function takeRedirectResult(): RedirectResult | null {
  const r = captured;
  captured = null;
  return r;
}

function nonceOf(idToken: string): string | undefined {
  try {
    const payload = idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload)).nonce;
  } catch {
    return undefined;
  }
}
