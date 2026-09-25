/**
 * updateService.ts — Production-grade Over-The-Air (OTA) update service.
 *
 * Provides:
 * - Real-time cloud checks via EAS Update
 * - Automatic background downloading
 * - User-friendly restart to apply updates without reinstalling APK
 * - Graceful fallback when running in development mode
 */

import * as Updates from 'expo-updates';

export interface UpdateCheckResult {
  isAvailable: boolean;
  isChecking: boolean;
  isEnabled: boolean;
  message?: string;
  error?: string;
  updateId?: string;
}

/**
 * Check if a new Over-The-Air update has been published on EAS Update
 */
export async function checkForAppUpdateAsync(): Promise<UpdateCheckResult> {
  try {
    if (!Updates.isEnabled) {
      return {
        isAvailable: false,
        isChecking: false,
        isEnabled: false,
        message: 'Updates enabled in standalone builds (APK)',
      };
    }

    const check = await Updates.checkForUpdateAsync();
    if (check.isAvailable) {
      return {
        isAvailable: true,
        isChecking: false,
        isEnabled: true,
        message: 'A new update is available for Example Project POS',
        updateId: check.manifest?.id,
      };
    }

    return {
      isAvailable: false,
      isChecking: false,
      isEnabled: true,
      message: 'App is running the latest version',
    };
  } catch (error: any) {
    console.warn('checkForAppUpdateAsync notice:', error?.message || error);
    return {
      isAvailable: false,
      isChecking: false,
      isEnabled: Updates.isEnabled,
      error: error?.message || 'Could not verify updates at this time',
    };
  }
}

/**
 * Downloads and applies the pending update, then restarts the app immediately
 */
export async function downloadAndApplyUpdateAsync(): Promise<{ success: boolean; message: string }> {
  try {
    if (!Updates.isEnabled) {
      return { success: false, message: 'Updates enabled in standalone builds' };
    }

    const fetchResult = await Updates.fetchUpdateAsync();
    if (fetchResult.isNew) {
      await Updates.reloadAsync();
      return { success: true, message: 'Update installed successfully' };
    }
    return { success: false, message: 'No new update content found' };
  } catch (error: any) {
    console.warn('downloadAndApplyUpdateAsync error:', error);
    return { success: false, message: error?.message || 'Failed to download update' };
  }
}
