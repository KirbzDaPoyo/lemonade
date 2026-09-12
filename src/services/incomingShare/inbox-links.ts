import { extractInstagramUrl, normalizeInstagramSourceUrl } from './instagramUrl';

export const INBOX_BATCH_LIMIT = 20;
export const INBOX_CAPACITY = 100;
export const extractInboxLinks = (text: string) => {
  const tokens = text.match(/https?:\/\/[^\s<>"']+/gi) ?? (text.trim() ? [text.trim()] : []);
  const urls: string[] = [];
  const seen = new Set<string>();
  let invalid = 0;
  let duplicate = 0;
  let omitted = 0;
  for (const token of tokens) {
    const extracted = token.length <= 2048 ? extractInstagramUrl(token) : null;
    if (!extracted) { invalid++; continue; }
    const canonical = normalizeInstagramSourceUrl(extracted);
    if (seen.has(canonical)) { duplicate++; continue; }
    seen.add(canonical);
    if (urls.length === INBOX_BATCH_LIMIT) { omitted++; continue; }
    urls.push(canonical);
  }
  return { urls, invalid, duplicate, omitted };
};
