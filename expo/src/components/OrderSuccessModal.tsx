import React, { useEffect, useRef } from 'react';
import {
  Modal, View, Text, StyleSheet, Animated, TouchableOpacity, Easing,
} from 'react-native';

interface OrderSuccessModalProps {
  visible: boolean;
  itemCount: number;
  total: number;
  table: string;
  orderId?: string;
  onDismiss: () => void;
}

export default function OrderSuccessModal({
  visible, itemCount, total, table, orderId, onDismiss,
}: OrderSuccessModalProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const checkScaleAnim = useRef(new Animated.Value(0)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      checkScaleAnim.setValue(0);
      ringAnim.setValue(0);

      Animated.sequence([
        Animated.parallel([
          Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
          Animated.spring(scaleAnim, {
            toValue: 1, tension: 80, friction: 7, useNativeDriver: true,
          }),
        ]),
        Animated.spring(checkScaleAnim, {
          toValue: 1, tension: 100, friction: 6, useNativeDriver: true,
        }),
        Animated.timing(ringAnim, {
          toValue: 1, duration: 600, easing: Easing.out(Easing.ease), useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss after 3 seconds
      const timer = setTimeout(onDismiss, 3000);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const ringScale = ringAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] });
  const ringOpacity = ringAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
          {/* Pulse Ring */}
          <View style={styles.iconWrap}>
            <Animated.View
              style={[
                styles.ring,
                { transform: [{ scale: ringScale }], opacity: ringOpacity },
              ]}
            />
            <Animated.View
              style={[styles.checkCircle, { transform: [{ scale: checkScaleAnim }] }]}
            >
              <Text style={styles.checkMark}>✓</Text>
            </Animated.View>
          </View>

          <Text style={styles.title}>Order Sent!</Text>
          {orderId ? (
            <View style={styles.orderIdBadge}>
              <Text style={styles.orderIdText}>{orderId}</Text>
            </View>
          ) : null}
          <Text style={styles.subtitle}>Kitchen has been notified</Text>

          <View style={styles.divider} />

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{itemCount}</Text>
              <Text style={styles.statLabel}>Items</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>₹{total}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue} numberOfLines={1}>{table}</Text>
              <Text style={styles.statLabel}>Table</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.btn} onPress={onDismiss}>
            <Text style={styles.btnText}>CONTINUE</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#111113',
    borderRadius: 32,
    padding: 36,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: '#1C1914',
  },
  iconWrap: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  ring: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: '#10B981',
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: '#fff', fontSize: 34, fontWeight: '900' },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFF',
    marginBottom: 6,
  },
  orderIdBadge: {
    backgroundColor: 'rgba(212,175,55,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.4)',
    marginBottom: 8,
  },
  orderIdText: {
    color: '#D4AF37',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 14,
    color: '#71717A',
    fontWeight: '600',
    marginBottom: 24,
  },
  divider: { height: 1, backgroundColor: '#27272A', width: '100%', marginBottom: 24 },
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    marginBottom: 28,
  },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 20, fontWeight: '900', color: '#D4AF37', marginBottom: 4 },
  statLabel: { fontSize: 11, color: '#71717A', fontWeight: '700', textTransform: 'uppercase' },
  statDivider: { width: 1, backgroundColor: '#27272A' },
  btn: {
    backgroundColor: '#D4AF37',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
  },
  btnText: { color: '#09090B', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
});
