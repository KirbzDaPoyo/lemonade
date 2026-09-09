import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SourceCard } from '../components/source-card';

import { StatePanel } from '../components/state-panel';
import { StorageErrorBanner } from '../components/storage-error-banner';
import { UserTagsEditor } from '../components/user-tags-editor';
import { V2Button } from '../components/v2-controls';
import { V2SectionLabel, V2TopBar } from '../components/v2-layout';
import { FavoriteMark } from '../components/v2-marks';
import { AppTheme, useAppTheme } from '../design-system/theme';
import type { AppNavigation } from '../navigation/types';
import { analytics } from '../observability/analytics';
import { addUserTag, deleteUserTag } from '../services/tags/user-tags';
import { usePlaces } from '../store/PlacesContext';
import type { PlaceStatus, PlaceTag } from '../types/place';
import { statusLabels } from '../utils/labels';

type V2PlaceDetailScreenProps = { navigation: AppNavigation; placeId: string };
const statusOptions: PlaceStatus[] = ['want_to_go', 'visited', 'skipped'];

const openExternalUrl = async (url: string, destination: string, onOpened?: () => void) => {
  try {
    await Linking.openURL(url);
    onOpened?.();
  } catch {
    Alert.alert(`${destination} unavailable`, 'This link could not be opened on this device.');
  }
};

