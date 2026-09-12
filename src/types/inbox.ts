import type { AnalyticsFailureCategory } from '../observability/analytics-contract';

export type InboxOrigin = 'share' | 'manual';
export type InboxItem = {
  id: string;
  sourceUrl: string;
  origin: InboxOrigin;
  status: 'pending' | 'needs_attention';
  placeNameHint: string | null;
  failureCategory: AnalyticsFailureCategory | null;
  attemptCount: number;
  lastAttemptAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type EnqueueOutcome = 'queued' | 'already_queued' | 'already_saved' | 'invalid' | 'capacity_reached';
export type EnqueueResult = { sourceUrl: string; outcome: EnqueueOutcome; placeId: string | null };
export type CaptureSummary = Record<EnqueueOutcome, number> & { duplicate: number; omitted: number; submitted: number };
export const sortInbox = (items: InboxItem[]) => [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
