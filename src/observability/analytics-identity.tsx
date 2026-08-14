import { useAuth } from '@clerk/expo';
import { useEffect } from 'react';

import { analytics } from './analytics';

export function AnalyticsIdentitySync() {
  const { isLoaded, userId } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;

    if (userId) analytics.identify(userId);
    else analytics.reset();
  }, [isLoaded, userId]);

  return null;
}
