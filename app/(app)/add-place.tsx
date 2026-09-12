import { useEffect } from 'react';
import { AppRecoveryBoundary } from '../../src/components/app-recovery-boundary';
import { useImportFlow } from '../../src/navigation/import-flow-context';
import { useAppNavigation } from '../../src/navigation/use-app-navigation';
import { V2AddPlaceScreen } from '../../src/screens/v2-add-place-screen';

export default function AddPlaceRoute() {
  const navigation = useAppNavigation();
  const { initialInstagramUrl, inboxItem, requestId, setActive } = useImportFlow();

  useEffect(() => { setActive(true); return () => setActive(false); }, [setActive]);
  return (
    <AppRecoveryBoundary
      category="import"
      onLeave={navigation.goBack}
      operation="import_flow"
      resetLabel="Leave import"
      title="Import paused"
    >
      <V2AddPlaceScreen
        initialInstagramUrl={initialInstagramUrl}
        inboxItem={inboxItem}
        key={requestId}
        navigation={navigation}
      />
    </AppRecoveryBoundary>
  );
}
