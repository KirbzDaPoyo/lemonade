import { useAppNavigation } from '../../src/navigation/use-app-navigation';
import { V2InboxScreen } from '../../src/screens/v2-inbox-screen';
export default function InboxRoute() { return <V2InboxScreen navigation={useAppNavigation()} />; }
