import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

import { AppButton } from '../components/AppButton';
import { getDefaultGeoContext } from '../config/geoContext';
import { AppNavigation } from '../navigation/types';
import { instagramImportProvider } from '../services/instagramImport';
import { placeExtractionService } from '../services/placeExtraction';
import { placeSearchService } from '../services/placeSearch';
import { colors, radii, spacing } from '../theme';
import { PlaceExtractionResult, PlaceSearchCandidate } from '../types/extraction';

type AddPlaceScreenProps = {
  navigation: AppNavigation;
};

const isInstagramUrl = (value: string) => {
  try {
    const url = new URL(value.trim());

    return (
      url.protocol === 'https:' &&
      ['instagram.com', 'www.instagram.com'].includes(url.hostname.toLowerCase()) &&
      (/^\/p\/[^/]+\/?$/i.test(url.pathname) ||
        /^\/reel\/[^/]+\/?$/i.test(url.pathname) ||
        /^\/reels\/[^/]+\/?$/i.test(url.pathname))
    );
  } catch {
    return false;
  }
};

const getSearchQuery = (extraction: PlaceExtractionResult, manualPlaceName: string) =>
  manualPlaceName.trim() || extraction.searchCandidates[0]?.query || extraction.searchQuery;

const prioritizeManualSearch = (
  extraction: PlaceExtractionResult,
  manualPlaceName: string
): PlaceSearchCandidate[] => {
  const userHint = manualPlaceName.trim();

  if (!userHint) {
    return extraction.searchCandidates;
  }

  return [
    {
      query: userHint,
      reason: 'manual correction',
      confidence: 1,
      parsedPlaceName: userHint,
      sourceSignal: 'user_hint'
    },
    ...extraction.searchCandidates.filter((candidate) => candidate.sourceSignal !== 'user_hint')
  ];
};

export function AddPlaceScreen({ navigation }: AddPlaceScreenProps) {
  const [sourceInstagramUrl, setSourceInstagramUrl] = useState('');
  const [manualPlaceName, setManualPlaceName] = useState('');
  const [isFindingPlace, setIsFindingPlace] = useState(false);
  const [needsManualQuery, setNeedsManualQuery] = useState(false);

  const canSearch =
    sourceInstagramUrl.trim().length > 0 &&
    !isFindingPlace &&
    (!needsManualQuery || manualPlaceName.trim().length > 0);

  const navigateToCandidates = async (
    extraction: PlaceExtractionResult,
    searchQuery: string
  ) => {
    const candidates = await placeSearchService.searchPlaces({
      query: searchQuery,
      searchCandidates: prioritizeManualSearch(extraction, manualPlaceName),
      sourceInstagramUrl: sourceInstagramUrl.trim(),
      areaOrCity: extraction.areaOrCity ?? undefined,
      category: extraction.category ?? undefined,
      cuisineOrSpecialty: extraction.cuisineOrSpecialty ?? undefined,
      geoContext: extraction.geoContext
    });

    navigation.navigate({
      name: 'CandidateMatch',
      draft: {
        sourceInstagramUrl: sourceInstagramUrl.trim(),
        suggestedPlaceName: extraction.placeName ?? searchQuery,
        extraction
      },
      candidates
    });
  };

  const buildManualExtraction = (): PlaceExtractionResult => ({
    placeName: manualPlaceName.trim() || null,
    areaOrCity: null,
    category: null,
    cuisineOrSpecialty: null,
    recommendedItems: [],
    vibeTags: ['manual-search'],
    visibleClues: ['Manual search query was provided by the user.'],
    searchQuery: manualPlaceName.trim(),
    searchCandidates: manualPlaceName.trim()
      ? [
          {
            query: manualPlaceName.trim(),
            reason: 'manual search',
            confidence: 1,
            parsedPlaceName: manualPlaceName.trim(),
            sourceSignal: 'user_hint'
          }
        ]
      : [],
    geoContext: getDefaultGeoContext(),
    confidence: manualPlaceName.trim() ? 1 : 0,
    needsUserConfirmation: true,
    missingFields: manualPlaceName.trim() ? [] : ['placeName']
  });

  const handleFindPlace = async () => {
    if (!isInstagramUrl(sourceInstagramUrl)) {
      Alert.alert(
        'Check the Instagram URL',
        'Paste a public Instagram post or reel URL, such as https://www.instagram.com/reel/...'
      );
      return;
    }

    setIsFindingPlace(true);

    try {
      let extraction: PlaceExtractionResult | undefined;
      const userHint = manualPlaceName.trim() || undefined;

      try {
        const instagramImport = await instagramImportProvider.importUrl({
          url: sourceInstagramUrl.trim()
        });

        extraction = await placeExtractionService.extractPlace({
          sourceUrl: sourceInstagramUrl.trim(),
          instagramImport,
          userHint
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Instagram import failed.';

        setNeedsManualQuery(true);

        if (manualPlaceName.trim()) {
          Alert.alert(
            'Instagram import failed',
            `${message} Searching with your place name instead.`
          );
          await navigateToCandidates(buildManualExtraction(), manualPlaceName.trim());
        } else {
          Alert.alert(
            'Instagram import failed',
            `${message} Enter the place name to search manually.`
          );
        }

        return;
      }

      const searchQuery = getSearchQuery(extraction, manualPlaceName);

      if (!searchQuery) {
        setNeedsManualQuery(true);
        Alert.alert(
          "I couldn't identify the place from this reel.",
          'What should we search? Add a place name, then try again.'
        );
        return;
      }

      await navigateToCandidates(extraction, searchQuery);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "I couldn't identify the place from this reel.";

      if (manualPlaceName.trim()) {
        Alert.alert('Place search failed', message);
      } else {
        setNeedsManualQuery(true);
        Alert.alert('Add a search hint', `${message} What should we search?`);
      }
    } finally {
      setIsFindingPlace(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <AppButton label="Back" onPress={navigation.goBack} variant="ghost" />
          <Text style={styles.title}>Add Place</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Instagram reel or post URL</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onChangeText={setSourceInstagramUrl}
            placeholder="https://www.instagram.com/reel/..."
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={sourceInstagramUrl}
          />
        </View>

        {needsManualQuery ? (
          <View style={styles.promptBox}>
            <Text style={styles.promptText}>
              I couldn't identify the place from this reel. What should we search?
            </Text>
          </View>
        ) : null}
        {needsManualQuery ? (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Place name or search</Text>
            <TextInput
              autoCapitalize="words"
              onChangeText={setManualPlaceName}
              placeholder="Lemon House Cafe"
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={manualPlaceName}
            />
          </View>
        ) : null}

        <AppButton
          disabled={!canSearch}
          label={isFindingPlace ? 'Finding the place...' : 'Find the Place'}
          onPress={handleFindPlace}
        />
        {isFindingPlace ? <ActivityIndicator color={colors.primary} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1
  },
  content: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900'
  },
  headerSpacer: {
    width: 72
  },
  fieldGroup: {
    gap: spacing.sm
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800'
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  promptBox: {
    backgroundColor: '#fff8eb',
    borderColor: colors.accent,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md
  },
  promptText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20
  }
});

