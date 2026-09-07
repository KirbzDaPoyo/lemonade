import { Redirect } from 'expo-router';

import { AppRecoveryBoundary } from '../../src/components/app-recovery-boundary';
import { useImportFlow } from '../../src/navigation/import-flow-context';
import { useAppNavigation } from '../../src/navigation/use-app-navigation';
import { V2CandidateMatchScreen } from '../../src/screens/v2-candidate-match-screen';

export default function MatchPlaceRoute() {
  const navigation = useAppNavigation();
  const { candidates, draft } = useImportFlow();

  if (!draft) {
    return <Redirect href="/add-place" />;
  }

  return (
    <AppRecoveryBoundary
      category="import"
      onLeave={() => navigation.replace({ name: 'AddPlace' })}
      operation="import_flow"
      resetLabel="Return to import"
      title="Matching paused"
    >
      <V2CandidateMatchScreen
        candidates={candidates}
        draft={draft}
        navigation={navigation}
      />
    </AppRecoveryBoundary>
  );
}
