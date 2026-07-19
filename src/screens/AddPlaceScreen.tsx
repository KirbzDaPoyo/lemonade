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
import { PlaceExtractionResult } from '../types/extraction';

type AddPlaceScreenProps = {
  navigation: AppNavigation;
};

const isInstagramUrl = (value: string) =>
  /^https?:\/\/(www\.)?instagram\.com\/(p|reel|reels|tv)\//i.test(value.trim());

const getSearchQuery = (extraction: PlaceExtractionResult, manualPlaceName: string) =>
  extraction.searchCandidates[0]?.query || extraction.searchQuery || manualPlaceName.trim();

export function AddPlaceScreen({ navigation }: AddPlaceScreenProps) {
  const [sourceInstagramUrl, setSourceInstagramUrl] = useState('');
  const [manualPlaceName, setManualPlaceName] = useState('');
  const [userHint, setUserHint] = useState('');
  const [captionText, setCaptionText] = useState('');
  const [notes, setNotes] = useState('');
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
      searchCandidates: extraction.searchCandidates,
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
        extraction,
        notes: notes.trim() || undefined,
        captionText: captionText.trim() || undefined,
        userHint: userHint.trim() || undefined
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
            confidence: 0.72,
            parsedPlaceName: manualPlaceName.trim(),
            sourceSignal: 'user_hint'
          }
        ]
      : [],
    geoContext: getDefaultGeoContext(),
    confidence: manualPlaceName.trim() ? 0.6 : 0,
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

      try {
        const instagramImport = await instagramImportProvider.importUrl({
          url: sourceInstagramUrl.trim()
        });

        extraction = await placeExtractionService.extractPlace({
          sourceUrl: sourceInstagramUrl.trim(),
          captionText: captionText.trim() || undefined,
          userHint: userHint.trim() || undefined,
          instagramImport
        });
      } catch {
        extraction = await placeExtractionService.extractPlace({
          sourceUrl: sourceInstagramUrl.trim(),
          captionText: captionText.trim() || undefined,
          userHint: userHint.trim() || manualPlaceName.trim() || undefined
        });
      }

      const searchQuery = getSearchQuery(extraction, manualPlaceName);

      if (!searchQuery) {
        setNeedsManualQuery(true);
        Alert.alert(
          "I couldn't identify the place from this reel.",
          'What should we search? Add a place name or hint, then try again.'
        );
        return;
      }

      await navigateToCandidates(extraction, searchQuery);
    } catch (error) {
      if (manualPlaceName.trim()) {
        await navigateToCandidates(buildManualExtraction(), manualPlaceName.trim());
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : "I couldn't identify the place from this reel.";
      setNeedsManualQuery(true);
      Alert.alert('Add a search hint', `${message} What should we search?`);
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

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Place name or hint</Text>
          <TextInput
            autoCapitalize="words"
            onChangeText={setManualPlaceName}
            placeholder="Lemon House Cafe"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={manualPlaceName}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Caption text</Text>
          <TextInput
            multiline
            onChangeText={setCaptionText}
            placeholder="Optional caption pasted by you"
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.textArea]}
            textAlignVertical="top"
            value={captionText}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Extra hint</Text>
          <TextInput
            onChangeText={setUserHint}
            placeholder="Optional area, cuisine, or clue"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={userHint}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            multiline
            onChangeText={setNotes}
            placeholder="What caught your eye?"
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.textArea]}
            textAlignVertical="top"
            value={notes}
          />
        </View>

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
  textArea: {
    minHeight: 96
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
