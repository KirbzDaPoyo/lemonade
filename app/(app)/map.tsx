import { MapLibraryScreen } from "../../src/screens/map-library-screen";
import { useAppNavigation } from "../../src/navigation/use-app-navigation";
export default function MapRoute() {
  return <MapLibraryScreen navigation={useAppNavigation()} />;
}
