import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions, type CameraCapturedPicture } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import apiClient from '../../lib/api-client';
import ScreenHeader from '../common/ScreenHeader';
import ErrorRetry from '../common/ErrorRetry';
import { SkeletonList } from '../common/Skeleton';
import { showAppAlert } from '../common/alerts/appAlert';
import { alpha, colors, radii, shadow, typography } from '../common/tokens';
import {
  describeOutcome,
  isUploadableCapture,
  stepFor,
  type IdentityOutcome,
  type IdentityStatus,
} from '../../lib/identity';

/**
 * RayVerify identity verification.
 *
 * Consent, then enroll a reference photo, then check it. The order is enforced
 * server-side too; this screen just makes it legible.
 *
 * The screen is deliberately plain about two things a caregiver deserves to
 * know before pointing a camera at their own face: exactly what is being
 * stored, and that they can delete it whenever they like. It is also plain
 * that a match confirms who is in the photo, not that a person was physically
 * present, because liveness is not built yet and implying otherwise would be
 * the easiest lie for this screen to tell.
 */

const TONE_COLOR = {
  success: colors.success,
  warning: colors.amber,
  error: colors.danger,
  info: colors.brandBlue,
} as const;

const TONE_ICON = {
  success: 'checkmark-circle',
  warning: 'alert-circle',
  error: 'close-circle',
  info: 'information-circle',
} as const;

type Mode = 'idle' | 'capturing-enroll' | 'capturing-verify';

interface VerifyResult {
  outcome: IdentityOutcome;
  similarity: number | null;
}

