import { useSignIn, useSignUp } from '@clerk/expo';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

import { AppButton } from '../components/AppButton';
import { colors, radii, spacing } from '../theme';

type AuthMode = 'signIn' | 'signUp';
type AuthStep = 'email' | 'code';

type ClerkErrorLike = {
  errors?: Array<{ longMessage?: string; message?: string }>;
  message?: string;
};

const getErrorMessage = (error: unknown) => {
  const clerkError = error as ClerkErrorLike;
  return (
    clerkError.errors?.[0]?.longMessage ??
    clerkError.errors?.[0]?.message ??
    clerkError.message ??
    'Something went wrong. Please try again.'
  );
};

export function AuthScreen() {
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

        const { error: sendError } =
          await signUp.verifications.sendEmailCode();
        if (sendError) throw sendError;
      } else {
        const { error } = await signIn.create({ identifier: cleanEmail });
        if (error) throw error;

        const { error: sendError } = await signIn.emailCode.sendCode({
          emailAddress: cleanEmail
        });
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
        const { error } = await signUp.verifications.verifyEmailCode({
          code: code.trim()
        });
        if (error) throw error;
        if (signUp.status !== 'complete') {
          throw new Error('Your account needs another verification step.');
        }

        const { error: finalizeError } = await signUp.finalize();
        if (finalizeError) throw finalizeError;
      } else {
        const { error } = await signIn.emailCode.verifyCode({
          code: code.trim()
        });
        if (error) throw error;
        if (signIn.status !== 'complete') {
          throw new Error('Your sign-in needs another verification step.');
        }

        const { error: finalizeError } = await signIn.finalize();
        if (finalizeError) throw finalizeError;
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <View style={styles.brand}>
        <Text style={styles.eyebrow}>Project Lemonade</Text>
        <Text style={styles.title}>Your places, saved for you.</Text>
        <Text style={styles.subtitle}>
          Use a one-time email code. No password to remember.
        </Text>
      </View>

      <View style={styles.card}>
        {step === 'email' ? (
          <>
            <View style={styles.modeRow}>
              <AppButton
                label="Create account"
                onPress={() => switchMode('signUp')}
                style={styles.modeButton}
                variant={mode === 'signUp' ? 'primary' : 'ghost'}
              />
              <AppButton
                label="Sign in"
                onPress={() => switchMode('signIn')}
                style={styles.modeButton}
                variant={mode === 'signIn' ? 'primary' : 'ghost'}
              />
            </View>

            <Text style={styles.cardTitle}>
              {mode === 'signUp' ? 'Create your account' : 'Welcome back'}
            </Text>
            <Text style={styles.label}>Email</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              editable={!isSubmitting}
              inputMode="email"
              onChangeText={setEmailAddress}
              onSubmitEditing={() => void sendCode()}
              placeholder="you@example.com"
              placeholderTextColor={colors.muted}
              returnKeyType="send"
              style={styles.input}
              value={emailAddress}
            />
            <AppButton
              disabled={isSubmitting}
              label={isSubmitting ? 'Sending...' : 'Email me a code'}
              onPress={() => void sendCode()}
            />
          </>
        ) : (
          <>
            <Text style={styles.cardTitle}>Check your email</Text>
            <Text style={styles.body}>
              Clerk sent a six-digit code to {emailAddress}.
            </Text>
            <Text style={styles.label}>Six-digit code</Text>
            <TextInput
              autoComplete="one-time-code"
              editable={!isSubmitting}
              inputMode="numeric"
              maxLength={6}
              onChangeText={setCode}
              onSubmitEditing={() => void verifyCode()}
              placeholder="000000"
              placeholderTextColor={colors.muted}
              returnKeyType="done"
              style={[styles.input, styles.codeInput]}
              value={code}
            />
            <AppButton
              disabled={isSubmitting}
              label={isSubmitting ? 'Verifying...' : 'Continue'}
              onPress={() => void verifyCode()}
            />
            <AppButton
              disabled={isSubmitting}
              label="Use a different email"
              onPress={() => {
                setStep('email');
                setCode('');
                setErrorMessage(undefined);
              }}
              variant="ghost"
            />
          </>
        )}

        {errorMessage ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {errorMessage}
          </Text>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.xxl,
    justifyContent: 'center',
    padding: spacing.xl
  },
  brand: {
    gap: spacing.sm
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase'
  },
  title: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 42
  },
  subtitle: {
    color: colors.muted,
    fontSize: 17,
    lineHeight: 24
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.xl
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  modeButton: {
    flex: 1,
    minHeight: 42,
    paddingHorizontal: spacing.sm
  },
  cardTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '800'
  },
  body: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 21
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700'
  },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: 17,
    minHeight: 52,
    paddingHorizontal: spacing.lg
  },
  codeInput: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 8,
    textAlign: 'center'
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20
  }
});
