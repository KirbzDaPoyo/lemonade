/*
THESIS: A private place library rendered as a sharp synthetic editorial index, refusing the generic rounded-card utility app.
OWN-WORLD: Original V2—near-black or cool-white fields, acid glyph tiles, chartreuse energy slashes, cobalt/violet/pink signals, warning-strip details, condensed display type, thin rules, and 0-8px geometry.
STORY: The user signs in, scans a legible place index, imports an Instagram source, confirms a match, and maintains the saved record without decorative friction.
FIRST VIEWPORT: A compact LEMONADE masthead, SAVED PLACES title, acid Add tile, status rail, and illustrated saved-place modules establish V2 immediately.
FORM: Original Synthetic Editorial V2, user-restored canonical direction. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md.
*/
import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed/700Bold';
import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useFonts } from 'expo-font';
import { ShareIntentProvider } from 'expo-share-intent';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { AppTheme, AppThemeProvider, useAppTheme } from './src/design-system/theme';
import { AppNavigator } from './src/navigation/AppNavigator';
import { AuthScreen } from './src/screens/AuthScreen';
import { PlacesProvider } from './src/store/PlacesContext';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

function LoadingScreen({ label = 'Opening Project Lemonade' }: { label?: string }) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.loading}>
      <View style={styles.loadingMark} />
      <Text style={styles.loadingWordmark}>LEMONADE</Text>
      <ActivityIndicator color={theme.colors.primary} />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

function AppContent() {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth();
  if (!isLoaded) return <LoadingScreen />;
  if (!isSignedIn || !userId) return <AuthScreen />;
  return <PlacesProvider accessTokenProvider={getToken} userId={userId}><AppNavigator /></PlacesProvider>;
}

function AppFrame({ children }: { children: React.ReactNode }) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.safeArea}>
      <StatusBar backgroundColor={theme.colors.background} style={theme.isDark ? 'light' : 'dark'} />
      {children}
    </SafeAreaView>
  );
}

function AppBoot() {
  const [fontsLoaded, fontError] = useFonts({ BarlowCondensed_700Bold });
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  if (!fontsLoaded && !fontError) {
    return <AppFrame><LoadingScreen label="Loading visual system" /></AppFrame>;
  }
  return clerkPublishableKey ? (
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
      <AppFrame><AppContent /></AppFrame>
    </ClerkProvider>
  ) : (
    <AppFrame>
      <View style={styles.configuration}>
        <Text style={styles.configurationTitle}>Configuration required</Text>
        <Text style={styles.configurationBody}>Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY and rebuild the app.</Text>
      </View>
    </AppFrame>
  );
}

export default function App() {
  return (
    <ShareIntentProvider options={{ disabled: isExpoGo }}>
      <SafeAreaProvider>
        <AppThemeProvider><AppBoot /></AppThemeProvider>
      </SafeAreaProvider>
    </ShareIntentProvider>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  safeArea: { backgroundColor: theme.colors.background, flex: 1 },
  loading: { alignItems: 'center', backgroundColor: theme.colors.background, flex: 1, gap: theme.spacing.md, justifyContent: 'center', padding: theme.spacing.xl },
  loadingMark: { backgroundColor: theme.colors.primary, height: 4, width: 52 },
  loadingWordmark: { color: theme.colors.text, fontFamily: theme.typography.displayFamily, fontSize: 44, letterSpacing: -0.8, lineHeight: 46 },
  loadingText: { color: theme.colors.textMuted, fontSize: theme.typography.body.medium, fontWeight: '700' },
  configuration: { flex: 1, gap: theme.spacing.md, justifyContent: 'center', padding: theme.spacing.xl },
  configurationTitle: { color: theme.colors.text, fontFamily: theme.typography.displayFamily, fontSize: theme.typography.display.screen, lineHeight: 42, textTransform: 'uppercase' },
  configurationBody: { color: theme.colors.textMuted, fontSize: theme.typography.body.large, lineHeight: 24 }
});
