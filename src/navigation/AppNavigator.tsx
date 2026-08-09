import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useShareIntentContext } from 'expo-share-intent';

import { AddPlaceScreen } from '../screens/AddPlaceScreen';
import { CandidateMatchScreen } from '../screens/CandidateMatchScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { PlaceDetailScreen } from '../screens/PlaceDetailScreen';
import { extractInstagramUrl } from '../services/incomingShare/instagramUrl';
import { AppNavigation, AppRoute } from './types';

export function AppNavigator() {
  const [stack, setStack] = useState<AppRoute[]>([{ name: 'Home' }]);
  const handlingShareRef = useRef(false);
  const shareSequenceRef = useRef(0);
  const { error, hasShareIntent, resetShareIntent, shareIntent } =
    useShareIntentContext();
  const currentRoute = stack[stack.length - 1];

  useEffect(() => {
    if (!hasShareIntent) {
      handlingShareRef.current = false;
      return;
    }

    if (handlingShareRef.current) {
      return;
    }

    handlingShareRef.current = true;

    const instagramUrl =
      extractInstagramUrl(shareIntent.webUrl) ??
      extractInstagramUrl(shareIntent.text);

    resetShareIntent();

    if (!instagramUrl) {
      Alert.alert(
        'Not an Instagram post',
        'Share a public Instagram post or reel URL.'
      );
      return;
    }

    shareSequenceRef.current += 1;
    setStack([
      { name: 'Home' },
      {
        name: 'AddPlace',
        initialInstagramUrl: instagramUrl,
        autoStart: true,
        shareRequestId: shareSequenceRef.current
      }
    ]);
  }, [
    hasShareIntent,
    resetShareIntent,
    shareIntent.text,
    shareIntent.webUrl
  ]);

  useEffect(() => {
    if (error) {
      Alert.alert('Could not receive share', error);
    }
  }, [error]);

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
    return (
      <AddPlaceScreen
        autoStart={currentRoute.autoStart}
        initialInstagramUrl={currentRoute.initialInstagramUrl}
        key={currentRoute.shareRequestId ?? 'manual-add-place'}
        navigation={navigation}
      />
    );
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
