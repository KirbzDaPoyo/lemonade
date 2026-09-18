import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { Platform, Text, View } from "react-native";
import Constants from "expo-constants";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { V2Button } from "./v2-controls";
import { useAppTheme } from "../design-system/theme";
import type { SavedMapProps } from "./saved-map-types";
import { errorMonitoring } from "../observability/error-monitoring";
class MapBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    errorMonitoring.captureException(new Error("Map rendering failed"), {
      operation: "map_render",
      category: "map",
    });
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
function NativeMap({ markers, selected, onSelect, scopeKey }: SavedMapProps) {
  const ref = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const { theme } = useAppTheme();
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!ready) setFailed(true);
    }, 15000);
    return () => clearTimeout(timer);
  }, [ready]);
  useEffect(() => {
    if (ready && markers.length)
      ref.current?.fitToCoordinates(
        markers.map((m) => m.position),
        {
          edgePadding: { top: 48, right: 48, bottom: 48, left: 48 },
          animated: false,
        },
      );
  }, [ready, scopeKey]);
  if (failed)
    return (
      <Text style={{ color: theme.colors.text }}>
        Map did not become ready. Use the list or retry the renderer.
      </Text>
    );
  return (
    <MapView
      ref={ref}
      style={{ height: 340, width: "100%" }}
      provider={PROVIDER_GOOGLE}
      onMapReady={() => setReady(true)}
      mapPadding={{ top: 12, right: 12, bottom: 12, left: 12 }}
      showsUserLocation={false}
      showsMyLocationButton={false}
      showsCompass
      toolbarEnabled={false}
      moveOnMarkerPress={false}
    >
      {markers.map((m, i) => (
        <Marker
          key={m.id}
          coordinate={m.position}
          title={`${selected === m.id ? "Selected: " : ""}${m.name}`}
          description={`Saved place ${i + 1}`}
          accessibilityLabel={`${selected === m.id ? "Selected " : ""}saved place ${i + 1}: ${m.name}`}
          onPress={() => onSelect(m.id)}
          pinColor={selected === m.id ? "#C32256" : "#245CC9"}
        />
      ))}
    </MapView>
  );
}
export function SavedMap(props: SavedMapProps) {
  const { theme } = useAppTheme();
  const [revision, setRevision] = useState(0);
  const configured =
    Constants.expoConfig?.extra?.mapSdk?.[Platform.OS] === true;
  if (!configured)
    return (
      <Text style={{ color: theme.colors.text }}>
        Google map configuration is unavailable in this build. The loaded list
        and external Maps actions remain available.
      </Text>
    );
  return (
    <View style={{ gap: 12 }}>
      <MapBoundary
        key={revision}
        fallback={
          <Text style={{ color: theme.colors.text }}>
            Map rendering failed. Use the list or retry.
          </Text>
        }
      >
        <NativeMap {...props} />
      </MapBoundary>
      <V2Button
        variant="ghost"
        label="Retry map display"
        onPress={() => setRevision((v) => v + 1)}
      />
    </View>
  );
}
