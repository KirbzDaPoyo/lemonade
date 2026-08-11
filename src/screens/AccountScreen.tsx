import { useAuth, useUser } from '@clerk/expo';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { ScreenHeader } from '../components/screen-header';
import type { AppNavigation } from '../navigation/types';
import { colors, radii, spacing } from '../theme';

export function AccountScreen({ navigation }: { navigation: AppNavigation }) {
  const { signOut } = useAuth();
  const { user } = useUser();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setErrorMessage(undefined);

    try {
      await signOut();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not sign out.'
      );
      setIsSigningOut(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader onBack={navigation.goBack} title="Account" />

      <View style={styles.card}>
        <Text style={styles.label}>Signed in as</Text>
        <Text selectable style={styles.email}>
          {user?.primaryEmailAddress?.emailAddress ?? 'Unknown email'}
        </Text>
        <Text style={styles.body}>
          Your saved places and tags are private to this account.
        </Text>
        <Text selectable style={styles.userId}>
          Account ID: {user?.id ?? 'Unavailable'}
        </Text>
      </View>

      <AppButton
        disabled={isSigningOut}
        label={isSigningOut ? 'Signing out...' : 'Sign out'}
        onPress={() => void handleSignOut()}
        variant="secondary"
      />

      {errorMessage ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {errorMessage}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.xl,
    padding: spacing.lg
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.xl
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  email: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800'
  },
  body: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 21
  },
  userId: {
    color: colors.muted,
    fontSize: 12,
    marginTop: spacing.sm
  },
  error: {
    color: colors.danger,
    fontSize: 14
  }
});