export default function IdentityScreen() {
  const [status, setStatus] = useState<IdentityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('idle');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get<IdentityStatus>('/api/identity/status');
      setStatus(res.data);
      setError(null);
    } catch {
      setError('Could not load your identity settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const step = stepFor(status);

  const openCamera = async (next: Exclude<Mode, 'idle'>) => {
    if (!permission?.granted) {
      const granted = await requestPermission();
      if (!granted.granted) {
        showAppAlert(
          'Camera access is needed',
          'RayHealth needs the camera to take your identity photo. You can turn it on in Settings.',
          undefined,
          { variant: 'info' },
        );
        return;
      }
    }
    setResult(null);
    setMode(next);
  };

  const capture = async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const photo: CameraCapturedPicture | undefined = await cameraRef.current.takePictureAsync({
        // Compressed hard on purpose: face matching needs resolution around
        // the face, not a printable image, and a smaller payload uploads far
        // more reliably on a phone in somebody's car.
        quality: 0.5,
        base64: true,
        skipProcessing: false,
      });

      if (!isUploadableCapture(photo?.base64)) {
        showAppAlert('That photo did not save properly', 'Please take it again.', undefined, {
          variant: 'error',
        });
        return;
      }

      if (mode === 'capturing-enroll') {
        await apiClient.post('/api/identity/enroll', { imageBase64: photo?.base64 });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setMode('idle');
        await load();
        return;
      }

      const res = await apiClient.post<VerifyResult>('/api/identity/verify', {
        imageBase64: photo?.base64,
      });
      setResult(res.data);
      setMode('idle');
      void Haptics.notificationAsync(
        res.data?.outcome === 'matched'
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      );
    } catch (err) {
      const code = (err as { response?: { data?: { code?: string; outcome?: string } } })?.response
        ?.data;
      if (code?.code === 'CONSENT_REQUIRED') {
        showAppAlert('Consent needed first', 'Please agree to identity checks before taking a photo.', undefined, {
          variant: 'info',
        });
        setMode('idle');
        await load();
        return;
      }
      if (code?.outcome === 'not_enrolled') {
        setResult({ outcome: 'not_enrolled', similarity: null });
        setMode('idle');
        return;
      }
      showAppAlert('Could not send that photo', 'Please check your connection and try again.', undefined, {
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const giveConsent = async () => {
    if (!status) return;
    setBusy(true);
    try {
      await apiClient.post('/api/identity/consent', {
        consentVersion: status.currentConsentVersion,
      });
      void Haptics.selectionAsync();
      await load();
    } catch {
      showAppAlert('Could not save your agreement', 'Please try again.', undefined, { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const withdraw = () => {
    showAppAlert(
      'Delete your identity photo?',
      'Your stored photo will be deleted and identity checks will stop. You can set it up again any time.',
      [
        { text: 'Keep it' },
        {
          text: 'Delete',
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                await apiClient.delete('/api/identity/consent');
                setResult(null);
                await load();
              } catch {
                showAppAlert(
                  'Could not delete your photo',
                  'Nothing was changed. Please try again, or contact your agency.',
                  undefined,
                  { variant: 'error' },
                );
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
      { variant: 'warning' },
    );
  };

  // ── Camera ───────────────────────────────────────────────────────────────
  if (mode !== 'idle') {
    return (
      <View style={styles.cameraScreen}>
        <CameraView ref={cameraRef} style={styles.camera} facing="front" />
        <View style={styles.cameraOverlay}>
          <Text style={styles.cameraHint}>
            {mode === 'capturing-enroll'
              ? 'Look straight at the camera in good light. This becomes your reference photo.'
              : 'Look straight at the camera to check against your reference photo.'}
          </Text>
          <View style={styles.cameraActions}>
            <Pressable
              onPress={() => setMode('idle')}
              style={styles.cameraCancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.cameraCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => void capture()}
              disabled={busy}
              style={({ pressed }) => [styles.shutter, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel="Take photo"
            >
              {busy ? <ActivityIndicator color={colors.brandBlue} /> : <View style={styles.shutterInner} />}
            </Pressable>
            <View style={styles.cameraCancel} />
          </View>
        </View>
      </View>
    );
  }

  const outcomeCopy = result ? describeOutcome(result.outcome, result.similarity) : null;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Identity check" />
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {loading ? (
          <SkeletonList count={3} />
        ) : error || !status ? (
          <ErrorRetry
            message={error ?? 'Could not load your identity settings.'}
            onRetry={() => { setLoading(true); void load(); }}
          />
        ) : (
          <>
            {!status.configured ? (
              <View style={[styles.notice, { backgroundColor: `${colors.brandBlue}${alpha.tint}` }]}>
                <Ionicons name="information-circle-outline" size={18} color={colors.brandBlue} />
                <Text style={styles.noticeText}>
                  Your agency has not switched identity checks on yet. You can still set yours up
                  now, and it will start working once they do.
                </Text>
              </View>
            ) : null}

            {step === 'unavailable' ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Not available yet</Text>
                <Text style={styles.cardHint}>
                  Your agency has not finished setting up identity checks, so there is nowhere to
                  keep your photo yet. Nothing is needed from you. This screen will let you set
                  yours up once they are done.
                </Text>
              </View>
            ) : null}

            {step === 'consent' ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Before we start</Text>
                <Text style={styles.consentText}>{status.consentText}</Text>
                <Pressable
                  onPress={() => void giveConsent()}
                  disabled={busy}
                  style={({ pressed }) => [styles.primaryBtn, pressed && !busy && { opacity: 0.9 }]}
                  accessibilityRole="button"
                  accessibilityLabel="I agree to identity checks"
                >
                  {busy ? (
                    <ActivityIndicator color={colors.onGradient} />
                  ) : (
                    <Text style={styles.primaryBtnText}>I agree</Text>
                  )}
                </Pressable>
                <Text style={styles.fineprint}>
                  You can withdraw this at any time and your photo will be deleted.
                </Text>
              </View>
            ) : null}

            {step === 'enroll' ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Take your reference photo</Text>
                <Text style={styles.cardHint}>
                  One clear photo of your face. Later photos are compared against this one.
                </Text>
                <Pressable
                  onPress={() => void openCamera('capturing-enroll')}
                  style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Open the camera to take your reference photo"
                >
                  <Text style={styles.primaryBtnText}>Open camera</Text>
                </Pressable>
              </View>
            ) : null}

            {step === 'ready' ? (
              <View style={styles.card}>
                <View style={styles.enrolledRow}>
                  <Ionicons name="shield-checkmark" size={20} color={colors.success} />
                  <Text style={styles.enrolledText}>Your reference photo is on file.</Text>
                </View>
                <Pressable
                  onPress={() => void openCamera('capturing-verify')}
                  style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Check my identity now"
                >
                  <Text style={styles.primaryBtnText}>Check it now</Text>
                </Pressable>
                <Pressable
                  onPress={() => void openCamera('capturing-enroll')}
                  style={styles.secondaryBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Replace my reference photo"
                >
                  <Text style={styles.secondaryBtnText}>Replace my photo</Text>
                </Pressable>
              </View>
            ) : null}

            {outcomeCopy ? (
              <Animated.View
                entering={FadeIn.duration(220)}
                style={[styles.result, { backgroundColor: `${TONE_COLOR[outcomeCopy.tone]}${alpha.tint}` }]}
              >
                <Ionicons
                  name={TONE_ICON[outcomeCopy.tone]}
                  size={22}
                  color={TONE_COLOR[outcomeCopy.tone]}
                />
                <View style={styles.resultBody}>
                  <Text style={[styles.resultTitle, { color: TONE_COLOR[outcomeCopy.tone] }]}>
                    {outcomeCopy.title}
                  </Text>
                  <Text style={styles.resultDetail}>{outcomeCopy.detail}</Text>
                </View>
              </Animated.View>
            ) : null}

            {/* Stated plainly rather than buried: a match says who is in the
                photo, not that somebody was really there. */}
            {!status.livenessSupported ? (
              <Text style={styles.limitationText}>
                This check confirms the face in the photo matches your reference photo. It does not
                yet detect whether a photo was taken of a screen or a printed picture.
              </Text>
            ) : null}

            {status.consented ? (
              <Pressable
                onPress={withdraw}
                disabled={busy}
                style={styles.withdrawBtn}
                accessibilityRole="button"
                accessibilityLabel="Withdraw consent and delete my photo"
              >
                <Text style={styles.withdrawText}>Withdraw and delete my photo</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBg },
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 48, gap: 12 },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.lg,
    padding: 18,
    gap: 12,
    ...shadow.card,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  cardHint: { ...typography.caption, color: colors.textSecondary, lineHeight: 17 },
  consentText: { fontSize: 14, color: colors.textSecondary, lineHeight: 21 },
  fineprint: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  primaryBtn: {
    backgroundColor: colors.brandBlue,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: colors.onGradient, fontWeight: '700', fontSize: 15 },
  secondaryBtn: { alignItems: 'center', paddingVertical: 6 },
  secondaryBtnText: { ...typography.caption, color: colors.brandBlue, fontWeight: '700' },
  enrolledRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  enrolledText: { fontSize: 14, color: colors.textPrimary, fontWeight: '600' },
  notice: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: radii.md },
  noticeText: { ...typography.caption, color: colors.textPrimary, flex: 1, lineHeight: 16 },
  result: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: radii.lg, alignItems: 'flex-start' },
  resultBody: { flex: 1, gap: 3 },
  resultTitle: { fontSize: 15, fontWeight: '700' },
  resultDetail: { ...typography.caption, color: colors.textSecondary, lineHeight: 17 },
  limitationText: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 16,
    paddingHorizontal: 4,
  },
  withdrawBtn: { alignItems: 'center', paddingVertical: 14 },
  withdrawText: { ...typography.caption, color: colors.danger, fontWeight: '700' },
  cameraScreen: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  cameraOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: 44,
    paddingTop: 18,
    paddingHorizontal: 20,
    gap: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  cameraHint: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  cameraActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cameraCancel: { width: 70 },
  cameraCancelText: { color: '#fff', fontSize: 15 },
  shutter: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#fff' },
});
