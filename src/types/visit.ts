import type { PlaceStatus } from './place';

export type Visit = {
  id: string; savedPlaceId: string; visitDate: string; rating: number | null;
  note: string | null; createdAt: string; updatedAt: string;
};
export type VisitDraft = { id: string; visitDate: string; rating: number | null; note: string };
export type VisitCursor = Pick<Visit, 'visitDate' | 'createdAt' | 'id'>;
export type VisitPage = {
  entries: Visit[]; hasMore: boolean;
  summary: { count: number; latestDate: string | null; latestRated: { rating: number; visitDate: string } | null };
  placeStatus: PlaceStatus; placeUpdatedAt: string;
};
export const localVisitDate = (now = new Date()) =>
  `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}
export function validateVisitDraft(draft: VisitDraft, today = localVisitDate(), originalDate?: string): string | null {
  if (!isCalendarDate(draft.visitDate)) return 'Enter a real date as YYYY-MM-DD.';
  if (draft.visitDate !== originalDate && draft.visitDate > today) return 'Choose today or an earlier date.';
  if (draft.rating !== null && (!Number.isInteger(draft.rating) || draft.rating < 1 || draft.rating > 5)) return 'Choose a rating from 1 to 5, or leave it unrated.';
  if (Array.from(draft.note).length > 2000) return 'Keep your reflection within 2,000 characters.';
  return null;
}
export function formatVisitDate(value: string): string {
  if (!isCalendarDate(value)) return value;
  const [year, month, day] = value.split('-').map(Number);
  // Build a local date; parsing YYYY-MM-DD as an instant would shift the day west of UTC.
  const date = new Date(2000, month - 1, day, 12);
  date.setFullYear(year);
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
// Same UUID approach as existing plan drafts. This is a deduplication ID, not a secret.
export const newVisitId = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const r = Math.floor(Math.random() * 16); return (c === 'x' ? r : (r & 3) | 8).toString(16);
});

export type VisitSummary = { count: number; latestDate: string | null; latestRating: number | null };
export type VisitExport = Visit & { validationTimezone: string };
