import { inferGeoContext } from '../../config/geoContext';
import { normalizePlaceTags } from '../tags/placeTagNormalizer';
import type { PlaceExtractionResult, PlaceSearchCandidate, PlaceSearchSourceSignal } from '../../types/extraction';
import type { PlaceCategory } from '../../types/place';
import type { PlaceExtractionInput, PlaceExtractionService } from './types';

type ParsedPinLine = {
  raw: string;
  text: string;
  parsedPlaceName?: string;
  parsedAddress?: string;
  isAddressLike: boolean;
};

type CaptionSignals = {
  pinLines: ParsedPinLine[];
  rawHandles: string[];
  possibleTitleLine?: string;
  addressLikeLines: string[];
  districtHints: string[];
  categoryHints: string[];
};

const districtHints = [
  'Causeway Bay',
  'Tsim Sha Tsui',
  'Sham Shui Po',
  'Central',
  'San Po Kong',
  'Kowloon',
  'Wan Chai',
  'Sheung Wan',
  'Mong Kok',
  'Yau Ma Tei',
  'Jordan',
  'Admiralty',
  'North Point',
  'Quarry Bay',
  'Hong Kong'
];

const categorySignals: Array<{
  category: Exclude<PlaceCategory, 'other'>;
  keywords: string[];
}> = [
  { category: 'cafe', keywords: ['cafe', 'coffee', 'espresso', 'latte'] },
  { category: 'restaurant', keywords: ['restaurant', 'dinner', 'lunch', 'bistro', 'ramen'] },
  { category: 'street_food', keywords: ['street food', 'stall', 'vendor', 'noodles'] },
  { category: 'dessert', keywords: ['dessert', 'cake', 'toast', 'ice cream', 'bakery'] },
  { category: 'bar', keywords: ['bar', 'cocktail', 'wine', 'beer'] },
  { category: 'market', keywords: ['market', 'night market', 'food hall', 'vendors'] }
];

const categoryKeywords = [
  'cafe',
  'coffee',
  'ramen',
  'restaurant',
  'bakery',
  'bar',
  'dessert',
  'brunch',
  'noodles',
  'pastry',
  'cocktail',
  'sushi',
  'dim sum',
  'cha chaan teng'
];

const addressIndicators = [
  'shop',
  'floor',
  'g/f',
  'f/',
  '/f',
  'road',
  'street',
  'avenue',
  'centre',
  'center',
  'terminal',
  'harbour city',
  'world trade centre'
];

const weakQueryTerms = new Set([
  'hong',
  'kong',
  'singapore',
  'hk',
  'sg',
  'cafe',
  'coffee',
  'restaurant',
  'ramen',
  'bakery',
  'bar',
  'dessert',
  'food',
  'central',
  'kowloon',
  'causeway',
  'bay',
  'tsim',
  'sha',
  'tsui',
  'sham',
  'shui',
  'po',
  'san',
  'kong',
  '\u9999\u6e2f',
  '\u65b0\u52a0\u5761'
]);

const noisyUsernameSuffixes = ['hongkong', 'official', 'restaurant'];
const knownHandleWords = [
  'coffee',
  'daily',
  'spin',
  'tailor',
  'bakehouse',
  'bake',
  'house',
  'cafe',
  'ramen',
  'noodle',
  'noodles',
  'bakery',
  'bar'
];

const normalize = (value: string) => value.trim().replace(/\s+/g, ' ');
const lower = (value: string) => normalize(value).toLowerCase();
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const containsKeyword = (text: string, keyword: string) => {
  const phrase = lower(keyword)
    .split(/\s+/)
    .map(escapeRegex)
    .join('\\s+');

  return new RegExp(
    `(?:^|[^\\p{L}\\p{M}\\p{N}])${phrase}(?=$|[^\\p{L}\\p{M}\\p{N}])`,
    'u'
  ).test(lower(text));
};
const isMeaningfulQueryToken = (token: string) =>
  Array.from(token).length > 2 || /[^\u0000-\u007f]/u.test(token);
