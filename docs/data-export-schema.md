# Account data export schema

The export format is `project-lemonade-data-export`, schema version **5**. It is UTF-8 JSON with an `exportedAt` UTC timestamp and a `data` object. Version 5 preserves the existing `savedPlaces`, `tags`, `importInboxItems`, and `diningPlans` arrays and adds `visits`.

Each visit contains:

| Field | Meaning |
| --- | --- |
| `id` | Stable visit identifier |
| `savedPlaceId` | Links to `data.savedPlaces[].id` |
| `visitDate` | Local calendar date, `YYYY-MM-DD`; never convert it to UTC |
| `rating` | Personal integer rating 1–5, or `null` |
| `note` | Private reflection, up to 2,000 Unicode characters, or `null` |
| `createdAt`, `updatedAt` | Database timestamps, including available fractional precision |
| `validationTimezone` | IANA time zone last supplied for validation; does not change the stored calendar date |

Visits are exported in stable identifier order. All persisted visits are read using bounded keyset pages until an empty page is returned, independently of loaded history pages and active library filters. Empty history is `[]`; an existing Visited status never invents a journal record. User IDs, credentials, provider payloads, device coordinates, and operational counters are excluded.

Retrieval failures stop export rather than sharing partial visit history. Account changes, sign-out, and local journal changes during preparation invalidate the operation; retry after changes finish. Like the existing multi-resource export, this is not a single database snapshot: changes made from another device during retrieval may affect the result. Finish editing before exporting a backup.

The native share sheet chooses the destination. Lemonade removes its cache copy when the share operation finishes or fails; a process interruption can leave the temporary copy until the next export or operating-system cache cleanup. Files saved to another destination are controlled by the user. Export makes no Google, Instagram, or Apify requests. Older clients exporting schema 4 omit visits and must not be used as complete backups of journal data. Import/restore is not provided by this release.
