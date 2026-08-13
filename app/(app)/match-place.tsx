import { Redirect } from 'expo-router';

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
    <V2CandidateMatchScreen
      candidates={candidates}
      draft={draft}
      navigation={navigation}
    />
  );
}
