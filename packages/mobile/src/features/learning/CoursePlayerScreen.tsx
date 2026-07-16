import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import * as ScreenOrientation from 'expo-screen-orientation';
import Animated, { FadeInRight, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import apiClient from '../../lib/api-client';
import {
  buildSteps,
  canAdvance,
  clampStep,
  firstQuizIndex,
  progressFraction,
  stepMeta,
  type CourseModules,
  type PlayerStep,
} from '../../lib/course-player';
import { emptyAnswers, gradeQuiz, type QuizGrade } from '../../lib/quiz';
import { parseLessonContent, sectionIcon, type LessonBlock } from '../../lib/lesson-format';
import {
  foldVideoEvent,
  initialVideoProgress,
  isVideoSatisfied,
  needsRewatchWarning,
  REQUIRED_WATCH_FRACTION,
  type VideoBridgeEvent,
  type VideoProgress,
} from '../../lib/video-progress';
import {
  parsePreset,
  PRESET_LABELS,
  PRESETS,
  readingStyle,
  TEXT_SIZE_KEY,
  type TextSizePreset,
} from '../../lib/text-size';
import { useAuth } from '../../lib/AuthContext';
import { isTestingAccount } from '../../lib/test-account';
import ScreenHeader from '../common/ScreenHeader';
import ErrorRetry from '../common/ErrorRetry';
import { SkeletonList } from '../common/Skeleton';
import { showAppAlert } from '../common/alerts/appAlert';
import CourseVideo from './CourseVideo';
import { showCertificateAlert } from './certificate';
import { alpha, colors, gradients, radii, shadow, space, typography } from '../common/tokens';

/**
 * Guided in-app course player: overview → one lesson section per screen →
 * video → quiz (one question at a time) → completion. Designed for caregivers
 * who aren't confident with technology, one thing on screen at a time, big
 * pinned Back/Next buttons, an always-visible progress bar, and a text-size
 * control on the lesson text.
 */

type EnrollmentStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue' | 'expired';

interface Course {
  id: string;
  title: string;
  description: string;
  required: boolean;
  durationMinutes: number;
  modules: CourseModules | null;
}

interface Enrollment {
  id: string;
  courseId: string;
  dueAt: string | null;
  status: EnrollmentStatus;
}

interface EnrollmentRow {
  enrollment: Enrollment;
  course: Course;
}

type CompletionState = 'idle' | 'submitting' | 'done' | 'error';

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v || undefined;
}

function formatDue(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
}

// A-size preview font sizes for the three text-size preset buttons.
const SIZE_BUTTON_FONT: Record<TextSizePreset, number> = { standard: 13, large: 16, xlarge: 19 };

