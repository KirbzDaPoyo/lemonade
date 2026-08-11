import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { ShareIntentProvider } from 'expo-share-intent';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { AppNavigator } from './src/navigation/AppNavigator';
import { AuthScreen } from './src/screens/AuthScreen';
import { PlacesProvider } from './src/store/PlacesContext';
import { colors, spacing } from './src/theme';

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.loadingText}>Opening Project Lemonade...</Text>
    </View>
  );
}

function AppContent() {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth();

  if (!isLoaded) {
    return <LoadingScreen />;
  }

  if (!isSignedIn || !userId) {
    return <AuthScreen />;
  }

  return (
    <PlacesProvider accessTokenProvider={getToken} userId={userId}>
      <AppNavigator />
    </PlacesProvider>
  );
}

function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      {children}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <ShareIntentProvider options={{ disabled: isExpoGo }}>
      <SafeAreaProvider>
        {clerkPublishableKey ? (
          <ClerkProvider
            publishableKey={clerkPublishableKey}
            tokenCache={tokenCache}
          >
            <AppFrame>
              <AppContent />
            </AppFrame>
          </ClerkProvider>
        ) : (
          <AppFrame>
            <View style={styles.configuration}>
              <Text style={styles.configurationTitle}>Clerk is not configured</Text>
              <Text style={styles.configurationBody}>
                Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY and rebuild the app.
              </Text>
            </View>
          </AppFrame>
        )}
      </SafeAreaProvider>
    </ShareIntentProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1
  },
  loading: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center'
  },
  loadingText: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '700'
  },
  configuration: {
    flex: 1,
    gap: spacing.sm,
    justifyContent: 'center',
    padding: spacing.xl
  },
  configurationTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900'
  },
  configurationBody: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 23
  }
});
