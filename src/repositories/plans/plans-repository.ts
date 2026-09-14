import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePlanTitle, sortPlans, type DiningPlan } from '../../types/dining-plan';
type PlanRow = {
    id: string;
    title: string;
    status: DiningPlan['status'];
    completed_at: string | null;
    created_at: string;
    updated_at: string;
    dining_plan_items?: {
        saved_place_id: string;
        created_at: string;
        id: string;
    }[];
};
export function mapPlanRow(row: PlanRow): DiningPlan { return { id: row.id, title: row.title, status: row.status, completedAt: row.completed_at, createdAt: row.created_at, updatedAt: row.updated_at, placeIds: [...(row.dining_plan_items ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)).map(i => i.saved_place_id) }; }
const fields = 'id,title,status,completed_at,created_at,updated_at,dining_plan_items(id,saved_place_id,created_at)';
export class PlanStorageError extends Error {
}
function check(error: unknown) {
    if (!error)
        return;
    const code = (error as {
        code?: string;
    }).code;
    throw new PlanStorageError(code === '23505' ? 'Already in this plan.' : code === 'P0020' ? 'This plan is full (20 places).' : code === '23503' ? 'This place or plan was removed. Refresh and try again.' : 'Plan storage unavailable. Check your connection and retry.');
}
export class PlansRepository {
    constructor(private client: SupabaseClient, private userId: string) { }
    async list(): Promise<DiningPlan[]> {
        const rows: DiningPlan[] = [];
        for (let offset = 0;; offset += 100) {
            const { data, error } = await this.client.from('dining_plans').select(fields).eq('user_id', this.userId).order('id').range(offset, offset + 99);
            check(error);
            rows.push(...(data ?? []).map(row => mapPlanRow(row as PlanRow)));
            if (!data || data.length < 100)
                return sortPlans(rows);
        }
    }
    async create(title: string, id: string) {
        const { data, error } = await this.client.from('dining_plans').upsert({ id, user_id: this.userId, title: normalizePlanTitle(title) }, { onConflict: 'id', ignoreDuplicates: true }).select('id');
        check(error);
        // A retry with a committed identity must confirm ownership and retain edited intent.
        if (!data?.length)
            await this.update(id, { title });
    }
    async update(id: string, patch: {
        title?: string;
        status?: DiningPlan['status'];
    }) {
        const { data, error } = await this.client.from('dining_plans').update({ ...patch, ...(patch.title !== undefined ? { title: normalizePlanTitle(patch.title) } : {}) }).eq('id', id).eq('user_id', this.userId).select('id');
        check(error);
        if (!data?.length)
            throw new PlanStorageError('Plan was removed. Refresh your plans.');
    }
    async remove(id: string) { const { error } = await this.client.from('dining_plans').delete().eq('id', id).eq('user_id', this.userId); check(error); }
    async add(planId: string, placeId: string) { const { error } = await this.client.from('dining_plan_items').insert({ plan_id: planId, saved_place_id: placeId, user_id: this.userId }); check(error); }
    async removePlace(planId: string, placeId: string) { const { error } = await this.client.from('dining_plan_items').delete().eq('plan_id', planId).eq('saved_place_id', placeId).eq('user_id', this.userId); check(error); }
}
