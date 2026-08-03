import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { UserTagsEditor } from '../components/user-tags-editor';
import { StorageErrorBanner } from '../components/storage-error-banner';
import { AppNavigation } from '../navigation/types';
import { addUserTag, deleteUserTag } from '../services/tags/user-tags';
import { usePlaces } from '../store/PlacesContext';
import { colors, radii, spacing } from '../theme';
import type { PlaceStatus, PlaceTag } from '../types/place';
import { favoriteLabel, statusLabels } from '../utils/labels';

type PlaceDetailScreenProps = {
  navigation: AppNavigation;
  placeId: string;
};

const statusOptions: PlaceStatus[] = ['want_to_go', 'visited', 'skipped'];

const openExternalUrl = async (url: string, destination: string) => {
  try {
    const isSupported = await Linking.canOpenURL(url);

    if (!isSupported) {
      throw new Error('Unsupported URL');
    }

    await Linking.openURL(url);
  } catch {
    Alert.alert(
      `${destination} unavailable`,
      'This link could not be opened on this device.'
    );
  }
};

export function PlaceDetailScreen({ navigation, placeId }: PlaceDetailScreenProps) {
  const {
    availableTags,
    createTag,
    deletePlace,
    deleteTag,
    places,
    renameTag,
    storageError,
    updatePlace
  } = usePlaces();
  const place = places.find((savedPlace) => savedPlace.id === placeId);
  const [notesDraft, setNotesDraft] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isUpdatingFavorite, setIsUpdatingFavorite] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<PlaceStatus | null>(null);
  const placeStateUpdateInFlight = useRef(false);
  const [pendingTagAction, setPendingTagAction] = useState<string | null>(null);
  useEffect(() => {
    setNotesDraft(place?.notes ?? '');
  }, [place?.id, place?.notes]);

  const handleSaveNotes = async () => {
    if (!place) {
      return;
    }

    setIsSavingNotes(true);

    try {
      const didUpdate = await updatePlace(place.id, {
        notes: notesDraft.trim() || null
      });

      if (!didUpdate) {
        Alert.alert('Notes not saved', 'The notes could not be updated.');
      }
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleClearNotes = async () => {
    setNotesDraft('');

    if (!place?.notes) {
      return;
    }

    setIsSavingNotes(true);

    try {
      const didUpdate = await updatePlace(place.id, { notes: null });

      if (!didUpdate) {
        Alert.alert('Notes not cleared', 'The notes could not be cleared.');
      }
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleStatusChange = async (status: PlaceStatus) => {
    if (!place || place.status === status || placeStateUpdateInFlight.current) {
      return;
    }

    placeStateUpdateInFlight.current = true;
    setPendingStatus(status);

    try {
      const didUpdate = await updatePlace(place.id, { status });

      if (!didUpdate) {
        Alert.alert(
          'Status not updated',
          `The status could not be changed to ${statusLabels[status]}.`
        );
      }
    } catch {
      Alert.alert(
        'Status not updated',
        `The status could not be changed to ${statusLabels[status]}.`
      );
    } finally {
      placeStateUpdateInFlight.current = false;
      setPendingStatus(null);
    }
  };

  const handleFavoriteToggle = async () => {
    if (!place || placeStateUpdateInFlight.current) {
      return;
    }

    placeStateUpdateInFlight.current = true;
    setIsUpdatingFavorite(true);

    try {
      const didUpdate = await updatePlace(place.id, { isFavorite: !place.isFavorite });

      if (!didUpdate) {
        Alert.alert('Favorite not updated', 'The Favorite setting could not be changed.');
      }
    } catch {
      Alert.alert('Favorite not updated', 'The Favorite setting could not be changed.');
    } finally {
      placeStateUpdateInFlight.current = false;
      setIsUpdatingFavorite(false);
    }
  };

  const handleTagsChange = async (tags: string[], action: string) => {
    if (!place || placeStateUpdateInFlight.current) {
      return;
    }

    placeStateUpdateInFlight.current = true;
    setPendingTagAction(action);

    try {
      const didUpdate = await updatePlace(place.id, { tags });

      if (!didUpdate) {
        Alert.alert('Tags not updated', 'Your tag changes could not be saved.');
      }
    } catch {
      Alert.alert('Tags not updated', 'Your tag changes could not be saved.');
    } finally {
      placeStateUpdateInFlight.current = false;
      setPendingTagAction(null);
    }
  };
  const handleToggleTag = (tag: PlaceTag, assigned: boolean) => {
    if (!place) {
      return;
    }

    const nextTags = assigned
      ? addUserTag(place.tags, tag.name)
      : deleteUserTag(place.tags, tag.name);
    void handleTagsChange(nextTags, `assign:${tag.id}`);
  };

  const handleCreateTag = async (name: string) => {
    if (!place || placeStateUpdateInFlight.current) {
      return;
    }

    placeStateUpdateInFlight.current = true;
    setPendingTagAction('create');

    try {
      const createdTag = await createTag(name);

      if (!createdTag) {
        Alert.alert('Tag not created', 'The new tag could not be saved.');
        return;
      }

      const didAssign = await updatePlace(place.id, {
        tags: addUserTag(place.tags, createdTag.name)
      });

      if (!didAssign) {
        Alert.alert('Tag created', 'The tag was created but could not be added to this place.');
      }
    } finally {
      placeStateUpdateInFlight.current = false;
      setPendingTagAction(null);
    }
  };

  const handleRenameTag = async (tag: PlaceTag, name: string) => {
    if (placeStateUpdateInFlight.current) {
      return;
    }

    placeStateUpdateInFlight.current = true;
    setPendingTagAction(`rename:${tag.id}`);

    try {
      const didRename = await renameTag(tag.id, name);

      if (!didRename) {
        Alert.alert('Tag not renamed', 'The tag could not be renamed.');
      }
    } finally {
      placeStateUpdateInFlight.current = false;
      setPendingTagAction(null);
    }
  };

  const performDeleteTag = async (tag: PlaceTag) => {
    if (placeStateUpdateInFlight.current) {
      return;
    }

    placeStateUpdateInFlight.current = true;
    setPendingTagAction(`delete:${tag.id}`);

    try {
      const didDelete = await deleteTag(tag.id);

      if (!didDelete) {
        Alert.alert('Tag not deleted', 'The tag could not be deleted.');
      }
    } finally {
      placeStateUpdateInFlight.current = false;
      setPendingTagAction(null);
    }
  };

  const handleDeleteTag = (tag: PlaceTag) => {
    Alert.alert(
      `Delete "${tag.name}"?`,
      'This removes the tag from every saved place. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everywhere',
          style: 'destructive',
          onPress: () => void performDeleteTag(tag)
        }
      ]
    );
  };


  const handleDelete = () => {
    if (!place) {
      return;
    }

    Alert.alert('Delete place?', `${place.placeName} will be removed from saved places.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const didDelete = await deletePlace(place.id);

          if (didDelete) {
            navigation.resetToHome();
          } else {
            Alert.alert('Delete failed', 'The place could not be deleted.');
          }
        }
      }
    ]);
  };

  if (!place) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Place not found</Text>
        <AppButton label="Home" onPress={navigation.resetToHome} />
      </View>
    );
  }

  const mapUrl = place.mapUrl;
  const isPlaceStateUpdating =
    pendingStatus !== null ||
    isUpdatingFavorite ||
    pendingTagAction !== null;

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View style={styles.header}>
        <AppButton label="Back" onPress={navigation.goBack} variant="ghost" />
        <AppButton label="Home" onPress={navigation.resetToHome} variant="secondary" />
      </View>

      <View style={styles.hero}>
        <Text style={styles.title}>{place.placeName}</Text>
        <Text style={styles.meta}>{place.areaCity}</Text>
      </View>

      {storageError ? <StorageErrorBanner message={storageError} /> : null}

      <Section title="Status">
        <View style={styles.statusGrid}>
          {statusOptions.map((status) => (
            <AppButton
              disabled={isPlaceStateUpdating}
              key={status}
              label={pendingStatus === status ? 'Updating...' : statusLabels[status]}
              onPress={() => handleStatusChange(status)}
              variant={place.status === status ? 'primary' : 'secondary'}
              style={styles.statusButton}
            />
          ))}
        </View>
      </Section>

      <Section title={favoriteLabel}>
        <AppButton
          disabled={isPlaceStateUpdating}
          label={
            isUpdatingFavorite
              ? 'Updating...'
              : place.isFavorite
                ? 'Remove Favorite'
                : 'Mark as Favorite'
          }
          onPress={handleFavoriteToggle}
          variant={place.isFavorite ? 'primary' : 'secondary'}
        />
      </Section>

      <Section title="Details">
        <DetailLine label="Address" value={place.address} />
        <DetailLine label="Specialty" value={place.cuisineOrSpecialty || 'Not set'} />
        <DetailLine label="Place ID" value={place.placeId || 'Not set'} />
      </Section>

      <UserTagsEditor
        assignedTags={place.tags}
        availableTags={availableTags}
        disabled={isPlaceStateUpdating}
        onCreateTag={(name) => void handleCreateTag(name)}
        onDeleteTag={handleDeleteTag}
        onRenameTag={(tag, name) => void handleRenameTag(tag, name)}
        onToggleTag={handleToggleTag}
        pendingAction={pendingTagAction}
      />

      <Section title="Notes">
        <TextInput
          multiline
          onChangeText={setNotesDraft}
          placeholder="Add your own notes about this place"
          placeholderTextColor={colors.muted}
          style={styles.notesInput}
          textAlignVertical="top"
          value={notesDraft}
        />
        <View style={styles.actionRow}>
          <AppButton
            disabled={isSavingNotes || notesDraft.trim() === (place.notes ?? '').trim()}
            label={isSavingNotes ? 'Saving...' : 'Save Notes'}
            onPress={handleSaveNotes}
            style={styles.flexButton}
          />
          <AppButton
            disabled={isSavingNotes || (!notesDraft.trim() && !place.notes)}
            label="Clear"
            onPress={handleClearNotes}
            variant="secondary"
            style={styles.flexButton}
          />
        </View>
      </Section>

      <Section title="Source">
        <Text selectable style={styles.linkText}>
          {place.sourceInstagramUrl}
        </Text>
        <View style={styles.actionRow}>
          <AppButton
            label="Open Instagram"
            onPress={() => void openExternalUrl(place.sourceInstagramUrl, 'Instagram')}
            variant="secondary"
            style={styles.flexButton}
          />
          {mapUrl ? (
            <AppButton
              label="Open Map"
              onPress={() => void openExternalUrl(mapUrl, 'Map')}
              variant="secondary"
              style={styles.flexButton}
            />
          ) : null}
        </View>
      </Section>

      <AppButton label="Delete Place" onPress={handleDelete} variant="danger" />
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
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
  hero: {
    gap: spacing.xs
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '900'
  },
  meta: {
    color: colors.muted,
    fontSize: 17,
    fontWeight: '600'
  },
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900'
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  statusButton: {
    flexGrow: 1,
    minHeight: 42
  },
  detailLine: {
    gap: spacing.xs
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  detailValue: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21
  },
  notesInput: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 120,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  linkText: {
    color: colors.primary,
    fontSize: 14,
    lineHeight: 20
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  flexButton: {
    flexGrow: 1
  }
});
