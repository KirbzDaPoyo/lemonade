import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { V2Button, V2TextField } from './v2-controls';
import { V2SectionLabel } from './v2-layout';
import { AppTheme, useAppTheme } from '../design-system/theme';
import {
  getUserTagKey,
  MAX_USER_TAG_LENGTH,
  normalizeUserTag
} from '../services/tags/user-tags';
import type { PlaceTag } from '../types/place';

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
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [draft, setDraft] = useState('');
  const [editingTag, setEditingTag] = useState<PlaceTag | null>(null);
  const [isEditingLibrary, setIsEditingLibrary] = useState(false);
  const normalizedDraft = normalizeUserTag(draft);
  const assignedKeys = new Set(assignedTags.map(getUserTagKey));
  const existingMatch = availableTags.find((tag) => getUserTagKey(tag.name) === getUserTagKey(normalizedDraft));
  const hasRenameConflict = Boolean(editingTag && existingMatch && existingMatch.id !== editingTag.id);

  useEffect(() => {
    if (editingTag && !availableTags.some((tag) => tag.id === editingTag.id)) {
      setEditingTag(null);
      setDraft('');
    }
  }, [availableTags, editingTag]);

  const stopEditing = () => {
    setEditingTag(null);
    setDraft('');
  };

  const handleSubmit = () => {
    if (!normalizedDraft || hasRenameConflict) return;

    if (editingTag) {
      if (getUserTagKey(editingTag.name) !== getUserTagKey(normalizedDraft)) onRenameTag(editingTag, normalizedDraft);
    } else if (existingMatch) {
      onToggleTag(existingMatch, true);
    } else {
      onCreateTag(normalizedDraft);
    }

    stopEditing();
  };

  return (
    <View style={styles.editor}>
      <View style={styles.headerRow}>
        <V2SectionLabel>Tag library</V2SectionLabel>
        <V2Button
          compact
          disabled={disabled}
          label={isEditingLibrary ? 'DONE' : 'EDIT LIBRARY'}
          onPress={() => {
            setIsEditingLibrary((current) => !current);
            stopEditing();
          }}
          variant="ghost"
        />
      </View>
      <Text style={styles.helpText}>
        {isEditingLibrary
          ? 'Rename or remove a tag from every saved place.'
          : 'Select the tags that describe this place.'}
      </Text>

      {availableTags.length > 0 ? (
        <View style={styles.chipGrid}>
          {availableTags.map((tag) => {
            const isAssigned = assignedKeys.has(getUserTagKey(tag.name));

            if (isEditingLibrary) {
              return (
                <View key={tag.id} style={styles.manageChip}>
                  <Pressable
                    accessibilityLabel={`Rename ${tag.name} tag`}
                    accessibilityRole="button"
                    disabled={disabled}
                    onPress={() => {
                      setEditingTag(tag);
                      setDraft(tag.name);
                    }}
                    style={({ pressed }) => [styles.manageChipName, pressed && styles.pressed]}
                  >
                    <Text style={styles.chipText}>{tag.name}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Delete ${tag.name} tag everywhere`}
                    accessibilityRole="button"
                    disabled={disabled}
                    onPress={() => onDeleteTag(tag)}
                    style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.deleteButtonText}>{pendingAction === `delete:${tag.id}` ? 'DELETING' : 'DELETE'}</Text>
                  </Pressable>
                </View>
              );
            }

            return (
              <Pressable
                accessibilityLabel={`${tag.name}. ${isAssigned ? 'Assigned' : 'Not assigned'}.`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isAssigned, disabled }}
                disabled={disabled}
                key={tag.id}
                onPress={() => onToggleTag(tag, !isAssigned)}
                style={({ pressed }) => [styles.chip, isAssigned && styles.assignedChip, disabled && styles.disabled, pressed && styles.pressed]}
              >
                <Text style={[styles.chipText, isAssigned && styles.assignedChipText]}>{pendingAction === `assign:${tag.id}` ? 'UPDATING' : tag.name}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : <Text style={styles.emptyText}>No tags yet. Create the first one below.</Text>}

      <V2TextField
        accessibilityLabel={editingTag ? `Rename ${editingTag.name} tag` : 'New tag name'}
        editable={!disabled}
        label={editingTag ? `Rename ${editingTag.name}` : 'New tag'}
        maxLength={MAX_USER_TAG_LENGTH}
        onChangeText={setDraft}
        onSubmitEditing={handleSubmit}
        placeholder={editingTag ? 'Rename tag everywhere' : 'Create a new tag'}
        returnKeyType="done"
        value={draft}
      />
      <View style={styles.actionRow}>
        <V2Button
          compact
          disabled={disabled || !normalizedDraft || hasRenameConflict}
          label={
            pendingAction === (editingTag ? `rename:${editingTag.id}` : 'create')
              ? 'SAVING'
              : hasRenameConflict
                ? 'TAG ALREADY EXISTS'
                : editingTag
                  ? 'RENAME TAG'
                  : existingMatch
                    ? 'ADD EXISTING TAG'
                    : 'CREATE TAG'
          }
          onPress={handleSubmit}
          style={styles.flexButton}
        />
        {editingTag ? <V2Button compact label="CANCEL" onPress={stopEditing} style={styles.flexButton} variant="secondary" /> : null}
      </View>
    </View>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  editor: { borderTopColor: theme.colors.border, borderTopWidth: 1, gap: theme.spacing.md, paddingTop: theme.spacing.md },
  headerRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  helpText: { color: theme.colors.textMuted, fontSize: theme.typography.body.small, lineHeight: 18 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  chip: { alignItems: 'center', backgroundColor: theme.colors.background, borderColor: theme.colors.acidBorder, borderWidth: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm },
  assignedChip: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  manageChip: { alignItems: 'stretch', backgroundColor: theme.colors.background, borderColor: theme.colors.borderStrong, borderWidth: 1, flexDirection: 'row', minHeight: 48, overflow: 'hidden' },
  manageChipName: { justifyContent: 'center', paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm },
  deleteButton: { alignItems: 'center', backgroundColor: theme.colors.dangerSurface, borderLeftColor: theme.colors.danger, borderLeftWidth: 1, justifyContent: 'center', minWidth: 72, paddingHorizontal: theme.spacing.sm },
  deleteButtonText: { color: theme.colors.danger, fontFamily: theme.typography.displayFamily, fontSize: 12, letterSpacing: 0.5 },
  chipText: { color: theme.colors.acidInk, fontFamily: theme.typography.displayFamily, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' },
  assignedChipText: { color: theme.colors.onPrimary },
  emptyText: { color: theme.colors.textMuted, fontSize: theme.typography.body.small },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  flexButton: { flexGrow: 1 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.68 }
});