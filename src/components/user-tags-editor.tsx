import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  getUserTagKey,
  MAX_USER_TAG_LENGTH,
  normalizeUserTag
} from '../services/tags/user-tags';
import { colors, radii, spacing } from '../theme';
import type { PlaceTag } from '../types/place';
import { AppButton } from './AppButton';

type UserTagsEditorProps = {
  assignedTags: string[];
  availableTags: PlaceTag[];
  disabled: boolean;
  pendingAction: string | null;
  onCreateTag: (name: string) => void;
  onDeleteTag: (tag: PlaceTag) => void;
  onRenameTag: (tag: PlaceTag, name: string) => void;
  onToggleTag: (tag: PlaceTag, assigned: boolean) => void;
};

export function UserTagsEditor({
  assignedTags,
  availableTags,
  disabled,
  pendingAction,
  onCreateTag,
  onDeleteTag,
  onRenameTag,
  onToggleTag
}: UserTagsEditorProps) {
  const [draft, setDraft] = useState('');
  const [editingTag, setEditingTag] = useState<PlaceTag | null>(null);
  const [isManaging, setIsManaging] = useState(false);
  const normalizedDraft = normalizeUserTag(draft);
  const assignedKeys = new Set(assignedTags.map(getUserTagKey));
  const existingMatch = availableTags.find(
    (tag) => getUserTagKey(tag.name) === getUserTagKey(normalizedDraft)
  );
  const hasRenameConflict = Boolean(
    editingTag && existingMatch && existingMatch.id !== editingTag.id
  );

  useEffect(() => {
    if (editingTag && !availableTags.some((tag) => tag.id === editingTag.id)) {
      setEditingTag(null);
      setDraft('');
    }
  }, [availableTags, editingTag]);

  const handleSubmit = () => {
    if (!normalizedDraft || hasRenameConflict) {
      return;
    }

    if (editingTag) {
      if (getUserTagKey(editingTag.name) !== getUserTagKey(normalizedDraft)) {
        onRenameTag(editingTag, normalizedDraft);
      }
    } else if (existingMatch) {
      onToggleTag(existingMatch, true);
    } else {
      onCreateTag(normalizedDraft);
    }

    setEditingTag(null);
    setDraft('');
  };

  const beginEdit = (tag: PlaceTag) => {
    setEditingTag(tag);
    setDraft(tag.name);
  };

  const stopEditing = () => {
    setEditingTag(null);
    setDraft('');
  };

  const toggleManageMode = () => {
    setIsManaging((current) => !current);
    stopEditing();
  };

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Tags</Text>
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={toggleManageMode}
          style={({ pressed }) => [
            styles.manageButton,
            disabled && styles.disabled,
            pressed && !disabled && styles.pressed
          ]}
        >
          <Text style={styles.manageButtonText}>{isManaging ? 'Done' : 'Manage'}</Text>
        </Pressable>
      </View>

      <Text style={styles.helpText}>
        {isManaging
          ? 'Tap a tag name to rename it everywhere, or x to delete it everywhere.'
          : 'Tap tags to add or remove them from this place. New tags use your own wording.'}
      </Text>

      {availableTags.length > 0 ? (
        <View style={styles.chipGrid}>
          {availableTags.map((tag) => {
            const isAssigned = assignedKeys.has(getUserTagKey(tag.name));

            return isManaging ? (
              <View key={tag.id} style={styles.manageChip}>
                <Pressable
                  accessibilityLabel={`Rename ${tag.name} tag`}
                  accessibilityRole="button"
                  disabled={disabled}
                  onPress={() => beginEdit(tag)}
                  style={({ pressed }) => [
                    styles.manageChipName,
                    pressed && !disabled && styles.pressed
                  ]}
                >
                  <Text style={styles.chipText}>{tag.name}</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={`Delete ${tag.name} tag everywhere`}
                  accessibilityRole="button"
                  disabled={disabled}
                  onPress={() => onDeleteTag(tag)}
                  style={({ pressed }) => [
                    styles.deleteButton,
                    pressed && !disabled && styles.pressed
                  ]}
                >
                  <Text style={styles.deleteButtonText}>
                    {pendingAction === `delete:${tag.id}` ? '...' : 'x'}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                accessibilityLabel={`${tag.name}. ${isAssigned ? 'Assigned' : 'Not assigned'}.`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isAssigned, disabled }}
                disabled={disabled}
                key={tag.id}
                onPress={() => onToggleTag(tag, !isAssigned)}
                style={({ pressed }) => [
                  styles.chip,
                  isAssigned && styles.assignedChip,
                  disabled && styles.disabled,
                  pressed && !disabled && styles.pressed
                ]}
              >
                <Text style={[styles.chipText, isAssigned && styles.assignedChipText]}>
                  {pendingAction === `assign:${tag.id}` ? 'Updating...' : tag.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Text style={styles.emptyText}>No tags yet. Create your first one below.</Text>
      )}

      <TextInput
        accessibilityLabel={editingTag ? `Rename ${editingTag.name} tag` : 'New tag name'}
        editable={!disabled}
        maxLength={MAX_USER_TAG_LENGTH}
        onChangeText={setDraft}
        onSubmitEditing={handleSubmit}
        placeholder={editingTag ? 'Rename tag everywhere' : 'Create a new tag'}
        placeholderTextColor={colors.muted}
        returnKeyType="done"
        style={styles.input}
        value={draft}
      />
      <View style={styles.actionRow}>
        <AppButton
          disabled={disabled || !normalizedDraft || hasRenameConflict}
          label={
            pendingAction === (editingTag ? `rename:${editingTag.id}` : 'create')
              ? 'Saving...'
              : hasRenameConflict
                ? 'Tag Already Exists'
                : editingTag
                  ? 'Rename Tag'
                  : existingMatch
                    ? 'Add Existing Tag'
                    : 'Create Tag'
          }
          onPress={handleSubmit}
          style={styles.flexButton}
        />
        {editingTag ? (
          <AppButton
            disabled={disabled}
            label="Cancel"
            onPress={stopEditing}
            style={styles.flexButton}
            variant="secondary"
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900'
  },
  manageButton: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.md
  },
  manageButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900'
  },
  helpText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  chip: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  assignedChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  manageChip: {
    alignItems: 'stretch',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 40,
    overflow: 'hidden'
  },
  manageChipName: {
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'center',
    minWidth: 38,
    paddingHorizontal: spacing.sm
  },
  deleteButtonText: {
    color: colors.danger,
    fontSize: 20,
    fontWeight: '900'
  },
  chipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800'
  },
  assignedChipText: {
    color: colors.surface
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    fontStyle: 'italic'
  },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  flexButton: {
    flexGrow: 1
  },
  disabled: {
    opacity: 0.5
  },
  pressed: {
    opacity: 0.78
  }
});