const queryTokens = (value: string) =>
  lower(value)
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((token) => token && isMeaningfulQueryToken(token));
const compact = (values: Array<string | null | undefined>) =>
  values.map((value) => value?.trim()).filter((value): value is string => Boolean(value));
const unique = <T>(values: T[], key: (value: T) => string) => {
  const seen = new Set<string>();

  return values.filter((value) => {
    const id = key(value).toLowerCase();

    if (!id || seen.has(id)) {
      return false;
    }

    seen.add(id);
    return true;
  });
};

const stripHandle = (value: string) => normalize(value).replace(/^@+/, '');

const splitKnownHandleWords = (value: string) => {
  let rest = value.toLowerCase();
  const words: string[] = [];
  const suffixes: string[] = [];

  if (rest.endsWith('hk') && rest.length > 2) {
    rest = rest.slice(0, -2);
    suffixes.push('hk');
  }

  if (rest.startsWith('the') && rest.length > 3) {
    words.push('the');
    rest = rest.slice(3);
  }

  while (rest.length) {
    const nextWord = knownHandleWords.find((word) => rest.startsWith(word));

    if (!nextWord) {
      return value;
    }

    words.push(nextWord);
    rest = rest.slice(nextWord.length);
  }

  return [...words, ...suffixes].join(' ') || value;
};
const appendGeoSuffix = (value: string, suffix: string) =>
  lower(value).includes(lower(suffix)) ? normalize(value) : `${normalize(value)} ${suffix}`;

const isAddressLike = (value: string) => {
  const text = lower(value);
  return /\d/.test(text) || addressIndicators.some((indicator) => text.includes(indicator));
};

const getDistrictHints = (text: string) =>
  districtHints.filter((district) => lower(text).includes(district.toLowerCase()));

const getCategoryHints = (text: string) =>
  categoryKeywords.filter((keyword) => containsKeyword(text, keyword));

const getCategory = (text: string): PlaceCategory | null =>
  categorySignals.find((signal) =>
    signal.keywords.some((keyword) => containsKeyword(text, keyword))
  )?.category ?? null;

