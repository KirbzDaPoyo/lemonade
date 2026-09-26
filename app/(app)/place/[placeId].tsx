import { Redirect, useLocalSearchParams } from 'expo-router';

import { useAppNavigation } from '../../../src/navigation/use-app-navigation';
import { V2PlaceDetailScreen } from '../../../src/screens/v2-place-detail-screen';

export default function PlaceDetailRoute() {
  const navigation = useAppNavigation();
  const { placeId, logVisit } = useLocalSearchParams<{ placeId?: string | string[]; logVisit?: string }>();
  const resolvedPlaceId = Array.isArray(placeId) ? placeId[0] : placeId;

  if (!resolvedPlaceId) {
    return <Redirect href="/" />;
  }

  return (
    <V2PlaceDetailScreen
      navigation={navigation}
      key={resolvedPlaceId}
      placeId={resolvedPlaceId}
      logVisit={logVisit === '1'}
    />
  );
}
