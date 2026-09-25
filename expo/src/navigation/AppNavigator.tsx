/**
 * AppNavigator — Root navigation with branch gate.
 *
 * Flow:
 * 1. Splash → Loading auth & branch state
 * 2. BranchSelectScreen → No branch saved yet (first launch or after "Switch Branch")
 * 3. LoginScreen → Branch selected, need role PIN
 * 4. Role Navigator → Authenticated (Waiter / Chef / Admin tabs)
 */

import React, { useContext } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { AuthContext } from '../context/AuthContext';
import { PosProvider } from '../context/PosContext';
import BranchSelectScreen from '../screens/BranchSelectScreen';
import LoginScreen from '../screens/LoginScreen';
import POSScreen from '../screens/POSScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ChefLiveScreen from '../screens/chef/ChefLiveScreen';
import ChefPrepSummaryScreen from '../screens/chef/ChefPrepSummaryScreen';
import ChefHistoryScreen from '../screens/chef/ChefHistoryScreen';
import AdminRevenueScreen from '../screens/admin/AdminRevenueScreen';
import { Colors, Spacing, FontWeights, TABLET_BREAKPOINT, TAB_BAR_HEIGHT_PHONE, TAB_BAR_HEIGHT_TABLET } from '../constants/theme';
import { hapticSelection } from '../utils/haptics';

const Tab = createBottomTabNavigator();

type TabIconType = 'order' | 'status' | 'kds' | 'prep' | 'archive' | 'revenue';

function TabIcon({ type, focused, isTablet }: { type: TabIconType; focused: boolean; isTablet: boolean }) {
  const color = focused ? Colors.gold : '#71717A';

  return (
    <View style={[tabStyles.iconContainer, isTablet && tabStyles.iconContainerTablet]}>
      {type === 'order' && (
        <View style={[tabStyles.orderPad, { borderColor: color }]}>
          <View style={[tabStyles.orderClip, { backgroundColor: color }]} />
          <View style={[tabStyles.orderLine1, { backgroundColor: color }]} />
          <View style={[tabStyles.orderLine2, { backgroundColor: color }]} />
        </View>
      )}

      {type === 'status' && (
        <View style={[tabStyles.clockCircle, { borderColor: color }]}>
          <View style={[tabStyles.clockNeedleV, { backgroundColor: color }]} />
          <View style={[tabStyles.clockNeedleH, { backgroundColor: color }]} />
        </View>
      )}

      {type === 'kds' && (
        <View style={tabStyles.kdsWrap}>
          <View style={[tabStyles.kdsScreen, { borderColor: color }]}>
            <View style={[tabStyles.kdsCol, { backgroundColor: color }]} />
            <View style={[tabStyles.kdsCol, { backgroundColor: color }]} />
          </View>
          <View style={[tabStyles.kdsStand, { backgroundColor: color }]} />
        </View>
      )}

      {type === 'prep' && (
        <View style={tabStyles.prepWrap}>
          <View style={[tabStyles.prepBar1, { backgroundColor: color }]} />
          <View style={[tabStyles.prepBar2, { backgroundColor: color }]} />
          <View style={[tabStyles.prepBar3, { backgroundColor: color }]} />
        </View>
      )}

      {type === 'archive' && (
        <View style={[tabStyles.archiveBox, { borderColor: color }]}>
          <View style={[tabStyles.archiveRim, { backgroundColor: color }]} />
          <View style={[tabStyles.archiveHandle, { borderColor: color }]} />
        </View>
      )}

      {type === 'revenue' && (
        <View style={tabStyles.revenueWrap}>
          <View style={tabStyles.revenueBars}>
            <View style={[tabStyles.revenueBar1, { backgroundColor: color }]} />
            <View style={[tabStyles.revenueBar2, { backgroundColor: color }]} />
            <View style={[tabStyles.revenueBar3, { backgroundColor: color }]} />
          </View>
          <View style={[tabStyles.revenueBase, { backgroundColor: color }]} />
        </View>
      )}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  iconContainer: {
    width: 28,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainerTablet: {
    width: 32,
    height: 26,
  },

  // Order pad icon
  orderPad: {
    width: 17,
    height: 21,
    borderRadius: 3,
    borderWidth: 1.8,
    alignItems: 'center',
    paddingTop: 3,
  },
  orderClip: {
    width: 7,
    height: 2,
    borderRadius: 1,
    position: 'absolute',
    top: -1,
  },
  orderLine1: {
    width: 9,
    height: 1.6,
    borderRadius: 0.8,
    marginBottom: 3,
  },
  orderLine2: {
    width: 6,
    height: 1.6,
    borderRadius: 0.8,
  },

  // Status (Clock) icon
  clockCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockNeedleV: {
    width: 1.8,
    height: 5,
    borderRadius: 0.9,
    position: 'absolute',
    top: 3.5,
  },
  clockNeedleH: {
    width: 4,
    height: 1.8,
    borderRadius: 0.9,
    position: 'absolute',
    left: 8.5,
  },

  // KDS (Monitor) icon
  kdsWrap: {
    alignItems: 'center',
  },
  kdsScreen: {
    width: 22,
    height: 15,
    borderRadius: 3,
    borderWidth: 1.8,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    padding: 1.5,
  },
  kdsCol: {
    width: 6,
    height: 7,
    borderRadius: 1,
    opacity: 0.65,
  },
  kdsStand: {
    width: 7,
    height: 2,
    borderRadius: 1,
    marginTop: 1,
  },

  // Prep (Stacked pans) icon
  prepWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 20,
  },
  prepBar1: {
    width: 13,
    height: 2.4,
    borderRadius: 1.2,
    opacity: 0.5,
    marginBottom: 2.5,
  },
  prepBar2: {
    width: 17,
    height: 2.4,
    borderRadius: 1.2,
    opacity: 0.75,
    marginBottom: 2.5,
  },
  prepBar3: {
    width: 21,
    height: 2.4,
    borderRadius: 1.2,
  },

  // Archive icon
  archiveBox: {
    width: 20,
    height: 17,
    borderRadius: 3,
    borderWidth: 1.8,
    alignItems: 'center',
    paddingTop: 2,
  },
  archiveRim: {
    width: 14,
    height: 1.5,
    borderRadius: 0.75,
    opacity: 0.5,
    marginBottom: 3,
  },
  archiveHandle: {
    width: 7,
    height: 3,
    borderRadius: 1.5,
    borderWidth: 1.2,
  },

  // Revenue (Financial graph) icon
  revenueWrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 21,
    width: 22,
  },
  revenueBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2.5,
    marginBottom: 1.5,
  },
  revenueBar1: {
    width: 3.5,
    height: 7,
    borderRadius: 1,
    opacity: 0.6,
  },
  revenueBar2: {
    width: 3.5,
    height: 11,
    borderRadius: 1,
    opacity: 0.85,
  },
  revenueBar3: {
    width: 3.5,
    height: 16,
    borderRadius: 1,
  },
  revenueBase: {
    width: 19,
    height: 1.6,
    borderRadius: 0.8,
    opacity: 0.5,
  },
});