const isLikelyTitleLine = (line: string) => {
  const text = normalize(line);

  return (
    text.length >= 3 &&
    text.length <= 48 &&
    !text.startsWith('@') &&
    !text.includes('@') &&
    !/^\(?in this reel/i.test(text) &&
    !/[?!.]/.test(text) &&
    !isAddressLike(text) &&
    !/^\d/.test(text)
  );
};

const removePinMarker = (line: string) =>
  line
    .replace(/^\s*(?:\uD83D\uDCCD|\uD83E\uDDED)\s*/, '')
    .replace(/^\s*(?:location|address|where)\s*[:\-]\s*/i, '')
    .trim();

const isPinLine = (line: string) =>
  /^\s*(?:\uD83D\uDCCD|\uD83E\uDDED|(?:location|address|where)\s*[:\-])/i.test(line);

const parsePinLine = (line: string): ParsedPinLine => {
  const text = removePinMarker(line);
  const segments = text.split(',').map(normalize).filter(Boolean);
  const firstSegment = segments[0];
  const hasComma = segments.length > 1;
  const firstLooksAddress = firstSegment ? isAddressLike(firstSegment) : false;

  if (hasComma && firstSegment && !firstLooksAddress) {
    return {
      raw: line,
      text,
      parsedPlaceName: firstSegment,
      parsedAddress: segments.slice(1).join(' '),
      isAddressLike: true
    };
  }

  if (!hasComma && text.length <= 60 && !isAddressLike(text)) {
    return {
      raw: line,
      text,
      parsedPlaceName: text,
      isAddressLike: false
    };
  }

  return {
    raw: line,
    text,
    parsedAddress: text,
    isAddressLike: isAddressLike(text)
  };
};

const extractRawHandles = (caption: string) =>
  Array.from(caption.matchAll(/@[A-Za-z0-9._]+/g)).map((match) => match[0]);

export const parseCaptionSignals = (caption: string): CaptionSignals => {
  const lines = caption
    .split(/\r?\n/)
    .map(normalize)
    .filter(Boolean);
  const pinLines = lines.filter(isPinLine).map(parsePinLine);
  const possibleTitleLine = lines.find((line) => !isPinLine(line) && isLikelyTitleLine(line));
  const addressLikeLines = lines.filter((line) => !isPinLine(line) && isAddressLike(line));
  const districtText = [caption, ...pinLines.map((line) => line.text)].join(' ');
  const categoryText = caption;

  return {
    pinLines,
    rawHandles: extractRawHandles(caption),
    possibleTitleLine,
    addressLikeLines,
    districtHints: getDistrictHints(districtText),
    categoryHints: getCategoryHints(categoryText)
  };
};

const cleanUsernameBase = (value: string, stripHk: boolean) => {
  const stripped = stripHandle(value);
  const spaced = stripped.replace(/[_.-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
  const withoutRegion = stripHk ? spaced.replace(/\b(hk|hongkong)\b$/i, '').trim() : spaced;
  const baseName = normalize(withoutRegion || spaced);
  const humanizedName = baseName.includes(' ') ? baseName : splitKnownHandleWords(baseName);
  const regionAdjustedName = stripHk ? humanizedName.replace(/\s+hk$/i, '').trim() : humanizedName;
  const tokens = regionAdjustedName.split(/\s+/);
  const cleanedTokens =
    tokens.length > 1 && noisyUsernameSuffixes.includes(tokens[tokens.length - 1].toLowerCase())
      ? tokens.slice(0, -1)
      : tokens;

  return normalize(cleanedTokens.join(' '));
};

const buildHandleCandidates = (
  handle: string,
  suffix: string,
  sourceSignal: PlaceSearchSourceSignal,
  districtHintsForCaption: string[]
): PlaceSearchCandidate[] => {
  const original = stripHandle(handle);
  const readable = cleanUsernameBase(handle, true);
  const readableWithHk = cleanUsernameBase(handle, false);
  const firstDistrict = districtHintsForCaption.find((district) => district !== 'Hong Kong');
  const baseCandidates = [
    { query: `${original} ${suffix}`, confidence: 0.82 },
    { query: `${readable} ${suffix}`, confidence: 0.78 },
    readableWithHk && lower(readableWithHk) !== lower(readable)
      ? { query: `${readableWithHk} ${suffix}`, confidence: 0.76 }
      : undefined,
    firstDistrict && readable
      ? { query: `${readable} ${firstDistrict} ${suffix}`, confidence: 0.8 }
      : undefined
  ];

  return baseCandidates.filter(Boolean).map((candidate) => ({
    query: normalize(candidate!.query),
    reason: sourceSignal === 'raw_handle' ? 'raw Instagram handle' : sourceSignal.replace('_', ' '),
    confidence: candidate!.confidence,
    parsedPlaceName: readable || original,
    sourceSignal
  }));
};

const createCandidate = (candidate: PlaceSearchCandidate) => candidate;

const hasStrongIdentifier = (candidate: PlaceSearchCandidate) =>
  Boolean(candidate.parsedPlaceName || candidate.parsedAddress) ||
  ['raw_handle', 'tagged_user', 'collaborator', 'instagram_location'].includes(candidate.sourceSignal);

const isWeakQuery = (candidate: PlaceSearchCandidate) => {
  if (!hasStrongIdentifier(candidate)) {
    return true;
  }

  const tokens = queryTokens(candidate.query);
  const distinctMeaningful = tokens.filter((token) => !weakQueryTerms.has(token));

  return distinctMeaningful.length === 0;
};

const getLikelyPlaceName = (
  input: PlaceExtractionInput,
  signals: CaptionSignals
) => {
  const importData = input.instagramImport;

  return (
    input.userHint ??
    importData?.locationName ??
    signals.pinLines.map((line) => line.parsedPlaceName).find(Boolean) ??
    signals.possibleTitleLine ??
    importData?.taggedUsers.map((user) => cleanUsernameBase(user, true)).find(Boolean) ??
    importData?.collaborators.map((user) => cleanUsernameBase(user, true)).find(Boolean) ??
    signals.rawHandles.map((handle) => cleanUsernameBase(handle, true)).find(Boolean) ??
    null
  );
};

const buildPinLineCandidates = (
  signals: CaptionSignals,
  suffix: string
): PlaceSearchCandidate[] => {
  const brandName = signals.possibleTitleLine;
  const categoryHint = signals.categoryHints[0];

  return signals.pinLines.flatMap((line) => {
    if (line.parsedPlaceName && line.parsedAddress) {
      return [
        createCandidate({
          query: appendGeoSuffix(`${line.parsedPlaceName} ${line.parsedAddress}`, suffix),
          reason: 'pin-line place + address',
          confidence: 0.96,
          parsedPlaceName: line.parsedPlaceName,
          parsedAddress: line.parsedAddress,
          sourceSignal: 'pin_line'
        }),
        createCandidate({
          query: appendGeoSuffix(`${line.parsedAddress} ${categoryHint ?? ''}`, suffix),
          reason: 'pin-line address + category',
          confidence: 0.72,
          parsedAddress: line.parsedAddress,
          sourceSignal: 'pin_line'
        })
      ];
    }

    if (line.parsedPlaceName) {
      return [
        createCandidate({
          query: appendGeoSuffix(
            compact([line.parsedPlaceName, categoryHint]).join(' '),
            suffix
          ),
          reason: 'pin-line place name',
          confidence: 0.93,
          parsedPlaceName: line.parsedPlaceName,
          sourceSignal: 'pin_line'
        }),
        createCandidate({
          query: appendGeoSuffix(line.parsedPlaceName, suffix),
          reason: 'pin-line place name',
          confidence: 0.9,
          parsedPlaceName: line.parsedPlaceName,
          sourceSignal: 'pin_line'
        })
      ];
    }

    if (line.parsedAddress && brandName) {
      return [
        createCandidate({
          query: appendGeoSuffix(`${brandName} ${line.parsedAddress}`, suffix),
          reason: 'brand + branch address',
          confidence: 0.94,
          parsedPlaceName: brandName,
          parsedAddress: line.parsedAddress,
          sourceSignal: 'pin_line'
        }),
        createCandidate({
          query: appendGeoSuffix(`${line.parsedAddress} ${categoryHint ?? ''}`, suffix),
          reason: 'branch address + category',
          confidence: 0.7,
          parsedAddress: line.parsedAddress,
          sourceSignal: 'address_line'
        })
      ];
    }

    return [];
  });
};

const buildSearchCandidates = (
  input: PlaceExtractionInput,
  signals: CaptionSignals,
  suffix: string
) => {
  const importData = input.instagramImport;
  const candidates: PlaceSearchCandidate[] = [
    ...(importData?.locationName && importData.locationAddress
      ? [
          createCandidate({
            query: appendGeoSuffix(
              `${importData.locationName} ${importData.locationAddress}`,
              suffix
            ),
            reason: 'Instagram location name + address',
            confidence: 0.99,
            parsedPlaceName: importData.locationName,
            parsedAddress: importData.locationAddress,
            sourceSignal: 'instagram_location'
          })
        ]
      : []),
    ...(importData?.locationName
      ? [
          createCandidate({
            query: appendGeoSuffix(importData.locationName, suffix),
            reason: 'Instagram location name',
            confidence: 0.98,
            parsedPlaceName: importData.locationName,
            sourceSignal: 'instagram_location'
          })
        ]
      : []),
    ...(!importData?.locationName && importData?.locationAddress
      ? [
          createCandidate({
            query: appendGeoSuffix(importData.locationAddress, suffix),
            reason: 'Instagram location address',
            confidence: 0.86,
            parsedAddress: importData.locationAddress,
            sourceSignal: 'instagram_location'
          })
        ]
      : []),
    ...buildPinLineCandidates(signals, suffix),
    ...(importData?.taggedUsers.flatMap((user) =>
      buildHandleCandidates(user, suffix, 'tagged_user', signals.districtHints)
    ) ?? []),
    ...(importData?.collaborators.flatMap((user) =>
      buildHandleCandidates(user, suffix, 'collaborator', signals.districtHints)
    ) ?? []),
    ...signals.rawHandles.flatMap((handle) =>
      buildHandleCandidates(handle, suffix, 'raw_handle', signals.districtHints)
    ),
    ...signals.addressLikeLines.flatMap((line) =>
      signals.possibleTitleLine
        ? [
            createCandidate({
              query: appendGeoSuffix(`${signals.possibleTitleLine} ${line}`, suffix),
              reason: 'title + address line',
              confidence: 0.82,
              parsedPlaceName: signals.possibleTitleLine,
              parsedAddress: line,
              sourceSignal: 'address_line'
            })
          ]
        : []
    ),
    ...(signals.possibleTitleLine
      ? [
          createCandidate({
            query: appendGeoSuffix(signals.possibleTitleLine, suffix),
            reason: 'title line',
            confidence: 0.68,
            parsedPlaceName: signals.possibleTitleLine,
            sourceSignal: 'title_line'
          })
        ]
      : []),
    ...(input.userHint
      ? [
          createCandidate({
            query: appendGeoSuffix(input.userHint, suffix),
            reason: 'user hint',
            confidence: 1,
            parsedPlaceName: input.userHint,
            sourceSignal: 'user_hint'
          })
        ]
      : [])
  ];
  const rejected = candidates.filter(isWeakQuery).map((candidate) => candidate.query);
  const accepted = candidates.filter((candidate) => !isWeakQuery(candidate));

  if (process.env.NODE_ENV !== 'production') {
    console.log('[caption-parser]', {
      pinLines: signals.pinLines.map((line) => line.text),
      rawHandles: signals.rawHandles,
      possibleTitleLine: signals.possibleTitleLine,
      generatedSearchCandidates: accepted.map((candidate) => ({
        query: candidate.query,
        reason: candidate.reason,
        confidence: candidate.confidence,
        sourceSignal: candidate.sourceSignal
      })),
      rejectedWeakQueries: rejected
    });
  }

  return unique(accepted, (candidate) => candidate.query)
    .sort(
      (left, right) =>
        Number(right.sourceSignal === 'user_hint') -
        Number(left.sourceSignal === 'user_hint')
    )
    .slice(0, 12);
};

const sourceReliabilityBonus: Record<PlaceSearchSourceSignal, number> = {
  user_hint: 0.18,
  instagram_location: 0.16,
  pin_line: 0.1,
  address_line: 0.08,
  tagged_user: 0.04,
  collaborator: 0.03,
  raw_handle: 0,
  title_line: 0
};

const normalizeEvidence = (value: string) =>
  lower(stripHandle(value)).replace(/[^\p{L}\p{M}\p{N}]/gu, '');

const countCorroboratingNameEvidence = (
  placeName: string | null,
  input: PlaceExtractionInput,
  signals: CaptionSignals
) => {
  if (!placeName) {
    return 0;
  }

  const importData = input.instagramImport;
  const target = normalizeEvidence(placeName);
  const evidence = compact([
    input.userHint,
    importData?.locationName,
    signals.possibleTitleLine,
    ...signals.pinLines.map((line) => line.parsedPlaceName),
    ...(importData?.taggedUsers ?? []),
    ...(importData?.collaborators ?? []),
    ...signals.rawHandles
  ]);

  return new Set(
    evidence
      .map(normalizeEvidence)
      .filter(
        (value) =>
          value &&
          (value === target ||
            value.includes(target) ||
            target.includes(value))
      )
  ).size;
};

export const mockPlaceExtractionService: PlaceExtractionService = {
  async extractPlace(input: PlaceExtractionInput): Promise<PlaceExtractionResult> {
    const importData = input.instagramImport;
    const rawCaption = compact([input.captionText, importData?.caption]).join('\n');
    const signals = parseCaptionSignals(rawCaption);
    const combinedText = compact([
      input.userHint,
      input.sharedText,
      rawCaption,
      importData?.hashtags.join(' '),
      importData?.mentions.join(' '),
      importData?.taggedUsers.join(' '),
      importData?.collaborators.join(' '),
      importData?.locationName,
      importData?.locationAddress,
      importData?.locationCity,
      importData?.locationCountry,
      importData?.ownerUsername,
      importData?.ownerFullName
    ]).join(' ');
    const geoContext = inferGeoContext(combinedText);
    const placeName = getLikelyPlaceName(input, signals);
    const areaOrCity = importData?.locationCity ?? signals.districtHints[0] ?? geoContext.searchSuffix;
    const category = getCategory(combinedText);
    const specialties = Array.from(new Set([...signals.categoryHints, ...(importData?.hashtags ?? [])]))
      .filter((item) => categoryKeywords.includes(lower(item)))
      .slice(0, 5);
    const cuisineOrSpecialty = specialties.join(', ') || null;
    const searchCandidates = buildSearchCandidates(input, signals, geoContext.searchSuffix);
    const primaryCandidate = searchCandidates[0];
    const corroboratingNameEvidence =
      countCorroboratingNameEvidence(placeName, input, signals);
    const hasAddressEvidence = Boolean(
      importData?.locationAddress ||
        signals.pinLines.some((line) => line.parsedAddress) ||
        signals.addressLikeLines.length
    );
    const hasAreaEvidence = Boolean(importData?.locationCity || signals.districtHints.length);
    const confidence = Math.min(
      0.08 +
        (primaryCandidate?.confidence ?? 0) * 0.45 +
        (primaryCandidate ? sourceReliabilityBonus[primaryCandidate.sourceSignal] : 0) +
        Math.min(Math.max(0, corroboratingNameEvidence - 1) * 0.06, 0.12) +
        (hasAddressEvidence ? 0.08 : 0) +
        (category ? 0.04 : 0),
      0.95
    );
    const missingFields = [
      !placeName ? 'placeName' : undefined,
      !hasAddressEvidence ? 'address' : undefined,
      !hasAreaEvidence ? 'areaOrCity' : undefined,
      !category ? 'category' : undefined,
      !cuisineOrSpecialty ? 'cuisineOrSpecialty' : undefined
    ].filter((field): field is string => Boolean(field));

    return {
      placeName,
      areaOrCity,
      category,
      cuisineOrSpecialty,
      recommendedItems: specialties,
      vibeTags: normalizePlaceTags({
        placeName,
        category,
        cuisineOrSpecialty,
        signals: [combinedText, ...specialties, ...(importData?.hashtags ?? [])]
      }),
      visibleClues: [
        'Instagram URL was provided by the user.',
        ...(rawCaption ? ['Caption text was parsed for place signals.'] : []),
        ...(signals.pinLines.length ? ['Pin-marker lines were available.'] : []),
        ...(signals.rawHandles.length ? ['Raw Instagram handles were available.'] : []),
        ...(importData?.locationName ? ['Instagram location metadata was available.'] : []),
        ...(importData?.taggedUsers.length ? ['Tagged users were available as place clues.'] : []),
        ...(importData?.collaborators.length ? ['Collaborators were available as place clues.'] : []),
        ...(input.userHint ? ['User hint was provided.'] : [])
      ],
      searchQuery: searchCandidates[0]?.query ?? '',
      searchCandidates,
      geoContext,
      confidence,
      needsUserConfirmation:
        confidence < 0.65 ||
        !searchCandidates.length ||
        missingFields.includes('placeName') ||
        missingFields.includes('address'),
      missingFields
    };
  }
};