import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppTheme, useAppTheme } from '../design-system/theme';

type StatePanelProps = {
  title: string;
  body?: string;
  loading?: boolean;
};

export function StatePanel({ title, body, loading = false }: StatePanelProps) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.panel}>
      {loading ? <ActivityIndicator color={theme.colors.primary} /> : null}
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    panel: {
      alignItems: 'flex-start',
      borderColor: theme.colors.border,
      borderTopWidth: 1,
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.xxl
    },
    title: {
      color: theme.colors.text,
      fontFamily: theme.typography.displayFamily,
      fontSize: theme.typography.display.section,
      lineHeight: 27,
      textTransform: 'uppercase'
    },
    body: {
      color: theme.colors.textMuted,
      fontSize: theme.typography.body.medium,
      lineHeight: 21,
      maxWidth: 520
    }
  });
