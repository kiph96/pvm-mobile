import { Ionicons } from '@expo/vector-icons';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { router, SplashScreen, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { captureRedirectResult } from '@/auth/webRedirect';
import { ToastProvider } from '@/components/toast';
import { ConfirmHost } from '@/components/ui';
import { I18nProvider, useI18n } from '@/i18n';
import { useNotificationRouting } from '@/notifications/useNotificationRouting';
import { SessionProvider, useSession } from '@/state/session';
import { useTheme } from '@/theme';
import { ThemeProvider } from '@/theme/ThemeProvider';

// Web: Google/Facebook send the browser back here with the token in the URL; take it before routing.
captureRedirectResult();

// keep the splash screen until the icon font is ready, so icons never draw as empty boxes
SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  // on phones this needs expo-file-system (expo-asset downloads the font file through it)
  const [fontsLoaded, fontError] = useFonts(Ionicons.font);
  useEffect(() => {
    if (fontError) console.warn('Icon font failed to load', fontError);
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsLoaded, fontError]);
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false } },
  }));
  return (
    <QueryClientProvider client={client}>
      <SafeAreaProvider>
        <ThemeProvider>
          <I18nProvider>
            <SessionProvider>
              <ToastProvider>
                <AppStack />
              </ToastProvider>
            </SessionProvider>
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

function AppStack() {
  const { colors, dark } = useTheme();
  const { t } = useI18n();
  useNotificationRouting();
  useSignedOutRedirect();
  // Navigator chrome (screen backgrounds during transitions, headers) uses the same palette.
  const base = dark ? DarkTheme : DefaultTheme;
  const navTheme = { ...base, dark, colors: { ...base.colors, primary: colors.primary, background: colors.background,
    card: colors.background, text: colors.text, border: colors.border, notification: colors.danger } };
  return (
    <NavigationThemeProvider value={navTheme}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <ConfirmHost />
      <Stack screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' },
        headerBackTitle: t('common.back'),
      }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="workspace" />
        <Stack.Screen name="owner" />
        <Stack.Screen name="staff" />
        <Stack.Screen name="shift/[id]" options={{ headerShown: true, title: t('screens.shift') }} />
        <Stack.Screen name="employee/[id]" options={{ headerShown: true, title: t('screens.employee') }} />
        <Stack.Screen name="store/[id]" options={{ headerShown: true, title: t('screens.store') }} />
        <Stack.Screen name="payroll" options={{ headerShown: true, title: t('screens.payroll') }} />
        <Stack.Screen name="billing" options={{ headerShown: true, title: t('screens.billing') }} />
        <Stack.Screen name="violations" options={{ headerShown: true, title: t('screens.violations') }} />
        <Stack.Screen name="notifications" options={{ headerShown: true, title: t('screens.notifications') }} />
        <Stack.Screen name="payslips" options={{ headerShown: true, title: t('screens.payslips') }} />
        <Stack.Screen name="preferences" options={{ headerShown: true, title: t('screens.preferences') }} />
        <Stack.Screen name="daily-digest" options={{ headerShown: true, title: t('screens.digest') }} />
        <Stack.Screen name="join" options={{ headerShown: true, title: t('screens.join'), presentation: 'modal' }} />
      </Stack>
    </NavigationThemeProvider>
  );
}

/**
 * Whenever the session ends (sign-out button, expired/revoked refresh token, another tab signing out),
 * leave the signed-in screens for the sign-in page.
 */
function useSignedOutRedirect() {
  const { ready, session } = useSession();
  const first = (useSegments() as string[])[0];
  const onPublicScreen = !first || first === 'sign-in';
  useEffect(() => {
    if (ready && !session && !onPublicScreen) router.replace('/sign-in');
  }, [ready, session, onPublicScreen]);
}
