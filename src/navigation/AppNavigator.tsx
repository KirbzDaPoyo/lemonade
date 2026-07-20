import { useState } from 'react';

import { AddPlaceScreen } from '../screens/AddPlaceScreen';
import { CandidateMatchScreen } from '../screens/CandidateMatchScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { PlaceDetailScreen } from '../screens/PlaceDetailScreen';
import { AppNavigation, AppRoute } from './types';

export function AppNavigator() {
  const [stack, setStack] = useState<AppRoute[]>([{ name: 'Home' }]);
  const currentRoute = stack[stack.length - 1];

  const navigation: AppNavigation = {
    navigate: (route) => setStack((currentStack) => [...currentStack, route]),
    replace: (route) =>
      setStack((currentStack) => [...currentStack.slice(0, -1), route]),
    goBack: () =>
      setStack((currentStack) =>
        currentStack.length > 1 ? currentStack.slice(0, -1) : currentStack
      ),
    resetToHome: () => setStack([{ name: 'Home' }])
  };

  if (currentRoute.name === 'AddPlace') {
    return <AddPlaceScreen navigation={navigation} />;
  }

  if (currentRoute.name === 'CandidateMatch') {
    return (
      <CandidateMatchScreen
        candidates={currentRoute.candidates}
        draft={currentRoute.draft}
        navigation={navigation}
      />
    );
  }

  if (currentRoute.name === 'PlaceDetail') {
    return <PlaceDetailScreen navigation={navigation} placeId={currentRoute.placeId} />;
  }

  return <HomeScreen navigation={navigation} />;
}