/**
 * Waiter Terminal Navigator:
 * Exclusively focused on server actions (taking orders, cart, order status).
 */
function WaiterNavigator({ isTablet, tabBarHeight }: { isTablet: boolean; tabBarHeight: number }) {
  return (
    <Tab.Navigator
      detachInactiveScreens={true}
      screenListeners={{
        tabPress: () => {
          hapticSelection();
        },
      }}
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
        animation: 'none',
        tabBarStyle: {
          backgroundColor: Colors.bg,
          borderTopColor: '#1A1A1D',
          borderTopWidth: 1,
          paddingBottom: isTablet ? 14 : 10,
          paddingTop: isTablet ? 12 : 8,
          height: tabBarHeight,
        },
        tabBarActiveTintColor: Colors.gold,
        tabBarInactiveTintColor: '#71717A',
        tabBarLabelStyle: {
          fontSize: isTablet ? 12 : 10,
          fontWeight: FontWeights.bold,
          marginTop: 3,
          letterSpacing: 0.2,
        },
      }}
    >
      <Tab.Screen
        name="Menu"
        component={POSScreen}
        options={{
          tabBarLabel: 'Take Order',
          tabBarIcon: ({ focused }) => <TabIcon type="order" focused={focused} isTablet={isTablet} />,
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarLabel: 'Order Status',
          tabBarIcon: ({ focused }) => <TabIcon type="status" focused={focused} isTablet={isTablet} />,
        }}
      />
    </Tab.Navigator>
  );
}

/**
 * Chef Kitchen Suite Navigator:
 * Exclusively focused on kitchen operations (Live KDS, Batch Prep, Kitchen Archive).
 */
function ChefNavigator({ isTablet, tabBarHeight }: { isTablet: boolean; tabBarHeight: number }) {
  return (
    <Tab.Navigator
      detachInactiveScreens={true}
      screenListeners={{
        tabPress: () => {
          hapticSelection();
        },
      }}
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
        animation: 'none',
        tabBarStyle: {
          backgroundColor: Colors.bg,
          borderTopColor: '#1A1A1D',
          borderTopWidth: 1,
          paddingBottom: isTablet ? 14 : 10,
          paddingTop: isTablet ? 12 : 8,
          height: tabBarHeight,
        },
        tabBarActiveTintColor: Colors.gold,
        tabBarInactiveTintColor: '#71717A',
        tabBarLabelStyle: {
          fontSize: isTablet ? 12 : 10,
          fontWeight: FontWeights.bold,
          marginTop: 3,
          letterSpacing: 0.2,
        },
      }}
    >
      <Tab.Screen
        name="ChefLive"
        component={ChefLiveScreen}
        options={{
          tabBarLabel: 'Live KDS',
          tabBarIcon: ({ focused }) => <TabIcon type="kds" focused={focused} isTablet={isTablet} />,
        }}
      />
      <Tab.Screen
        name="ChefPrep"
        component={ChefPrepSummaryScreen}
        options={{
          tabBarLabel: 'Batch Prep',
          tabBarIcon: ({ focused }) => <TabIcon type="prep" focused={focused} isTablet={isTablet} />,
        }}
      />
      <Tab.Screen
        name="ChefHistory"
        component={ChefHistoryScreen}
        options={{
          tabBarLabel: 'Kitchen Archive',
          tabBarIcon: ({ focused }) => <TabIcon type="archive" focused={focused} isTablet={isTablet} />,
        }}
      />
    </Tab.Navigator>
  );
}

