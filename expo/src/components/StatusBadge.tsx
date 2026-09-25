/**
 * StatusBadge — Reusable status indicator.
 *
 * Color-coded pill for PENDING / COOKING / SERVED / CANCELLED.
 * Used by KDSScreen and HistoryScreen.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusColors, FontSizes, FontWeights, Radii, Spacing } from '../constants/theme';

interface StatusBadgeProps {
  status: string;
  /** Override label text (e.g. "NEW" instead of "PENDING") */
  label?: string;
}

export default function StatusBadge({ status, label }: StatusBadgeProps) {
  const config = StatusColors[status as keyof typeof StatusColors] || StatusColors.pending;
  const displayLabel = label || config.label;

  return (
    <View style={[styles.badge, { backgroundColor: config.bg, borderColor: config.border }]}>
      <Text style={[styles.text, { color: config.text }]}>{displayLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radii.md,
    borderWidth: 1,
  },
  text: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.black,
    letterSpacing: 0.5,
  },
});
