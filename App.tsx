import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native';

import { AppNavigator } from './src/navigation/AppNavigator';
import { PlacesProvider } from './src/store/PlacesContext';
import { colors } from './src/theme';

export default function App() {
  return (
    <PlacesProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar style="dark" />
        <AppNavigator />
      </SafeAreaView>
    </PlacesProvider>
  );
}
