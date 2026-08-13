import { useRouter } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

import { useImportFlow } from './import-flow-context';
import { appRoutePaths } from './route-contract';
import { getIncomingInstagramUrl } from './share-routing';


export function AuthenticatedShareCoordinator() {
  const router = useRouter();
  const { beginSharedAdd } = useImportFlow();
  const handlingShareRef = useRef(false);
  const { error, hasShareIntent, resetShareIntent, shareIntent } =
    useShareIntentContext();

  useEffect(() => {
    if (!hasShareIntent) {
      handlingShareRef.current = false;
      return;
    }

    if (handlingShareRef.current) {
      return;
    }

    handlingShareRef.current = true;
    const instagramUrl = getIncomingInstagramUrl(
      shareIntent.webUrl,
      shareIntent.text
    );

    resetShareIntent();

    if (!instagramUrl) {
      Alert.alert(
        'Not an Instagram post',
        'Share a public Instagram post or reel URL.'
      );
      return;
    }

    beginSharedAdd(instagramUrl);
    if (router.canDismiss()) {
      router.dismissAll();
    }
    router.replace(appRoutePaths.home);
    router.push(appRoutePaths.addPlace);
  }, [
    beginSharedAdd,
    hasShareIntent,
    resetShareIntent,
    router,
    shareIntent.text,
    shareIntent.webUrl
  ]);

  useEffect(() => {
    if (error) {
      Alert.alert('Could not receive share', error);
    }
  }, [error]);

  return null;
}
