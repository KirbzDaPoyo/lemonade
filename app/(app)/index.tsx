import { useAppNavigation } from '../../src/navigation/use-app-navigation';
import { V2HomeScreen } from '../../src/screens/v2-home-screen';

export default function HomeRoute() {
  const navigation = useAppNavigation();

  return <V2HomeScreen navigation={navigation} />;
}
