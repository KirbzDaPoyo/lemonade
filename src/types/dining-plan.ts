import type { PlaceCard } from './place';
export type DiningPlan = {
    id: string;
    title: string;
    status: 'active' | 'completed';
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
    placeIds: string[];
};
export function normalizePlanTitle(value: string) {
    const title = value.trim();
    if (!title || Array.from(title).length > 80)
        throw new Error('Use a title between 1 and 80 characters.');
    return title;
}
export function sortPlans(plans: DiningPlan[]) {
    return [...plans].sort((a, b) => Number(a.status === 'completed') - Number(b.status === 'completed') || (b.completedAt ?? b.updatedAt).localeCompare(a.completedAt ?? a.updatedAt) || a.id.localeCompare(b.id));
}
export function planTransition(status: DiningPlan['status'], now = new Date().toISOString()) { return { status, completedAt: status === 'completed' ? now : null }; }
export function membershipFeedback(plan: DiningPlan, placeId: string) { return plan.placeIds.includes(placeId) ? 'Already in this plan.' : plan.placeIds.length >= 20 ? 'This plan is full (20 places).' : null; }
export function planPlaces(plan: DiningPlan, places: PlaceCard[]) { const byId = new Map(places.map(p => [p.id, p])); return plan.placeIds.flatMap(id => byId.has(id) ? [byId.get(id)!] : []); }
export function pickPlanPlace(places: PlaceCard[], includeSkipped = false, random = Math.random): PlaceCard | null {
    const eligible = places.filter(p => includeSkipped || p.status !== 'skipped');
    if (!eligible.length)
        return null;
    if (eligible.length === 1)
        return eligible[0];
    const value = random();
    const index = Math.floor(Math.max(0, Math.min(1 - Number.EPSILON, Number.isFinite(value) ? value : 0)) * eligible.length);
    return eligible[index];
}
