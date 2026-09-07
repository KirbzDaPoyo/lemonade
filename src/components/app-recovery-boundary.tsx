import { Component, type ErrorInfo, type ReactNode, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppTheme, useAppTheme } from '../design-system/theme';
import {
  errorMonitoring,
  type ErrorCategory,
  type ErrorOperation
} from '../observability/error-monitoring';

type BoundaryProps = {
  children: ReactNode;
  category: ErrorCategory;
  fallback: ReactNode;
  operation: ErrorOperation;
};

type BoundaryState = { hasError: boolean };

class RecoveryBoundaryCore extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    errorMonitoring.captureException(error, {
      operation: this.props.operation,
      category: this.props.category
    });
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

export function AppRecoveryBoundary({
  children,
  category,
  description = 'This screen hit an unexpected problem. Your saved information is still safe.',
  onLeave,
  operation,
  resetLabel = 'Try again',
  title = 'Something went wrong'
}: {
  children: ReactNode;
  category: ErrorCategory;
  description?: string;
  onLeave?: () => void;
  operation: ErrorOperation;
  resetLabel?: string;
  title?: string;
}) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [resetKey, setResetKey] = useState(0);

  const fallback = (
    <View accessibilityLiveRegion="assertive" style={styles.screen}>
      <View style={styles.rule} />
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      <Text style={styles.body}>{description}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          onLeave?.();
          setResetKey((current) => current + 1);
        }}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Text style={styles.buttonLabel}>{resetLabel}</Text>
      </Pressable>
    </View>
  );

  return (
    <RecoveryBoundaryCore
      category={category}
      fallback={fallback}
      key={resetKey}
      operation={operation}
    >
      {children}
    </RecoveryBoundaryCore>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    screen: {
      backgroundColor: theme.colors.background,
      flex: 1,
      gap: theme.spacing.lg,
      justifyContent: 'center',
      padding: theme.spacing.xl
    },
    rule: { backgroundColor: theme.colors.primary, height: 5, width: 64 },
    title: {
      color: theme.colors.text,
      fontFamily: theme.typography.displayFamily,
      fontSize: theme.typography.display.screen,
      lineHeight: 43,
      textTransform: 'uppercase'
    },
    body: {
      color: theme.colors.textMuted,
      fontSize: theme.typography.body.large,
      lineHeight: 24
    },
    button: {
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.acidBorder,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 56,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md
    },
    buttonPressed: { backgroundColor: theme.colors.primaryPressed },
    buttonLabel: {
      color: theme.colors.onPrimary,
      fontFamily: theme.typography.displayFamily,
      fontSize: 17,
      letterSpacing: 0.5,
      textTransform: 'uppercase'
    }
  });
