import { useEffect, useRef, useState } from 'react';
import { Alert, BackHandler } from 'react-native';
import { useShareIntentContext } from 'expo-share-intent';

import { AccountScreen } from '../screens/AccountScreen';
import { V2AddPlaceScreen } from '../screens/v2-add-place-screen';
import { V2CandidateMatchScreen } from '../screens/v2-candidate-match-screen';
import { V2HomeScreen } from '../screens/v2-home-screen';
import { V2PlaceDetailScreen } from '../screens/v2-place-detail-screen';
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

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length <= 1) return false;

      setStack((currentStack) =>
        currentStack.length > 1 ? currentStack.slice(0, -1) : currentStack
      );
      return true;
    });

    return () => subscription.remove();
  }, [stack.length]);

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

  if (currentRoute.name === 'Account') {
    return <AccountScreen navigation={navigation} />;
  }

  if (currentRoute.name === 'AddPlace') {
    return (
      <V2AddPlaceScreen
        initialInstagramUrl={currentRoute.initialInstagramUrl}
        key={currentRoute.shareRequestId ?? 'manual-add-place'}
        navigation={navigation}
      />
    );
  }

  if (currentRoute.name === 'CandidateMatch') {
    return (
      <V2CandidateMatchScreen
        candidates={currentRoute.candidates}
        draft={currentRoute.draft}
        navigation={navigation}
      />
    );
  }

  if (currentRoute.name === 'PlaceDetail') {
    return <V2PlaceDetailScreen navigation={navigation} placeId={currentRoute.placeId} />;
  }

  return <V2HomeScreen navigation={navigation} />;
}
