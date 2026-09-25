import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { checkForAppUpdateAsync, downloadAndApplyUpdateAsync } from '../services/updateService';
import { Colors, Spacing, Radii, FontSizes, FontWeights } from '../constants/theme';
import { hapticTap, hapticSuccess, hapticWarning } from '../utils/haptics';

export default function UpdateBanner() {
  const [checking, setChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleCheck = async () => {
    if (checking || installing) return;
    hapticTap();
    setChecking(true);
    setStatusMessage('Checking cloud server...');

    const result = await checkForAppUpdateAsync();
    setChecking(false);

    if (result.isAvailable) {
      hapticSuccess();
      setUpdateAvailable(true);
      setStatusMessage('New update available! Tap to install.');
    } else {
      hapticTap();
      setUpdateAvailable(false);
      setStatusMessage(result.message || 'Running latest version');
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  const handleInstall = async () => {
    if (installing) return;
    hapticTap();
    Alert.alert(
      'Install Update',
      'Download and apply the latest update? The app will restart with the new version.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update & Restart',
          onPress: async () => {
            setInstalling(true);
            setStatusMessage('Downloading & applying update...');
            const res = await downloadAndApplyUpdateAsync();
            setInstalling(false);
            if (!res.success) {
              hapticWarning();
              Alert.alert('Update Notice', res.message);
              setStatusMessage(res.message);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.infoRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>OTA UPDATES</Text>
        </View>
        <Text style={styles.statusText} numberOfLines={1}>
          {statusMessage || 'Live Cloud Updates Enabled'}
        </Text>
      </View>

      <View style={styles.btnRow}>
        {updateAvailable ? (
          <TouchableOpacity
            style={[styles.btn, styles.btnInstall]}
            onPress={handleInstall}
            disabled={installing}
            activeOpacity={0.8}
          >
            {installing ? (
              <ActivityIndicator size="small" color={Colors.bg} />
            ) : (
              <Text style={styles.btnTextBlack}>INSTALL UPDATE NOW</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.btn, styles.btnCheck]}
            onPress={handleCheck}
            disabled={checking}
            activeOpacity={0.8}
          >
            {checking ? (
              <ActivityIndicator size="small" color={Colors.gold} />
            ) : (
              <Text style={styles.btnTextGold}>CHECK FOR UPDATES</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  badge: {
    backgroundColor: Colors.goldDim,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: Colors.goldBorder,
  },
  badgeText: {
    color: Colors.gold,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.black,
    letterSpacing: 0.8,
  },
  statusText: {
    color: Colors.textMuted,
    fontSize: FontSizes.body,
    fontWeight: FontWeights.normal,
    flex: 1,
  },
  btnRow: {
    flexDirection: 'row',
  },
  btn: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCheck: {
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.goldBorder,
  },
  btnInstall: {
    backgroundColor: Colors.gold,
  },
  btnTextGold: {
    color: Colors.gold,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.black,
    letterSpacing: 0.5,
  },
  btnTextBlack: {
    color: Colors.black,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.black,
    letterSpacing: 0.5,
  },
});
