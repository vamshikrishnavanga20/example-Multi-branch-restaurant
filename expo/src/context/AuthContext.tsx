/**
 * AuthContext — Branch-aware, role-based terminal authentication.
 *
 * Validates PIN against the active branch's configurable passcodes:
 * - Waiter: branch.waiter_passcode  (default: 1111)
 * - Chef:   branch.chef_passcode    (default: 2222)
 * - Admin:  branch.manager_passcode (default: 4040) or owner_passcode (9999)
 */

import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { Alert, Keyboard, Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BranchStorage, ActiveBranch, StaffRole } from '../../lib/branchStorage';

export type UserRole = 'staff' | 'admin' | 'chef' | null;

type AuthContextType = {
  isAuthenticated: boolean | null;
  userRole: UserRole;
  activeBranch: ActiveBranch | null;
  hasBranch: boolean;
  setActiveBranch: (branch: ActiveBranch) => void;
  unlockTerminal: (pin: string, selectedRole?: StaffRole) => Promise<boolean>;
  lockTerminal: () => void;
  switchBranch: () => void;
};

export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

/** Map StaffRole → UserRole used by navigators */
function staffRoleToUserRole(role: StaffRole): UserRole {
  switch (role) {
    case 'waiter': return 'staff';
    case 'chef': return 'chef';
    case 'manager': return 'admin';
    default: return null;
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [activeBranch, setActiveBranchState] = useState<ActiveBranch | null>(null);
  const [hasBranch, setHasBranch] = useState(false);

  // ── Restore Session on App Launch ───────────────────────────────────────────
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // 1. Check if a branch has been selected for this device
        const savedBranch = await BranchStorage.getBranch();
        if (savedBranch) {
          setActiveBranchState(savedBranch);
          setHasBranch(true);
        } else {
          setHasBranch(false);
        }

        // 2. Check if a role session exists
        const unlocked = await AsyncStorage.getItem('is_unlocked');
        const role = await AsyncStorage.getItem('user_role');
        if (unlocked === 'true' && role) {
          setUserRole(role as UserRole);
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  // ── Set Active Branch ───────────────────────────────────────────────────────
  const setActiveBranch = async (branch: ActiveBranch) => {
    await BranchStorage.saveBranch(branch);
    setActiveBranchState(branch);
    setHasBranch(true);
  };

  // ── PIN Unlock — validates and auto-detects role against active branch passcodes ──
  const unlockTerminal = async (pin: string, optionalRole?: StaffRole): Promise<boolean> => {
    try {
      const branch = activeBranch || (await BranchStorage.getBranch());
      if (!branch) {
        Alert.alert('No Branch Selected', 'Please select a branch first.');
        return false;
      }

      let detectedRole: StaffRole | null = null;

      if (optionalRole) {
        if (optionalRole === 'waiter' && pin === (branch.waiter_passcode || '1111')) {
          detectedRole = 'waiter';
        } else if (optionalRole === 'chef' && pin === (branch.chef_passcode || '2222')) {
          detectedRole = 'chef';
        } else if (optionalRole === 'manager' && (pin === (branch.manager_passcode || '4040') || pin === (branch.owner_passcode || '9999'))) {
          detectedRole = 'manager';
        }
      } else {
        // Auto-detect role directly from PIN entered!
        if (pin === (branch.manager_passcode || '4040') || pin === (branch.owner_passcode || '9999')) {
          detectedRole = 'manager';
        } else if (pin === (branch.chef_passcode || '2222')) {
          detectedRole = 'chef';
        } else if (pin === (branch.waiter_passcode || '1111')) {
          detectedRole = 'waiter';
        }
      }

      if (detectedRole) {
        const resolvedUserRole = staffRoleToUserRole(detectedRole);
        await AsyncStorage.setItem('user_role', resolvedUserRole || 'staff');
        await AsyncStorage.setItem('is_unlocked', 'true');
        await BranchStorage.saveSession(detectedRole);
        setUserRole(resolvedUserRole);
        setIsAuthenticated(true);
        Keyboard.dismiss();
        Vibration.vibrate([0, 50, 50, 100]);
        return true;
      } else {
        return false;
      }
    } catch (err) {
      Alert.alert('Authentication Error', 'Could not verify passcode.');
      return false;
    }
  };

  // ── Lock Terminal ───────────────────────────────────────────────────────────
  const lockTerminal = () => {
    Alert.alert(
      'Lock Terminal',
      'Are you sure you want to lock the POS?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Lock',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('is_unlocked');
            await AsyncStorage.removeItem('user_role');
            await BranchStorage.clearSession();
            setIsAuthenticated(false);
            setUserRole(null);
          },
        },
      ]
    );
  };

  // ── Switch Branch (clears everything) ──────────────────────────────────────
  const switchBranch = () => {
    Alert.alert(
      'Switch Branch',
      'This will lock the terminal and return to branch selection. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('is_unlocked');
            await AsyncStorage.removeItem('user_role');
            await BranchStorage.clearSession();
            await BranchStorage.clearBranch();
            setIsAuthenticated(false);
            setUserRole(null);
            setActiveBranchState(null);
            setHasBranch(false);
          },
        },
      ]
    );
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      userRole,
      activeBranch,
      hasBranch,
      setActiveBranch,
      unlockTerminal,
      lockTerminal,
      switchBranch,
    }}>
      {children}
    </AuthContext.Provider>
  );
};