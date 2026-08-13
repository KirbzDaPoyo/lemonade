import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import { ColorSchemeName, useColorScheme } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedColorScheme = 'light' | 'dark';

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 48
} as const;

export const radii = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 6,
  lg: 8,
  full: 999
} as const;

export const typography = {
  displayFamily: 'BarlowCondensed_700Bold',
  display: {
    hero: 48,
    screen: 40,
    section: 24
  },
  body: {
    large: 17,
    medium: 15,
    small: 13
  },
  label: {
    large: 15,
    medium: 13,
    small: 11
  }
} as const;

export const motion = {
  pressMs: 120,
  shortMs: 160,
  mediumMs: 240
} as const;

const lightColors = {
  background: '#F4F6F1',
  surface: '#FFFFFF',
  surfaceMuted: '#E8ECE5',
  surfaceElevated: '#FFFFFF',
  border: '#C8D0C6',
  borderStrong: '#707B71',
  text: '#0A0D0B',
  textMuted: '#505A52',
  textSubtle: '#68726A',
  primary: '#B7F500',
  primaryPressed: '#9ED500',
  acidInk: '#527000',
  acidBorder: '#809900',
  onPrimary: '#0A0D0B',
  primarySoft: '#E7FBB1',
  cobalt: '#1E4ED8',
  violet: '#6338E6',
  pink: '#C70064',
  onPink: '#FFFFFF',
  danger: '#B52543',
  dangerSurface: '#FCE8EC',
  warning: '#7C5600',
  warningSurface: '#FFF4CF',
  success: '#176A43',
  focus: '#1E4ED8',
  input: '#FFFFFF',
  disabledSurface: '#DCE1DA',
  disabledText: '#737B74',
  overlay: 'rgba(5, 8, 6, 0.64)',
  shadow: '#061009',
  skeleton: '#DCE3DA'
} as const;

const darkColors = {
  background: '#050706',
  surface: '#0B0F0D',
  surfaceMuted: '#121914',
  surfaceElevated: '#172019',
  border: '#2A352C',
  borderStrong: '#647066',
  text: '#F5F8F1',
  textMuted: '#ADB7AE',
  textSubtle: '#89948A',
  primary: '#C8FF2E',
  primaryPressed: '#AEE51A',
  acidInk: '#C8FF2E',
  acidBorder: '#AEE51A',
  onPrimary: '#070A08',
  primarySoft: '#202C11',
  cobalt: '#6F8CFF',
  violet: '#9C7DFF',
  pink: '#FF62AA',
  onPink: '#050706',
  danger: '#FF7185',
  dangerSurface: '#35141C',
  warning: '#F6C95C',
  warningSurface: '#30260D',
  success: '#67D69B',
  focus: '#9CB0FF',
  input: '#090D0A',
  disabledSurface: '#1B211C',
  disabledText: '#727A73',
  overlay: 'rgba(0, 0, 0, 0.76)',
  shadow: '#000000',
  skeleton: '#1B251E'
} as const;

type ThemeColors = { [Key in keyof typeof lightColors]: string };

export type AppTheme = {
  colorScheme: ResolvedColorScheme;
  colors: ThemeColors;
  isDark: boolean;
  motion: typeof motion;
  radii: typeof radii;
  spacing: typeof spacing;
  typography: typeof typography;
};

const themes: Record<ResolvedColorScheme, AppTheme> = {
  light: {
    colorScheme: 'light',
    colors: lightColors,
    isDark: false,
    motion,
    radii,
    spacing,
    typography
  },
  dark: {
    colorScheme: 'dark',
    colors: darkColors,
    isDark: true,
    motion,
    radii,
    spacing,
    typography
  }
};

const APPEARANCE_KEY = 'project-lemonade.appearance';

type ThemeContextValue = {
  appearance: ThemePreference;
  setAppearance: (preference: ThemePreference) => Promise<void>;
  theme: AppTheme;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const isThemePreference = (value: string | null): value is ThemePreference =>
  value === 'system' || value === 'light' || value === 'dark';

const resolveScheme = (
  preference: ThemePreference,
  systemScheme: ColorSchemeName
): ResolvedColorScheme =>
  preference === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : preference;

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [appearance, setAppearanceState] = useState<ThemePreference>('system');

  useEffect(() => {
    let isMounted = true;

    void SecureStore.getItemAsync(APPEARANCE_KEY)
      .then((storedPreference) => {
        if (isMounted && isThemePreference(storedPreference)) {
          setAppearanceState(storedPreference);
        }
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, []);

  const theme = themes[resolveScheme(appearance, systemScheme)];
  const value = useMemo<ThemeContextValue>(
    () => ({
      appearance,
      setAppearance: async (preference) => {
        setAppearanceState(preference);

        try {
          await SecureStore.setItemAsync(APPEARANCE_KEY, preference);
        } catch {
          // The selected appearance still applies for the current session.
        }
      },
      theme
    }),
    [appearance, theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useAppTheme must be used inside AppThemeProvider.');
  }

  return context;
}

export const getTheme = (colorScheme: ResolvedColorScheme) => themes[colorScheme];
