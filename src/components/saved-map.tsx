import { Text } from "react-native";
import { useAppTheme } from "../design-system/theme";
import type { SavedMapProps } from "./saved-map-types";
export function SavedMap(_props: SavedMapProps) {
  const { theme } = useAppTheme();
  return (
    <Text style={{ color: theme.colors.text }}>
      Embedded maps are available in the Android and iOS app. Use the list and
      Google Maps actions below.
    </Text>
  );
}
