import { Text, View } from 'react-native';

import { colors } from '../theme';
import { AppButton } from './AppButton';

export function ScreenHeader({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View style={{ alignItems: 'center', flexDirection: 'row' }}>
      <View style={{ alignItems: 'flex-start', flex: 1 }}>
        <AppButton label="Back" onPress={onBack} variant="ghost" />
      </View>
      <Text numberOfLines={1} style={{ color: colors.text, flex: 2, fontSize: 24, fontWeight: '900', textAlign: 'center' }}>
        {title}
      </Text>
      <View style={{ flex: 1 }} />
    </View>
  );
}
