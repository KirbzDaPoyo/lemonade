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
import { AppNavigation } from '../navigation/types';
import { placeSearchService } from '../services/placeSearch';
import { colors, radii, spacing } from '../theme';

type AddPlaceScreenProps = {
  navigation: AppNavigation;
};

const isInstagramUrl = (value: string) =>
  /^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\//i.test(value.trim());

export function AddPlaceScreen({ navigation }: AddPlaceScreenProps) {
  const [sourceInstagramUrl, setSourceInstagramUrl] = useState('');
  const [placeName, setPlaceName] = useState('');
  const [notes, setNotes] = useState('');
  const [captionText, setCaptionText] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const canSearch =
    sourceInstagramUrl.trim().length > 0 && placeName.trim().length > 0 && !isSearching;

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
  }
});
