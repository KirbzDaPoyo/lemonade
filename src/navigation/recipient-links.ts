// Pure routing boundary. Never return a bearer in an Expo Router path or params.
const TOKEN = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;
export function approvedSharingOrigin(value: string | undefined): string | undefined {
  try {
    const url = new URL(value ?? '');
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) return;
    return url.origin;
  } catch { return; }
}
export function parseRecipientLink(path: string, origin: string | undefined, development = false): { handled: boolean; token: string | null } {
  const scheme = development ? 'project-lemonade-dev' : 'project-lemonade';
  const prefixes = [`${scheme}://shared#`, '/shared#', '/s#', ...(origin ? [`${origin}/s#`] : [])];
  for (const prefix of prefixes) {
    if (path.startsWith(prefix)) {
      const token = path.slice(prefix.length);
      return { handled: true, token: TOKEN.test(token) ? token : null };
    }
  }
  // Fail closed on recipient-looking links, including encoded paths and wrong hosts.
  try {
    const url = new URL(path, 'https://local.invalid');
    const route = decodeURIComponent(url.pathname);
    const handled = /^shared(?:\/|$)/i.test(decodeURIComponent(url.hostname)) || /\/(?:s|shared)(?:[/?#]|$)/i.test(path) || /^\/(?:s|shared)(?:\/|$)/i.test(route);
    return { handled, token: null };
  } catch { return { handled: true, token: null }; }
}
export class RecipientLinkSession {
  private token: string | null = null;
  private version = 0;
  private listeners = new Set<() => void>();
  getVersion = () => this.version;
  getToken = () => this.token;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  accept(token: string | null) { this.token = token; this.version++; for (const listener of this.listeners) listener(); }
  clear() { this.accept(null); }
}
export const recipientLinks = new RecipientLinkSession();
export function routeRecipientLink(path: string) {
  const result = parseRecipientLink(path, approvedSharingOrigin(process.env.EXPO_PUBLIC_SHARING_ORIGIN), process.env.EXPO_PUBLIC_APP_ENV === 'development');
  if (!result.handled) return path;
  recipientLinks.accept(result.token);
  return '/shared';
}
