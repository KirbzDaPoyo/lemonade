import { extractInstagramUrl } from '../services/incomingShare/instagramUrl';

export const getIncomingInstagramUrl = (
  webUrl?: string | null,
  text?: string | null
) => extractInstagramUrl(webUrl) ?? extractInstagramUrl(text);
