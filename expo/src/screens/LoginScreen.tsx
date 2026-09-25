/**
 * LoginScreen — Multi-role PIN authentication with branch badge.
 *
 * Features:
 * - 3 role-selector tabs: 🍽️ Waiter | 👨‍🍳 Kitchen | 👑 Manager
 * - Branch name badge at the top
 * - PIN validated against the selected role's branch-configurable passcode
 * - "Switch Branch" button to change terminal location
 */

import React, { useContext, useState, useRef, useEffect } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ActivityIndicator,
  Animated, Vibration, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import { StaffRole } from '../../lib/branchStorage';
import { Colors, Spacing, Radii, FontSizes, FontWeights, TABLET_BREAKPOINT } from '../constants/theme';
import { hapticTap, hapticWarning, hapticSuccess } from '../utils/haptics';

const PIN_LENGTH = 4;

const PAD_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', '⌫'],
];


export default function LoginScreen() {
  const { unlockTerminal, activeBranch, switchBranch } = useContext(AuthContext);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
    ]).start();
  }, []);

  const triggerShake = () => {
    setShake(true);
    hapticWarning();
    Vibration.vibrate([0, 80, 60, 80, 60, 80]);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start(() => setShake(false));
  };

  const handleKey = async (key: string) => {
    if (loading) return;
    if (key === '⌫') {
      hapticTap();
      setPin(prev => prev.slice(0, -1));
      return;
    }
    if (key === '') return;

    hapticTap();
    const newPin = pin + key;
    setPin(newPin);

    if (newPin.length === PIN_LENGTH) {
      setLoading(true);
      try {
        const success = await unlockTerminal(newPin);
        if (success) {
          hapticSuccess();
        } else {
          triggerShake();
          setPin('');
        }
      } finally {
        setLoading(false);
      }
    }
  };

  // Responsive sizing for tablets
  const padKeySize = isTablet ? 90 : 80;
  const padKeyRadius = isTablet ? 22 : 20;
  const padKeyFontSize = isTablet ? 30 : 26;

  return (
    <SafeAreaView style={styles.screen}>
      <Animated.View
        style={[
          styles.card,
          isTablet && styles.cardTablet,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        {/* Branch Badge */}
        {activeBranch && (
          <TouchableOpacity style={styles.branchBadge} onPress={switchBranch} activeOpacity={0.7}>
            <View style={styles.branchBadgeDot} />
            <Text style={styles.branchBadgeText} numberOfLines={1}>
              {activeBranch.name}
            </Text>
            <Text style={styles.branchBadgeSwitch}>Switch ›</Text>
          </TouchableOpacity>
        )}

        {/* Title / Branding */}
        <View style={styles.logoWrap}>
          <Text style={[styles.appTitle, isTablet && styles.appTitleTablet]}>Example Project</Text>
          <Text style={styles.appSubtitle}>ENTERPRISE POINT OF SALE</Text>
        </View>

        {/* Access Instructions */}
        <Text style={styles.lockLabel}>TERMINAL ACCESS</Text>
        <Text style={styles.lockHint}>Enter your 4-digit PIN</Text>

        {/* PIN Dots */}
        <Animated.View
          style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}
        >
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                isTablet && styles.dotTablet,
                i < pin.length && styles.dotFilled,
                shake && styles.dotError,
              ]}
            />
          ))}
        </Animated.View>

        {shake && <Text style={styles.errorText}>Invalid PIN for this branch. Try again.</Text>}

        {/* Number Pad */}
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={Colors.gold} size="large" />
            <Text style={styles.loadingText}>Authenticating & Routing...</Text>
          </View>
        ) : (
          <View style={styles.pad}>
            {PAD_KEYS.map((row, ri) => (
              <View key={ri} style={styles.padRow}>
                {row.map((key, ki) => (
                  key === '' ? (
                    <View key={ki} style={[styles.padKeyEmpty, { width: padKeySize, height: padKeySize }]} />
                  ) : (
                    <TouchableOpacity
                      key={ki}
                      style={[
                        styles.padKey,
                        { width: padKeySize, height: padKeySize, borderRadius: padKeyRadius },
                        key === '⌫' && styles.padKeyBack,
                        pin.length === 0 && key === '⌫' && { opacity: 0.3 },
                      ]}
                      onPress={() => handleKey(key)}
                      activeOpacity={0.7}
                      disabled={pin.length === 0 && key === '⌫'}
                    >
                      <Text style={[
                        styles.padKeyText,
                        { fontSize: padKeyFontSize },
                        key === '⌫' && styles.padKeyBackText,
                      ]}>
                        {key}
                      </Text>
                    </TouchableOpacity>
                  )
                ))}
              </View>
            ))}
          </View>
        )}

        <Text style={styles.footerText}>Role auto-detected • Waiter, Kitchen, or Manager</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.bgCard,
    borderRadius: Radii.sheet,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xxxl,
    alignItems: 'center',
  },
  cardTablet: {
    maxWidth: 460,
    padding: Spacing.huge,
  },

  // Branch Badge
  branchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.goldDim,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.goldBorder,
    maxWidth: '100%',
    gap: 6,
  },
  branchBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.green,
  },
  branchBadgeText: {
    color: Colors.gold,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.bold,
    flex: 1,
  },
  branchBadgeSwitch: {
    color: Colors.textDim,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.semibold,
  },

  // Logo
  logoWrap: { alignItems: 'center', marginBottom: Spacing.xl },
  brandLogo: {
    width: 90,
    height: 90,
    marginBottom: Spacing.md,
    borderRadius: 20,
  },
  brandLogoTablet: {
    width: 110,
    height: 110,
    marginBottom: Spacing.lg,
    borderRadius: 24,
  },
  appTitle: {
    fontSize: 30,
    fontWeight: FontWeights.black,
    color: Colors.gold,
    letterSpacing: 1,
  },
  appTitleTablet: { fontSize: 36 },
  appSubtitle: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.extrabold,
    color: Colors.textDim,
    letterSpacing: 4,
    marginTop: 4,
  },

  // Role Tabs

  // Labels
  lockLabel: {
    fontSize: FontSizes.sm,
    color: Colors.gold,
    fontWeight: FontWeights.extrabold,
    letterSpacing: 2,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  lockHint: {
    fontSize: FontSizes.xs,
    color: Colors.textDim,
    fontWeight: FontWeights.normal,
    letterSpacing: 0.5,
    marginBottom: Spacing.xl,
  },

  // PIN Dots
  dotsRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginBottom: Spacing.md - 2,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: Colors.borderFocus,
    backgroundColor: Colors.transparent,
  },
  dotTablet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2.5,
  },
  dotFilled: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
  dotError: {
    borderColor: Colors.red,
    backgroundColor: 'rgba(239,68,68,0.3)',
  },
  errorText: {
    color: Colors.red,
    fontSize: FontSizes.body,
    fontWeight: FontWeights.bold,
    marginBottom: 4,
    marginTop: 6,
  },

  // Loading
  loadingWrap: { alignItems: 'center', paddingVertical: Spacing.huge },
  loadingText: { color: Colors.textDim, marginTop: Spacing.md, fontSize: FontSizes.md, fontWeight: FontWeights.semibold },

  // Keypad
  pad: { marginTop: Spacing.xxl, width: '100%', gap: Spacing.md },
  padRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.md },
  padKey: {
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  padKeyEmpty: {},
  padKeyBack: {
    backgroundColor: Colors.redDim,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  padKeyText: {
    color: Colors.textPrimary,
    fontWeight: FontWeights.bold,
  },
  padKeyBackText: {
    color: Colors.red,
    fontSize: 22,
  },

  // Footer
  footerText: {
    color: Colors.textGhost,
    fontSize: FontSizes.body - 1,
    fontWeight: FontWeights.semibold,
    marginTop: Spacing.xxl,
    letterSpacing: 0.5,
  },
});