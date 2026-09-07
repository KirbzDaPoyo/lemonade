import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HazardStrip } from '../components/v2-marks';
import { V2Button, V2TextField } from '../components/v2-controls';
import { V2Console, V2TitleBlock, V2TopBar } from '../components/v2-layout';
import { getDefaultGeoContext } from '../config/geoContext';
import { AppTheme, useAppTheme } from '../design-system/theme';
import type { AppNavigation } from '../navigation/types';
import { analytics } from '../observability/analytics';
import { errorMonitoring } from '../observability/error-monitoring';
import { extractInstagramUrl } from '../services/incomingShare/instagramUrl';
import { instagramImportProvider } from '../services/instagramImport';
import { placeExtractionService } from '../services/placeExtraction';
import { placeSearchService } from '../services/placeSearch';
import type { PlaceExtractionResult, PlaceSearchCandidate } from '../types/extraction';

type V2AddPlaceScreenProps = { navigation: AppNavigation; initialInstagramUrl?: string };

const isInstagramUrl = (value: string) => {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && ['instagram.com', 'www.instagram.com'].includes(url.hostname.toLowerCase()) && (/^\/p\/[^/]+\/?$/i.test(url.pathname) || /^\/reel\/[^/]+\/?$/i.test(url.pathname) || /^\/reels\/[^/]+\/?$/i.test(url.pathname));
  } catch { return false; }
};

const getSearchQuery = (extraction: PlaceExtractionResult, manualPlaceName: string) => manualPlaceName.trim() || extraction.searchCandidates[0]?.query || extraction.searchQuery;
const prioritizeManualSearch = (extraction: PlaceExtractionResult, manualPlaceName: string): PlaceSearchCandidate[] => {
  const userHint = manualPlaceName.trim();
  if (!userHint) return extraction.searchCandidates;
  return [{ query: userHint, reason: 'manual correction', confidence: 1, parsedPlaceName: userHint, sourceSignal: 'user_hint' }, ...extraction.searchCandidates.filter((candidate) => candidate.sourceSignal !== 'user_hint')];
};

