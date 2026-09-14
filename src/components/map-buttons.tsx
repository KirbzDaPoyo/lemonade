import { Alert, Linking } from 'react-native';
import { V2Button } from './v2-controls';
import { buildMapUrl, type MapAction } from '../services/map-handoff';
import type { PlaceCard } from '../types/place';
import { analytics } from '../observability/analytics';
export function MapButtons({ place }: {
    place: PlaceCard;
}) {
    const open = async (action: MapAction) => { const url = buildMapUrl(place, action); if (!url)
        return; try {
        await Linking.openURL(url);
        analytics.mapHandoffOpened(action);
    }
    catch {
        Alert.alert('Maps unavailable', 'Could not open Google Maps. Try again from this button.');
    } };
    return <><V2Button variant="secondary" label={buildMapUrl(place, 'map') ? 'Open in Google Maps' : 'Map unavailable'} disabled={!buildMapUrl(place, 'map')} onPress={() => void open('map')}/><V2Button variant="secondary" label={buildMapUrl(place, 'directions') ? 'Directions' : 'Directions unavailable'} disabled={!buildMapUrl(place, 'directions')} onPress={() => void open('directions')}/></>;
}
