import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { AppNavigator } from './src/navigation/AppNavigator';
import { PlacesProvider } from './src/store/PlacesContext';
import { colors } from './src/theme';

export default function App() {
  return (
    <SafeAreaProvider>
      <PlacesProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <StatusBar style="dark" />
          <AppNavigator />
        </SafeAreaView>
      </PlacesProvider>
    </SafeAreaProvider>
  );
}
