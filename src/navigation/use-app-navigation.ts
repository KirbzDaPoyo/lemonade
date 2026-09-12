import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { useImportFlow } from './import-flow-context';
import { appRoutePaths, getPlaceDetailHref } from './route-contract';
import type { AppNavigation, AppRoute } from './types';


export function useAppNavigation(): AppNavigation {
  const router = useRouter();
  const { beginInboxAdd, beginManualAdd, beginSharedAdd, showCandidates } = useImportFlow();

  return useMemo(() => {
    const prepareRoute = (route: AppRoute) => {
      if (route.name === 'AddPlace') {
        if (route.inboxItem) {
          beginInboxAdd(route.inboxItem);
        } else if (route.initialInstagramUrl) {
          beginSharedAdd(route.initialInstagramUrl);
        } else {
          beginManualAdd();
        }
      }

      if (route.name === 'CandidateMatch') {
        showCandidates(route.draft, route.candidates);
      }
    };

    const hrefForRoute = (route: AppRoute) => {
      switch (route.name) {
        case 'Inbox':
          return appRoutePaths.inbox;
        case 'Home':
          return appRoutePaths.home;
        case 'Account':
          return appRoutePaths.account;
        case 'AddPlace':
          return appRoutePaths.addPlace;
        case 'CandidateMatch':
          return appRoutePaths.matchPlace;
        case 'PlaceDetail':
          return getPlaceDetailHref(route.placeId);
      }
    };

    return {
      navigate: (route) => {
        prepareRoute(route);
        router.push(hrefForRoute(route));
      },
      replace: (route) => {
        prepareRoute(route);
        router.replace(hrefForRoute(route));
      },
      goBack: () => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace(appRoutePaths.home);
        }
      },
      resetToHome: () => {
        if (router.canDismiss()) {
          router.dismissAll();
        }
        router.replace(appRoutePaths.home);
      }
    };
  }, [beginInboxAdd, beginManualAdd, beginSharedAdd, router, showCandidates]);
}
