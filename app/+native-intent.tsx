import { recipientLinks, routeRecipientLink } from '../src/navigation/recipient-links';
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try { return routeRecipientLink(path); } catch { recipientLinks.clear(); return '/shared'; }
}