export default function CoursePlayerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const enrollmentId = one(params.enrollmentId);
  const courseId = one(params.courseId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<EnrollmentRow | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [grade, setGrade] = useState<QuizGrade | null>(null);
  const [completionState, setCompletionState] = useState<CompletionState>('idle');
  const [textPreset, setTextPreset] = useState<TextSizePreset>('standard');
  const [video, setVideo] = useState<VideoProgress>(initialVideoProgress());
  const [videoKey, setVideoKey] = useState(0);
  const [videoFullscreen, setVideoFullscreen] = useState(false);
  // Section illustrations that failed to load are hidden rather than showing
  // a broken frame (e.g. offline, or the asset is not deployed yet).
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const canSkipVideo = isTestingAccount(user);
  const startedRef = useRef(false);
  const submittedRef = useRef(false);
  const celebrationHapticRef = useRef(false);

  const modules = row?.course.modules ?? null;
  const quiz = useMemo(() => modules?.quiz ?? [], [modules]);
  const steps = useMemo<PlayerStep[]>(() => (modules ? buildSteps(modules) : []), [modules]);
  const step = steps[stepIndex];
  const hasQuiz = quiz.length > 0;
  const alreadyCompleted = row?.enrollment.status === 'completed';
  const isCompleted = alreadyCompleted || completionState === 'done';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{
        success: boolean;
        data: { enrollments: EnrollmentRow[] };
      }>('/api/learning/progress');
      const rows = res.data?.data?.enrollments ?? [];
      const found =
        rows.find((r) => r.enrollment.id === enrollmentId) ??
        rows.find((r) => r.course.id === courseId) ??
        null;
      if (!found || !found.course.modules) {
        setError('Could not load this course.');
      } else {
        setRow(found);
        setAnswers(emptyAnswers(found.course.modules.quiz?.length ?? 0));
        setError(null);
      }
    } catch {
      setError('Could not load this course.');
    } finally {
      setLoading(false);
    }
  }, [enrollmentId, courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Hydrate the saved text-size preference.
  useEffect(() => {
    SecureStore.getItemAsync(TEXT_SIZE_KEY)
      .then((raw) => setTextPreset(parsePreset(raw)))
      .catch(() => {});
  }, []);

  const changeTextPreset = (preset: TextSizePreset) => {
    setTextPreset(preset);
    void Haptics.selectionAsync();
    SecureStore.setItemAsync(TEXT_SIZE_KEY, preset).catch(() => {});
  };

  // Tell the server the caregiver opened the course (not_started → in_progress).
  // Fire-and-forget: a failure here must never block reading the lesson.
  useEffect(() => {
    if (!row || startedRef.current) return;
    const status = row.enrollment.status;
    if (status === 'in_progress' || status === 'completed') return;
    startedRef.current = true;
    apiClient.post('/api/learning/start', { enrollmentId: row.enrollment.id }).catch(() => {});
  }, [row]);

  const submitCompletion = useCallback(
    async (finalGrade: QuizGrade | null) => {
      if (!row || submittedRef.current) return; // /learning/complete is not idempotent
      submittedRef.current = true;
      setCompletionState('submitting');
      try {
        await apiClient.post('/api/learning/complete', {
          enrollmentId: row.enrollment.id,
          courseId: row.course.id,
          ...(finalGrade ? { score: finalGrade.scorePercent } : {}),
        });
        setCompletionState('done');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        submittedRef.current = false;
        setCompletionState('error');
        showAppAlert(
          'Could not save your completion',
          'Please check your connection and try again.',
          undefined,
          { variant: 'error' },
        );
      }
    },
    [row],
  );

  // Passing the quiz completes the course automatically, no extra button.
  useEffect(() => {
    if (grade?.passed && !alreadyCompleted && completionState === 'idle') {
      void submitCompletion(grade);
    }
  }, [grade, alreadyCompleted, completionState, submitCompletion]);

  // One celebration haptic when the done step first shows as completed.
  useEffect(() => {
    if (step?.kind === 'done' && isCompleted && !celebrationHapticRef.current) {
      celebrationHapticRef.current = true;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [step, isCompleted]);

  // Animated header progress bar.
  const progress = useSharedValue(0);
  useEffect(() => {
    if (steps.length > 0) {
      progress.value = withTiming(progressFraction(stepIndex, steps), { duration: 350 });
    }
  }, [stepIndex, steps, progress]);
  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  const goTo = (index: number) => {
    void Haptics.selectionAsync();
    setStepIndex(clampStep(index, steps));
  };

  const handleNext = () => {
    if (!step) return;
    if (step.kind === 'quiz-question' && step.questionIndex === quiz.length - 1) {
      const g = gradeQuiz(quiz, answers);
      setGrade(g);
      if (!g.passed) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    goTo(stepIndex + 1);
  };

  const handleRetryQuiz = () => {
    setAnswers(emptyAnswers(quiz.length));
    setGrade(null);
    setCompletionState('idle');
    goTo(firstQuizIndex(steps));
  };

  const handleVideoEvent = useCallback((event: VideoBridgeEvent) => {
    setVideo((prev) => foldVideoEvent(prev, event));
  }, []);

  const handleRewatch = () => {
    void Haptics.selectionAsync();
    setVideo(initialVideoProgress());
    setVideoKey((k) => k + 1);
  };

  // Course screens may rotate freely; the rest of the app stays portrait.
  useFocusEffect(
    useCallback(() => {
      void ScreenOrientation.unlockAsync();
      return () => {
        void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      };
    }, []),
  );

  const enterFullscreen = () => {
    void Haptics.selectionAsync();
    setVideoFullscreen(true);
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
  };

  const exitFullscreen = useCallback(() => {
    setVideoFullscreen(false);
    void ScreenOrientation.unlockAsync();
  }, []);

  // Hardware back leaves fullscreen instead of leaving the course.
  useEffect(() => {
    if (!videoFullscreen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      exitFullscreen();
      return true;
    });
    return () => sub.remove();
  }, [videoFullscreen, exitFullscreen]);

  // Testing accounts only: mark the video fully watched without sitting
  // through it. Real caregiver accounts never see this control.
  const handleSkipVideo = () => {
    void Haptics.selectionAsync();
    setVideo((v) => foldVideoEvent(v, { kind: 'progress', watchedPct: 1, skipped: false, ended: true }));
  };

  const selectAnswer = (questionIndex: number, optionIndex: number) => {
    void Haptics.selectionAsync();
    setAnswers((prev) => {
      const next = [...prev];
      next[questionIndex] = optionIndex;
      return next;
    });
  };

  // ---- Render ----

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Course" />
        <View style={{ padding: space.lg }}>
          <SkeletonList count={4} />
        </View>
      </View>
    );
  }

  if (error || !row || !modules || !step) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Course" />
        <ErrorRetry message={error ?? 'Could not load this course.'} onRetry={load} />
      </View>
    );
  }

  const meta = stepMeta(step, modules);
  const readingBody = readingStyle(typography.readingBody.fontSize, textPreset);
  const readingHeading = readingStyle(typography.readingHeading.fontSize, textPreset);
  const showTextControl = step.kind === 'section' || step.kind === 'quiz-question';
  const nextLabel =
    step.kind === 'overview'
      ? 'Start course'
      : step.kind === 'quiz-question' && step.questionIndex === quiz.length - 1
        ? 'Check answers'
        : step.kind === 'quiz-result'
          ? 'Finish'
          : 'Next';
  const videoSatisfied = isCompleted || isVideoSatisfied(video);
  const nextDisabled =
    !canAdvance(step, answers) ||
    (step.kind === 'video' && !videoSatisfied) ||
    (step.kind === 'quiz-result' && !alreadyCompleted && completionState !== 'done');
  const footerVisible =
    step.kind !== 'done' && !(step.kind === 'quiz-result' && grade != null && !grade.passed);

  const renderStep = () => {
    switch (step.kind) {
      case 'overview':
        return renderOverview();
      case 'section':
        return renderSection(step.sectionIndex);
      case 'video':
        return renderVideo();
      case 'quiz-question':
        return renderQuizQuestion(step.questionIndex);
      case 'quiz-result':
        return renderQuizResult();
      case 'done':
        return renderDone();
    }
  };

  const renderOverview = () => {
    const due = formatDue(row.enrollment.dueAt);
    return (
      <View style={styles.card}>
        <Text style={styles.overviewTitle}>{row.course.title}</Text>
        {row.course.description ? (
          <Text style={[styles.readingText, readingBody]}>{row.course.description}</Text>
        ) : null}
        <View style={styles.metaRow}>
          {row.course.required ? (
            <View style={styles.reqPill}>
              <Text style={styles.reqText}>REQUIRED</Text>
            </View>
          ) : null}
          {row.course.durationMinutes > 0 ? (
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color={colors.textMuted} />
              <Text style={styles.metaItemText}>About {row.course.durationMinutes} min</Text>
            </View>
          ) : null}
          {due ? (
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
              <Text style={styles.metaItemText}>Due {due}</Text>
            </View>
          ) : null}
        </View>
        {modules.objectives.length > 0 ? (
          <View style={styles.objectives}>
            <Text style={styles.objectivesLabel}>What you&apos;ll learn</Text>
            {modules.objectives.map((obj, i) => (
              <View key={i} style={styles.objectiveRow}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text style={[styles.objectiveText, readingBody]}>{obj}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {modules.note ? (
          <View style={styles.noteCallout}>
            <Ionicons name="information-circle" size={18} color={colors.amberDark} />
            <Text style={styles.noteText}>{modules.note}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  const renderBlock = (block: LessonBlock, key: number) => {
    switch (block.kind) {
      case 'paragraph':
        return (
          <Text key={key} style={[styles.readingText, readingBody]}>
            {block.text}
          </Text>
        );
      case 'steps':
        return (
          <View key={key} style={styles.stepList}>
            {block.items.map((item, i) => {
              // Bold a short "Label:" lead inside a step ("Physical Abuse: hitting…").
              const labelled = item.match(/^([A-Z][^.:]{0,40}):\s(.+)$/s);
              return (
                <View key={i} style={styles.stepRow}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.stepText, readingBody]}>
                    {labelled ? (
                      <>
                        <Text style={styles.stepLabel}>{labelled[1]}: </Text>
                        {labelled[2]}
                      </>
                    ) : (
                      item
                    )}
                  </Text>
                </View>
              );
            })}
          </View>
        );
      case 'bullets':
        return (
          <View key={key} style={styles.stepList}>
            {block.items.map((item, i) => (
              <View key={i} style={styles.stepRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={colors.brandBlue}
                  style={styles.bulletIcon}
                />
                <Text style={[styles.stepText, readingBody]}>{item}</Text>
              </View>
            ))}
          </View>
        );
      case 'terms':
        return (
          <View key={key} style={styles.termList}>
            {block.items.map((item, i) => (
              <View key={i} style={styles.termBlock}>
                <Text style={[styles.termLabel, { fontSize: readingBody.fontSize - 1 }]}>
                  {item.term}
                </Text>
                <Text style={[styles.readingText, readingBody]}>{item.text}</Text>
              </View>
            ))}
          </View>
        );
      case 'callout':
        return (
          <View key={key} style={styles.calloutCard}>
            <View style={styles.calloutHeader}>
              <Ionicons name="arrow-forward-circle" size={20} color={colors.brandBlue} />
              <Text style={[styles.calloutTitle, { fontSize: readingBody.fontSize - 1 }]}>
                {block.title}
              </Text>
            </View>
            {block.text ? (
              <Text style={[styles.readingText, readingBody]}>{block.text}</Text>
            ) : null}
            {block.items.map((item, i) => (
              <View key={i} style={styles.stepRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={colors.brandBlue}
                  style={styles.bulletIcon}
                />
                <Text style={[styles.stepText, readingBody]}>{item}</Text>
              </View>
            ))}
          </View>
        );
      case 'keypoint':
        return (
          <View key={key} style={styles.keypointCard}>
            <Ionicons name="alert-circle" size={22} color={colors.amberDark} style={styles.bulletIcon} />
            <Text style={[styles.keypointText, readingBody]}>{block.text}</Text>
          </View>
        );
    }
  };

  const renderSection = (sectionIndex: number) => {
    const section = modules.sections[sectionIndex];
    if (!section) return null;
    const blocks = parseLessonContent(section.content);
    const imageUrl = section.imageUrl && !failedImages.has(section.imageUrl) ? section.imageUrl : null;
    return (
      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconCircle}>
            <Ionicons name={sectionIcon(section.title) as never} size={22} color={colors.brandBlue} />
          </View>
          <Text style={[styles.sectionTitle, readingHeading, { flex: 1 }]}>{section.title}</Text>
        </View>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.sectionImage}
            contentFit="cover"
            transition={200}
            accessible
            accessibilityLabel={section.imageAlt ?? section.title}
            onError={() => setFailedImages((prev) => new Set(prev).add(imageUrl))}
          />
        ) : null}
        {blocks.map(renderBlock)}
      </View>
    );
  };

  const renderVideo = () => {
    const showRewatch = needsRewatchWarning(video) && !isCompleted;
    const watchedPercent = Math.round(video.watchedPct * 100);
    return (
      <View style={videoFullscreen ? styles.videoWrapFs : styles.videoWrap}>
        {!videoFullscreen && (
          <Text style={[styles.sectionTitle, readingHeading]}>Watch the training video</Text>
        )}
        <CourseVideo key={videoKey} videoUrl={modules.videoUrl as string} onEvent={handleVideoEvent} />
        {videoFullscreen ? (
          <Pressable
            onPress={exitFullscreen}
            style={({ pressed }) => [
              styles.fsExitBtn,
              { top: Math.max(insets.top, space.md) },
              pressed && { opacity: 0.85 },
            ]}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Exit full screen"
          >
            <Ionicons name="contract" size={22} color={colors.onGradient} />
          </Pressable>
        ) : (
          <View style={styles.videoCtrlRow}>
            <Pressable
              onPress={enterFullscreen}
              style={({ pressed }) => [styles.videoCtrlBtn, pressed && { opacity: 0.9 }]}
              accessibilityRole="button"
              accessibilityLabel="Play video full screen"
            >
              <Ionicons name="expand" size={16} color={colors.brandBlue} />
              <Text style={styles.videoCtrlText}>Full screen</Text>
            </Pressable>
            {canSkipVideo && !videoSatisfied ? (
              <Pressable
                onPress={handleSkipVideo}
                style={({ pressed }) => [styles.videoCtrlBtn, styles.skipBtn, pressed && { opacity: 0.9 }]}
                accessibilityRole="button"
                accessibilityLabel="Skip video, testing accounts only"
              >
                <Ionicons name="play-skip-forward" size={16} color={colors.amberDark} />
                <Text style={[styles.videoCtrlText, { color: colors.amberDark }]}>Skip (testing)</Text>
              </Pressable>
            ) : null}
          </View>
        )}
        {videoFullscreen ? null : showRewatch ? (
          <View style={styles.rewatchCard}>
            <Ionicons name="alert-circle" size={22} color={colors.amberDark} style={styles.bulletIcon} />
            <View style={{ flex: 1, gap: space.sm }}>
              <Text style={styles.rewatchText}>
                It looks like part of the video was skipped. Please watch it through so nothing
                important is missed.
              </Text>
              <Pressable
                onPress={handleRewatch}
                style={({ pressed }) => [styles.rewatchBtn, pressed && { opacity: 0.9 }]}
                accessibilityRole="button"
                accessibilityLabel="Rewatch the video"
              >
                <Ionicons name="refresh" size={16} color={colors.onGradient} />
                <Text style={styles.rewatchBtnText}>Rewatch video</Text>
              </Pressable>
            </View>
          </View>
        ) : videoSatisfied ? (
          <View style={styles.videoStatusRow}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={[styles.videoHint, { color: colors.successDark }]}>
              {video.error
                ? 'Video unavailable right now. You can continue.'
                : 'Nice work. Press Next to continue.'}
            </Text>
          </View>
        ) : (
          <Text style={styles.videoHint}>
            {watchedPercent > 0
              ? `Watched ${watchedPercent}%. Keep going, Next unlocks at ${Math.round(REQUIRED_WATCH_FRACTION * 100)}%.`
              : 'Tap the video to play it. Next unlocks after you watch it.'}
          </Text>
        )}
      </View>
    );
  };

  const renderQuizQuestion = (questionIndex: number) => {
    const q = quiz[questionIndex];
    if (!q) return null;
    const selected = answers[questionIndex];
    return (
      <View>
        <View style={styles.card}>
          <Text style={[styles.sectionTitle, readingHeading]}>{q.question}</Text>
          <Text style={styles.quizHint}>Tap the answer you think is right.</Text>
        </View>
        <View style={styles.options}>
          {q.options.map((option, optionIndex) => {
            const isSelected = selected === optionIndex;
            return (
              <Pressable
                key={optionIndex}
                onPress={() => selectAnswer(questionIndex, optionIndex)}
                style={({ pressed }) => [
                  styles.option,
                  isSelected && styles.optionSelected,
                  pressed && { opacity: 0.9 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={option}
                accessibilityState={{ selected: isSelected }}
              >
                <Ionicons
                  name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                  size={24}
                  color={isSelected ? colors.brandBlue : colors.chevron}
                />
                <Text
                  style={[
                    styles.optionText,
                    readingBody,
                    isSelected && { color: colors.brandBlue, fontWeight: '700' },
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  const renderQuizResult = () => {
    if (!grade) {
      return (
        <View style={styles.card}>
          <Text style={[styles.readingText, readingBody]}>
            Answer all the questions to see your result.
          </Text>
        </View>
      );
    }
    if (grade.passed) {
      return (
        <View style={[styles.card, styles.resultPass]}>
          <View style={[styles.resultIconCircle, { backgroundColor: `${colors.success}${alpha.tint}` }]}>
            <Ionicons name="checkmark-circle" size={44} color={colors.success} />
          </View>
          <Text style={styles.resultTitle}>You passed!</Text>
          <Text style={[styles.readingText, readingBody, { textAlign: 'center' }]}>
            {grade.correctCount} of {grade.total} correct, {grade.scorePercent}%
          </Text>
          {completionState === 'submitting' ? (
            <View style={styles.savingRow}>
              <ActivityIndicator color={colors.brandBlue} size="small" />
              <Text style={styles.savingText}>Saving your completion…</Text>
            </View>
          ) : completionState === 'error' ? (
            <Pressable
              onPress={() => void submitCompletion(grade)}
              style={({ pressed }) => [styles.inlineRetryBtn, pressed && { opacity: 0.9 }]}
              accessibilityRole="button"
              accessibilityLabel="Try saving your completion again"
            >
              <Ionicons name="refresh" size={18} color={colors.onGradient} />
              <Text style={styles.inlineRetryText}>Try saving again</Text>
            </Pressable>
          ) : (
            <View style={styles.savingRow}>
              <Ionicons name="cloud-done-outline" size={18} color={colors.success} />
              <Text style={[styles.savingText, { color: colors.success }]}>Completion saved</Text>
            </View>
          )}
        </View>
      );
    }
    return (
      <View>
        <View style={[styles.card, styles.resultFail]}>
          <Text style={styles.resultFailTitle}>
            {grade.correctCount} of {grade.total} correct
          </Text>
          <Text style={[styles.readingText, readingBody]}>
            You need 80% to pass. Review the answers below, then try again, you can retry as many
            times as you like.
          </Text>
        </View>
        {grade.wrong.map((w) => {
          const q = quiz[w.questionIndex];
          if (!q) return null;
          return (
            <View key={w.questionIndex} style={styles.card}>
              <Text style={[styles.sectionTitle, { fontSize: readingHeading.fontSize - 2 }]}>
                {q.question}
              </Text>
              {w.selected >= 0 ? (
                <View style={styles.correctionRow}>
                  <Ionicons name="close-circle" size={20} color={colors.danger} />
                  <Text style={[styles.correctionText, { color: colors.danger }]}>
                    You answered: {q.options[w.selected]}
                  </Text>
                </View>
              ) : null}
              <View style={styles.correctionRow}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text style={[styles.correctionText, { color: colors.successDark }]}>
                  Correct answer: {w.correctText}
                </Text>
              </View>
            </View>
          );
        })}
        <Pressable
          onPress={handleRetryQuiz}
          style={({ pressed }) => [styles.bigBtnWrap, pressed && { opacity: 0.92 }]}
          accessibilityRole="button"
          accessibilityLabel="Try the quiz again"
        >
          <LinearGradient colors={gradients.cta} style={styles.bigBtn}>
            <Ionicons name="refresh" size={20} color={colors.onGradient} />
            <Text style={styles.bigBtnText}>Try again</Text>
          </LinearGradient>
        </Pressable>
      </View>
    );
  };

  const renderDone = () => {
    if (isCompleted) {
      return (
        <View style={[styles.card, styles.resultPass]}>
          <View style={[styles.resultIconCircle, { backgroundColor: `${colors.success}${alpha.tint}` }]}>
            <Ionicons name="ribbon" size={44} color={colors.success} />
          </View>
          <Text style={styles.resultTitle}>Course complete!</Text>
          <Text style={[styles.readingText, readingBody, { textAlign: 'center' }]}>
            {grade
              ? `Great work, you scored ${grade.scorePercent}%.`
              : 'Great work. This course is now marked complete.'}
          </Text>
          <Pressable
            onPress={() => void showCertificateAlert(row.course.id)}
            style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.9 }]}
            accessibilityRole="button"
            accessibilityLabel="View certificate"
          >
            <Ionicons name="ribbon-outline" size={18} color={colors.brandBlue} />
            <Text style={styles.ghostBtnText}>View certificate</Text>
          </Pressable>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.bigBtnWrap, { alignSelf: 'stretch' }, pressed && { opacity: 0.92 }]}
            accessibilityRole="button"
            accessibilityLabel="Back to training"
          >
            <LinearGradient colors={gradients.cta} style={styles.bigBtn}>
              <Text style={styles.bigBtnText}>Back to training</Text>
            </LinearGradient>
          </Pressable>
        </View>
      );
    }
    if (hasQuiz) {
      // Shouldn't normally land here without passing; guide back to the quiz.
      return (
        <View style={styles.card}>
          <Text style={[styles.readingText, readingBody]}>
            Pass the knowledge check to complete this course.
          </Text>
        </View>
      );
    }
    return (
      <View style={[styles.card, styles.resultPass]}>
        <Text style={styles.resultTitle}>That&apos;s everything!</Text>
        <Text style={[styles.readingText, readingBody, { textAlign: 'center' }]}>
          You&apos;ve reviewed the whole course. Press the button below to mark it complete.
        </Text>
        <Pressable
          onPress={() => void submitCompletion(null)}
          disabled={completionState === 'submitting'}
          style={({ pressed }) => [styles.bigBtnWrap, { alignSelf: 'stretch' }, pressed && { opacity: 0.92 }]}
          accessibilityRole="button"
          accessibilityLabel="Mark course complete"
        >
          <LinearGradient
            colors={completionState === 'submitting' ? gradients.ctaDisabled : gradients.ctaSuccess}
            style={styles.bigBtn}
          >
            {completionState === 'submitting' ? (
              <ActivityIndicator color={colors.onGradient} size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color={colors.onGradient} />
                <Text style={styles.bigBtnText}>Mark complete</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={[styles.container, videoFullscreen && { backgroundColor: colors.navy }]}>
      {videoFullscreen ? null : (
      <ScreenHeader title={row.course.title}>
        <View style={styles.headerExtra}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, progressStyle]} />
          </View>
          <View style={styles.headerRow}>
            <Text style={styles.headerMeta}>{meta ?? 'All done'}</Text>
            {showTextControl ? (
              <View style={styles.sizeControl}>
                {PRESETS.map((preset) => {
                  const active = preset === textPreset;
                  return (
                    <Pressable
                      key={preset}
                      onPress={() => changeTextPreset(preset)}
                      style={[styles.sizeBtn, active && styles.sizeBtnActive]}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`Text size: ${PRESET_LABELS[preset]}`}
                      accessibilityState={{ selected: active }}
                    >
                      <Text
                        style={[
                          styles.sizeBtnText,
                          { fontSize: SIZE_BUTTON_FONT[preset] },
                          active && { color: colors.navy },
                        ]}
                      >
                        A
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        </View>
      </ScreenHeader>
      )}

      {step.kind === 'video' ? (
        // The video step lives outside the ScrollView so the player never
        // remounts (and never loses watch progress) when toggling fullscreen.
        <View style={videoFullscreen ? styles.fsBody : [styles.body, styles.bodyContent]}>
          {renderVideo()}
        </View>
      ) : (
        <ScrollView
          key={stepIndex}
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInRight.duration(220)}>{renderStep()}</Animated.View>
        </ScrollView>
      )}

      {footerVisible && !videoFullscreen ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
          {stepIndex > 0 ? (
            <Pressable
              onPress={() => goTo(stepIndex - 1)}
              style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel="Previous step"
            >
              <Ionicons name="chevron-back" size={20} color={colors.brandBlue} />
              <Text style={styles.backBtnText}>Back</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={handleNext}
            disabled={nextDisabled}
            style={({ pressed }) => [styles.nextBtnWrap, pressed && !nextDisabled && { opacity: 0.92 }]}
            accessibilityRole="button"
            accessibilityLabel={nextLabel}
            accessibilityState={{ disabled: nextDisabled }}
          >
            <LinearGradient
              colors={nextDisabled ? gradients.ctaDisabled : gradients.cta}
              style={styles.nextBtn}
            >
              <Text style={styles.bigBtnText}>{nextLabel}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.onGradient} />
            </LinearGradient>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },

  // Header extras
  headerExtra: { marginTop: space.md, gap: space.sm },
  progressTrack: {
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: `${colors.onGradient}${alpha.tintStrong}`,
    overflow: 'hidden',
    marginHorizontal: space.xs,
  },
  progressFill: { height: '100%', borderRadius: radii.pill, backgroundColor: colors.onGradient },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xs,
    minHeight: 34,
  },
  headerMeta: { ...typography.body, color: colors.onGradientSoft, fontWeight: '700' },
  sizeControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.onGradient}${alpha.tint}`,
    borderRadius: radii.pill,
    paddingHorizontal: space.xs,
  },
  sizeBtn: {
    minWidth: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    paddingHorizontal: space.xs,
  },
  sizeBtnActive: { backgroundColor: colors.onGradient },
  sizeBtnText: { color: colors.onGradientSoft, fontWeight: '800' },

  // Body
  body: { flex: 1 },
  bodyContent: { padding: space.lg, paddingBottom: space.hero },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.lg,
    padding: space.xl,
    marginBottom: space.md,
    gap: space.lg,
    ...shadow.card,
  },
  overviewTitle: { ...typography.title, color: colors.textPrimary },
  readingText: { color: colors.textPrimary },
  sectionTitle: { color: colors.textPrimary },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  sectionImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radii.md,
    backgroundColor: colors.pressedBg,
  },
  sectionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${colors.brandBlue}${alpha.tint}`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepList: { gap: space.md, marginTop: space.xs },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${colors.brandBlue}${alpha.tint}`,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepBadgeText: { ...typography.body, color: colors.brandBlue, fontWeight: '900' },
  stepText: { flex: 1, color: colors.textPrimary },
  bulletIcon: { marginTop: 4 },
  termList: { gap: space.lg, marginTop: space.xs },
  termBlock: {
    borderLeftWidth: 3,
    borderLeftColor: colors.brandBlueLight,
    paddingLeft: space.md,
    gap: space.xs,
  },
  termLabel: { color: colors.brandBlue, fontWeight: '900', letterSpacing: 0.2 },
  stepLabel: { fontWeight: '900', color: colors.navy },
  calloutCard: {
    backgroundColor: colors.pressedBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radii.md,
    padding: space.lg,
    gap: space.md,
  },
  calloutHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  calloutTitle: { flex: 1, color: colors.brandBlue, fontWeight: '900', lineHeight: 22 },
  keypointCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    backgroundColor: colors.amberBg,
    borderWidth: 1,
    borderColor: colors.amberBorder,
    borderRadius: radii.md,
    padding: space.lg,
  },
  keypointText: { flex: 1, color: colors.amberDark, fontWeight: '700' },

  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  metaItemText: { ...typography.sub, color: colors.textSecondary, fontWeight: '600' },
  reqPill: {
    backgroundColor: colors.amberBg,
    borderRadius: radii.sm - 4,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.amberBorder,
  },
  reqText: { ...typography.label, color: colors.amberDark },

  objectives: { gap: space.sm },
  objectivesLabel: { ...typography.label, color: colors.textSecondary },
  objectiveRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  objectiveText: { flex: 1, color: colors.textPrimary },

  noteCallout: {
    flexDirection: 'row',
    gap: space.sm,
    backgroundColor: colors.amberBg,
    borderWidth: 1,
    borderColor: colors.amberBorder,
    borderRadius: radii.sm,
    padding: space.md,
  },
  noteText: { ...typography.sub, color: colors.amberDark, flex: 1, lineHeight: 19 },

  // Video
  videoWrap: { gap: space.md },
  videoWrapFs: { flex: 1, justifyContent: 'center' },
  fsBody: { flex: 1, backgroundColor: colors.navy, justifyContent: 'center', padding: space.sm },
  fsExitBtn: {
    position: 'absolute',
    right: space.md,
    zIndex: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${colors.navy}cc`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoCtrlRow: { flexDirection: 'row', justifyContent: 'center', gap: space.md },
  videoCtrlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    height: 40,
    paddingHorizontal: space.md,
    borderRadius: radii.sm,
    backgroundColor: colors.pressedBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  videoCtrlText: { ...typography.sub, color: colors.brandBlue, fontWeight: '800' },
  skipBtn: { backgroundColor: colors.amberBg, borderColor: colors.amberBorder },
  videoHint: { ...typography.sub, color: colors.textSecondary, textAlign: 'center' },
  videoStatusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  rewatchCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    backgroundColor: colors.amberBg,
    borderWidth: 1,
    borderColor: colors.amberBorder,
    borderRadius: radii.md,
    padding: space.lg,
  },
  rewatchText: { ...typography.body, color: colors.amberDark, lineHeight: 21 },
  rewatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    alignSelf: 'flex-start',
    backgroundColor: colors.amber,
    borderRadius: radii.sm,
    paddingHorizontal: space.md,
    height: 40,
  },
  rewatchBtnText: { ...typography.sub, color: colors.onGradient, fontWeight: '800' },

  // Quiz
  quizHint: { ...typography.sub, color: colors.textSecondary },
  options: { gap: space.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.cardBg,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    minHeight: 56,
    ...shadow.subtle,
  },
  optionSelected: {
    borderColor: colors.brandBlue,
    backgroundColor: `${colors.brandBlue}${alpha.tint}`,
  },
  optionText: { flex: 1, color: colors.textPrimary },

  // Results / completion
  resultPass: { alignItems: 'center', gap: space.lg, paddingVertical: space.hero },
  resultFail: {
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerBg,
  },
  resultIconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultTitle: { ...typography.title, color: colors.textPrimary, textAlign: 'center' },
  resultFailTitle: { ...typography.heading, color: colors.dangerDark },
  savingRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  savingText: { ...typography.sub, color: colors.textSecondary, fontWeight: '700' },
  correctionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  correctionText: { ...typography.body, flex: 1, lineHeight: 21 },

  inlineRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.brandBlue,
    borderRadius: radii.md,
    paddingHorizontal: space.xl,
    height: 48,
  },
  inlineRetryText: { ...typography.body, color: colors.onGradient, fontWeight: '800' },

  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    alignSelf: 'stretch',
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.pressedBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  ghostBtnText: { ...typography.body, color: colors.brandBlue, fontWeight: '800' },

  bigBtnWrap: { borderRadius: radii.md, overflow: 'hidden' },
  bigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 56,
    paddingHorizontal: space.xxl,
  },
  bigBtnText: { fontSize: 17, fontWeight: '800', color: colors.onGradient },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: colors.cardBg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    height: 56,
    paddingHorizontal: space.lg,
    borderRadius: radii.md,
    backgroundColor: colors.pressedBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  backBtnText: { ...typography.body, color: colors.brandBlue, fontWeight: '800' },
  nextBtnWrap: { flex: 1, borderRadius: radii.md, overflow: 'hidden' },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    height: 56,
  },
});
