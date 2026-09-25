/**
 * notificationService.ts — Notification service.
 *
 * NOTE: Expo Go (SDK 53+) does not support native notifications.
 * Native system notifications are temporarily disabled for Expo Go.
 * In-app UI notifications (toasts/banners) continue to work normally.
 * Native push notifications can be re-enabled for custom dev builds / EAS production.
 */

let notificationsSilenced = false;

/**
 * Configure whether system notifications are silenced (e.g. for Admin mode)
 */
export function setNotificationsSilenced(silenced: boolean) {
  notificationsSilenced = silenced;
}

export function isNotificationsSilenced(): boolean {
  return notificationsSilenced;
}

/**
 * Register notification channels and request permission (Disabled for Expo Go)
 */
export async function registerForPushNotificationsAsync(): Promise<boolean> {
  // Disabled for Expo Go compatibility
  return false;
}

/**
 * Send an immediate native system notification to phone status bar / lock screen (Disabled for Expo Go)
 */
export async function sendLocalNotification(
  _title: string,
  _body: string,
  _data?: any,
  _channelId: 'orders' | 'kitchen' = 'orders'
): Promise<void> {
  // Disabled for Expo Go compatibility
  return;
}
