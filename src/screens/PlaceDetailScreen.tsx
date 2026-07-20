import { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { AppNavigation } from '../navigation/types';
import { getTagLabel } from '../services/tags/placeTagNormalizer';
import { usePlaces } from '../store/PlacesContext';
import { colors, radii, spacing } from '../theme';
import { PlaceStatus } from '../types/place';
import { categoryLabels, statusLabels } from '../utils/labels';

type PlaceDetailScreenProps = {
  navigation: AppNavigation;
  placeId: string;
};

const statusOptions: PlaceStatus[] = ['want_to_go', 'visited', 'favorite', 'skip'];

export function PlaceDetailScreen({ navigation, placeId }: PlaceDetailScreenProps) {
  const { deletePlace, places, storageError, updatePlace, updatePlaceStatus } = usePlaces();
  const place = places.find((savedPlace) => savedPlace.id === placeId);
  const [notesDraft, setNotesDraft] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
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

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View style={styles.header}>
        <AppButton label="Back" onPress={navigation.goBack} variant="ghost" />
        <AppButton label="Home" onPress={navigation.resetToHome} variant="secondary" />
      </View>

      <View style={styles.hero}>
        <Text style={styles.category}>{categoryLabels[place.category]}</Text>
        <Text style={styles.title}>{place.placeName}</Text>
        <Text style={styles.meta}>{place.areaCity}</Text>
      </View>

      {storageError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorTitle}>Storage issue</Text>
          <Text style={styles.errorBody}>{storageError}</Text>
        </View>
      ) : null}

      <Section title="Status">
        <View style={styles.statusGrid}>
          {statusOptions.map((status) => (
            <AppButton
              key={status}
              label={statusLabels[status]}
              onPress={() => updatePlaceStatus(place.id, status)}
              variant={place.status === status ? 'primary' : 'secondary'}
              style={styles.statusButton}
            />
          ))}
        </View>
      </Section>

      <Section title="Details">
        <DetailLine label="Address" value={place.address} />
        <DetailLine label="Specialty" value={place.cuisineOrSpecialty || 'Not set'} />
        <DetailLine label="Place ID" value={place.placeId || 'Not set'} />
      </Section>

      <Section title="Tags">
        <View style={styles.tagRow}>
          {place.tags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{getTagLabel(tag)}</Text>
            </View>
          ))}
        </View>
      </Section>

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
            onPress={() => Linking.openURL(place.sourceInstagramUrl)}
            variant="secondary"
            style={styles.flexButton}
          />
          {place.mapUrl ? (
            <AppButton
              label="Open Map"
              onPress={() => Linking.openURL(place.mapUrl || '')}
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
  category: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase'
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
  errorBanner: {
    backgroundColor: '#fff3f0',
    borderColor: colors.danger,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md
  },
  errorTitle: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '900'
  },
  errorBody: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18
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
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  tag: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  tagText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800'
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


