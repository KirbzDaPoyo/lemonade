// Generated from src/services/sharing-content.ts. Run node script/build-sharing-web.mjs.
export const sharingDisclosure = {
    heading: 'Review what you will share',
    publicFields: 'Your public title, the place names and optional locations you enter, their order, and available Google Maps links will be visible.',
    audience: 'Anyone with the link can view and forward it without an account.',
    updates: 'Changes to this plan and its public details appear the next time someone opens or refreshes the link.',
    incomplete: 'If you add a place without a public name, the shared page will be unavailable until you add that name.',
    revocation: 'Disabling the link stops future access. It cannot remove content already displayed, screenshots, or copies.',
    authorship: 'Write public names and locations yourself, using information you know independently. Do not copy imported provider text into these fields.',
    caution: 'Only enter information you intend to share. Anything you type in these public fields can be seen by recipients.',
    excluded: 'Your private plan title, notes, journals, ratings, visit dates, tags, favorites, saved-place status, account details, and Instagram sources are not included automatically.',
    maps: 'Opening a map link sends that destination to Google Maps, which operates under its own privacy policy.',
    confirmation: 'Enable read-only link'
};
function record(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Shared content unavailable');
    return value;
}
function keys(value, allowed) {
    const actual = Object.keys(value);
    if (actual.length !== allowed.length || actual.some(key => !allowed.includes(key)))
        throw new Error('Shared content unavailable');
}
function text(value, maximum) {
    if (typeof value !== 'string' || value !== value.trim() || !value || [...value].length > maximum ||
        /[\u0000-\u001f\u007f]/u.test(value))
        throw new Error('Shared content unavailable');
    return value;
}
function destination(value, name, location) {
    if (value === null)
        return null;
    if (typeof value !== 'string' || new TextEncoder().encode(value).length > 1024)
        throw new Error('Shared content unavailable');
    let url;
    try {
        url = new URL(value);
    }
    catch {
        throw new Error('Shared content unavailable');
    }
    const query = [name, location].filter(Boolean).join(', ');
    const params = new URLSearchParams({ api: '1', query });
    const placeId = url.searchParams.get('query_place_id');
    if (placeId !== null) {
        if (!/^[A-Za-z0-9_-]{1,255}$/.test(placeId))
            throw new Error('Shared content unavailable');
        params.set('query_place_id', placeId);
    }
    // Equality rejects extra/duplicate parameters, fragments, redirects, credentials,
    // alternative hosts/schemes and a destination differing from the preview text.
    if (value !== 'https://www.google.com/maps/search/?' + params)
        throw new Error('Shared content unavailable');
    return value;
}
export function parseSharedPlanContent(value) {
    const raw = record(value);
    keys(raw, ['schemaVersion', 'title', 'places']);
    if (raw.schemaVersion !== 1 || !Array.isArray(raw.places) || raw.places.length > 20)
        throw new Error('Shared content unavailable');
    const title = text(raw.title, 80);
    const places = raw.places.map(value => {
        const row = record(value);
        keys(row, ['name', 'location', 'mapUrl']);
        const name = text(row.name, 200);
        const location = row.location === null ? null : text(row.location, 300);
        return { name, location, mapUrl: destination(row.mapUrl, name, location) };
    });
    const result = { schemaVersion: 1, title, places };
    if (new TextEncoder().encode(JSON.stringify(result)).length > 65536)
        throw new Error('Shared content unavailable');
    return result;
}
export function createSharingReview(value) {
    return { content: parseSharedPlanContent(value), disclosure: sharingDisclosure };
}
