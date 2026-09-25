/**
 * branchStorage.ts — AsyncStorage-backed persistence for active branch and role session.
 *
 * Used on first launch to pick a branch, then PIN auth validates against that
 * branch's configurable passcodes (manager_passcode, waiter_passcode, chef_passcode).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ActiveBranch {
  id: string;
  name: string;
  code: string;
  city?: string;
  address?: string;
  phone?: string;
  manager_name?: string;
  owner_passcode: string;
  manager_passcode: string;
  waiter_passcode: string;
  chef_passcode: string;
  royalty_pct?: number;
  status: 'active' | 'inactive';
}

export type StaffRole = 'manager' | 'waiter' | 'chef';

const KEYS = {
  BRANCH: '@manohaa_pos_branch',
  ROLE: '@manohaa_pos_role',
  STAFF_NAME: '@manohaa_pos_staff_name',
};

export const BranchStorage = {
  // ── Branch ────────────────────────────────────────────────────────────────

  /** Save the selected branch for this terminal device. */
  async saveBranch(branch: ActiveBranch): Promise<void> {
    await AsyncStorage.setItem(KEYS.BRANCH, JSON.stringify(branch));
  },

  /** Get the currently saved branch, or null if none selected yet. */
  async getBranch(): Promise<ActiveBranch | null> {
    try {
      const data = await AsyncStorage.getItem(KEYS.BRANCH);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('BranchStorage.getBranch failed:', e);
    }
    return null;
  },

  /** Clear the saved branch (triggers re-selection on next launch). */
  async clearBranch(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.BRANCH);
  },

  // ── Role Session ──────────────────────────────────────────────────────────

  /** Save the authenticated role and optional staff name. */
  async saveSession(role: StaffRole, staffName: string = ''): Promise<void> {
    await AsyncStorage.setItem(KEYS.ROLE, role);
    if (staffName) {
      await AsyncStorage.setItem(KEYS.STAFF_NAME, staffName);
    }
  },

  /** Retrieve the current session (role + staffName). */
  async getSession(): Promise<{ role: StaffRole | null; staffName: string }> {
    const role = (await AsyncStorage.getItem(KEYS.ROLE)) as StaffRole | null;
    const staffName = (await AsyncStorage.getItem(KEYS.STAFF_NAME)) || '';
    return { role, staffName };
  },

  /** Clear the current session (lock terminal). */
  async clearSession(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.ROLE);
    await AsyncStorage.removeItem(KEYS.STAFF_NAME);
  },
};