/**
 * Admin Executive Suite Navigator:
 * Full management oversight: Business Analytics & Revenue, Order Taking, Order Status, and Kitchen Monitor.
 */
function AdminNavigator({ isTablet, tabBarHeight }: { isTablet: boolean; tabBarHeight: number }) {
  return (
    <Tab.Navigator
      detachInactiveScreens={true}
      screenListeners={{
        tabPress: () => {
          hapticSelection();
        },
      }}
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
        animation: 'none',
        tabBarStyle: {
          backgroundColor: Colors.bg,
          borderTopColor: '#1A1A1D',
          borderTopWidth: 1,
          paddingBottom: isTablet ? 14 : 10,
          paddingTop: isTablet ? 12 : 8,
          height: tabBarHeight,
        },
        tabBarActiveTintColor: Colors.gold,
        tabBarInactiveTintColor: '#71717A',
        tabBarLabelStyle: {
          fontSize: isTablet ? 12 : 10,
          fontWeight: FontWeights.bold,
          marginTop: 3,
          letterSpacing: 0.2,
        },
      }}
    >
      <Tab.Screen
        name="AdminRevenue"
        component={AdminRevenueScreen}
        options={{
          tabBarLabel: 'Revenue',
          tabBarIcon: ({ focused }) => <TabIcon type="revenue" focused={focused} isTablet={isTablet} />,
        }}
      />
      <Tab.Screen
        name="AdminOrder"
        component={POSScreen}
        options={{
          tabBarLabel: 'Take Order',
          tabBarIcon: ({ focused }) => <TabIcon type="order" focused={focused} isTablet={isTablet} />,
        }}
      />
      <Tab.Screen
        name="AdminStatus"
        component={HistoryScreen}
        options={{
          tabBarLabel: 'Order Status',
          tabBarIcon: ({ focused }) => <TabIcon type="status" focused={focused} isTablet={isTablet} />,
        }}
      />
      <Tab.Screen
        name="AdminKitchen"
        component={ChefLiveScreen}
        options={{
          tabBarLabel: 'Kitchen KDS',
          tabBarIcon: ({ focused }) => <TabIcon type="kds" focused={focused} isTablet={isTablet} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { isAuthenticated, userRole, hasBranch } = useContext(AuthContext);
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;

  // ── Loading splash ──────────────────────────────────────────────────────────
  if (isAuthenticated === null) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashTitle}>Example Project</Text>
        <Text style={styles.splashSubtitle}>POINT OF SALE & KITCHEN SYSTEM</Text>
        <ActivityIndicator color={Colors.gold} size="large" style={{ marginTop: 24 }} />
      </View>
    );
  }

  const tabBarHeight = isTablet ? TAB_BAR_HEIGHT_TABLET : TAB_BAR_HEIGHT_PHONE;

  // ── Branch Gate → Branch Selection (first launch) ───────────────────────────
  if (!hasBranch) {
    return <BranchSelectScreen />;
  }

  return (
    <NavigationContainer>
      {!isAuthenticated ? (
        // ── PIN Login Screen ────────────────────────────────────────────────
        <LoginScreen />
      ) : (
        // ── Authenticated → Role-specific navigator ─────────────────────────
        <PosProvider>
          {userRole === 'chef' ? (
            <ChefNavigator isTablet={isTablet} tabBarHeight={tabBarHeight} />
          ) : userRole === 'admin' ? (
            <AdminNavigator isTablet={isTablet} tabBarHeight={tabBarHeight} />
          ) : (
            <WaiterNavigator isTablet={isTablet} tabBarHeight={tabBarHeight} />
          )}
        </PosProvider>
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: '#09090B', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  splashTitle: { fontSize: 32, fontWeight: FontWeights.black, color: '#FFFFFF', letterSpacing: -0.5 },
  splashSubtitle: { fontSize: 11, fontWeight: FontWeights.extrabold, color: Colors.gold, letterSpacing: 1.5, marginTop: 6, textTransform: 'uppercase' },
});