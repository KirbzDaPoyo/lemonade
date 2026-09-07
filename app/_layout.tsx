/*
THESIS: A private place library rendered as a sharp synthetic editorial index, refusing the generic rounded-card utility app.
OWN-WORLD: Original V2?near-black or cool-white fields, acid glyph tiles, chartreuse energy slashes, cobalt/violet/pink signals, warning-strip details, condensed display type, thin rules, and 0-8px geometry.
STORY: The user signs in, scans a legible place index, imports an Instagram source, confirms a match, and maintains the saved record without decorative friction.
*/
import 'react-native-url-polyfill/auto';

import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed/700Bold';
import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { ShareIntentProvider } from 'expo-share-intent';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { AppRecoveryBoundary } from '../src/components/app-recovery-boundary';
import { AnalyticsIdentitySync } from '../src/observability/analytics-identity';
import { ErrorMonitoringIdentitySync } from '../src/observability/error-monitoring-identity';
import { wrapWithErrorMonitoring } from '../src/observability/error-monitoring';
import {
  AppTheme,
  AppThemeProvider,
  useAppTheme
} from '../src/design-system/theme';

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const clerkPublishableKey =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

function LoadingScreen({
  label = 'Opening Project Lemonade'
}: {
  label?: string;
}) {
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

function RootNavigator() {
  const { isLoaded, isSignedIn } = useAuth();
  const { theme } = useAppTheme();

  if (!isLoaded) {
    return <LoadingScreen />;
  }

  return (
    <Stack
      screenOptions={{
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: theme.colors.background },
        headerShown: false
      }}
    >
      <Stack.Protected guard={Boolean(isSignedIn)}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

function AppFrame({ children }: { children: React.ReactNode }) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      style={styles.safeArea}
    >
      <StatusBar
        backgroundColor={theme.colors.background}
        style={theme.isDark ? 'light' : 'dark'}
      />
      {children}
    </SafeAreaView>
  );
}

function AppBoot() {
  const [fontsLoaded, fontError] = useFonts({ BarlowCondensed_700Bold });
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (!fontsLoaded && !fontError) {
    return (
      <AppFrame>
        <LoadingScreen label="Loading visual system" />
      </AppFrame>
    );
  }

  if (!clerkPublishableKey) {
    return (
      <AppFrame>
        <View style={styles.configuration}>
          <Text style={styles.configurationTitle}>Configuration required</Text>
          <Text style={styles.configurationBody}>
            Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY and rebuild the app.
          </Text>
        </View>
      </AppFrame>
    );
  }

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      tokenCache={tokenCache}
    >
      <AnalyticsIdentitySync />
      <ErrorMonitoringIdentitySync />
      <AppFrame>
        <RootNavigator />
      </AppFrame>
    </ClerkProvider>
  );
}

function RootLayout() {
  return (
    <ShareIntentProvider options={{ disabled: isExpoGo }}>
      <SafeAreaProvider>
        <AppThemeProvider>
          <AppRecoveryBoundary
            category="boundary"
            operation="app_frame"
            title="Project Lemonade paused"
          >
            <AppBoot />
          </AppRecoveryBoundary>
        </AppThemeProvider>
      </SafeAreaProvider>
    </ShareIntentProvider>
  );
}

export default wrapWithErrorMonitoring(RootLayout);

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    safeArea: {
      backgroundColor: theme.colors.background,
      flex: 1
    },
    loading: {
      alignItems: 'center',
      backgroundColor: theme.colors.background,
      flex: 1,
      gap: theme.spacing.md,
      justifyContent: 'center',
      padding: theme.spacing.xl
    },
    loadingMark: {
      backgroundColor: theme.colors.primary,
      height: 4,
      width: 52
    },
    loadingWordmark: {
      color: theme.colors.text,
      fontFamily: theme.typography.displayFamily,
      fontSize: 44,
      letterSpacing: -0.8,
      lineHeight: 46
    },
    loadingText: {
      color: theme.colors.textMuted,
      fontSize: theme.typography.body.medium,
      fontWeight: '700'
    },
    configuration: {
      flex: 1,
      gap: theme.spacing.md,
      justifyContent: 'center',
      padding: theme.spacing.xl
    },
    configurationTitle: {
      color: theme.colors.text,
      fontFamily: theme.typography.displayFamily,
      fontSize: theme.typography.display.screen,
      lineHeight: 42,
      textTransform: 'uppercase'
    },
    configurationBody: {
      color: theme.colors.textMuted,
      fontSize: theme.typography.body.large,
      lineHeight: 24
    }
  });
