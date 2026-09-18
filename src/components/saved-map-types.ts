import type { Position } from "../services/map-library";
export type SavedMapProps = {
  scopeKey: string;
  markers: { id: string; name: string; position: Position }[];
  selected?: string;
  onSelect: (id: string) => void;
};
