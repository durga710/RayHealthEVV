import React, { useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import ScreenHeader from '../common/ScreenHeader';
import EmptyState from '../common/EmptyState';
import { showAppAlert } from '../common/alerts/appAlert';
import { colors, typography, radii, shadow, alpha } from '../common/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

interface HelpBlock {
  heading?: string;
  text?: string;
  bullets?: string[];
  note?: string;
}

interface HelpSection {
  key: string;
  icon: IconName;
  tint: string;
  title: string;
  summary: string;
  blocks: HelpBlock[];
}

// Condensed from the RayHealthEVV™ Mobile User Guide.
// © 2026 RayHealthEVV LLC. All Rights Reserved.
const HELP_SECTIONS: HelpSection[] = [
  {
    key: 'agency-selection',
    icon: 'business-outline',
    tint: colors.brandBlue,
    title: 'Agency Selection',
    summary: 'Working with more than one agency',
    blocks: [
      {
        text:
          'If your RayHealthEVV ID is linked to multiple agencies, you will be prompted to select an agency after signing in.',
      },
      {
        heading: 'The selected agency determines what you see',
        bullets: [
          'Assigned schedules',
          'Messages',
          'Visit verification',
          'Patients and care plans',
          'Agency-specific settings',
        ],
      },
      {
        note:
          'Always select the correct agency before continuing. All information shown during your session belongs only to the selected agency.',
      },
      {
        heading: 'Switching later',
        text:
          'Open Me → Linked agencies at any time to switch. Your schedule, messages, and patients update to match the agency you choose.',
      },
    ],
  },
  {
    key: 'home',
    icon: 'home-outline',
    tint: colors.cyan,
    title: 'Home Screen',
    summary: 'Finding your way around',
    blocks: [
      {
        text:
          'After signing in you land on the Home Screen. It provides quick access to your daily work:',
        bullets: [
          'Today, all visits assigned for the current day, with patient name, scheduled time, address, and clock-in status',
          'Schedule, upcoming assignments',
          'Visits, search past and upcoming visits',
          'Me, your profile, linked agencies, training, and settings',
        ],
      },
    ],
  },
  {
    key: 'schedule',
    icon: 'calendar-outline',
    tint: colors.success,
    title: "Today's Schedule & Visit Indicators",
    summary: 'Visit list, TS / M / L markers, status colors',
    blocks: [
      {
        text: "Today's Schedule displays all visits assigned for the current day. Each visit shows:",
        bullets: [
          'Patient name and address',
          'Scheduled start and end time',
          'Clock-in status',
        ],
      },
      {
        heading: 'Timesheet required (TS)',
        text: 'Visits requiring a paper or electronic timesheet display the TS indicator.',
      },
      {
        heading: 'Mutual visits (M)',
        text:
          'Mutual visits involve multiple patients receiving care during the same scheduled time at the same residence. Only one Clock-In and one Clock-Out are required, the system automatically verifies the additional patient. Care Plan tasks must still be completed individually for each patient.',
      },
      {
        heading: 'Linked visits (L)',
        text:
          'Linked visits involve multiple patients receiving back-to-back services. Clock in at the beginning of the first visit and clock out at the end of the final visit; intermediate visit times are verified automatically.',
      },
      {
        heading: 'Status colors',
        bullets: [
          '🟢  Visit verified successfully, or a time edit was approved',
          '🟠  Time edit awaiting agency approval',
          '🔴  Visit verification issue detected',
          'Gray text, the visit has already been billed',
        ],
      },
    ],
  },
  {
    key: 'visit-details',
    icon: 'time-outline',
    tint: colors.purple,
    title: 'Visit Details & Clock In / Out',
    summary: 'Verifying visits, care plan tasks, notes',
    blocks: [
      {
        text:
          'Selecting a visit opens Visit Details, with tabs for Clock In / Clock Out, Directions, Patient Information, Care Plan, and Notes.',
      },
      {
        heading: 'Clock In',
        text:
          "Tap Clock In when you arrive. Verification uses your agency's approved method. GPS, Bluetooth beacon, NFC, security token, or other approved EVV technology. Once verified, your clock-in time is recorded and the button is disabled.",
      },
      {
        heading: 'Clock Out',
        text:
          'Tap Clock Out when services are complete. After verification you will be prompted to complete Care Plan tasks.',
      },
      {
        heading: 'Care Plan task status',
        bullets: [
          'Performed, you successfully completed the task',
          'Refused, you attempted the task, but the patient refused the service',
        ],
        note: 'Tasks may be edited until billing has been completed by the agency.',
      },
      {
        heading: 'Directions',
        text:
          "The Directions tab shows the patient's location on an interactive map. Tap the address to open your preferred navigation app, or press and hold to copy it into Google Maps, Apple Maps, Waze, or another GPS application.",
      },
      {
        heading: 'Care Plan',
        text:
          "Displays the patient's complete care plan: care plan notes, task numbers and descriptions, scheduled days, and As-Needed (PRN) tasks. Task numbers may also be used for IVR visit confirmation when applicable.",
      },
      {
        heading: 'Visit notes',
        bullets: [
          'Text notes, create one or more written notes',
          'Audio notes, record up to 30 seconds of audio',
          'Image notes, attach photographs related to the visit',
        ],
        note: 'All notes become available to authorized agency staff.',
      },
    ],
  },
  {
    key: 'unscheduled',
    icon: 'add-circle-outline',
    tint: colors.amber,
    title: 'Unscheduled Visits',
    summary: 'Starting a visit that was not scheduled',
    blocks: [
      {
        text:
          'Occasionally you must provide services that are not on the daily schedule, commonly when your agency requests an unexpected visit. Use Unscheduled Visit to begin these visits.',
      },
      {
        heading: 'Existing patient',
        text: 'Search for a recently assigned patient and select them to begin the visit.',
      },
      {
        heading: 'Unlisted patient',
        text:
          'If the patient cannot be found, select Unlisted Patient. The agency will review and assign the visit after submission.',
      },
      { note: 'Every unscheduled visit is automatically added to your Visit History.' },
    ],
  },
  {
    key: 'history-patients',
    icon: 'folder-open-outline',
    tint: '#be185d',
    title: 'Visit History & Patients',
    summary: 'Past visits, patient records, medications',
    blocks: [
      {
        heading: 'Visit history',
        text:
          'Search both completed and upcoming visits, filtered by date range, patient, or visit type.',
      },
      {
        heading: 'Patients',
        text:
          'Search patients you have served and review previous interactions. Selecting a patient opens their complete record: patient information, visit history, clinical information, and medications.',
      },
      {
        heading: 'Clinical information',
        bullets: [
          'Allergies',
          'Primary care physician and specialists',
          'Preferred pharmacy',
          'Nutrition notes and other important medical information',
        ],
      },
      {
        heading: 'Medications',
        text:
          'Current medications display the name, dose, route, frequency, and comments.',
        note:
          'Medication information is for caregiver reference only and should always be administered according to agency policy.',
      },
    ],
  },
  {
    key: 'messages',
    icon: 'chatbubbles-outline',
    tint: colors.brandBlueLight,
    title: 'Messages',
    summary: 'Secure agency communication',
    blocks: [
      {
        text:
          'The Messages section provides secure communication between caregivers and agencies. Incoming messages appear automatically, and unread messages display notification badges.',
      },
      {
        heading: 'Priority indicators',
        bullets: [
          '🔴  High priority',
          '🟠  Medium priority',
          '🔵  Low priority / informational',
        ],
      },
      {
        heading: 'Sending messages',
        text:
          'Select New Message and choose one or more recipients before sending. If recipient lists are unavailable, contact your agency administrator.',
      },
    ],
  },
  {
    key: 'profile',
    icon: 'person-outline',
    tint: colors.teal,
    title: 'Your Profile & Linked Agencies',
    summary: 'Profile details, connecting agencies',
    blocks: [
      {
        heading: 'User profile',
        text:
          'Your profile contains the information provided during registration, name, gender, date of birth, email address, and phone number.',
        note: 'If any information is incorrect, contact your agency administrator.',
      },
      {
        heading: 'Linked agencies',
        text:
          'You may work for multiple agencies using a single RayHealthEVV ID. All connected agencies are listed under Me → Linked agencies, where you can switch which agency you are working in.',
      },
      {
        heading: 'Disconnecting & reconnecting',
        text:
          'After disconnecting from an agency you lose access to it, future schedules and messages from that agency no longer appear. To reconnect, contact the agency and provide your RayHealthEVV ID; once approved, access is automatically restored.',
      },
      {
        heading: 'Password',
        text: 'Change your password any time from Me → Password & security.',
      },
    ],
  },
  {
    key: 'support',
    icon: 'help-buoy-outline',
    tint: colors.amber,
    title: 'Support',
    summary: 'Who to contact and when',
    blocks: [
      {
        bullets: [
          'For assistance with your account, schedules, or visit issues, contact your agency administrator',
          'For software support, contact RayHealthEVV Support',
        ],
      },
    ],
  },
];

function matchesQuery(section: HelpSection, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  if (section.title.toLowerCase().includes(needle)) return true;
  if (section.summary.toLowerCase().includes(needle)) return true;
  return section.blocks.some(
    (b) =>
      b.heading?.toLowerCase().includes(needle) ||
      b.text?.toLowerCase().includes(needle) ||
      b.note?.toLowerCase().includes(needle) ||
      b.bullets?.some((x) => x.toLowerCase().includes(needle)),
  );
}

function Block({ block, tint }: { block: HelpBlock; tint: string }) {
  return (
    <View style={styles.block}>
      {block.heading ? <Text style={styles.blockHeading}>{block.heading}</Text> : null}
      {block.text ? <Text style={styles.blockText}>{block.text}</Text> : null}
      {block.bullets?.map((bullet) => (
        <View key={bullet} style={styles.bulletRow}>
          <View style={[styles.bulletDot, { backgroundColor: tint }]} />
          <Text style={styles.bulletText}>{bullet}</Text>
        </View>
      ))}
      {block.note ? (
        <View style={styles.noteBox}>
          <Ionicons name="information-circle" size={15} color={colors.brandBlue} style={styles.noteIcon} />
          <Text style={styles.noteText}>{block.note}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function HelpScreen() {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const visible = useMemo(() => HELP_SECTIONS.filter((s) => matchesQuery(s, query)), [query]);
  // While searching, auto-expand a lone match so the answer is visible without
  // an extra tap.
  const effectiveExpanded = query.trim() && visible.length === 1 ? visible[0].key : expanded;

  const openSupportEmail = () => {
    Linking.openURL('mailto:support@rayhealthevv.com?subject=RayHealthEVV%20Support').catch(() => {
      showAppAlert('Support', 'Email us at support@rayhealthevv.com', undefined, {
        variant: 'info',
        icon: 'help-buoy-outline',
      });
    });
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Help & User Guide" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.introCard}>
          <View style={styles.introIcon}>
            <Ionicons name="book" size={22} color={colors.brandBlue} />
          </View>
          <View style={styles.introText}>
            <Text style={styles.introTitle}>RayHealthEVV™ Mobile User Guide</Text>
            <Text style={styles.introSub}>
              Everything you need to verify visits, manage your schedule, and stay connected with
              your agencies.
            </Text>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={17} color={colors.onGradientFaint} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search the guide…"
            placeholderTextColor={colors.placeholder}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {visible.length === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="search-outline"
              title="No matching topics"
              message="Try a different word, or email support and we'll point you the right way."
            />
          </View>
        ) : (
          <View style={styles.sectionList}>
            {visible.map((section) => {
              const isOpen = effectiveExpanded === section.key;
              return (
                <Animated.View
                  key={section.key}
                  style={styles.sectionCard}
                  layout={LinearTransition.springify().damping(18)}
                >
                  <Pressable
                    onPress={() => {
                      void Haptics.selectionAsync();
                      setExpanded(isOpen ? null : section.key);
                    }}
                    style={({ pressed }) => [styles.sectionHead, pressed && styles.sectionHeadPressed]}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isOpen }}
                    accessibilityLabel={section.title}
                  >
                    <View style={[styles.sectionIcon, { backgroundColor: `${section.tint}${alpha.tint}` }]}>
                      <Ionicons name={section.icon} size={18} color={section.tint} />
                    </View>
                    <View style={styles.sectionText}>
                      <Text style={styles.sectionTitle}>{section.title}</Text>
                      <Text style={styles.sectionSummary}>{section.summary}</Text>
                    </View>
                    <Ionicons
                      name={isOpen ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={colors.chevron}
                    />
                  </Pressable>
                  {isOpen ? (
                    <Animated.View
                      entering={FadeIn.duration(220)}
                      exiting={FadeOut.duration(160)}
                      style={styles.sectionBody}
                    >
                      {section.blocks.map((block, i) => (
                        <Block key={i} block={block} tint={section.tint} />
                      ))}
                    </Animated.View>
                  ) : null}
                </Animated.View>
              );
            })}
          </View>
        )}

        <View style={styles.supportCard}>
          <Text style={styles.supportTitle}>Still need help?</Text>
          <Text style={styles.supportText}>
            For account, schedule, or visit questions, contact your agency administrator. For
            software issues, reach RayHealthEVV Support.
          </Text>
          <Pressable
            onPress={openSupportEmail}
            style={({ pressed }) => [styles.supportBtn, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel="Email RayHealthEVV support"
          >
            <Ionicons name="mail-outline" size={17} color="#fff" />
            <Text style={styles.supportBtnText}>Email Support</Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>
          RayHealthEVV™ v{version}{'\n'}Copyright © 2026 RayHealthEVV LLC. All Rights Reserved.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  scroll: { padding: 16, paddingBottom: 40 },

  introCard: {
    flexDirection: 'row', gap: 13, alignItems: 'center',
    backgroundColor: colors.cardBg, borderRadius: radii.lg, padding: 16,
    ...shadow.card,
  },
  introIcon: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: `${colors.brandBlue}${alpha.tint}`,
    justifyContent: 'center', alignItems: 'center',
  },
  introText: { flex: 1 },
  introTitle: { ...typography.heading, color: colors.textPrimary },
  introSub: { fontSize: 12, color: colors.textSecondary, marginTop: 3, lineHeight: 17 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    backgroundColor: colors.cardBg, borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.inputBorder,
    paddingHorizontal: 13, height: 48, marginTop: 14,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.inputText },

  emptyWrap: { marginTop: 22 },

  sectionList: { gap: 10, marginTop: 14 },
  sectionCard: {
    backgroundColor: colors.cardBg, borderRadius: radii.lg, overflow: 'hidden',
    ...shadow.card,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14 },
  sectionHeadPressed: { backgroundColor: colors.pressedBg },
  sectionIcon: {
    width: 36, height: 36, borderRadius: radii.sm, justifyContent: 'center', alignItems: 'center',
  },
  sectionText: { flex: 1 },
  sectionTitle: { ...typography.body, fontWeight: '700', color: colors.textPrimary },
  sectionSummary: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  sectionBody: {
    paddingHorizontal: 16, paddingBottom: 16, paddingTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },

  block: { marginTop: 12 },
  blockHeading: { fontSize: 13.5, fontWeight: '800', color: colors.textPrimary, marginBottom: 5 },
  blockText: { fontSize: 13.5, color: colors.textSecondary, lineHeight: 20 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 6, paddingRight: 6 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  bulletText: { flex: 1, fontSize: 13.5, color: colors.textSecondary, lineHeight: 20 },
  noteBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: '#f0f6ff', borderRadius: radii.sm, padding: 11, marginTop: 9,
    borderWidth: 1, borderColor: '#dbeafe',
  },
  noteIcon: { marginTop: 1.5 },
  noteText: { flex: 1, fontSize: 12.5, color: '#1e4976', lineHeight: 18 },

  supportCard: {
    backgroundColor: colors.navy, borderRadius: radii.xl, padding: 20, marginTop: 20,
    shadowColor: colors.navy, shadowOpacity: 0.25, shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  supportTitle: { color: '#fff', fontSize: 17, fontWeight: '900' },
  supportText: { ...typography.sub, color: colors.onGradientSoft, lineHeight: 19, marginTop: 6 },
  supportBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    backgroundColor: colors.brandBlue, borderRadius: 12, height: 48, marginTop: 14,
  },
  supportBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  footer: {
    textAlign: 'center', color: colors.textMuted, fontSize: 11.5, lineHeight: 17, marginTop: 20,
  },
});