export function V2PlaceDetailScreen({ navigation, placeId }: V2PlaceDetailScreenProps) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { availableTags, createTag, deletePlace, deleteTag, places, renameTag, retryStorage, storageError, updatePlace } = usePlaces();
  const place = places.find((savedPlace) => savedPlace.id === placeId);
  const [notesDraft, setNotesDraft] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isUpdatingFavorite, setIsUpdatingFavorite] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<PlaceStatus | null>(null);
  const [pendingTagAction, setPendingTagAction] = useState<string | null>(null);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const placeStateUpdateInFlight = useRef(false);

  useEffect(() => {
    setNotesDraft(place?.notes ?? '');
  }, [place?.id, place?.notes]);

  const handleStatusChange = async (status: PlaceStatus) => {
    if (!place || place.status === status || placeStateUpdateInFlight.current) return;
    placeStateUpdateInFlight.current = true;
    setPendingStatus(status);
    try {
      const didUpdate = await updatePlace(place.id, { status });
      if (didUpdate) analytics.placeStatusChanged(place.status, status);
      else Alert.alert('Status not updated', `The status could not be changed to ${statusLabels[status]}.`);
    } catch {
      Alert.alert('Status not updated', `The status could not be changed to ${statusLabels[status]}.`);
    } finally {
      placeStateUpdateInFlight.current = false;
      setPendingStatus(null);
    }
  };

  const handleFavoriteToggle = async () => {
    if (!place || placeStateUpdateInFlight.current) return;
    placeStateUpdateInFlight.current = true;
    setIsUpdatingFavorite(true);
    try {
      const nextFavorite = !place.isFavorite;
      const didUpdate = await updatePlace(place.id, { isFavorite: nextFavorite });
      if (didUpdate) analytics.favoriteChanged(nextFavorite);
      else Alert.alert('Favorite not updated', 'The favorite setting could not be changed.');
    } catch {
      Alert.alert('Favorite not updated', 'The favorite setting could not be changed.');
    } finally {
      placeStateUpdateInFlight.current = false;
      setIsUpdatingFavorite(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!place) return;
    setIsSavingNotes(true);
    try {
      const didUpdate = await updatePlace(place.id, { notes: notesDraft.trim() || null });
      if (!didUpdate) Alert.alert('Notes not saved', 'The notes could not be updated.');
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleTagsChange = async (tags: string[], action: string) => {
    if (!place || placeStateUpdateInFlight.current) return;
    placeStateUpdateInFlight.current = true;
    setPendingTagAction(action);
    try {
      const didUpdate = await updatePlace(place.id, { tags });
      if (!didUpdate) Alert.alert('Tags not updated', 'Your tag changes could not be saved.');
    } catch {
      Alert.alert('Tags not updated', 'Your tag changes could not be saved.');
    } finally {
      placeStateUpdateInFlight.current = false;
      setPendingTagAction(null);
    }
  };

  const handleToggleTag = (tag: PlaceTag, assigned: boolean) => {
    if (!place) return;
    const nextTags = assigned ? addUserTag(place.tags, tag.name) : deleteUserTag(place.tags, tag.name);
    void handleTagsChange(nextTags, `assign:${tag.id}`);
  };

  const handleCreateTag = async (name: string) => {
    if (!place || placeStateUpdateInFlight.current) return;
    placeStateUpdateInFlight.current = true;
    setPendingTagAction('create');
    try {
      const createdTag = await createTag(name);
      if (!createdTag) {
        Alert.alert('Tag not created', 'The new tag could not be saved.');
        return;
      }
      const didAssign = await updatePlace(place.id, { tags: addUserTag(place.tags, createdTag.name) });
      if (!didAssign) Alert.alert('Tag created', 'The tag was created but could not be added to this place.');
    } finally {
      placeStateUpdateInFlight.current = false;
      setPendingTagAction(null);
    }
  };

  const handleRenameTag = async (tag: PlaceTag, name: string) => {
    if (placeStateUpdateInFlight.current) return;
    placeStateUpdateInFlight.current = true;
    setPendingTagAction(`rename:${tag.id}`);
    try {
      const didRename = await renameTag(tag.id, name);
      if (!didRename) Alert.alert('Tag not renamed', 'The tag could not be renamed.');
    } finally {
      placeStateUpdateInFlight.current = false;
      setPendingTagAction(null);
    }
  };

  const performDeleteTag = async (tag: PlaceTag) => {
    if (placeStateUpdateInFlight.current) return;
    placeStateUpdateInFlight.current = true;
    setPendingTagAction(`delete:${tag.id}`);
    try {
      const didDelete = await deleteTag(tag.id);
      if (!didDelete) Alert.alert('Tag not deleted', 'The tag could not be deleted.');
    } finally {
      placeStateUpdateInFlight.current = false;
      setPendingTagAction(null);
    }
  };

  const handleDeleteTag = (tag: PlaceTag) => {
    Alert.alert(`Delete "${tag.name}"?`, 'This removes the tag from every saved place. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete Everywhere', style: 'destructive', onPress: () => void performDeleteTag(tag) }
    ]);
  };

  const handleDelete = () => {
    if (!place) return;
    Alert.alert('Delete place?', `${place.placeName} will be removed from saved places.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const didDelete = await deletePlace(place.id);
          if (didDelete) navigation.resetToHome();
          else Alert.alert('Delete failed', 'The place could not be deleted.');
        }
      }
    ]);
  };

  if (!place) {
    return (
      <View style={styles.missing}>
        <StatePanel title="Place not found" body="This saved place is no longer available." />
        <V2Button label="RETURN HOME" onPress={navigation.resetToHome} />
      </View>
    );
  }

  const isUpdating = pendingStatus !== null || isUpdatingFavorite || pendingTagAction !== null;
  const mapUrl = place.mapUrl;

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic" style={styles.screen}>
      <V2TopBar onBack={navigation.goBack} onHome={navigation.resetToHome} />
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text adjustsFontSizeToFit numberOfLines={2} style={styles.title}>{place.placeName}</Text>
          <Text style={styles.city}>{place.areaCity}</Text>
          <Text style={styles.address}>{place.address}</Text>
        </View>
        <FavoriteMark active={place.isFavorite} />
      </View>
      {storageError ? <StorageErrorBanner message={storageError} onRetry={retryStorage} /> : null}

      <View style={styles.controlSection}>
        <V2SectionLabel>Status</V2SectionLabel>
        <View style={styles.segmented}>
          {statusOptions.map((status) => {
            const selected = place.status === status;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: isUpdating, selected }}
                disabled={isUpdating}
                key={status}
                onPress={() => void handleStatusChange(status)}
                style={({ pressed }) => [styles.segment, selected && styles.segmentSelected, pressed && styles.pressed]}
              >
                <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{pendingStatus === status ? 'UPDATING' : statusLabels[status]}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.controlSection}>
        <V2SectionLabel color="pink">Favorite</V2SectionLabel>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: place.isFavorite, disabled: isUpdating }}
          disabled={isUpdating}
          onPress={() => void handleFavoriteToggle()}
          style={({ pressed }) => [styles.favoriteRow, place.isFavorite && styles.favoriteRowActive, pressed && styles.pressed]}
        >
          <View style={[styles.favoriteTile, place.isFavorite && styles.favoriteTileActive]}>
            <FavoriteMark active={place.isFavorite} contrast={place.isFavorite} />
          </View>
          <View style={styles.favoriteCopyWrap}>
            <Text style={styles.favoriteTitle}>{place.isFavorite ? 'SAVED AS FAVORITE' : 'ADD TO FAVORITES'}</Text>
            <Text style={styles.favoriteCopy}>{isUpdatingFavorite ? 'Updating favorite...' : place.isFavorite ? 'This place appears in your favorites filter.' : 'Keep this place within easy reach.'}</Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.controlSection}>
        <View style={styles.sectionHeaderRow}>
          <V2SectionLabel>Tags</V2SectionLabel>
          <V2Button compact label="MANAGE" onPress={() => setShowTagManager(true)} variant="ghost" />
        </View>
        {place.tags.length > 0 ? (
          <View style={styles.tagRail}>
            {place.tags.slice(0, 4).map((tag, index) => (
              <View key={tag} style={[styles.tag, index === 1 && styles.violetTag]}>
                <Text style={[styles.tagText, index === 1 && styles.violetTagText]}>{tag}</Text>
              </View>
            ))}
            {place.tags.length > 4 ? <Text style={styles.moreTags}>+{place.tags.length - 4} MORE</Text> : null}
          </View>
        ) : <Text style={styles.emptyCopy}>No tags assigned.</Text>}

      </View>

      <View style={styles.controlSection}>
        <V2SectionLabel>Notes</V2SectionLabel>
        <TextInput
          accessibilityLabel="Notes"
          multiline
          onChangeText={setNotesDraft}
          placeholder="Add your own notes about this place"
          placeholderTextColor={theme.colors.textSubtle}
          selectionColor={theme.colors.cobalt}
          style={styles.notesInput}
          textAlignVertical="top"
          value={notesDraft}
        />
        <V2Button disabled={isSavingNotes || notesDraft.trim() === (place.notes ?? '').trim()} label={isSavingNotes ? 'SAVING NOTES' : 'SAVE NOTES'} onPress={() => void handleSaveNotes()} />
      </View>

      <View style={styles.controlSection}>
        <V2SectionLabel>Sources / {place.sources.length}</V2SectionLabel>
        {place.sources.length ? (
          place.sources.map((source) => (
            <SourceCard
              key={source.id}
              onOpen={() => void openExternalUrl(source.sourceUrl, 'Instagram', () => analytics.instagramSourceOpened(source.mediaType))}
              source={source}
            />
          ))
        ) : (
          <StatePanel title="No source details" body="No Instagram sources are attached to this place yet." />
        )}
      </View>


      <View style={styles.controlSection}>
        <V2SectionLabel>Actions</V2SectionLabel>
        {mapUrl ? <V2Button label="OPEN MAP" onPress={() => void openExternalUrl(mapUrl, 'Map', analytics.mapLinkOpened)} variant="secondary" /> : null}
      </View>

      <View style={styles.detailsSection}>
        <V2SectionLabel color="cobalt">Details</V2SectionLabel>
        <DetailLine label="Specialty" value={place.cuisineOrSpecialty || 'Not set'} />
        <V2Button compact label={showTechnicalDetails ? 'HIDE TECHNICAL INFO' : 'SHOW TECHNICAL INFO'} onPress={() => setShowTechnicalDetails((current) => !current)} variant="secondary" />
        {showTechnicalDetails ? (
          <View style={styles.technicalDetails}>
            <DetailLine label="Place ID" value={place.placeId || 'Not set'} />
            <Text selectable style={styles.sourceUrl}>{place.sourceInstagramUrl}</Text>
          </View>
        ) : null}
      </View>

      <V2Button label="DELETE PLACE" onPress={handleDelete} variant="danger" />
      </ScrollView>
      <Modal
        animationType="slide"
        onRequestClose={() => setShowTagManager(false)}
        transparent={false}
        visible={showTagManager}
      >
        <SafeAreaView edges={['top', 'bottom']} style={styles.tagModal}>
          <View style={styles.tagModalHeader}>
            <View>
              <V2SectionLabel>Tags</V2SectionLabel>
              <Text style={styles.tagModalTitle}>MANAGE TAGS</Text>
            </View>
            <V2Button compact label="DONE" onPress={() => setShowTagManager(false)} variant="ghost" />
          </View>
          <ScrollView contentContainerStyle={styles.tagModalContent} contentInsetAdjustmentBehavior="automatic">
            <Text style={styles.managementIntro}>Assign tags to this place, or manage the shared tag library.</Text>
            <UserTagsEditor
              assignedTags={place.tags}
              availableTags={availableTags}
              disabled={isUpdating}
              onCreateTag={(name) => void handleCreateTag(name)}
              onDeleteTag={handleDeleteTag}
              onRenameTag={(tag, name) => void handleRenameTag(tag, name)}
              onToggleTag={handleToggleTag}
              pendingAction={pendingTagAction}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text selectable style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  screen: { backgroundColor: theme.colors.background, flex: 1 },
  content: { gap: theme.spacing.lg, padding: theme.spacing.lg, paddingBottom: theme.spacing.huge },
  missing: { backgroundColor: theme.colors.background, flex: 1, gap: theme.spacing.lg, justifyContent: 'center', padding: theme.spacing.xl },
  hero: { alignItems: 'flex-start', flexDirection: 'row', gap: theme.spacing.lg, justifyContent: 'space-between', paddingVertical: theme.spacing.sm },
  heroCopy: { flex: 1, gap: theme.spacing.xs },
  title: { color: theme.colors.text, fontFamily: theme.typography.displayFamily, fontSize: 43, letterSpacing: -0.5, lineHeight: 44, textTransform: 'uppercase' },
  city: { color: theme.colors.textMuted, fontSize: theme.typography.body.medium, fontWeight: '700' },
  address: { color: theme.colors.text, fontSize: theme.typography.body.medium, lineHeight: 21 },
  controlSection: { gap: theme.spacing.sm },
  sectionHeaderRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  segmented: { borderColor: theme.colors.borderStrong, borderWidth: 1, flexDirection: 'row' },
  segment: { alignItems: 'center', borderRightColor: theme.colors.borderStrong, borderRightWidth: 1, flex: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: theme.spacing.xs },
  segmentSelected: { backgroundColor: theme.colors.primary },
  segmentText: { color: theme.colors.text, fontFamily: theme.typography.displayFamily, fontSize: 12, letterSpacing: 0.4, textAlign: 'center', textTransform: 'uppercase' },
  segmentTextSelected: { color: theme.colors.onPrimary },
  favoriteRow: { alignItems: 'center', borderColor: theme.colors.borderStrong, borderWidth: 1, flexDirection: 'row', gap: theme.spacing.md, minHeight: 66, padding: theme.spacing.sm },
  favoriteRowActive: { borderColor: theme.colors.pink },
  favoriteTile: { alignItems: 'center', backgroundColor: theme.colors.surfaceMuted, height: 48, justifyContent: 'center', width: 48 },
  favoriteTileActive: { backgroundColor: theme.colors.pink },
  favoriteCopyWrap: { flex: 1, gap: theme.spacing.xxs },
  favoriteTitle: { color: theme.colors.pink, fontFamily: theme.typography.displayFamily, fontSize: 13, letterSpacing: 0.6 },
  favoriteCopy: { color: theme.colors.textMuted, fontSize: theme.typography.body.small, lineHeight: 18 },
  tagRail: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  tag: { borderColor: theme.colors.acidBorder, borderWidth: 1, minHeight: 32, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs },
  tagText: { color: theme.colors.acidInk, fontFamily: theme.typography.displayFamily, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase' },
  violetTag: { borderColor: theme.colors.violet },
  violetTagText: { color: theme.colors.violet },
  moreTags: { color: theme.colors.textMuted, fontFamily: theme.typography.displayFamily, fontSize: 11, letterSpacing: 0.6 },
  emptyCopy: { color: theme.colors.textMuted, fontSize: theme.typography.body.small },

  tagModal: { backgroundColor: theme.colors.background, flex: 1, padding: theme.spacing.lg },
  tagModalHeader: { alignItems: 'center', borderBottomColor: theme.colors.border, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 58 },
  tagModalTitle: { color: theme.colors.text, fontFamily: theme.typography.displayFamily, fontSize: 24, letterSpacing: 0.5 },
  tagModalContent: { gap: theme.spacing.md, paddingBottom: theme.spacing.huge, paddingTop: theme.spacing.lg },
  managementIntro: { color: theme.colors.textMuted, fontSize: theme.typography.body.small, lineHeight: 18 },
  notesInput: { backgroundColor: theme.colors.input, borderColor: theme.colors.borderStrong, borderWidth: 1, color: theme.colors.text, fontSize: theme.typography.body.medium, lineHeight: 21, minHeight: 100, padding: theme.spacing.md },
  detailsSection: { borderTopColor: theme.colors.border, borderTopWidth: 1, gap: theme.spacing.md, paddingTop: theme.spacing.lg },
  technicalDetails: { borderTopColor: theme.colors.border, borderTopWidth: 1, gap: theme.spacing.md, paddingTop: theme.spacing.md },
  detailLine: { gap: theme.spacing.xs },
  detailLabel: { color: theme.colors.textMuted, fontFamily: theme.typography.displayFamily, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase' },
  detailValue: { color: theme.colors.text, fontSize: theme.typography.body.medium, lineHeight: 21 },
  sourceUrl: { color: theme.colors.cobalt, fontSize: theme.typography.body.small, lineHeight: 18 },
  pressed: { opacity: 0.68 }
});