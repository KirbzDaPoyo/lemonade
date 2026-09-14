import type { PlaceCard } from '../types/place';
export type MapAction = 'map' | 'directions';
type MapPlace = Pick<PlaceCard, 'placeName' | 'address' | 'mapUrl' | 'placeId'>;
export function validStoredMapUrl(value?: string): string | null {
    if (!value || value.length > 2048)
        return null;
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.username || url.password || url.port)
            return null;
        if ((url.hostname === 'www.google.com' || url.hostname === 'google.com' || url.hostname === 'maps.google.com') && (url.pathname === '/maps' || url.pathname.startsWith('/maps/') || url.hostname === 'maps.google.com'))
            return url.href.length <= 2048 ? url.href : null;
        if ((url.hostname === 'maps.app.goo.gl' || url.hostname === 'goo.gl' && url.pathname.startsWith('/maps/')) && url.pathname.length > 1)
            return url.href.length <= 2048 ? url.href : null;
    }
    catch { }
    return null;
}
export function buildMapUrl(place: MapPlace, action: MapAction): string | null {
    const query = [place.placeName.trim(), place.address.trim()].filter(Boolean).join(', ');
    const stored = validStoredMapUrl(place.mapUrl);
    const construct = () => {
        if (!query)
            return null;
        const params = new URLSearchParams({ api: '1', [action === 'map' ? 'query' : 'destination']: query });
        if (place.placeId?.trim())
            params.set(action === 'map' ? 'query_place_id' : 'destination_place_id', place.placeId.trim());
        const url = `https://www.google.com/maps/${action === 'map' ? 'search' : 'dir'}/?${params}`;
        return url.length <= 2048 ? url : null;
    };
    if (place.placeId?.trim())
        return construct();
    if (action === 'map' && stored)
        return stored;
    if (action === 'directions' && stored) {
        const url = new URL(stored);
        if (url.pathname.startsWith('/maps/dir/') && url.searchParams.get('api') === '1' && url.searchParams.get('destination')) {
            url.searchParams.delete('origin');
            url.searchParams.delete('origin_place_id');
            return url.href.length <= 2048 ? url.href : null;
        }
    }
    return construct();
}
