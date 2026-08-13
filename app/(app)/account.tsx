import { useAppNavigation } from '../../src/navigation/use-app-navigation';
import { AccountScreen } from '../../src/screens/AccountScreen';

export default function AccountRoute() {
  const navigation = useAppNavigation();

  return <AccountScreen navigation={navigation} />;
}
