import { Text, View } from 'react-native';

import { colors, radii, spacing } from '../theme';

export function StorageErrorBanner({ message }: { message: string }) {
  return (
    <View
      style={{
        backgroundColor: '#fff3f0',
        borderColor: colors.danger,
        borderRadius: radii.md,
        borderWidth: 1,
        gap: spacing.xs,
        padding: spacing.md
      }}
    >
      <Text selectable style={{ color: colors.danger, fontSize: 14, fontWeight: '900' }}>Storage issue</Text>
      <Text selectable style={{ color: colors.text, fontSize: 13, lineHeight: 18 }}>{message}</Text>
    </View>
  );
}
