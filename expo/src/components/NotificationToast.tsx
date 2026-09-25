/**
 * NotificationToast — Animated slide-down toast component.
 *
 * Renders at the top of the screen over all content.
 * Color-coded by notification type. Auto-dismisses after 4 seconds.
 */

import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Notification, NotificationType } from '../context/NotificationContext';
import { Colors, Radii, Spacing, FontSizes, FontWeights } from '../constants/theme';

const TYPE_CONFIG: Record<NotificationType, { bg: string; border: string; badge: string; accentColor: string }> = {
  success: {
    bg: 'rgba(16,185,129,0.12)',
    border: 'rgba(16,185,129,0.35)',
    badge: 'OK',
    accentColor: Colors.green,
  },
  warning: {
    bg: 'rgba(249,115,22,0.12)',
    border: 'rgba(249,115,22,0.35)',
    badge: 'ALERT',
    accentColor: Colors.orange,
  },
  info: {
    bg: 'rgba(212,175,55,0.12)',
    border: 'rgba(212,175,55,0.35)',
    badge: 'INFO',
    accentColor: Colors.gold,
  },
  order_ready: {
    bg: 'rgba(16,185,129,0.16)',
    border: 'rgba(16,185,129,0.45)',
    badge: 'READY',
    accentColor: Colors.green,
  },
};

const AUTO_DISMISS_MS = 4000;

function SingleToast({
  notification,
  onDismiss,
  index,
}: {
  notification: Notification;
  onDismiss: (id: string) => void;
  index: number;
}) {
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const config = TYPE_CONFIG[notification.type];

  useEffect(() => {
    // Slide in
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -120,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => onDismiss(notification.id));
    }, AUTO_DISMISS_MS);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
          transform: [{ translateY }],
          opacity,
          marginTop: index > 0 ? Spacing.sm : 0,
        },
      ]}
    >
      <View style={[styles.badgeContainer, { borderColor: config.border }]}>
        <Text style={[styles.badgeText, { color: config.accentColor }]}>{config.badge}</Text>
      </View>
      <View style={styles.toastContent}>
        <Text style={[styles.toastTitle, { color: config.accentColor }]}>
          {notification.title}
        </Text>
        <Text style={styles.toastBody} numberOfLines={2}>
          {notification.body}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.dismissBtn}
        onPress={() => onDismiss(notification.id)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.dismissText}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function NotificationToast({
  notifications,
  onDismiss,
}: {
  notifications: Notification[];
  onDismiss: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();

  if (notifications.length === 0) return null;

  // Only show the most recent 3 toasts
  const visible = notifications.slice(-3);

  return (
    <View style={[styles.container, { top: insets.top + Spacing.sm }]} pointerEvents="box-none">
      {visible.map((notif, idx) => (
        <SingleToast
          key={notif.id}
          notification={notif}
          onDismiss={onDismiss}
          index={idx}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 9999,
    elevation: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radii.xxl,
    borderWidth: 1.5,
    gap: Spacing.md,
    // Shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 12,
  },
  badgeContainer: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radii.sm,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: FontWeights.black,
    letterSpacing: 0.8,
  },
  toastContent: {
    flex: 1,
  },
  toastTitle: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.black,
    marginBottom: 2,
  },
  toastBody: {
    fontSize: FontSizes.body,
    color: Colors.textMuted,
    fontWeight: FontWeights.semibold,
  },
  dismissBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissText: {
    color: Colors.textDim,
    fontSize: 12,
    fontWeight: FontWeights.black,
  },
});
