import * as Haptics from 'expo-haptics';
import { Vibration, Platform } from 'react-native';

/**
 * Production-grade haptics utility with graceful fallback.
 * Uses native Apple Taptic Engine & Android Vibration Actuator when available.
 */

// Light tap: used for menu item selection, button clicks, keypresses
export function hapticTap() {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    if (Platform.OS === 'android') {
      Vibration.vibrate(15);
    }
  }
}

// Medium tap: used for category switching, order type toggle (Walk-in/Parcel/Catering)
export function hapticMedium() {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    if (Platform.OS === 'android') {
      Vibration.vibrate(25);
    }
  }
}

// Selection click: used for bottom tab switching, date selections
export function hapticSelection() {
  try {
    Haptics.selectionAsync();
  } catch {
    if (Platform.OS === 'android') {
      Vibration.vibrate(10);
    }
  }
}

// Success feedback: used when sending order to kitchen, completing ticket
export function hapticSuccess() {
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    Vibration.vibrate([0, 40, 50, 60]);
  }
}

// Warning feedback: used when clearing cart, cancelling order
export function hapticWarning() {
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {
    Vibration.vibrate([0, 60, 40, 80]);
  }
}
