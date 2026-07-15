import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, radii, typography } from '../common/tokens';

/** One stroke = the [x, y] integer points of a continuous finger drag. */
export type SignatureStrokes = [number, number][][];

// Mirror the server-side payload bounds (60 strokes / 4000 points / 1000 per
// stroke) so a long scribble degrades by capping locally instead of earning a
// 400 at clock-out.
const MAX_STROKES = 60;
const MAX_POINTS_TOTAL = 4000;
const MAX_POINTS_PER_STROKE = 1000;

/**
 * Finger-drawn signature pad: PanResponder captures drag points, react-native-svg
 * draws them live. Strokes are plain integer point arrays, the exact shape the
 * clock-out API stores, so no rasterization step exists anywhere.
 */
export default function SignaturePad({
  strokes,
  onChange,
  height = 190,
}: {
  strokes: SignatureStrokes;
  onChange: (strokes: SignatureStrokes, size: { width: number; height: number }) => void;
  height?: number;
}) {
  const [width, setWidth] = useState(0);
  // The in-progress stroke lives in a ref (mutated per move event) and is
  // mirrored into state only to trigger redraws; committing to the parent
  // happens once per released stroke.
  const activeRef = useRef<[number, number][]>([]);
  const [, forceDraw] = useState(0);
  const sizeRef = useRef({ width: 0, height });
  sizeRef.current = { width, height };
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;

  const totalPoints = useMemo(
    () => strokes.reduce((total, s) => total + s.length, 0),
    [strokes],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          if (strokesRef.current.length >= MAX_STROKES) return;
          const { locationX, locationY } = evt.nativeEvent;
          activeRef.current = [[Math.round(locationX), Math.round(locationY)]];
          forceDraw((n) => n + 1);
        },
        onPanResponderMove: (evt) => {
          if (activeRef.current.length === 0) return;
          const committed = strokesRef.current.reduce((t, s) => t + s.length, 0);
          if (
            activeRef.current.length >= MAX_POINTS_PER_STROKE ||
            committed + activeRef.current.length >= MAX_POINTS_TOTAL
          ) {
            return;
          }
          const { width: w, height: h } = sizeRef.current;
          const x = Math.round(Math.min(Math.max(evt.nativeEvent.locationX, 0), w));
          const y = Math.round(Math.min(Math.max(evt.nativeEvent.locationY, 0), h));
          activeRef.current.push([x, y]);
          forceDraw((n) => n + 1);
        },
        onPanResponderRelease: () => {
          if (activeRef.current.length === 0) return;
          const finished = activeRef.current;
          activeRef.current = [];
          onChange([...strokesRef.current, finished], {
            width: Math.round(sizeRef.current.width),
            height: Math.round(sizeRef.current.height),
          });
        },
        onPanResponderTerminate: () => {
          activeRef.current = [];
          forceDraw((n) => n + 1);
        },
      }),
    [onChange],
  );

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const toPointsAttr = (stroke: [number, number][]) => stroke.map(([x, y]) => `${x},${y}`).join(' ');

  const clear = () => {
    void Haptics.selectionAsync();
    activeRef.current = [];
    onChange([], { width: Math.round(width), height });
  };

  const isEmpty = totalPoints === 0 && activeRef.current.length === 0;

  return (
    <View>
      <View
        style={[styles.pad, { height }]}
        onLayout={onLayout}
        {...panResponder.panHandlers}
        accessibilityLabel="Signature pad, draw the signature with a finger"
      >
        {width > 0 ? (
          <Svg width={width} height={height} pointerEvents="none">
            {strokes.map((stroke, i) => (
              <Polyline
                key={i}
                points={toPointsAttr(stroke)}
                fill="none"
                stroke={colors.textPrimary}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {activeRef.current.length > 0 ? (
              <Polyline
                points={toPointsAttr(activeRef.current)}
                fill="none"
                stroke={colors.textPrimary}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
          </Svg>
        ) : null}
        {isEmpty ? (
          <View style={styles.placeholder} pointerEvents="none">
            <Ionicons name="create-outline" size={22} color={colors.placeholder} />
            <Text style={styles.placeholderText}>Sign here</Text>
          </View>
        ) : null}
        <View style={styles.baseline} pointerEvents="none" />
      </View>
      <View style={styles.toolbar}>
        <Text style={styles.hint}>Use a finger to sign inside the box.</Text>
        <Pressable
          onPress={clear}
          disabled={isEmpty}
          hitSlop={8}
          style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.7 }, isEmpty && { opacity: 0.4 }]}
          accessibilityRole="button"
          accessibilityLabel="Clear signature"
        >
          <Ionicons name="refresh" size={14} color={colors.brandBlue} />
          <Text style={styles.clearText}>Clear</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    overflow: 'hidden',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  placeholderText: { ...typography.sub, color: colors.placeholder, fontWeight: '700' },
  baseline: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 34,
    height: 1,
    backgroundColor: colors.border,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  hint: { ...typography.caption, color: colors.textMuted },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  clearText: { fontSize: 12.5, fontWeight: '800', color: colors.brandBlue },
});
