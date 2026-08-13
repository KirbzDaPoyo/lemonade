import { useAuth } from '@clerk/expo';
import { Redirect, Stack } from 'expo-router';

import { useAppTheme } from '../../src/design-system/theme';
import { ImportFlowProvider } from '../../src/navigation/import-flow-context';
import { AuthenticatedShareCoordinator } from '../../src/navigation/share-coordinator';
import { PlacesProvider } from '../../src/store/PlacesContext';

export default function AuthenticatedLayout() {
  const { getToken, userId } = useAuth();
  const { theme } = useAppTheme();

  if (!userId) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <PlacesProvider accessTokenProvider={getToken} userId={userId}>
      <ImportFlowProvider>
        <AuthenticatedShareCoordinator />
        <Stack
          screenOptions={{
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: theme.colors.background },
            headerShown: false
          }}
        />
      </ImportFlowProvider>
    </PlacesProvider>
  );
}
