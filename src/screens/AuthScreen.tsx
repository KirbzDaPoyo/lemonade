import { useSignIn, useSignUp } from '@clerk/expo';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';

import { AppButton } from '../components/AppButton';
import { AppTextField } from '../components/app-text-field';
import { AppTheme, useAppTheme } from '../design-system/theme';
import { analytics } from '../observability/analytics';

type AuthMode = 'signIn' | 'signUp';
type AuthStep = 'email' | 'code';

type ClerkErrorLike = {
  errors?: Array<{ longMessage?: string; message?: string }>;
  message?: string;
};

const getErrorMessage = (error: unknown) => {
  const clerkError = error as ClerkErrorLike;
  return clerkError.errors?.[0]?.longMessage ?? clerkError.errors?.[0]?.message ?? clerkError.message ?? 'Something went wrong. Please try again.';
};

export function AuthScreen() {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const [mode, setMode] = useState<AuthMode>('signUp');
  const [step, setStep] = useState<AuthStep>('email');
  const [emailAddress, setEmailAddress] = useState('');
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const sendCode = async () => {
    const cleanEmail = emailAddress.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setErrorMessage('Enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(undefined);
    try {
      if (mode === 'signUp') {
        const { error } = await signUp.create({ emailAddress: cleanEmail });
        if (error) throw error;
        const { error: sendError } = await signUp.verifications.sendEmailCode();
        if (sendError) throw sendError;
      } else {
        const { error } = await signIn.create({ identifier: cleanEmail });
        if (error) throw error;
        const { error: sendError } = await signIn.emailCode.sendCode({ emailAddress: cleanEmail });
        if (sendError) throw sendError;
      }
      setEmailAddress(cleanEmail);
      setStep('code');
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyCode = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      setErrorMessage('Enter the six-digit code from your email.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(undefined);
    try {
      if (mode === 'signUp') {
        const { error } = await signUp.verifications.verifyEmailCode({ code: code.trim() });
        if (error) throw error;
        if (signUp.status !== 'complete') throw new Error('Your account needs another verification step.');
        const { error: finalizeError } = await signUp.finalize();
        if (finalizeError) throw finalizeError;
        analytics.markAuthenticationCompleted();
      } else {
        const { error } = await signIn.emailCode.verifyCode({ code: code.trim() });
        if (error) throw error;
        if (signIn.status !== 'complete') throw new Error('Your sign-in needs another verification step.');
        const { error: finalizeError } = await signIn.finalize();
        if (finalizeError) throw finalizeError;
        analytics.markAuthenticationCompleted();
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setStep('email');
    setCode('');
    setErrorMessage(undefined);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <View style={styles.brandRule} />
          <Text style={styles.wordmark}>LEMONADE</Text>
          <Text style={styles.title}>Your places, saved for you.</Text>
          <Text style={styles.subtitle}>A private index for the places you discover on Instagram.</Text>
        </View>

        <View style={styles.form}>
          {step === 'email' ? (
            <>
              <View style={styles.modeRow}>
                <AppButton compact label="Create account" onPress={() => switchMode('signUp')} style={styles.modeButton} variant={mode === 'signUp' ? 'primary' : 'ghost'} />
                <AppButton compact label="Sign in" onPress={() => switchMode('signIn')} style={styles.modeButton} variant={mode === 'signIn' ? 'primary' : 'ghost'} />
              </View>
              <Text style={styles.formTitle}>{mode === 'signUp' ? 'Create your account' : 'Welcome back'}</Text>
              <AppTextField autoCapitalize="none" autoComplete="email" autoCorrect={false} editable={!isSubmitting} inputMode="email" label="Email" onChangeText={setEmailAddress} onSubmitEditing={() => void sendCode()} placeholder="you@example.com" returnKeyType="send" value={emailAddress} />
              <AppButton disabled={isSubmitting} label={isSubmitting ? 'Sending code' : 'Email me a code'} onPress={() => void sendCode()} />
            </>
          ) : (
            <>
              <Text style={styles.formTitle}>Check your email</Text>
              <Text style={styles.body}>Clerk sent a six-digit code to {emailAddress}.</Text>
              <AppTextField autoComplete="one-time-code" editable={!isSubmitting} inputMode="numeric" label="Six-digit code" maxLength={6} onChangeText={setCode} onSubmitEditing={() => void verifyCode()} placeholder="000000" returnKeyType="done" style={styles.codeInput} value={code} />
              <AppButton disabled={isSubmitting} label={isSubmitting ? 'Verifying' : 'Continue'} onPress={() => void verifyCode()} />
              <AppButton disabled={isSubmitting} label="Use a different email" onPress={() => { setStep('email'); setCode(''); setErrorMessage(undefined); }} variant="ghost" />
            </>
          )}
          {errorMessage ? <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  screen: { backgroundColor: theme.colors.background, flex: 1 },
  content: { flexGrow: 1, gap: theme.spacing.xxxl, justifyContent: 'center', padding: theme.spacing.xl, paddingBottom: theme.spacing.huge },
  brand: { gap: theme.spacing.md },
  brandRule: { backgroundColor: theme.colors.primary, height: 5, width: 64 },
  wordmark: { color: theme.colors.text, fontFamily: theme.typography.displayFamily, fontSize: theme.typography.display.hero, letterSpacing: -0.7, lineHeight: 49 },
  title: { color: theme.colors.text, fontSize: 24, fontWeight: '800', lineHeight: 29, maxWidth: 420 },
  subtitle: { color: theme.colors.textMuted, fontSize: theme.typography.body.large, lineHeight: 24, maxWidth: 440 },
  form: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderTopWidth: 1, gap: theme.spacing.lg, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.xl },
  modeRow: { borderBottomColor: theme.colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: theme.spacing.sm, paddingBottom: theme.spacing.lg },
  modeButton: { flex: 1 },
  formTitle: { color: theme.colors.text, fontFamily: theme.typography.displayFamily, fontSize: 28, lineHeight: 31, textTransform: 'uppercase' },
  body: { color: theme.colors.textMuted, fontSize: theme.typography.body.medium, lineHeight: 21 },
  codeInput: { fontSize: 24, fontWeight: '800', letterSpacing: 8, textAlign: 'center' },
  error: { backgroundColor: theme.colors.dangerSurface, color: theme.colors.danger, fontSize: theme.typography.body.small, lineHeight: 19, padding: theme.spacing.md }
});
