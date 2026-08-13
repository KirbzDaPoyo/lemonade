import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppTheme, useAppTheme } from '../design-system/theme';
import { AppButton } from './AppButton';

export function ScreenHeader({ onBack, title }: { onBack: () => void; title: string }) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.header}>
      <AppButton compact label="Back" onPress={onBack} style={styles.side} variant="ghost" />
      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      <View style={styles.side} />
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    header: {
      alignItems: 'center',
      borderBottomColor: theme.colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      minHeight: 56,
      paddingBottom: theme.spacing.sm
    },
    side: {
      width: 80
    },
    title: {
      color: theme.colors.text,
      flex: 1,
      fontFamily: theme.typography.displayFamily,
      fontSize: theme.typography.display.section,
      letterSpacing: 0.2,
      lineHeight: 28,
      textAlign: 'center',
      textTransform: 'uppercase'
    }
  });
