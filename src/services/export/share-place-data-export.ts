import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { SavedPlacesExportData } from '../../repositories/savedPlaces';
import { createPlaceDataExport, serializePlaceDataExport } from './place-data-export';

const EXPORT_FILE_NAME = 'project-lemonade-data-export.json';
let sharing = false;

export const sharePlaceDataExport = async ({
  places,
  tags
}: SavedPlacesExportData, inboxItems: import('../../types/inbox').InboxItem[] = [], plans: import('../../types/dining-plan').DiningPlan[] = [], visits: import('../../types/visit').VisitExport[] = [], assertCurrent: () => void = () => {}, planSharing: import('../owner-sharing').SharingDetails[] = []) => {
  if (sharing) throw new Error('An export is already being shared.');
  sharing = true;
  let exportFile: File | undefined;
  try {
    assertCurrent();
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error('File sharing is not available on this device.');
    }

    assertCurrent();
    exportFile = new File(Paths.cache, EXPORT_FILE_NAME);

    if (exportFile.exists) exportFile.delete();

    exportFile.create();
    exportFile.write(
      serializePlaceDataExport(createPlaceDataExport(places, tags, undefined, inboxItems, plans, visits, planSharing))
    );

    assertCurrent();
    await Sharing.shareAsync(exportFile.uri, {
      dialogTitle: 'Export Lemonade data',
      mimeType: 'application/json',
      UTI: 'public.json'
    });

  } finally {
    try { if (exportFile?.exists) exportFile.delete(); } finally { sharing = false; }
  }
};
