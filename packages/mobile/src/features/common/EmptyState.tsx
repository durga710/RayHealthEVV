import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from './tokens';

type IoniconName = keyof typeof Ionicons.glyphMap;

// Shared "nothing here yet" treatment, icon-in-tinted-circle + title +
// subtitle, generalized from DashboardScreen's original EmptyVisits so
// Visits/Schedule/Training stop each reinventing their own variant.
export default function EmptyState({
  icon,
  title,
  message,
  tint = colors.brandBlue,
}: {
  icon: IoniconName;
  title: string;
  message?: string;
  tint?: string;
}) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconCircle, { backgroundColor: `${tint}1a` }]}>
        <Ionicons name={icon} size={32} color={tint} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 32, gap: 4 },
  iconCircle: { width: 76, height: 76, borderRadius: 38, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 17, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  message: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 19, marginTop: 4 },
});
