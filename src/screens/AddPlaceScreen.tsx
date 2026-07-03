import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

import { AppButton } from '../components/AppButton';
import { AppNavigation } from '../navigation/types';
import { placeExtractionService } from '../services/placeExtraction';
import { placeSearchService } from '../services/placeSearch';
import { colors, radii, spacing } from '../theme';
import { PlaceExtractionResult } from '../types/extraction';
import { PlaceCategory } from '../types/place';
import { categoryLabels } from '../utils/labels';

type AddPlaceScreenProps = {
  navigation: AppNavigation;
};

const isInstagramUrl = (value: string) =>
  /^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\//i.test(value.trim());

const categoryOptions: PlaceCategory[] = [
  'cafe',
  'restaurant',
  'street_food',
  'dessert',
  'bar',
  'market',
  'other'
];

const splitCommaList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export function AddPlaceScreen({ navigation }: AddPlaceScreenProps) {
  const [sourceInstagramUrl, setSourceInstagramUrl] = useState('');
  const [placeName, setPlaceName] = useState('');
  const [notes, setNotes] = useState('');
  const [captionText, setCaptionText] = useState('');
  const [areaOrCity, setAreaOrCity] = useState('');
  const [category, setCategory] = useState<PlaceCategory>('other');
  const [cuisineOrSpecialty, setCuisineOrSpecialty] = useState('');
  const [recommendedItems, setRecommendedItems] = useState('');
  const [vibeTags, setVibeTags] = useState('');
  const [visibleClues, setVisibleClues] = useState('');
  const [extractionConfidence, setExtractionConfidence] = useState<number | undefined>();
  const [needsUserConfirmation, setNeedsUserConfirmation] = useState(false);
  const [hasExtraction, setHasExtraction] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const canExtract = sourceInstagramUrl.trim().length > 0 && !isExtracting;
  const canSearch =
    sourceInstagramUrl.trim().length > 0 &&
    placeName.trim().length > 0 &&
    !isSearching &&
    !isExtracting;

  const applyExtraction = (result: PlaceExtractionResult) => {
    setHasExtraction(true);
    setPlaceName(result.place_name);
    setAreaOrCity(result.area_or_city);
    setCategory(result.category);
    setCuisineOrSpecialty(result.cuisine_or_specialty);
    setRecommendedItems(result.recommended_items.join(', '));
    setVibeTags(result.vibe_tags.join(', '));
    setVisibleClues(result.visible_clues.join(', '));
    setExtractionConfidence(result.confidence);
    setNeedsUserConfirmation(result.needs_user_confirmation);
  };

  const buildReviewedExtraction = (): PlaceExtractionResult | undefined => {
    if (!hasExtraction) {
      return undefined;
    }

    return {
      place_name: placeName.trim(),
      area_or_city: areaOrCity.trim(),
      category,
      cuisine_or_specialty: cuisineOrSpecialty.trim(),
      recommended_items: splitCommaList(recommendedItems),
      vibe_tags: splitCommaList(vibeTags),
      visible_clues: splitCommaList(visibleClues),
      confidence: extractionConfidence ?? 0,
      needs_user_confirmation: needsUserConfirmation
    };
  };

  const handleExtractDetails = async () => {
    if (!isInstagramUrl(sourceInstagramUrl)) {
      Alert.alert(
        'Check the Instagram URL',
        'Paste a public Instagram post or reel URL before extracting details.'
      );
      return;
    }

    setIsExtracting(true);

    try {
      const result = await placeExtractionService.extractPlace({
        source_url: sourceInstagramUrl.trim(),
        caption_text: captionText.trim(),
        user_notes: notes.trim() || undefined
      });

      applyExtraction(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Mock extraction could not run.';
      Alert.alert('Extraction unavailable', message);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleFindCandidates = async () => {
    if (!isInstagramUrl(sourceInstagramUrl)) {
      Alert.alert(
        'Check the Instagram URL',
        'Paste a public Instagram post or reel URL, such as https://www.instagram.com/reel/...'
      );
      return;
    }

    setIsSearching(true);

    try {
      const candidates = await placeSearchService.searchPlaces({
        query: placeName,
        sourceInstagramUrl
      });

      navigation.navigate({
        name: 'CandidateMatch',
        draft: {
          sourceInstagramUrl: sourceInstagramUrl.trim(),
          suggestedPlaceName: placeName.trim(),
          extraction: buildReviewedExtraction(),
          notes: notes.trim() || undefined,
          captionText: captionText.trim() || undefined
        },
        candidates
      });
    } finally {
      setIsSearching(false);
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

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Caption text</Text>
          <TextInput
            multiline
            onChangeText={setCaptionText}
            placeholder="Optional text copied from the post"
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.textArea]}
            textAlignVertical="top"
            value={captionText}
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
          disabled={!canExtract}
          label={isExtracting ? 'Extracting...' : 'Mock Extract Details'}
          onPress={handleExtractDetails}
          variant="secondary"
        />
        {isExtracting ? <ActivityIndicator color={colors.primary} /> : null}

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Place name</Text>
          <TextInput
            autoCapitalize="words"
            onChangeText={setPlaceName}
            placeholder="Lemon House Cafe"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={placeName}
          />
        </View>

        {hasExtraction ? (
          <View style={styles.extractionPanel}>
            <Text style={styles.panelTitle}>Extraction review</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Area or city</Text>
              <TextInput
                autoCapitalize="words"
                onChangeText={setAreaOrCity}
                placeholder="Bangkok"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={areaOrCity}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Category</Text>
              <View style={styles.categoryRow}>
                {categoryOptions.map((option) => {
                  const isSelected = option === category;

                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={option}
                      onPress={() => setCategory(option)}
                      style={[
                        styles.categoryChip,
                        isSelected && styles.selectedCategoryChip
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          isSelected && styles.selectedCategoryChipText
                        ]}
                      >
                        {categoryLabels[option]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Cuisine or specialty</Text>
              <TextInput
                onChangeText={setCuisineOrSpecialty}
                placeholder="espresso and lemon tart"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={cuisineOrSpecialty}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Recommended items</Text>
              <TextInput
                onChangeText={setRecommendedItems}
                placeholder="espresso, lemon tart"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={recommendedItems}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Vibe tags</Text>
              <TextInput
                onChangeText={setVibeTags}
                placeholder="coffee, brunch, quiet"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={vibeTags}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Visible clues</Text>
              <TextInput
                multiline
                onChangeText={setVisibleClues}
                placeholder="caption mentions coffee, source is Instagram"
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.textArea]}
                textAlignVertical="top"
                value={visibleClues}
              />
            </View>

            <Text style={styles.extractionMeta}>
              Confidence: {Math.round((extractionConfidence ?? 0) * 100)}% - Needs
              confirmation: {needsUserConfirmation ? 'Yes' : 'No'}
            </Text>
          </View>
        ) : null}

        <AppButton
          disabled={!canSearch}
          label={isSearching ? 'Searching...' : 'Find Matches'}
          onPress={handleFindCandidates}
        />
        {isSearching ? <ActivityIndicator color={colors.primary} /> : null}
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
    minHeight: 104
  },
  extractionPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.lg
  },
  panelTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900'
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  categoryChip: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  selectedCategoryChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  categoryChipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800'
  },
  selectedCategoryChipText: {
    color: colors.surface
  },
  extractionMeta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700'
  }
});
