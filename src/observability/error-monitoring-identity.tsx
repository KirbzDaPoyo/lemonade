import { useAuth } from '@clerk/expo';
import { useEffect } from 'react';

import { errorMonitoring } from './error-monitoring';

export function ErrorMonitoringIdentitySync() {
  const { isLoaded, userId } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;

    if (userId) errorMonitoring.identify(userId);
    else errorMonitoring.resetIdentity();
  }, [isLoaded, userId]);

  return null;
}
