import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { Alert } from 'react-native';

import { usePlaces } from '../store/PlacesContext';
import { useInbox } from '../store/inbox-context';
import { appRoutePaths, getPlaceDetailHref } from './route-contract';
import type { PlaceSaveOutcome } from '../repositories/savedPlaces/types';

export const saveMessages = {
  created_place: ['Place saved', 'This place and its first Instagram source are now in your private index.'],
  attached_source: ['Source added', 'This post or reel was added to the place you already saved.'],
  existing_source: ['Already saved', 'This post or reel is already attached to this place.']
} as const;
export async function resolveSavedInbox(id: string, remove: (id: string, resolved: boolean) => Promise<boolean>) {
  // The place save has already committed. Cleanup is a separate outcome.
  try { return await remove(id, true); } catch { return false; }
}
export function useInboxCompletion() {
  const router = useRouter();
  const { items, remove } = useInbox();
  const { retryStorage } = usePlaces();
  const latestItems = useRef(items);
  latestItems.current = items;
  return async (id: string, placeId: string, outcome: PlaceSaveOutcome) => {
    const cleaned = await resolveSavedInbox(id, remove);
    if (outcome === 'existing_source') retryStorage();
    const remaining = latestItems.current.length - (cleaned && latestItems.current.some(item => item.id === id) ? 1 : 0);
    const [title, message] = saveMessages[outcome];
    router.dismissTo(appRoutePaths.inbox);
    Alert.alert(title, `${message} ${remaining} remaining in inbox.${cleaned ? '' : ' The place is saved, but inbox cleanup failed. Retry this item to remove it safely.'}`, [
      { text: 'Continue in inbox', style: 'cancel' },
      { text: 'Open place', onPress: () => router.push(getPlaceDetailHref(placeId)) }
    ]);
  };
}
