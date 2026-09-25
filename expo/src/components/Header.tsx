/**
 * Header — Shared professional header component across all terminal screens.
 *
 * Displays "Example Project" branding, the active franchise branch name,
 * the screen's operational subtitle, offline indicator, and secure lock action.
 * Completely responsive and flexible across mobile phones and tablets.
 */

import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { Colors, Spacing, FontSizes, FontWeights, Radii } from '../constants/theme';
import { useIsTablet } from '../constants/layout';

interface HeaderProps {
  subtitle: string;
  isOffline?: boolean;
  onLock: () => void;
  rightContent?: React.ReactNode;
  customTitle?: string;
}

export default function Header({
  subtitle,
  isOffline = false,
  onLock,
  rightContent,
  customTitle,
}: HeaderProps) {
  const { activeBranch } = useContext(AuthContext);
  const isTablet = useIsTablet();

  return (
    <View style={[styles.header, isTablet && styles.headerTablet]}>
      <View style={styles.headerRow}>
        {/* Left: App Branding + Active Branch Pill + Subtitle */}
        <View style={styles.titleSection}>
          <View style={styles.brandRow}>
            <Text style={styles.brandTitle} numberOfLines={1}>
              {customTitle || 'Example Project'}
            </Text>

            {activeBranch?.name ? (
              <View style={styles.branchPill}>
                <View style={styles.branchDot} />
                <Text style={styles.branchText} numberOfLines={1}>
                  {activeBranch.name}
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>

        {/* Right: Network Status + Lock Terminal Action */}
        <View style={styles.rightSection}>
          {isOffline && (
            <View style={styles.offlinePill}>
              <View style={styles.offlineDot} />
              <Text style={styles.offlineText}>OFFLINE</Text>
            </View>
          )}
          {rightContent}
          <TouchableOpacity
            onPress={onLock}
            style={styles.lockBtn}
            activeOpacity={0.75}
            accessibilityLabel="Lock Terminal"
          >
            <Text style={styles.lockText}>LOCK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm + 2,
    backgroundColor: '#09090B',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerTablet: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleSection: {
    flex: 1,
    marginRight: Spacing.md,
    minWidth: 0,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  brandTitle: {
    fontSize: FontSizes.xl + 2,
    fontWeight: FontWeights.black,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  branchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#16161D',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    maxWidth: 220,
  },
  branchDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  branchText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold,
    color: '#D1D5DB',
  },
  subtitle: {
    fontSize: 11,
    fontWeight: FontWeights.extrabold,
    color: Colors.gold,
    letterSpacing: 1,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 0,
  },
  offlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  offlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.red,
  },
  offlineText: {
    color: Colors.red,
    fontSize: 10,
    fontWeight: FontWeights.black,
    letterSpacing: 0.5,
  },
  lockBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  lockText: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: FontWeights.black,
    letterSpacing: 0.8,
  },
});
