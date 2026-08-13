import { useImportFlow } from '../../src/navigation/import-flow-context';
import { useAppNavigation } from '../../src/navigation/use-app-navigation';
import { V2AddPlaceScreen } from '../../src/screens/v2-add-place-screen';

export default function AddPlaceRoute() {
  const navigation = useAppNavigation();
  const { initialInstagramUrl, requestId } = useImportFlow();

  return (
    <V2AddPlaceScreen
      initialInstagramUrl={initialInstagramUrl}
      key={requestId}
      navigation={navigation}
    />
  );
}
