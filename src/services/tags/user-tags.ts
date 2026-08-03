export const MAX_USER_TAG_LENGTH = 40;

export const normalizeUserTag = (value: string) =>
  value
    .normalize('NFKC')
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ')
    .slice(0, MAX_USER_TAG_LENGTH)
    .trim();

export const getUserTagKey = (value: string) => normalizeUserTag(value).toLowerCase();

const uniqueUserTags = (tags: string[]) => {
  const seen = new Set<string>();

  return tags.flatMap((tag) => {
    const normalized = normalizeUserTag(tag);
    const key = getUserTagKey(normalized);

    if (!normalized || seen.has(key)) {
      return [];
    }

    seen.add(key);
    return [normalized];
  });
};

export const addUserTag = (tags: string[], tag: string) => uniqueUserTags([...tags, tag]);

export const deleteUserTag = (tags: string[], tagToDelete: string) => {
  const deletedKey = getUserTagKey(tagToDelete);
  return tags.filter((tag) => getUserTagKey(tag) !== deletedKey);
};

const searchableText = (value: string) =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const suggestUserTags = (
  availableTags: string[],
  clues: Array<string | null | undefined>
) => {
  if (availableTags.length === 0) {
    return [];
  }

  const haystack = ` ${searchableText(clues.filter(Boolean).join(' '))} `;

  return uniqueUserTags(availableTags).filter((tag) => {
    const phrase = searchableText(tag);
    return Boolean(phrase) && haystack.includes(` ${phrase} `);
  });
};
