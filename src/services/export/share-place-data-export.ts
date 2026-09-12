import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { SavedPlacesExportData } from '../../repositories/savedPlaces';
import { createPlaceDataExport, serializePlaceDataExport } from './place-data-export';

const EXPORT_FILE_NAME = 'project-lemonade-data-export.json';

export const sharePlaceDataExport = async ({
  places,
  tags
}: SavedPlacesExportData, inboxItems: import('../../types/inbox').InboxItem[] = []) => {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('File sharing is not available on this device.');
  }

  const exportFile = new File(Paths.cache, EXPORT_FILE_NAME);

  if (exportFile.exists) {
    exportFile.delete();
  }

  exportFile.create();
  exportFile.write(
    serializePlaceDataExport(createPlaceDataExport(places, tags, undefined, inboxItems))
  );

  await Sharing.shareAsync(exportFile.uri, {
    dialogTitle: 'Export Lemonade data',
    mimeType: 'application/json',
    UTI: 'public.json'
  });

  return exportFile.uri;
};
