import * as Facebook from 'expo-auth-session/providers/facebook';
import * as Google from 'expo-auth-session/providers/google';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { createAuthApi, type AuthProviders } from '@/api/http';
import { useToast } from '@/components/toast';
import { Button, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useSession, type AuthMethod } from '@/state/session';
import { errorMessage } from '@/utils/format';
import { facebookConfigured, googleConfigured, oauth } from './config';

type Exchange = (method: AuthMethod, providerToken: string) => Promise<void>;

/**
 * "Continue with Google / Facebook". The provider token is sent to pvm-backend, which verifies
 * it and returns the app's own tokens. A button is shown disabled when this build or the
 * server is not configured for that provider.
 */
export function SocialButtons({ serverUrl, onSignedIn }: { serverUrl: string; onSignedIn: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const { signInWithTokens } = useSession();
  const [server, setServer] = useState<AuthProviders | null>(null);
  const [busy, setBusy] = useState<AuthMethod | null>(null);

  useEffect(() => {
    let live = true;
    createAuthApi(serverUrl).providers().then((p) => live && setServer(p));
    return () => { live = false; };
  }, [serverUrl]);

  const exchange: Exchange = async (method, providerToken) => {
    setBusy(method);
    try {
      const api = createAuthApi(serverUrl);
      const tokens = method === 'google' ? await api.google(providerToken) : await api.facebook(providerToken);
      await signInWithTokens(serverUrl, method, tokens);
      if (tokens.newUser) toast(t('auth.welcomeNew', { name: tokens.user.displayName }));
      onSignedIn();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const googleReady = googleConfigured() && !!server?.google;
  const facebookReady = facebookConfigured() && !!server?.facebook;
  return (
    <View style={{ gap: 10 }}>
      {googleReady
        ? <GoogleButton busy={busy === 'google'} onToken={(tok) => exchange('google', tok)} onError={(m) => toast(m, 'error')} />
        : <Button title={t('signIn.google')} icon="logo-google" variant="secondary" disabled full />}
      {facebookReady
        ? <FacebookButton busy={busy === 'facebook'} onToken={(tok) => exchange('facebook', tok)} onError={(m) => toast(m, 'error')} />
        : <Button title={t('auth.facebook')} icon="logo-facebook" variant="secondary" disabled full />}
      {!googleReady || !facebookReady ? (
        <Txt variant="small" muted>
          {server == null ? t('common.loading')
            : !server.google && !server.facebook ? t('auth.serverNotConfigured')
              : t('auth.partlyConfigured')}
        </Txt>
      ) : null}
    </View>
  );
}

interface ProviderButtonProps { busy: boolean; onToken: (token: string) => void; onError: (message: string) => void }

function GoogleButton({ busy, onToken, onError }: ProviderButtonProps) {
  const { t } = useI18n();
  // OpenID Connect implicit flow: Google returns an ID token signed for our client ID.
  const [request, response, prompt] = Google.useIdTokenAuthRequest({
    webClientId: oauth.googleWebClientId,
    iosClientId: oauth.googleIosClientId,
    androidClientId: oauth.googleAndroidClientId,
    selectAccount: true,
  });
  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.params.id_token ?? response.authentication?.idToken;
      if (idToken) onToken(idToken);
      else onError(t('auth.noToken'));
    } else if (response?.type === 'error') {
      onError(response.error?.message ?? t('auth.failed'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);
  return <Button title={t('signIn.google')} icon="logo-google" variant="secondary" full loading={busy} disabled={!request}
    onPress={() => prompt()} />;
}

function FacebookButton({ busy, onToken, onError }: ProviderButtonProps) {
  const { t } = useI18n();
  const [request, response, prompt] = Facebook.useAuthRequest({ clientId: oauth.facebookAppId, scopes: ['public_profile', 'email'] });
  useEffect(() => {
    if (response?.type === 'success') {
      const token = response.authentication?.accessToken ?? response.params.access_token;
      if (token) onToken(token);
      else onError(t('auth.noToken'));
    } else if (response?.type === 'error') {
      onError(response.error?.message ?? t('auth.failed'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);
  return <Button title={t('auth.facebook')} icon="logo-facebook" variant="secondary" full loading={busy} disabled={!request}
    onPress={() => prompt()} />;
}
