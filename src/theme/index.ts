import { createContext, useContext } from 'react';
import { Platform, useColorScheme } from 'react-native';

/** What the user picked: follow the device, or force light / dark. */
export type ThemePreference = 'system' | 'light' | 'dark';
export interface ThemeChoice { preference: ThemePreference; setPreference: (p: ThemePreference) => void; scheme: 'light' | 'dark' }
/** Provided by <ThemeProvider/> (src/theme/ThemeProvider.tsx). */
export const ThemeContext = createContext<ThemeChoice | null>(null);

// Warm "coffee shop" palette: cream surfaces, espresso text, a fresh green
// for primary actions and clear status colours for staffing health.
const light = {
  background: '#FBF7F2',
  surface: '#FFFFFF',
  surfaceAlt: '#F4EDE4',
  border: '#E8DED2',
  text: '#2B1D14',
  textMuted: '#7A6A5C',
  textInverse: '#FFFFFF',
  primary: '#1F7A5C',
  primaryPressed: '#17614A',
  primarySoft: '#DDF1E8',
  accent: '#C8762B',
  accentSoft: '#FBEBDA',
  danger: '#C2410C',
  dangerSoft: '#FDE5D8',
  warning: '#B7791F',
  warningSoft: '#FDF1D6',
  success: '#1F7A5C',
  successSoft: '#DDF1E8',
  info: '#2F6FB0',
  infoSoft: '#DFEBF8',
  shadow: 'rgba(60, 40, 20, 0.08)',
};

const dark: typeof light = {
  background: '#17120E',
  surface: '#221B16',
  surfaceAlt: '#2C241E',
  border: '#3A3029',
  text: '#F5EEE7',
  textMuted: '#B3A396',
  textInverse: '#FFFFFF',
  primary: '#3FB58A',
  primaryPressed: '#2F9A74',
  primarySoft: '#1E3A2F',
  accent: '#E39A55',
  accentSoft: '#3D2C1D',
  danger: '#F07B4A',
  dangerSoft: '#40241A',
  warning: '#E0AC4A',
  warningSoft: '#3B3020',
  success: '#3FB58A',
  successSoft: '#1E3A2F',
  info: '#6EA8E6',
  infoSoft: '#1D2C3D',
  shadow: 'rgba(0, 0, 0, 0.4)',
};

export type Colors = typeof light;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };

export const font = {
  title: { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.4 },
  heading: { fontSize: 19, fontWeight: '700' as const, letterSpacing: -0.2 },
  subheading: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  small: { fontSize: 13, fontWeight: '500' as const },
  tiny: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.5 },
};

export function useTheme() {
  const system = useColorScheme();
  const choice = useContext(ThemeContext);
  const scheme = choice?.scheme ?? (system === 'dark' ? 'dark' : 'light');
  return { colors: scheme === 'dark' ? dark : light, dark: scheme === 'dark', spacing, radius, font };
}

/** The user's theme choice and setter (System / Light / Dark). */
export function useThemePreference() {
  const choice = useContext(ThemeContext);
  if (!choice) throw new Error('useThemePreference must be used inside ThemeProvider');
  return choice;
}

export const palettes = { light, dark };

export function cardShadow(colors: Colors) {
  return Platform.select({
    ios: { shadowColor: colors.shadow, shadowOpacity: 1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
    android: { elevation: 2 },
    default: { boxShadow: `0 4px 14px ${colors.shadow}` },
  }) as object;
}
