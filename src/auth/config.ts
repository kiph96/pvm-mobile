import { Platform } from 'react-native';

// OAuth client IDs are public values, inlined at build time from EXPO_PUBLIC_* variables
// (.env locally, build args in Docker). See README "Sign in with Google / Facebook".
export const oauth = {
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined,
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
  googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || undefined,
  facebookAppId: process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || undefined,
};

/** Whether this build has a Google client ID for the platform it runs on. */
export function googleConfigured() {
  if (Platform.OS === 'ios') return !!oauth.googleIosClientId;
  if (Platform.OS === 'android') return !!oauth.googleAndroidClientId;
  return !!oauth.googleWebClientId;
}

export function facebookConfigured() {
  return !!oauth.facebookAppId;
}
