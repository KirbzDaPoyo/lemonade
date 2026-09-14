import { useLocalSearchParams } from 'expo-router';
import { PlansScreen } from '../../src/screens/plans-screen';
import { useAppNavigation } from '../../src/navigation/use-app-navigation';
export default function PlansRoute() { const { addPlaceId } = useLocalSearchParams<{
    addPlaceId?: string;
}>(); return <PlansScreen navigation={useAppNavigation()} addPlaceId={typeof addPlaceId === 'string' ? addPlaceId : undefined}/>; }
