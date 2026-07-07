import { forwardRef, useImperativeHandle, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Web shim for react-native-maps.
 *
 * react-native-maps is native-only — it imports react-native internals
 * (codegenNativeCommands) that don't exist on web, so bundling it for web
 * breaks `expo export`. metro.config.cjs redirects `react-native-maps` to this
 * file for the web platform only; iOS/Android keep the real package.
 *
 * The caregiver clock-in flow ships on iOS/Android; the web bundle exists only
 * so `expo export` builds cleanly. MapView renders a neutral placeholder and
 * exposes the imperative methods the clock-in screen calls
 * (`fitToCoordinates`, `animateToRegion`) as no-ops, so `mapRef.current?.…`
 * stays safe. Overlays (Marker, Circle) render nothing.
 */

type MapHandle = {
  fitToCoordinates: (...args: unknown[]) => void;
  animateToRegion: (...args: unknown[]) => void;
};

const MapView = forwardRef<MapHandle, { style?: StyleProp<ViewStyle>; children?: ReactNode }>(
  ({ style, children }, ref) => {
    useImperativeHandle(ref, () => ({ fitToCoordinates: () => {}, animateToRegion: () => {} }));
    return (
      <View style={[styles.fallback, style]}>
        <Text style={styles.text}>Interactive map is available in the RayHealth mobile app.</Text>
        {children}
      </View>
    );
  },
);
MapView.displayName = 'MapViewWebShim';

export const Marker = (_props: unknown): null => null;
export const Circle = (_props: unknown): null => null;
export default MapView;

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#E9EEF2' },
  text: { color: '#5B6B78', fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },
});
