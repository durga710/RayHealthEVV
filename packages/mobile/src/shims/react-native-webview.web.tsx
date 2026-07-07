import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Web shim for react-native-webview.
 *
 * react-native-webview is native-only, it imports react-native internals
 * (codegenNativeComponent) that don't exist on web, so bundling it for web
 * breaks `expo export`. metro.config.cjs redirects `react-native-webview` to
 * this file for the web platform only; iOS/Android keep the real package.
 *
 * The course player ships on iOS/Android; the web bundle exists only so
 * `expo export` builds cleanly. WebView renders a neutral placeholder.
 */

export const WebView = ({ style }: { style?: StyleProp<ViewStyle>; [key: string]: unknown }) => (
  <View style={[styles.fallback, style]}>
    <Text style={styles.text}>Training videos are available in the RayHealth mobile app.</Text>
  </View>
);

export default WebView;

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#E9EEF2' },
  text: { color: '#5B6B78', fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },
});
