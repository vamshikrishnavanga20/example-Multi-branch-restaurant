# Example Project POS - Expo Franchise & Role Passcode Integration Guide

This guide provides step-by-step instructions and **drop-in code** to integrate the multi-branch franchise architecture and 3-tier role passcode security into your React Native (Expo) app located at:
`c:\Projects\Hoteltemplate-1\native-app\S4-Manohaa-POS`

---

## 🏗️ Architecture Overview

| Role | Default Passcode | Access Scope |
| :--- | :--- | :--- |
| **Branch Manager / Owner** | `4040` (Configurable per branch in Admin Panel) | Full POS access: Table management, Daily settlements, Gross revenue analytics, Refunds, Terminal branch settings |
| **Waiter / Server** | `1111` (Configurable per branch in Admin Panel) | Floor operations: Table floor plan, Taking food orders, Kitchen send (KOT), Scoped strictly to current branch |
| **Chef / Kitchen (KDS)** | `2222` (Configurable per branch in Admin Panel) | Kitchen Display System: Live pending & preparing tickets for this branch's kitchen only. Mark dishes as prepared |

All orders created by the POS are automatically stamped with `branch_id` and `branch_name`. When the Web Admin Command Center loads, gross revenue is attributed accurately to each franchise location.

---

## 📁 Step 1: Branch Storage Helper (`lib/branchStorage.ts` or `src/lib/branchStorage.ts`)

Create a new file `lib/branchStorage.ts` in your Expo project to handle persisting the active branch and logged-in role using `@react-native-async-storage/async-storage`:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ActiveBranch {
  id: string;
  name: string;
  code: string;
  city?: string;
  manager_passcode: string;
  waiter_passcode: string;
  chef_passcode: string;
  status: 'active' | 'inactive';
}

export type StaffRole = 'manager' | 'waiter' | 'chef';

const KEYS = {
  BRANCH: '@manohaa_pos_branch',
  ROLE: '@manohaa_pos_role',
  STAFF_NAME: '@manohaa_pos_staff_name',
};

export const BranchStorage = {
  // Save selected branch
  async saveBranch(branch: ActiveBranch): Promise<void> {
    await AsyncStorage.setItem(KEYS.BRANCH, JSON.stringify(branch));
  },

  // Get current active branch (defaults to Hyderabad HQ if not set)
  async getBranch(): Promise<ActiveBranch> {
    try {
      const data = await AsyncStorage.getItem(KEYS.BRANCH);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Failed to load branch, using default HQ:', e);
    }
    return {
      id: 'branch-hyderabad-hq',
      name: 'Hyderabad Highway HQ',
      code: 'HYD-01',
      city: 'Hyderabad',
      manager_passcode: '4040',
      waiter_passcode: '1111',
      chef_passcode: '2222',
      status: 'active',
    };
  },

  // Role Session
  async saveSession(role: StaffRole, staffName: string = ''): Promise<void> {
    await AsyncStorage.setItem(KEYS.ROLE, role);
    if (staffName) await AsyncStorage.setItem(KEYS.STAFF_NAME, staffName);
  },

  async getSession(): Promise<{ role: StaffRole | null; staffName: string }> {
    const role = (await AsyncStorage.getItem(KEYS.ROLE)) as StaffRole | null;
    const staffName = (await AsyncStorage.getItem(KEYS.STAFF_NAME)) || '';
    return { role, staffName };
  },

  async clearSession(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.ROLE);
    await AsyncStorage.removeItem(KEYS.STAFF_NAME);
  },
};
```

---

## 🌐 Step 2: Update `services/api.ts`

In your `S4-Manohaa-POS/services/api.ts` (or `src/services/api.ts`), update your API calls to:
1. Fetch available branches from the Next.js backend.
2. Automatically inject `branch_id` and `branch_name` into every outgoing order.
3. Filter orders/KDS tickets by the active branch.

```typescript
import { BranchStorage, ActiveBranch } from '../lib/branchStorage';

