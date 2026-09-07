import { useAuth, useUser } from '@clerk/expo';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { V2Button } from '../components/v2-controls';
import { V2SectionLabel, V2TitleBlock, V2TopBar } from '../components/v2-layout';
import { AppTheme, ThemePreference, useAppTheme } from '../design-system/theme';
import type { AppNavigation } from '../navigation/types';
import { analytics } from '../observability/analytics';
import { errorMonitoring } from '../observability/error-monitoring';

const appearanceOptions: Array<{ value: ThemePreference; label: string; description: string }> = [
  { value: 'system', label: 'System', description: 'Follow your device appearance.' },
  { value: 'light', label: 'Light', description: 'Cool-white editorial field.' },
  { value: 'dark', label: 'Dark', description: 'Near-black night field.' }
];

const canVerifyErrorMonitoring =
  process.env.EXPO_PUBLIC_APP_ENV !== 'production' && Boolean(process.env.EXPO_PUBLIC_SENTRY_DSN);

export function AccountScreen({ navigation }: { navigation: AppNavigation }) {
  const { appearance, setAppearance, theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { signOut } = useAuth();
  const { user } = useUser();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [showTechnicalId, setShowTechnicalId] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const selectedDescription = appearanceOptions.find((option) => option.value === appearance)?.description;

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setErrorMessage(undefined);
    try {
      await analytics.signOut();
      await signOut();
    } catch (error) {
      errorMonitoring.captureException(error, {
        operation: 'authentication_transition',
        category: 'authentication'
      });
      setErrorMessage(error instanceof Error ? error.message : 'Could not sign out.');
      setIsSigningOut(false);
    }
  };

  const handleMonitoringVerification = async () => {
    setVerificationStatus('sending');
    const sent = await errorMonitoring.sendVerificationEvent();
    setVerificationStatus(sent ? 'sent' : 'failed');
  };

  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic" style={styles.screen}>
      <V2TopBar onBack={navigation.goBack} />
      <V2TitleBlock decorated={false} subtitle="Identity, privacy, and appearance for your private place library." title="YOUR ACCOUNT" />

      <View style={styles.module}>
        <V2SectionLabel>Identity</V2SectionLabel>
        <View style={styles.detailLine}>
          <Text style={styles.label}>SIGNED IN AS</Text>
          <Text selectable style={styles.email}>{user?.primaryEmailAddress?.emailAddress ?? 'Unknown email'}</Text>
        </View>
        <Text style={styles.body}>Your saved places and tags are private to this account.</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showTechnicalId }}
          onPress={() => setShowTechnicalId((current) => !current)}
          style={({ pressed }) => [styles.technicalToggle, pressed && styles.pressed]}
        >
          <Text style={styles.technicalToggleText}>{showTechnicalId ? 'HIDE ACCOUNT ID' : 'SHOW ACCOUNT ID'}</Text>
        </Pressable>
        {showTechnicalId ? <Text selectable style={styles.userId}>Account ID: {user?.id ?? 'Unavailable'}</Text> : null}
      </View>

      <View style={styles.module}>
        <V2SectionLabel>Appearance</V2SectionLabel>
        <View style={styles.appearanceControl}>
          {appearanceOptions.map((option, index) => {
            const selected = appearance === option.value;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={option.value}
                onPress={() => void setAppearance(option.value)}
                style={({ pressed }) => [
                  styles.appearanceOption,
                  index < appearanceOptions.length - 1 && styles.appearanceDivider,
                  selected && styles.appearanceOptionSelected,
                  pressed && styles.pressed
                ]}
              >
                {selected ? <View style={styles.appearanceMark} /> : null}
                <Text style={[styles.appearanceOptionLabel, selected && styles.appearanceOptionLabelSelected]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.body}>{selectedDescription}</Text>
      </View>

      {canVerifyErrorMonitoring ? (
        <View style={styles.module}>
          <V2SectionLabel>Preview diagnostics</V2SectionLabel>
          <Text style={styles.body}>Send one privacy-scrubbed test event to confirm error monitoring is connected.</Text>
          <V2Button
            disabled={verificationStatus === 'sending'}
            label={verificationStatus === 'sending' ? 'SENDING TEST EVENT' : 'VERIFY ERROR MONITORING'}
            onPress={() => void handleMonitoringVerification()}
            variant="secondary"
          />
          {verificationStatus === 'sent' ? <Text accessibilityLiveRegion="polite" style={styles.success}>TEST EVENT SENT</Text> : null}
          {verificationStatus === 'failed' ? <Text accessibilityRole="alert" style={styles.error}>The test event could not be sent. Check your connection and try again.</Text> : null}
        </View>
      ) : null}

      <View style={styles.module}>
        <V2SectionLabel color="pink">Session</V2SectionLabel>
        <Text style={styles.body}>Sign out only when you are finished with this private library on this device.</Text>
        <V2Button disabled={isSigningOut} label={isSigningOut ? 'SIGNING OUT' : 'SIGN OUT'} onPress={() => void handleSignOut()} variant="secondary" />
        {errorMessage ? <Text accessibilityRole="alert" selectable style={styles.error}>{errorMessage}</Text> : null}
      </View>
    </ScrollView>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  screen: { backgroundColor: theme.colors.background, flex: 1 },
  content: { gap: theme.spacing.xl, padding: theme.spacing.lg, paddingBottom: theme.spacing.huge },
  module: { borderBottomColor: theme.colors.border, borderBottomWidth: 1, borderTopColor: theme.colors.border, borderTopWidth: 1, gap: theme.spacing.md, paddingVertical: theme.spacing.lg },
  detailLine: { gap: theme.spacing.xs },
  label: { color: theme.colors.textMuted, fontFamily: theme.typography.displayFamily, fontSize: 12, letterSpacing: 0.8 },
  email: { color: theme.colors.text, fontSize: 20, fontWeight: '800' },
  body: { color: theme.colors.textMuted, fontSize: theme.typography.body.medium, lineHeight: 21 },
  technicalToggle: { alignSelf: 'flex-start', minHeight: 48, justifyContent: 'center', paddingHorizontal: theme.spacing.sm },
  technicalToggleText: { color: theme.colors.cobalt, fontFamily: theme.typography.displayFamily, fontSize: 13, letterSpacing: 0.6 },
  userId: { color: theme.colors.textSubtle, fontFamily: 'monospace', fontSize: theme.typography.label.small },
  appearanceControl: { borderColor: theme.colors.borderStrong, borderWidth: 1, flexDirection: 'row' },
  appearanceOption: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: 48, overflow: 'hidden', paddingHorizontal: theme.spacing.xs, position: 'relative' },
  appearanceDivider: { borderRightColor: theme.colors.borderStrong, borderRightWidth: 1 },
  appearanceOptionSelected: { backgroundColor: theme.colors.primary },
  appearanceMark: { backgroundColor: theme.colors.onPrimary, height: 3, left: 0, position: 'absolute', right: 0, top: 0 },
  appearanceOptionLabel: { color: theme.colors.text, fontFamily: theme.typography.displayFamily, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' },
  appearanceOptionLabelSelected: { color: theme.colors.onPrimary },
  error: { backgroundColor: theme.colors.dangerSurface, color: theme.colors.danger, fontSize: theme.typography.body.small, lineHeight: 19, padding: theme.spacing.md },
  success: { color: theme.colors.primary, fontFamily: theme.typography.displayFamily, fontSize: 13, letterSpacing: 0.6 },
  pressed: { opacity: 0.68 }
});