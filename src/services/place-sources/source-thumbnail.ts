import type { PlaceSource } from '../../types/place-source';

export const getSourceThumbnailState = (
  source: Pick<PlaceSource, 'thumbnailUrl'>,
  failed: boolean
) => (source.thumbnailUrl && !failed ? 'image' : 'fallback');
