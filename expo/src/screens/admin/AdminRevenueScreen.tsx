import React, { useContext, useState, useMemo, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  RefreshControl, useWindowDimensions, Modal, Vibration, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../../context/AuthContext';
import { PosContext, Ticket } from '../../context/PosContext';
import Header from '../../components/Header';
import StatusBadge from '../../components/StatusBadge';
import UpdateBanner from '../../components/UpdateBanner';
import { useIsTablet } from '../../constants/layout';
import { Colors, Spacing, Radii, FontSizes, FontWeights } from '../../constants/theme';
import { getGlobalNetworkOrders, getBranches } from '../../services/api';

type TimeFilter = 'today' | 'week' | 'month' | 'all' | 'custom';

interface DateRange {
  startDate: string; // 'YYYY-MM-DD'
  endDate: string;   // 'YYYY-MM-DD'
}

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatPrettyDate(dateStr: string): string {
  if (!dateStr) return 'Select';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts.map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[m - 1]} ${y}`;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function AdminRevenueScreen() {
  const { lockTerminal } = useContext(AuthContext);
  const { tickets, isOffline, refreshing, onRefresh } = useContext(PosContext);

  const isTablet = useIsTablet();
  const { width } = useWindowDimensions();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

  // Enterprise Multi-Branch State
  const [networkOrders, setNetworkOrders] = useState<any[]>([]);
  const [branchesList, setBranchesList] = useState<any[]>([]);
  const [selectedBranchScope, setSelectedBranchScope] = useState<string>('ALL');
  const [loadingNetwork, setLoadingNetwork] = useState(false);

  // Custom date range state (defaults to past 7 days)
  const [customRange, setCustomRange] = useState<DateRange>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 6);
    return {
      startDate: formatDateStr(start),
      endDate: formatDateStr(end),
    };
  });

  const [showDatePickerModal, setShowDatePickerModal] = useState(false);

  // Fetch all branches and global network orders for Super Admin view
  const loadNetworkData = useCallback(async () => {
    try {
      setLoadingNetwork(true);
      const [orders, branches] = await Promise.all([
        getGlobalNetworkOrders(),
        getBranches(),
      ]);
      if (Array.isArray(orders) && orders.length > 0) {
        setNetworkOrders(orders);
      }
      if (Array.isArray(branches) && branches.length > 0) {
        setBranchesList(branches);
      }
    } catch (e) {
      console.warn('Network data fetch error in AdminRevenueScreen:', e);
    } finally {
      setLoadingNetwork(false);
    }
  }, []);

  useEffect(() => {
    loadNetworkData();
  }, [loadNetworkData]);

  // Calendar navigation within the picker modal
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth());
  const [tempStart, setTempStart] = useState<string>(customRange.startDate);
  const [tempEnd, setTempEnd] = useState<string>(customRange.endDate);

  // Open modal prefilled with active range
  const openDatePicker = () => {
    setTempStart(customRange.startDate);
    setTempEnd(customRange.endDate);
    if (customRange.startDate) {
      const [y, m] = customRange.startDate.split('-').map(Number);
      setCalendarYear(y);
      setCalendarMonth(m - 1);
    }
    setShowDatePickerModal(true);
  };

  // Convert network orders or fallback to local tickets
  const allNetworkTickets: (Ticket & { branchId?: string; branchName?: string })[] = useMemo(() => {
    if (networkOrders.length > 0) {
      return networkOrders.map((o: any) => ({
        orderId: o.order_id || o.client_order_id || '',
        table: o.table_number || 'Walk-in',
        orderType: (o.order_type || 'walk-in') as any,
        status: (o.status || 'pending') as any,
        total: Number(o.total_price ?? o.total_amount ?? 0),
        time: o.created_at || new Date().toISOString(),
        branchId: o.branch_id || 'branch-hyderabad-hq',
        branchName: o.branch_name || (o.branch_id?.includes('bodhgaya') ? 'Bodhgaya Highway Express' : 'Hyderabad Highway HQ'),
        items: (o.items || []).map((i: any) => ({
          id: i.id || i.menu_item_id || '',
          name: i.name || 'Dish',
          qty: Number(i.quantity || i.qty || 1),
          price: Number(i.price || 0),
          notes: i.notes || '',
        })),
        coverCount: 1,
        isRush: false,
        isOffline: false,
      }));
    }
    // Fallback to local tickets
    return tickets.map(t => ({
      ...t,
      branchId: 'branch-hyderabad-hq',
      branchName: 'Hyderabad Highway HQ',
    }));
  }, [networkOrders, tickets]);

  // Filter tickets by selected timeframe across ALL branches
  const dateFilteredNetworkTickets = useMemo(() => {
    if (timeFilter === 'all') return allNetworkTickets;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return allNetworkTickets.filter(t => {
      const ticketTime = new Date(t.time).getTime();
      if (timeFilter === 'today') return ticketTime >= startOfToday;
      if (timeFilter === 'week') return ticketTime >= startOfWeek;
      if (timeFilter === 'month') return ticketTime >= startOfMonth;
      if (timeFilter === 'custom') {
        if (!customRange.startDate || !customRange.endDate) return true;
        const ticketDateStr = formatDateStr(new Date(t.time));
        return ticketDateStr >= customRange.startDate && ticketDateStr <= customRange.endDate;
      }
      return true;
    });
  }, [allNetworkTickets, timeFilter, customRange]);

  // Compute Enterprise Telemetry (Total Combined Revenue + Owner's Headquarters Revenue)
  const enterpriseTelemetry = useMemo(() => {
    const valid = dateFilteredNetworkTickets.filter(t => t.status !== 'cancelled');
    const combinedRevenue = valid.reduce((sum, t) => sum + t.total, 0);
    const combinedOrders = valid.length;

    // Filter Owner's Headquarters (branch-hyderabad-hq)
    const hqTickets = valid.filter(t => (t.branchId || 'branch-hyderabad-hq') === 'branch-hyderabad-hq');
    const hqRevenue = hqTickets.reduce((sum, t) => sum + t.total, 0);
    const hqOrders = hqTickets.length;
    const hqShare = combinedRevenue > 0 ? Math.round((hqRevenue / combinedRevenue) * 100) : 0;

    // Franchise Total
    const franchiseRevenue = combinedRevenue - hqRevenue;
    const franchiseOrders = combinedOrders - hqOrders;

    // Per-Branch Breakdown
    const branchMap: Record<string, { id: string; name: string; code: string; revenue: number; orders: number }> = {};
    const knownBranches = branchesList.length > 0 ? branchesList : [
      { id: 'branch-hyderabad-hq', name: 'Hyderabad Highway HQ', code: 'HYD-01' },
      { id: 'branch-bodhgaya-highway-express-9cba', name: 'Bodhgaya Highway Express', code: 'BDG-02' },
      { id: 'branch-example-jubliee-hills-4795', name: 'example-Jubliee Hills', code: 'FR-03' },
    ];

    knownBranches.forEach(b => {
      branchMap[b.id] = {
        id: b.id,
        name: b.name,
        code: b.code || '',
        revenue: 0,
        orders: 0,
      };
    });

    valid.forEach(t => {
      const bId = t.branchId || 'branch-hyderabad-hq';
      if (!branchMap[bId]) {
        branchMap[bId] = {
          id: bId,
          name: t.branchName || bId,
          code: '',
          revenue: 0,
          orders: 0,
        };
      }
      branchMap[bId].revenue += t.total;
      branchMap[bId].orders += 1;
    });

    const branchBreakdown = Object.values(branchMap).sort((a, b) => b.revenue - a.revenue);

    return {
      combinedRevenue,
      combinedOrders,
      hqRevenue,
      hqOrders,
      hqShare,
      franchiseRevenue,
      franchiseOrders,
      branchBreakdown,
    };
  }, [dateFilteredNetworkTickets, branchesList]);

  // Scoped tickets based on active branch selection
  const filteredTickets = useMemo(() => {
    if (selectedBranchScope === 'ALL') {
      return dateFilteredNetworkTickets;
    }
    return dateFilteredNetworkTickets.filter(t => (t.branchId || 'branch-hyderabad-hq') === selectedBranchScope);
  }, [dateFilteredNetworkTickets, selectedBranchScope]);

  // Financial & Operational Metrics
  const metrics = useMemo(() => {
    const validTickets = filteredTickets.filter(t => t.status !== 'cancelled');
    const totalOrders = validTickets.length;
    const grossRevenue = validTickets.reduce((sum, t) => sum + t.total, 0);
    const avgOrderValue = totalOrders > 0 ? Math.round(grossRevenue / totalOrders) : 0;

    const completedCount = validTickets.filter(t => t.status === 'completed').length;
    const pendingCount = validTickets.filter(t => t.status === 'pending').length;
    const cookingCount = validTickets.filter(t => t.status === 'in_progress').length;
    const cancelledCount = filteredTickets.filter(t => t.status === 'cancelled').length;

    // Breakdown by Order Type
    const typeBreakdown: Record<string, { count: number; revenue: number }> = {
      'Walk-in': { count: 0, revenue: 0 },
      'Parcel': { count: 0, revenue: 0 },
      'Catering Service': { count: 0, revenue: 0 },
    };

    validTickets.forEach(t => {
      let key = 'Walk-in';
      if (t.orderType === 'parcel' || t.table.toLowerCase().includes('parcel')) key = 'Parcel';
      else if (t.orderType === 'catering' || t.table.toLowerCase().includes('catering')) key = 'Catering Service';

      if (!typeBreakdown[key]) typeBreakdown[key] = { count: 0, revenue: 0 };
      typeBreakdown[key].count += 1;
      typeBreakdown[key].revenue += t.total;
    });

    // Top Selling Dishes
    const dishMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    validTickets.forEach(t => {
      t.items.forEach(item => {
        if (!dishMap[item.name]) {
          dishMap[item.name] = { name: item.name, qty: 0, revenue: 0 };
        }
        dishMap[item.name].qty += item.qty;
        dishMap[item.name].revenue += item.price * item.qty;
      });
    });

    const topDishes = Object.values(dishMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      totalOrders,
      grossRevenue,
      avgOrderValue,
      completedCount,
      pendingCount,
      cookingCount,
      cancelledCount,
      typeBreakdown,
      topDishes,
    };
  }, [filteredTickets]);

  // Calendar helper computations
  const firstDayOfWeek = new Date(calendarYear, calendarMonth, 1).getDay();
  const totalDaysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();

  const dayCells = useMemo(() => {
    const cells: Array<{ empty: boolean; day?: number; dateStr?: string; key: string }> = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({ empty: true, key: `empty-${i}` });
    }
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ empty: false, day: d, dateStr, key: dateStr });
    }
    return cells;
  }, [calendarYear, calendarMonth, firstDayOfWeek, totalDaysInMonth]);

  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(y => y - 1);
    } else {
      setCalendarMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(y => y + 1);
    } else {
      setCalendarMonth(m => m + 1);
    }
  };

  const handleDaySelect = (dateStr: string) => {
    Vibration.vibrate(25);
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(dateStr);
      setTempEnd('');
    } else {
      if (dateStr < tempStart) {
        setTempEnd(tempStart);
        setTempStart(dateStr);
      } else {
        setTempEnd(dateStr);
      }
    }
  };

  const applyPreset = (daysBack: number) => {
    Vibration.vibrate(30);
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - daysBack);
    const sStr = formatDateStr(start);
    const eStr = formatDateStr(end);
    setTempStart(sStr);
    setTempEnd(eStr);
    setCalendarYear(end.getFullYear());
    setCalendarMonth(end.getMonth());
  };

  const applyThisMonth = () => {
    Vibration.vibrate(30);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setTempStart(formatDateStr(start));
    setTempEnd(formatDateStr(end));
    setCalendarYear(now.getFullYear());
    setCalendarMonth(now.getMonth());
  };

  const applyLastMonth = () => {
    Vibration.vibrate(30);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    setTempStart(formatDateStr(start));
    setTempEnd(formatDateStr(end));
    setCalendarYear(start.getFullYear());
    setCalendarMonth(start.getMonth());
  };

  const confirmCustomRange = () => {
    Vibration.vibrate([0, 40, 60, 80]);
    const finalStart = tempStart || tempEnd || formatDateStr(new Date());
    const finalEnd = tempEnd || tempStart || formatDateStr(new Date());
    const validStart = finalStart <= finalEnd ? finalStart : finalEnd;
    const validEnd = finalStart <= finalEnd ? finalEnd : finalStart;

    setCustomRange({ startDate: validStart, endDate: validEnd });
    setTimeFilter('custom');
    setShowDatePickerModal(false);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <Header
        subtitle="ADMIN EXECUTIVE REVENUE SUITE"
        isOffline={isOffline}
        onLock={lockTerminal}
      />

      {/* Time Range Filter Bar */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {[
            { key: 'today', label: 'Today' },
            { key: 'week', label: 'This Week' },
            { key: 'month', label: 'This Month' },
            { key: 'all', label: 'All Time' },
            { key: 'custom', label: 'Custom Range' },
          ].map(filter => {
            const active = timeFilter === filter.key;
            return (
              <TouchableOpacity
                key={filter.key}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => {
                  if (filter.key === 'custom') {
                    openDatePicker();
                  } else {
                    setTimeFilter(filter.key as TimeFilter);
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {filter.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Custom Range Active Banner */}
      {timeFilter === 'custom' && (
        <View style={styles.customBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.customBannerLabel}>ACTIVE CUSTOM DATE WINDOW</Text>
            <Text style={styles.customBannerDates}>
              {formatPrettyDate(customRange.startDate)} ⟶ {formatPrettyDate(customRange.endDate)}
            </Text>
          </View>
          <TouchableOpacity style={styles.changeRangeBtn} onPress={openDatePicker} activeOpacity={0.75}>
            <Text style={styles.changeRangeText}>CHANGE DATES</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[styles.container, isTablet && styles.containerTablet]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || loadingNetwork}
            onRefresh={async () => {
              await Promise.all([onRefresh(), loadNetworkData()]);
            }}
            tintColor={Colors.gold}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Live Over-The-Air Update Manager */}
        <UpdateBanner />

        {/* ── SUPER ADMIN ENTERPRISE REVENUE TELEMETRY ── */}
        <View style={styles.enterpriseSection}>
          <View style={styles.enterpriseHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <View style={styles.enterpriseShieldDot} />
              <Text style={styles.enterpriseTitle}>ENTERPRISE REVENUE MATRIX</Text>
            </View>
            <View style={styles.livePulseBadge}>
              <View style={styles.livePulseDot} />
              <Text style={styles.livePulseText}>LIVE NETWORK</Text>
            </View>
          </View>

          {/* Two Prominent Hero Cards: Total Combined vs Headquarters */}
          <View style={[styles.enterpriseHeroRow, isTablet && { flexWrap: 'nowrap' }]}>
            {/* 1. Combined All Branches Revenue */}
            <TouchableOpacity
              style={[styles.heroCard, selectedBranchScope === 'ALL' && styles.heroCardActiveCombined]}
              onPress={() => {
                Vibration.vibrate(20);
                setSelectedBranchScope('ALL');
              }}
              activeOpacity={0.85}
            >
              <View style={styles.heroCardHeader}>
                <Text style={styles.heroTagCombined}>ALL BRANCHES</Text>
                {selectedBranchScope === 'ALL' && (
                  <View style={styles.activePillBadge}>
                    <Text style={styles.activePillText}>ACTIVE</Text>
                  </View>
                )}
              </View>
              <Text style={styles.heroCombinedValue}>₹{enterpriseTelemetry.combinedRevenue.toLocaleString()}</Text>
              <Text style={styles.heroSubText}>
                Total Network Revenue • {enterpriseTelemetry.combinedOrders} Orders
              </Text>
            </TouchableOpacity>

            {/* 2. Owner's Headquarters Revenue (Hyderabad Highway HQ) */}
            <TouchableOpacity
              style={[
                styles.heroCard,
                selectedBranchScope === 'branch-hyderabad-hq' && styles.heroCardActiveHq,
              ]}
              onPress={() => {
                Vibration.vibrate(20);
                setSelectedBranchScope('branch-hyderabad-hq');
              }}
              activeOpacity={0.85}
            >
              <View style={styles.heroCardHeader}>
                <Text style={styles.heroTagHq}>HEADQUARTERS</Text>
                {selectedBranchScope === 'branch-hyderabad-hq' && (
                  <View style={styles.activePillBadgeHq}>
                    <Text style={styles.activePillTextHq}>ACTIVE</Text>
                  </View>
                )}
              </View>
              <Text style={styles.heroHqValue}>₹{enterpriseTelemetry.hqRevenue.toLocaleString()}</Text>
              <Text style={styles.heroSubText}>
                Hyderabad Highway HQ • {enterpriseTelemetry.hqShare}% share
              </Text>
            </TouchableOpacity>
          </View>

          {/* Branch Filter Switcher Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.branchScopeScroll}
          >
            <TouchableOpacity
              style={[
                styles.branchScopeChip,
                selectedBranchScope === 'ALL' && styles.branchScopeChipActive,
              ]}
              onPress={() => {
                Vibration.vibrate(20);
                setSelectedBranchScope('ALL');
              }}
            >
              <Text
                style={[
                  styles.branchScopeText,
                  selectedBranchScope === 'ALL' && styles.branchScopeTextActive,
                ]}
              >
                All Branches (₹{enterpriseTelemetry.combinedRevenue.toLocaleString()})
              </Text>
            </TouchableOpacity>

            {enterpriseTelemetry.branchBreakdown.map(b => {
              const isHq = b.id === 'branch-hyderabad-hq' || b.code === 'HYD-01';
              const isSelected = selectedBranchScope === b.id;
              return (
                <TouchableOpacity
                  key={b.id}
                  style={[
                    styles.branchScopeChip,
                    isSelected && (isHq ? styles.branchScopeChipActiveHq : styles.branchScopeChipActive),
                  ]}
                  onPress={() => {
                    Vibration.vibrate(20);
                    setSelectedBranchScope(b.id);
                  }}
                >
                  <Text
                    style={[
                      styles.branchScopeText,
                      isSelected && styles.branchScopeTextActive,
                    ]}
                  >
                    {isHq ? 'HQ • ' : 'FRANCHISE • '}
                    {b.name.split(' ')[0]} (₹{b.revenue.toLocaleString()})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Core KPI Metrics Grid */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            EXECUTIVE SUMMARY {selectedBranchScope === 'ALL' ? '(ALL BRANCHES)' : `(${branchesList.find(b => b.id === selectedBranchScope)?.name?.toUpperCase() || selectedBranchScope})`}
          </Text>
          {selectedBranchScope !== 'ALL' && (
            <TouchableOpacity onPress={() => setSelectedBranchScope('ALL')}>
              <Text style={styles.clearScopeText}>Reset to All Branches</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.kpiRow, isTablet && styles.kpiRowTablet]}>
          {/* Total Revenue */}
          <View style={[styles.kpiCard, styles.kpiCardHighlight]}>
            <Text style={styles.kpiLabel}>TOTAL REVENUE</Text>
            <Text style={styles.kpiValueGold}>₹{metrics.grossRevenue.toLocaleString()}</Text>
            <Text style={styles.kpiSub}>Gross sales volume</Text>
          </View>

          {/* Total Orders Count */}
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>TOTAL ORDERS</Text>
            <Text style={styles.kpiValue}>{metrics.totalOrders}</Text>
            <Text style={styles.kpiSub}>Active & fulfilled</Text>
          </View>

          {/* Average Order Value */}
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>AVG ORDER VALUE (AOV)</Text>
            <Text style={styles.kpiValue}>₹{metrics.avgOrderValue}</Text>
            <Text style={styles.kpiSub}>Per order average</Text>
          </View>

          {/* Completed Orders */}
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>FULFILLED ORDERS</Text>
            <Text style={[styles.kpiValue, { color: '#10B981' }]}>{metrics.completedCount}</Text>
            <Text style={styles.kpiSub}>
              {metrics.cancelledCount > 0 ? `${metrics.cancelledCount} cancelled` : '100% fulfillment'}
            </Text>
          </View>
        </View>

        {/* Order Type Distribution: Walk-in vs Parcel vs Catering */}
        <Text style={styles.sectionTitle}>REVENUE BY ORDER TYPE</Text>
        <View style={[styles.typeRow, isTablet && styles.typeRowTablet]}>
          {Object.entries(metrics.typeBreakdown).map(([type, data]) => {
            const share = metrics.grossRevenue > 0
              ? Math.round((data.revenue / metrics.grossRevenue) * 100)
              : 0;

            const isParcel = type === 'Parcel';
            const isCatering = type === 'Catering Service';

            return (
              <View key={type} style={styles.typeCard}>
                <View style={styles.typeCardHeader}>
                  <Text style={[
                    styles.typeName,
                    isParcel && styles.typeNameParcel,
                    isCatering && styles.typeNameCatering,
                  ]}>
                    {type.toUpperCase()}
                  </Text>
                  <View style={styles.shareBadge}>
                    <Text style={styles.shareText}>{share}%</Text>
                  </View>
                </View>

                <Text style={styles.typeRevenue}>₹{data.revenue.toLocaleString()}</Text>
                <Text style={styles.typeCount}>{data.count} orders</Text>
              </View>
            );
          })}
        </View>

        {/* Top Selling Dishes */}
        {metrics.topDishes.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>TOP SELLING DISHES</Text>
            <View style={styles.tableCard}>
              {metrics.topDishes.map((dish, idx) => (
                <View key={dish.name} style={[styles.dishRow, idx > 0 && styles.dishRowBorder]}>
                  <View style={styles.dishRank}>
                    <Text style={styles.rankText}>#{idx + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dishName}>{dish.name}</Text>
                    <Text style={styles.dishQty}>{dish.qty} portions sold</Text>
                  </View>
                  <Text style={styles.dishRevenue}>₹{dish.revenue.toLocaleString()}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Recent Transaction Audit Log (Bulletproof 3-Row Non-Colliding Layout) */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            RECENT ORDERS AUDIT LOG ({filteredTickets.length} ORDERS)
          </Text>
        </View>
        <View style={styles.auditContainer}>
          {filteredTickets.length === 0 ? (
            <View style={styles.emptyAudit}>
              <Text style={styles.emptyAuditText}>No orders recorded in this date range.</Text>
            </View>
          ) : (
            filteredTickets.slice(0, 30).map(ticket => {
              const isCancelled = ticket.status === 'cancelled';
              const ticketDate = new Date(ticket.time);
              const formattedDate = formatDateStr(ticketDate);
              const formattedTime = ticketDate.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
              const rawId = ticket.orderId || '';
              const compactId = rawId.length > 8
                ? `#${rawId.replace(/^#/, '').slice(-6).toUpperCase()}`
                : (rawId.startsWith('#') ? rawId : `#${rawId}`);

              const isHqBranch = (ticket.branchId || 'branch-hyderabad-hq') === 'branch-hyderabad-hq';

              return (
                <View key={ticket.orderId || ticket.time} style={[styles.auditCard, isCancelled && styles.auditRowCancelled]}>
                  {/* Row 1: Left = ID Pill + Table Pill + Branch Badge; Right = Total Amount */}
                  <View style={styles.auditRowTop}>
                    <View style={styles.auditRowLeft}>
                      <View style={styles.auditIdPill}>
                        <Text style={styles.auditIdText}>{compactId}</Text>
                      </View>
                      <View style={styles.auditTypePill}>
                        <Text style={styles.auditTypeText} numberOfLines={1}>
                          {ticket.table}
                        </Text>
                      </View>
                      {ticket.branchName && (
                        <View style={[styles.auditBranchPill, isHqBranch && styles.auditBranchPillHq]}>
                          <Text style={[styles.auditBranchText, isHqBranch && styles.auditBranchTextHq]} numberOfLines={1}>
                            {isHqBranch ? 'HYD-HQ' : 'BRANCH'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.auditTotal}>₹{ticket.total.toLocaleString()}</Text>
                  </View>

                  {/* Row 2: Dish Items Summary */}
                  <Text style={styles.auditItems} numberOfLines={1}>
                    {ticket.items.map(i => `${i.qty}× ${i.name}`).join(', ')}
                  </Text>

                  {/* Row 3: Timestamp on Left, Status Badge on Right */}
                  <View style={styles.auditRowBottom}>
                    <Text style={styles.auditTime}>{formattedDate} • {formattedTime}</Text>
                    <StatusBadge status={ticket.status} />
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* ── Custom Date Range Picker Modal ── */}
      <Modal
        visible={showDatePickerModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowDatePickerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowDatePickerModal(false)}
          />
          <View style={[styles.modalContent, isTablet && styles.modalContentTablet]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>CUSTOM DATE RANGE</Text>
                <Text style={styles.modalSubtitle}>Filter revenue & analytics by dates</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowDatePickerModal(false)}
                style={styles.modalCloseBtn}
                activeOpacity={0.75}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Quick Presets */}
            <View style={styles.presetRow}>
              <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset(1)}>
                <Text style={styles.presetChipText}>Yesterday</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset(6)}>
                <Text style={styles.presetChipText}>Last 7D</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset(13)}>
                <Text style={styles.presetChipText}>Last 14D</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset(29)}>
                <Text style={styles.presetChipText}>Last 30D</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.presetChip} onPress={applyThisMonth}>
                <Text style={styles.presetChipText}>This Month</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.presetChip} onPress={applyLastMonth}>
                <Text style={styles.presetChipText}>Last Month</Text>
              </TouchableOpacity>
            </View>

            {/* Month / Year Navigator */}
            <View style={styles.monthNav}>
              <TouchableOpacity onPress={handlePrevMonth} style={styles.monthNavBtn} activeOpacity={0.7}>
                <Text style={styles.monthNavBtnText}>‹ PREV</Text>
              </TouchableOpacity>
              <Text style={styles.monthNavTitle}>
                {MONTH_NAMES[calendarMonth]} {calendarYear}
              </Text>
              <TouchableOpacity onPress={handleNextMonth} style={styles.monthNavBtn} activeOpacity={0.7}>
                <Text style={styles.monthNavBtnText}>NEXT ›</Text>
              </TouchableOpacity>
            </View>

            {/* Days of Week Header */}
            <View style={styles.weekDaysRow}>
              {DAY_LABELS.map((d, i) => (
                <Text key={i} style={styles.weekDayLabel}>{d}</Text>
              ))}
            </View>

            {/* Interactive Calendar Days Grid */}
            <View style={styles.calendarGrid}>
              {dayCells.map(cell => {
                if (cell.empty || !cell.dateStr) {
                  return <View key={cell.key} style={styles.dayCellEmpty} />;
                }

                const isStart = cell.dateStr === tempStart;
                const isEnd = cell.dateStr === tempEnd;
                const inRange =
                  tempStart &&
                  tempEnd &&
                  cell.dateStr > (tempStart < tempEnd ? tempStart : tempEnd) &&
                  cell.dateStr < (tempStart < tempEnd ? tempEnd : tempStart);

                return (
                  <TouchableOpacity
                    key={cell.key}
                    style={[
                      styles.dayCell,
                      inRange && styles.dayCellInRange,
                      (isStart || isEnd) && styles.dayCellSelected,
                    ]}
                    onPress={() => cell.dateStr && handleDaySelect(cell.dateStr)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dayCellText,
                        inRange && styles.dayCellTextInRange,
                        (isStart || isEnd) && styles.dayCellTextSelected,
                      ]}
                    >
                      {cell.day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Range Preview Readout */}
            <View style={styles.readoutCard}>
              <View style={styles.readoutItem}>
                <Text style={styles.readoutLabel}>FROM</Text>
                <Text style={styles.readoutValue}>{formatPrettyDate(tempStart)}</Text>
              </View>
              <Text style={styles.readoutArrow}>⟶</Text>
              <View style={styles.readoutItem}>
                <Text style={styles.readoutLabel}>TO</Text>
                <Text style={styles.readoutValue}>{formatPrettyDate(tempEnd || tempStart)}</Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowDatePickerModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalApplyBtn}
                onPress={confirmCustomRange}
                activeOpacity={0.85}
              >
                <Text style={styles.modalApplyText}>APPLY DATE RANGE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  filterBar: {
    backgroundColor: '#0F0F12',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  filterScroll: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radii.sm,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  filterChipActive: {
    backgroundColor: 'rgba(212,175,55,0.14)',
    borderColor: Colors.gold,
  },
  filterText: {
    fontSize: FontSizes.body - 1,
    fontWeight: FontWeights.bold,
    color: Colors.textMuted,
  },
  filterTextActive: {
    color: Colors.gold,
    fontWeight: FontWeights.black,
  },

  customBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,175,55,0.25)',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 8,
  },
  customBannerLabel: {
    fontSize: 9,
    fontWeight: FontWeights.black,
    color: Colors.gold,
    letterSpacing: 0.8,
  },
  customBannerDates: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.extrabold,
    color: '#FFF',
    marginTop: 2,
  },
  changeRangeBtn: {
    backgroundColor: '#1C1C22',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.4)',
  },
  changeRangeText: {
    color: Colors.gold,
    fontSize: 10,
    fontWeight: FontWeights.black,
    letterSpacing: 0.5,
  },

  container: { padding: Spacing.md, paddingBottom: 60 },
  containerTablet: { padding: Spacing.lg, paddingBottom: 80 },

  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.black,
    color: Colors.gold,
    letterSpacing: 1.2,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm + 2,
  },

  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiRowTablet: { flexWrap: 'nowrap' },
  kpiCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: '#121215',
    borderRadius: Radii.card,
    padding: Spacing.lg - 2,
    borderWidth: 1.5,
    borderColor: '#24242A',
  },
  kpiCardHighlight: {
    borderColor: 'rgba(212,175,55,0.35)',
    backgroundColor: '#14130F',
  },
  kpiLabel: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.black,
    color: Colors.textDim,
    letterSpacing: 0.8,
  },
  kpiValue: {
    fontSize: FontSizes.hero,
    fontWeight: FontWeights.black,
    color: Colors.textPrimary,
    marginVertical: 4,
  },
  kpiValueGold: {
    fontSize: FontSizes.display,
    fontWeight: FontWeights.black,
    color: Colors.gold,
    marginVertical: 4,
  },
  kpiSub: {
    fontSize: FontSizes.sm,
    color: Colors.textMuted,
    fontWeight: FontWeights.semibold,
  },

  typeRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  typeRowTablet: { flexWrap: 'nowrap' },
  typeCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#121215',
    borderRadius: Radii.card,
    padding: Spacing.md + 2,
    borderWidth: 1.5,
    borderColor: '#24242A',
  },
  typeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeName: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.black,
    color: Colors.gold,
    letterSpacing: 0.5,
  },
  typeNameParcel: { color: '#FBBF24' },
  typeNameCatering: { color: '#C084FC' },
  shareBadge: {
    backgroundColor: '#1E1E22',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  shareText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeights.black,
  },
  typeRevenue: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.black,
    color: Colors.textPrimary,
  },
  typeCount: {
    fontSize: FontSizes.sm,
    color: Colors.textDim,
    marginTop: 2,
    fontWeight: FontWeights.semibold,
  },

  tableCard: {
    backgroundColor: '#121215',
    borderRadius: Radii.card,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: '#24242A',
  },
  dishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    gap: 12,
  },
  dishRowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#1E1E24',
  },
  dishRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1A1A20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.black,
    color: Colors.gold,
  },
  dishName: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
    color: Colors.textPrimary,
  },
  dishQty: {
    fontSize: FontSizes.sm,
    color: Colors.textDim,
    marginTop: 1,
  },
  dishRevenue: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.black,
    color: Colors.gold,
  },

  auditContainer: { gap: 8 },
  emptyAudit: {
    padding: Spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#121215',
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#222228',
  },
  emptyAuditText: {
    color: Colors.textDim,
    fontSize: FontSizes.body,
    fontWeight: FontWeights.semibold,
  },
  // ── Enterprise Multi-Branch Matrix Styles ──
  enterpriseSection: {
    backgroundColor: '#0E0E12',
    borderRadius: Radii.card,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: '#262218',
    marginBottom: Spacing.sm,
  },
  enterpriseHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md - 2,
  },
  enterpriseShieldDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.gold,
  },
  enterpriseTitle: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.black,
    color: Colors.gold,
    letterSpacing: 1,
  },
  livePulseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16,185,129,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.25)',
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  livePulseText: {
    fontSize: 9,
    fontWeight: FontWeights.black,
    color: '#10B981',
    letterSpacing: 0.5,
  },
  enterpriseHeroRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: Spacing.md - 2,
  },
  heroCard: {
    flex: 1,
    backgroundColor: '#141419',
    borderRadius: Radii.md,
    padding: Spacing.md - 2,
    borderWidth: 1.5,
    borderColor: '#24242C',
  },
  heroCardActiveCombined: {
    borderColor: Colors.gold,
    backgroundColor: '#1C1912',
  },
  heroCardActiveHq: {
    borderColor: '#10B981',
    backgroundColor: '#111C16',
  },
  heroCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  heroTagCombined: {
    fontSize: 10,
    fontWeight: FontWeights.black,
    color: Colors.gold,
    letterSpacing: 0.8,
  },
  heroTagHq: {
    fontSize: 10,
    fontWeight: FontWeights.black,
    color: '#34D399',
    letterSpacing: 0.8,
  },
  activePillBadge: {
    backgroundColor: Colors.gold,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  activePillText: {
    fontSize: 8,
    fontWeight: FontWeights.black,
    color: '#000',
  },
  activePillBadgeHq: {
    backgroundColor: '#34D399',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  activePillTextHq: {
    fontSize: 8,
    fontWeight: FontWeights.black,
    color: '#000',
  },
  heroCombinedValue: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.black,
    color: Colors.gold,
    marginVertical: 2,
  },
  heroHqValue: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.black,
    color: '#34D399',
    marginVertical: 2,
  },
  heroSubText: {
    fontSize: 10,
    color: Colors.textDim,
    fontWeight: FontWeights.semibold,
  },
  branchScopeScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  branchScopeChip: {
    backgroundColor: '#181820',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: '#2A2A38',
  },
  branchScopeChipActive: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
  branchScopeChipActiveHq: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  branchScopeText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold,
    color: Colors.textSecondary,
  },
  branchScopeTextActive: {
    color: '#000',
    fontWeight: FontWeights.black,
  },
  clearScopeText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold,
    color: Colors.gold,
  },

  // ── Bulletproof Non-Colliding Audit Cards ──
  auditCard: {
    backgroundColor: '#121216',
    borderRadius: Radii.md,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: '#22222A',
    gap: 8,
  },
  auditRowCancelled: { opacity: 0.45 },
  auditRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  auditRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  auditIdPill: {
    backgroundColor: '#1B1812',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
  },
  auditIdText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.black,
    color: Colors.gold,
    letterSpacing: 0.5,
  },
  auditTypePill: {
    backgroundColor: '#1E1E26',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: '#2A2A36',
  },
  auditTypeText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold,
    color: Colors.textSecondary,
  },
  auditBranchPill: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.25)',
  },
  auditBranchText: {
    fontSize: 9,
    fontWeight: FontWeights.black,
    color: '#60A5FA',
    letterSpacing: 0.5,
  },
  auditBranchPillHq: {
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderColor: 'rgba(212,175,55,0.3)',
  },
  auditBranchTextHq: {
    color: Colors.gold,
  },
  auditTotal: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.black,
    color: Colors.gold,
    marginLeft: 8,
  },
  auditItems: {
    fontSize: FontSizes.sm,
    color: Colors.textMuted,
    fontWeight: FontWeights.semibold,
  },
  auditRowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingTop: 4,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  auditTime: {
    fontSize: FontSizes.xs,
    color: Colors.textDim,
    fontWeight: FontWeights.semibold,
  },

  // ── Modal Styles ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#121216',
    borderRadius: Radii.sheet,
    borderWidth: 1.5,
    borderColor: '#2A2A32',
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 20,
  },
  modalContentTablet: {
    maxWidth: 480,
    padding: Spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.black,
    color: Colors.gold,
    letterSpacing: 0.8,
  },
  modalSubtitle: {
    fontSize: FontSizes.xs,
    color: Colors.textDim,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E1E24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    color: Colors.textMuted,
    fontSize: 16,
    fontWeight: FontWeights.black,
  },

  // Presets
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: Spacing.md,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.sm,
    backgroundColor: '#1A1A20',
    borderWidth: 1,
    borderColor: '#272730',
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: FontWeights.bold,
    color: Colors.textSecondary,
  },

  // Month navigation
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#1E1E24',
  },
  monthNavBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.sm,
    backgroundColor: '#181820',
  },
  monthNavBtnText: {
    color: Colors.gold,
    fontSize: 11,
    fontWeight: FontWeights.black,
    letterSpacing: 0.5,
  },
  monthNavTitle: {
    fontSize: FontSizes.body,
    fontWeight: FontWeights.black,
    color: '#FFF',
    letterSpacing: 0.5,
  },

  // Week days row
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  weekDayLabel: {
    width: 38,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: FontWeights.black,
    color: Colors.textDim,
  },

  // Calendar Grid
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  dayCellEmpty: {
    width: 38,
    height: 38,
    marginVertical: 2,
  },
  dayCell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  dayCellInRange: {
    backgroundColor: 'rgba(212,175,55,0.18)',
    borderRadius: 8,
  },
  dayCellSelected: {
    backgroundColor: Colors.gold,
    borderRadius: 19,
  },
  dayCellText: {
    fontSize: 12,
    fontWeight: FontWeights.bold,
    color: Colors.textPrimary,
  },
  dayCellTextInRange: {
    color: Colors.gold,
    fontWeight: FontWeights.black,
  },
  dayCellTextSelected: {
    color: '#000',
    fontWeight: FontWeights.black,
  },

  // Readout
  readoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#18181E',
    borderRadius: Radii.md,
    padding: Spacing.sm + 2,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#262630',
  },
  readoutItem: {
    alignItems: 'center',
  },
  readoutLabel: {
    fontSize: 9,
    fontWeight: FontWeights.black,
    color: Colors.gold,
    letterSpacing: 0.8,
  },
  readoutValue: {
    fontSize: FontSizes.body,
    fontWeight: FontWeights.black,
    color: '#FFF',
    marginTop: 2,
  },
  readoutArrow: {
    fontSize: 18,
    fontWeight: FontWeights.bold,
    color: Colors.gold,
  },

  // Action buttons
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radii.md,
    backgroundColor: '#1C1C22',
    borderWidth: 1,
    borderColor: '#2A2A34',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    color: Colors.textMuted,
    fontSize: FontSizes.body,
    fontWeight: FontWeights.black,
    letterSpacing: 0.5,
  },
  modalApplyBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: Radii.md,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  modalApplyText: {
    color: '#000',
    fontSize: FontSizes.body,
    fontWeight: FontWeights.black,
    letterSpacing: 0.5,
  },
});