// Replace with your local machine's IP or production domain
// E.g. 'http://192.168.29.89:3000'
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.29.89:3000';

export const ApiService = {
  // 1. Fetch available franchise branches
  async getBranches(): Promise<ActiveBranch[]> {
    try {
      const res = await fetch(`${BASE_URL}/api/branches`);
      if (!res.ok) throw new Error('Failed to fetch branches');
      return await res.json();
    } catch (error) {
      console.error('API getBranches error:', error);
      // Fallback default
      return [
        {
          id: 'branch-hyderabad-hq',
          name: 'Hyderabad Highway HQ',
          code: 'HYD-01',
          city: 'Hyderabad',
          manager_passcode: '4040',
          waiter_passcode: '1111',
          chef_passcode: '2222',
          status: 'active',
        },
      ];
    }
  },

  // 2. Fetch branch-scoped menu items
  async getMenu(): Promise<any[]> {
    const branch = await BranchStorage.getBranch();
    const res = await fetch(`${BASE_URL}/api/menu?branch_id=${branch.id}`);
    if (!res.ok) throw new Error('Failed to fetch menu');
    return await res.json();
  },

  // 3. Create order stamped with branch_id & branch_name
  async createOrder(orderData: {
    tableNo?: string;
    table_number?: string;
    order_type?: string;
    items: Array<{
      id?: string;
      menu_item_id?: string;
      name?: string;
      price?: number;
      qty?: number;
      quantity?: number;
    }>;
    subtotal?: number;
    gst?: number;
    grandTotal?: number;
    paymentMethod?: string;
    notes?: string;
  }): Promise<any> {
    const branch = await BranchStorage.getBranch();
    const session = await BranchStorage.getSession();

    const payload = {
      client_order_id: `ord-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      table_number: orderData.table_number || orderData.tableNo || 'Walk-in',
      order_type: orderData.order_type || 'dine_in',
      notes: orderData.notes || '',
      items: orderData.items.map(it => ({
        menu_item_id: it.menu_item_id || it.id,
        quantity: it.quantity || it.qty || 1,
      })),
      // Automatic Multi-Branch Tagging
      branch_id: branch.id,
      branch_name: branch.name,
      staff_role: session.role || 'waiter',
      staff_name: session.staffName || 'Staff',
    };

    const res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to submit order');
    }

    return await res.json();
  },

  // 4. Fetch orders for Kitchen Display System (scoped to branch)
  async getKitchenOrders(): Promise<any[]> {
    const branch = await BranchStorage.getBranch();
    const res = await fetch(`${BASE_URL}/api/orders?branch_id=${branch.id}`);
    if (!res.ok) throw new Error('Failed to fetch kitchen orders');
    return await res.json();
  },
};
```

---

## 🔐 Step 3: Role Passcode Gate Component (`components/RolePasscodeModal.tsx`)

Create `components/RolePasscodeModal.tsx` to display an attractive luxury dark-mode PIN entry screen with role selection:

```tsx
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Vibration,
} from 'react-native';
import { ActiveBranch, StaffRole, BranchStorage } from '../lib/branchStorage';

interface Props {
  visible: boolean;
  branch: ActiveBranch;
  onSuccess: (role: StaffRole) => void;
  onCancel?: () => void;
}

export const RolePasscodeModal: React.FC<Props> = ({
  visible,
  branch,
  onSuccess,
  onCancel,
}) => {
  const [selectedRole, setSelectedRole] = useState<StaffRole>('waiter');
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      setErrorMsg('');

      if (newPin.length === 4) {
        verifyPin(newPin);
      }
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setErrorMsg('');
  };

  const verifyPin = (enteredPin: string) => {
    let expectedPin = '';
    if (selectedRole === 'manager') expectedPin = branch.manager_passcode || '4040';
    if (selectedRole === 'waiter') expectedPin = branch.waiter_passcode || '1111';
    if (selectedRole === 'chef') expectedPin = branch.chef_passcode || '2222';

    if (enteredPin === expectedPin) {
      BranchStorage.saveSession(selectedRole);
      setPin('');
      setErrorMsg('');
      onSuccess(selectedRole);
    } else {
      Vibration.vibrate(200);
      setErrorMsg('Incorrect PIN for ' + selectedRole.toUpperCase());
      setTimeout(() => setPin(''), 500);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <Text style={styles.branchName}>{branch.name}</Text>
          <Text style={styles.title}>Terminal Authentication</Text>

          {/* Role Switcher Tabs */}
          <View style={styles.roleTabs}>
            {(['waiter', 'chef', 'manager'] as StaffRole[]).map(role => (
              <TouchableOpacity
                key={role}
                style={[
                  styles.roleButton,
                  selectedRole === role && styles.roleButtonActive,
                ]}
                onPress={() => {
                  setSelectedRole(role);
                  setPin('');
                  setErrorMsg('');
                }}
              >
                <Text
                  style={[
                    styles.roleButtonText,
                    selectedRole === role && styles.roleButtonTextActive,
                  ]}
                >
                  {role === 'waiter' && '🍽️ Waiter'}
                  {role === 'chef' && '👨‍🍳 Kitchen'}
                  {role === 'manager' && '👑 Manager'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* PIN Dots Display */}
          <View style={styles.dotsRow}>
            {[0, 1, 2, 3].map(index => (
              <View
                key={index}
                style={[
                  styles.dot,
                  pin.length > index && styles.dotFilled,
                  errorMsg ? styles.dotError : null,
                ]}
              />
            ))}
          </View>

          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

          {/* Keypad */}
          <View style={styles.keypad}>
            {[
              ['1', '2', '3'],
              ['4', '5', '6'],
              ['7', '8', '9'],
              ['C', '0', '⌫'],
            ].map((row, rIdx) => (
              <View key={rIdx} style={styles.keypadRow}>
                {row.map(k => (
                  <TouchableOpacity
                    key={k}
                    style={styles.key}
                    onPress={() => {
                      if (k === 'C') setPin('');
                      else if (k === '⌫') handleDelete();
                      else handleKeyPress(k);
                    }}
                  >
                    <Text style={styles.keyText}>{k}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>

          {onCancel && (
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#121214',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  branchName: {
    color: '#D4AF37',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
  },
  roleTabs: {
    flexDirection: 'row',
    backgroundColor: '#1E1E22',
    borderRadius: 14,
    padding: 4,
    marginBottom: 24,
    width: '100%',
  },
  roleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  roleButtonActive: {
    backgroundColor: '#D4AF37',
  },
  roleButtonText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
  },
  roleButtonTextActive: {
    color: '#000',
    fontWeight: '800',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: '#D4AF37',
    borderColor: '#D4AF37',
  },
  dotError: {
    borderColor: '#EF4444',
    backgroundColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  keypad: {
    width: '100%',
    gap: 10,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  key: {
    flex: 1,
    height: 60,
    backgroundColor: '#1C1C20',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  keyText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: 16,
    padding: 8,
  },
  cancelText: {
    color: '#888',
    fontSize: 13,
  },
});
```

---

## 🏢 Step 4: Branch Selection / Setup Screen (`screens/BranchSelectScreen.tsx`)

When launching the POS on a new tablet or phone, staff can select the branch this device represents:

```tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { ApiService } from '../services/api';
import { BranchStorage, ActiveBranch } from '../lib/branchStorage';

interface Props {
  onBranchSelected: (branch: ActiveBranch) => void;
}

export const BranchSelectScreen: React.FC<Props> = ({ onBranchSelected }) => {
  const [branches, setBranches] = useState<ActiveBranch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBranches();
  }, []);

  const loadBranches = async () => {
    setLoading(true);
    const list = await ApiService.getBranches();
    setBranches(list.filter(b => b.status === 'active'));
    setLoading(false);
  };

  const handleSelect = async (branch: ActiveBranch) => {
    await BranchStorage.saveBranch(branch);
    onBranchSelected(branch);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.goldSubtitle}>S4 MANOHAA ENTERPRISE</Text>
        <Text style={styles.title}>Select Terminal Location</Text>
        <Text style={styles.subtext}>
          Choose the restaurant branch for this POS device. All orders will be attributed to this branch.
        </Text>

        {loading ? (
          <ActivityIndicator size="large" color="#D4AF37" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={branches}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => handleSelect(item)}
              >
                <View>
                  <Text style={styles.cardName}>{item.name}</Text>
                  <Text style={styles.cardLocation}>{item.city || 'Highway Hub'}</Text>
                </View>
                <View style={styles.codeBadge}>
                  <Text style={styles.codeBadgeText}>{item.code}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#09090B' },
  container: { flex: 1, padding: 24 },
  goldSubtitle: { color: '#D4AF37', fontSize: 11, fontWeight: '800', letterSpacing: 3, marginBottom: 8 },
  title: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', marginBottom: 6 },
  subtext: { color: '#888899', fontSize: 13, lineHeight: 18, marginBottom: 24 },
  list: { gap: 12 },
  card: {
    backgroundColor: '#141418',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardName: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  cardLocation: { color: '#888', fontSize: 12 },
  codeBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  codeBadgeText: { color: '#D4AF37', fontSize: 11, fontWeight: 'bold' },
});
```

---

## 🚀 Step 5: How It Fits Into Your App Entry (`App.tsx` / `_layout.tsx`)

In your main entry file, wrap your navigation or screens with the branch check and PIN lock:

```tsx
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { BranchStorage, ActiveBranch, StaffRole } from './lib/branchStorage';
import { BranchSelectScreen } from './screens/BranchSelectScreen';
import { RolePasscodeModal } from './components/RolePasscodeModal';

// Your existing screens
import TableFloorScreen from './screens/TableFloorScreen';
import KitchenKdsScreen from './screens/KitchenKdsScreen';
import ManagerDashboardScreen from './screens/ManagerDashboardScreen';

export default function MainApp() {
  const [branch, setBranch] = useState<ActiveBranch | null>(null);
  const [role, setRole] = useState<StaffRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPinModal, setShowPinModal] = useState(false);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const savedBranch = await BranchStorage.getBranch();
    setBranch(savedBranch);
    const session = await BranchStorage.getSession();
    if (session.role) {
      setRole(session.role);
    } else {
      setShowPinModal(true);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#09090B', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#D4AF37" />
      </View>
    );
  }

  // 1. If no branch selected yet
  if (!branch) {
    return <BranchSelectScreen onBranchSelected={(b) => { setBranch(b); setShowPinModal(true); }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#09090B' }}>
      {/* 2. PIN Gate Modal */}
      <RolePasscodeModal
        visible={showPinModal}
        branch={branch}
        onSuccess={(unlockedRole) => {
          setRole(unlockedRole);
          setShowPinModal(false);
        }}
      />

      {/* 3. Screen Routing Based On Unlocked Role */}
      {role === 'chef' && <KitchenKdsScreen branch={branch} onLock={() => setShowPinModal(true)} />}
      {role === 'waiter' && <TableFloorScreen branch={branch} onLock={() => setShowPinModal(true)} />}
      {role === 'manager' && <ManagerDashboardScreen branch={branch} onLock={() => setShowPinModal(true)} />}
    </View>
  );
}
```

---

## ✅ Verification Checklist

1. **Manager PIN (`4040`):** Entering `4040` logs in as Manager, with access to terminal management, end-of-day reports, and settlements.
2. **Waiter PIN (`1111`):** Entering `1111` enters Waiter mode: floor tables, taking cart items, creating orders.
3. **Chef PIN (`2222`):** Entering `2222` shows Kitchen tickets only for that specific branch.
4. **Cloud Attribution:** Placing an order will automatically reflect in the Web Command Center under the selected franchise branch, updating Gross Revenue, Ledger, and Dish Intelligence in real time!
