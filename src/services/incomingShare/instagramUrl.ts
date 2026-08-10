const URL_CANDIDATE_PATTERN = /https?:\/\/[^\s<>"']+/gi;
const TRAILING_PUNCTUATION_PATTERN = /[)\]}>.,!?]+$/g;

const INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com']);
const INSTAGRAM_POST_PATHS = new Set(['p', 'reel', 'reels']);

export function extractInstagramUrl(
  input: string | null | undefined
): string | null {
  if (!input) {
    return null;
  }

  const candidates = input.match(URL_CANDIDATE_PATTERN) ?? [input.trim()];

  for (const candidate of candidates) {
    try {
      const url = new URL(
        candidate.replace(TRAILING_PUNCTUATION_PATTERN, '')
      );
      const pathSegments = url.pathname.split('/').filter(Boolean);

      if (
        url.protocol !== 'https:' ||
        !INSTAGRAM_HOSTS.has(url.hostname.toLowerCase()) ||
        pathSegments.length !== 2 ||
        !INSTAGRAM_POST_PATHS.has(pathSegments[0].toLowerCase()) ||
        !/^[A-Za-z0-9_-]+$/.test(pathSegments[1])
      ) {
        continue;
      }

      url.hash = '';
      return url.toString();
    } catch {
      // Shared text can contain several non-URL tokens before a usable URL.
    }
  }

  return null;
}
