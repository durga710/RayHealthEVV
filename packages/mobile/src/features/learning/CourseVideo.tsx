import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { toEmbedUrl } from '../../lib/video-embed';
import { colors, radii, shadow, typography } from '../common/tokens';

/**
 * Inline training video for the course player: a tap-to-play poster that swaps
 * to a WebView on the privacy-enhanced YouTube embed (autoplay once tapped).
 * Nothing loads until the caregiver explicitly taps play.
 */
export default function CourseVideo({ videoUrl }: { videoUrl: string }) {
  const [started, setStarted] = useState(false);

  if (!started) {
    return (
      <Pressable
        onPress={() => {
          void Haptics.selectionAsync();
          setStarted(true);
        }}
        style={({ pressed }) => [styles.frame, styles.poster, pressed && { opacity: 0.92 }]}
        accessibilityRole="button"
        accessibilityLabel="Play training video"
      >
        <View style={styles.playCircle}>
          <Ionicons name="play" size={30} color={colors.onGradient} style={{ marginLeft: 3 }} />
        </View>
        <Text style={styles.posterText}>Tap to play the training video</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.frame}>
      <WebView
        source={{ uri: toEmbedUrl(videoUrl) }}
        style={styles.webview}
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.onGradient} size="large" />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    aspectRatio: 16 / 9,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.navy,
    ...shadow.card,
  },
  poster: { alignItems: 'center', justifyContent: 'center', gap: 14 },
  playCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.brandBlue,
    alignItems: 'center', justifyContent: 'center',
    ...shadow.raised,
  },
  posterText: { ...typography.body, color: colors.onGradientSoft },
  webview: { flex: 1, backgroundColor: colors.navy },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.navy,
  },
});
