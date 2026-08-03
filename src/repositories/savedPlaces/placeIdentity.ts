export const normalizeInstagramSourceUrl = (value: string) => {
  const trimmedValue = value.trim();

  try {
    const url = new URL(trimmedValue);
    const match = url.pathname.match(/^\/(p|reels?)\/([^/]+)\/?$/i);

    if (
      url.protocol === 'https:' &&
      ['instagram.com', 'www.instagram.com'].includes(url.hostname.toLowerCase()) &&
      match
    ) {
      const contentType = match[1].toLowerCase() === 'p' ? 'p' : 'reel';
      return `https://www.instagram.com/${contentType}/${match[2]}/`;
    }
  } catch {
    // Invalid URLs are validated by the Add Place screen before reaching persistence.
  }

  return trimmedValue;
};
