import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppTheme, useAppTheme } from '../design-system/theme';
import { getSourceThumbnailState } from '../services/place-sources/source-thumbnail';
import type { PlaceSource } from '../types/place-source';

export function SourceCard({ source, onOpen }: { source: PlaceSource; onOpen: () => void }) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const showImage = getSourceThumbnailState(source, thumbnailFailed) === 'image';
  const date = source.publishedAt
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(source.publishedAt))
    : undefined;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        {showImage ? (
          <Image onError={() => setThumbnailFailed(true)} resizeMode="cover" source={{ uri: source.thumbnailUrl }} style={styles.thumbnail} />
        ) : (
          <View accessibilityLabel="Instagram thumbnail unavailable" style={styles.fallback}>
            <Text style={styles.fallbackText}>{source.mediaType.toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.copy}>
          <Text numberOfLines={1} selectable style={styles.creator}>{source.creatorUsername ? `@${source.creatorUsername}` : 'INSTAGRAM SOURCE'}</Text>
          <Text selectable style={styles.meta}>{source.mediaType.toUpperCase()}{date ? ` / ${date}` : ''}</Text>
          {source.captionExcerpt ? <Text numberOfLines={4} selectable style={styles.caption}>{source.captionExcerpt}</Text> : null}
        </View>
      </View>
      {source.recommendedItems.length ? <Text selectable style={styles.detail}>TRY / {source.recommendedItems.join(' / ')}</Text> : null}
      {source.vibeTags.length ? <Text selectable style={styles.detail}>VIBE / {source.vibeTags.join(' / ')}</Text> : null}
      <Pressable accessibilityRole="link" onPress={onOpen} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Text style={styles.buttonText}>OPEN ON INSTAGRAM</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  card: { borderColor: theme.colors.borderStrong, borderWidth: 1, gap: theme.spacing.sm, padding: theme.spacing.md },
  row: { flexDirection: 'row', gap: theme.spacing.md },
  thumbnail: { backgroundColor: theme.colors.surfaceMuted, height: 92, width: 92 },
  fallback: { alignItems: 'center', backgroundColor: theme.colors.surfaceMuted, height: 92, justifyContent: 'center', width: 92 },
  fallbackText: { color: theme.colors.textMuted, fontFamily: theme.typography.displayFamily, fontSize: 12, letterSpacing: 0.8 },
  copy: { flex: 1, gap: theme.spacing.xs, minWidth: 0 },
  creator: { color: theme.colors.text, fontFamily: theme.typography.displayFamily, fontSize: 17, letterSpacing: 0.4 },
  meta: { color: theme.colors.textMuted, fontSize: theme.typography.body.small, fontVariant: ['tabular-nums'] },
  caption: { color: theme.colors.text, fontSize: theme.typography.body.small, lineHeight: 18 },
  detail: { color: theme.colors.violet, fontFamily: theme.typography.displayFamily, fontSize: 12, letterSpacing: 0.4 },
  button: { alignItems: 'center', borderColor: theme.colors.acidBorder, borderWidth: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: theme.spacing.md },
  buttonText: { color: theme.colors.acidInk, fontFamily: theme.typography.displayFamily, fontSize: 13, letterSpacing: 0.5 },
  pressed: { opacity: 0.68 }
});
