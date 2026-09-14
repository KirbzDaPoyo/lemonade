import { Redirect, useLocalSearchParams } from 'expo-router';
import { PlansScreen } from '../../../src/screens/plans-screen';
import { useAppNavigation } from '../../../src/navigation/use-app-navigation';
export default function PlanRoute() { const { planId } = useLocalSearchParams<{
    planId?: string;
}>(); const navigation = useAppNavigation(); return typeof planId === 'string' ? <PlansScreen navigation={navigation} planId={planId}/> : <Redirect href="/plans"/>; }