export function V2AddPlaceScreen({ navigation, initialInstagramUrl }: V2AddPlaceScreenProps) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [sourceInstagramUrl, setSourceInstagramUrl] = useState(initialInstagramUrl ?? '');
  const [manualPlaceName, setManualPlaceName] = useState('');
  const [isFindingPlace, setIsFindingPlace] = useState(false);
  const [needsManualQuery, setNeedsManualQuery] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; }; }, []);
  const extractedUrl = extractInstagramUrl(sourceInstagramUrl);
  const hasEnteredUrl = sourceInstagramUrl.trim().length > 0;
  const hasValidUrl = Boolean(extractedUrl && isInstagramUrl(extractedUrl));
  const canSearch = hasValidUrl && !isFindingPlace && (!needsManualQuery || manualPlaceName.trim().length > 0);
  const consoleTitle = isFindingPlace ? 'IMPORTING...' : !hasEnteredUrl ? 'READY FOR URL' : hasValidUrl ? 'URL READY' : 'CHECK URL';
  const consoleBody = isFindingPlace
    ? 'Searching for matching places.'
    : !hasEnteredUrl
      ? 'Paste a public Instagram post or reel to begin.'
      : hasValidUrl
        ? 'Review the URL, then find matching places.'
        : 'Use a public Instagram post or reel URL.';

  const navigateToCandidates = async (extraction: PlaceExtractionResult, searchQuery: string, instagramUrl: string) => {
    const candidates = await placeSearchService.searchPlaces({ query: searchQuery, searchCandidates: prioritizeManualSearch(extraction, manualPlaceName), geoContext: extraction.geoContext });
    if (!isMountedRef.current) return;
    analytics.candidatesDisplayed(candidates.length);
    navigation.navigate({ name: 'CandidateMatch', draft: { sourceInstagramUrl: instagramUrl, extraction }, candidates });
  };

  const buildManualExtraction = (): PlaceExtractionResult => ({
    placeName: manualPlaceName.trim() || null,
    areaOrCity: null,
    category: null,
    cuisineOrSpecialty: null,
    recommendedItems: [],
    vibeTags: ['manual-search'],
    searchQuery: manualPlaceName.trim(),
    searchCandidates: manualPlaceName.trim() ? [{ query: manualPlaceName.trim(), reason: 'manual search', confidence: 1, parsedPlaceName: manualPlaceName.trim(), sourceSignal: 'user_hint' }] : [],
    geoContext: getDefaultGeoContext(),
    confidence: manualPlaceName.trim() ? 1 : 0
  });

  const handleFindPlace = async (requestedUrl = sourceInstagramUrl) => {
    const instagramUrl = extractInstagramUrl(requestedUrl);
    if (!instagramUrl || !isInstagramUrl(instagramUrl)) {
      Alert.alert('Check the Instagram URL', 'Paste a public Instagram post or reel URL, such as https://www.instagram.com/reel/...');
      return;
    }
    setSourceInstagramUrl(instagramUrl);
    setIsFindingPlace(true);
    analytics.importStarted();
    let didImportSucceed = false;
    try {
      let extraction: PlaceExtractionResult | undefined;
      const userHint = manualPlaceName.trim() || undefined;
      try {
        const instagramImport = await instagramImportProvider.importUrl({ url: instagramUrl });
        didImportSucceed = true;
        analytics.importSucceeded();
        extraction = await placeExtractionService.extractPlace({ instagramImport, userHint });
      } catch (error) {
        if (!didImportSucceed) analytics.importFailed(error);
        if (!isMountedRef.current) return;
        const message = error instanceof Error ? error.message : 'Instagram import failed.';
        setNeedsManualQuery(true);
        if (manualPlaceName.trim()) {
          Alert.alert('Instagram import failed', `${message} Searching with your place name instead.`);
          await navigateToCandidates(buildManualExtraction(), manualPlaceName.trim(), instagramUrl);
        } else {
          Alert.alert('Instagram import failed', `${message} Enter the place name to search manually.`);
        }
        return;
      }
      if (!isMountedRef.current) return;
      const searchQuery = getSearchQuery(extraction, manualPlaceName);
      if (!searchQuery) {
        setNeedsManualQuery(true);
        Alert.alert("I couldn't identify the place from this reel.", 'What should we search? Add a place name, then try again.');
        return;
      }
      await navigateToCandidates(extraction, searchQuery, instagramUrl);
    } catch (error) {
      if (!isMountedRef.current) return;
      errorMonitoring.captureException(error, {
        operation: 'place_search',
        category: 'search'
      });
      const message = error instanceof Error ? error.message : "I couldn't identify the place from this reel.";
      if (manualPlaceName.trim()) Alert.alert('Place search failed', message);
      else { setNeedsManualQuery(true); Alert.alert('Add a search hint', `${message} What should we search?`); }
    } finally {
      if (isMountedRef.current) setIsFindingPlace(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled">
        <V2TopBar onBack={navigation.goBack} />
        <V2TitleBlock title="ADD PLACE" />
        <V2TextField
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          label="Instagram URL"
          onChangeText={setSourceInstagramUrl}
          placeholder="https://www.instagram.com/reel/..."
          value={sourceInstagramUrl}
        />
        <V2TextField
          autoCapitalize="words"
          hint="Adding a name can help us find the right match when Instagram details are limited."
          label={needsManualQuery ? 'Place name — required' : 'Place name — optional'}
          onChangeText={setManualPlaceName}
          placeholder="e.g. Neon Noodles"
          value={manualPlaceName}
        />
        {needsManualQuery ? (
          <View style={styles.recoveryNotice}>
            <Text style={styles.recoveryTitle}>SEARCH HINT NEEDED</Text>
            <Text style={styles.recoveryBody}>Instagram did not expose enough place information. Enter a place name and search again.</Text>
          </View>
        ) : null}
        <V2Button disabled={!canSearch} label={isFindingPlace ? 'FINDING PLACE' : 'FIND PLACE'} onPress={() => void handleFindPlace()} />
        <V2Console label="Import status">
          <View accessibilityLiveRegion="polite" style={styles.progressRow}>
            {isFindingPlace ? <ActivityIndicator color={theme.colors.acidInk} /> : <View style={[styles.readyIndicator, hasEnteredUrl && !hasValidUrl && styles.invalidIndicator]} />}
            <View style={styles.progressCopy}>
              <Text style={styles.progressTitle}>{consoleTitle}</Text>
              <Text style={styles.progressBody}>{consoleBody}</Text>
            </View>
          </View>
        </V2Console>
        <View style={styles.footer}><HazardStrip /></View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  screen: { backgroundColor: theme.colors.background, flex: 1 },
  content: { gap: theme.spacing.xl, padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  recoveryNotice: { backgroundColor: theme.colors.warningSurface, borderColor: theme.colors.warning, borderWidth: 1, gap: theme.spacing.xs, padding: theme.spacing.md },
  recoveryTitle: { color: theme.colors.warning, fontFamily: theme.typography.displayFamily, fontSize: 15, letterSpacing: 0.8 },
  recoveryBody: { color: theme.colors.text, fontSize: theme.typography.body.small, lineHeight: 18 },
  progressRow: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing.md, minHeight: 50 },
  readyIndicator: { borderColor: theme.colors.acidBorder, borderRadius: 13, borderWidth: 2, height: 26, width: 26 },
  invalidIndicator: { borderColor: theme.colors.warning },
  progressCopy: { flex: 1, gap: theme.spacing.xxs },
  progressTitle: { color: theme.colors.text, fontFamily: theme.typography.displayFamily, fontSize: 15, letterSpacing: 0.7 },
  progressBody: { color: theme.colors.textMuted, fontSize: theme.typography.body.small, lineHeight: 18 },
  footer: { borderTopColor: theme.colors.border, borderTopWidth: 1, paddingTop: theme.spacing.lg }
});
