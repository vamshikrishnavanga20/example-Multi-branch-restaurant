import React, { useContext, useState, useMemo, useEffect } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, FlatList,
  RefreshControl, TextInput, useWindowDimensions, BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import { PosContext, Ticket } from '../context/PosContext';
import Header from '../components/Header';
import StatusBadge from '../components/StatusBadge';
import EditOrderModal from '../components/EditOrderModal';
import { useIsTablet } from '../constants/layout';
import { Colors, Spacing, Radii, FontSizes, FontWeights } from '../constants/theme';
import { hapticTap, hapticWarning } from '../utils/haptics';

// Generate a short local order ID from position
function localOrderId(_ticketTime: string, index: number): string {
  return `#${String(index + 1).padStart(3, '0')}`;
}

const FILTERS = [
  { key: 'all',       label: 'All'       },
  { key: 'pending',   label: 'Pending'   },
  { key: 'completed', label: 'Served'    },
  { key: 'cancelled', label: 'Cancelled' },
] as const;

type FilterKey = typeof FILTERS[number]['key'];

export default function HistoryScreen() {
  const { lockTerminal, userRole } = useContext(AuthContext);
  const {
    tickets, isOffline, handleCancelTicket, handleEditTicket,
    updateOrderDetails, menuItems,
    currentTime, refreshing, onRefresh,
  } = useContext(PosContext);

  const isAdmin = userRole === 'admin';
  const isTablet = useIsTablet();
  const numColumns = isTablet ? 2 : 1;

  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);

  // Close edit modal on Android back button
  useEffect(() => {
    if (!editingTicket) return;
    const onBackPress = () => {
      setEditingTicket(null);
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [editingTicket]);

  const pendingCount = useMemo(
    () => tickets.filter((t: Ticket) => t.status === 'pending').length,
    [tickets]
  );
  const servedCount = useMemo(
    () => tickets.filter((t: Ticket) => t.status === 'completed').length,
    [tickets]
  );
  const cancelledCount = useMemo(
    () => tickets.filter((t: Ticket) => t.status === 'cancelled').length,
    [tickets]
  );

  const filtersWithCounts = useMemo(() => [
    { key: 'all' as const, label: 'All', count: tickets.length },
    { key: 'pending' as const, label: 'Pending', count: pendingCount },
    { key: 'completed' as const, label: 'Served', count: servedCount },
    { key: 'cancelled' as const, label: 'Cancelled', count: cancelledCount },
  ], [tickets.length, pendingCount, servedCount, cancelledCount]);

  // Memoize filtered tickets to avoid sorting every second when currentTime ticks
  const { filtered } = useMemo(() => {
    // Sort oldest-first so order IDs are stable
    const sorted = [...tickets].sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
    );

    // Build index map for stable order IDs
    const idMap = new Map<string, string>(
      sorted.map((t, idx) => [t.time, localOrderId(t.time, idx)])
    );

    const res = sorted
      .reverse() // most recent first for display
      .filter((ticket: Ticket) => {
        const matchFilter = filter === 'all' || ticket.status === filter;
        const matchSearch =
          search.trim() === '' ||
          ticket.table.toLowerCase().includes(search.toLowerCase()) ||
          (idMap.get(ticket.time) || '').toLowerCase().includes(search.toLowerCase()) ||
          (ticket.orderId || '').toLowerCase().includes(search.toLowerCase());
        return matchFilter && matchSearch;
      });

    return { filtered: res };
  }, [tickets, filter, search]);

  const renderTicket = ({ item: ticket }: { item: Ticket }) => {
    const ticketAge = (currentTime - new Date(ticket.time).getTime()) / 1000;
    const canEdit   = isAdmin || (ticket.status === 'pending' && ticketAge < 120);
    const canDelete = isAdmin || (ticket.status === 'pending' && ticketAge < 120);
    const timeLeft  = Math.max(0, 120 - Math.floor(ticketAge));
    const orderId   = ticket.orderId || '';

    return (
      <View style={[
        styles.ticketBox,
        ticket.status === 'cancelled' && { opacity: 0.4 },
        numColumns > 1 && { flex: 1 },
      ]}>
        {/* Header */}
        <View style={styles.ticketHeader}>
          {/* Top Line: Compact Order Token + Status Badge */}
          <View style={styles.headerTopRow}>
            <View style={styles.orderIdRow}>
              <View style={styles.orderIdPill}>
                <Text style={styles.orderIdText} numberOfLines={1}>
                  {orderId.length > 8 ? `#${orderId.replace(/^#/, '').slice(-6).toUpperCase()}` : (orderId.startsWith('#') ? orderId : `#${orderId}`)}
                </Text>
              </View>
              {ticket.isOffline && (
                <View style={styles.offlineTicketBadge}>
                  <Text style={styles.offlineTicketText}>OFFLINE</Text>
                </View>
              )}
            </View>
            <StatusBadge status={ticket.status} />
          </View>

          {/* Middle Line: Table Name on Left, Price on Right */}
          <View style={styles.headerMainRow}>
            <Text style={styles.ticketTable} numberOfLines={1}>{ticket.table}</Text>
            <Text style={styles.ticketTotal}>₹{ticket.total.toLocaleString('en-IN')}</Text>
          </View>

          {/* Bottom Line: Timestamp */}
          <Text style={styles.ticketTime}>
            {new Date(ticket.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        {/* Items */}
        <View style={styles.itemsSection}>
          {ticket.items.map((item: any, idx: number) => {
            const dishNote = item.notes || (ticket as any).notes;
            return (
              <View key={idx} style={styles.itemRow}>
                <Text style={styles.itemBullet}>•</Text>
                <Text style={styles.itemText}>
                  {item.qty}× {item.name}
                  {dishNote ? (
                    <Text style={styles.itemNoteHighlight}> • NOTE: {dishNote}</Text>
                  ) : null}
                </Text>
              </View>
            );
          })}
          {/* Show order-level notes if any */}
          {(ticket as any).notes ? (
            <View style={styles.orderNoteRow}>
              <Text style={styles.orderNoteText}>NOTE: {(ticket as any).notes}</Text>
            </View>
          ) : null}
        </View>

        {/* Actions (unrestricted for Admin, 2 min window for Staff) */}
        {(canEdit || canDelete) && (
          <View style={styles.footerActions}>
            {canDelete && (
              <TouchableOpacity
                onPress={() => {
                  hapticWarning();
                  handleCancelTicket(ticket);
                }}
                style={styles.btnDanger}
                activeOpacity={0.8}
              >
                <Text style={styles.btnTextDanger}>Cancel Order</Text>
              </TouchableOpacity>
            )}
            {canEdit && (
              <TouchableOpacity
                onPress={() => {
                  hapticTap();
                  setEditingTicket(ticket);
                }}
                style={styles.btnPrimary}
                activeOpacity={0.8}
              >
                <Text style={styles.btnTextBlack}>
                  {isAdmin ? 'Edit Order' : `Edit (${timeLeft}s)`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {/* Header */}
      <Header
        subtitle="Order History"
        isOffline={isOffline}
        onLock={lockTerminal}
      />

      {/* Summary */}
      <View style={styles.summaryWrap}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: Colors.gold }]}>{pendingCount}</Text>
            <Text style={styles.summaryLabel}>Pending</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: Colors.green }]}>{servedCount}</Text>
            <Text style={styles.summaryLabel}>Served</Text>
          </View>
        </View>
      </View>

      <View style={styles.contentContainer}>
        {/* Search */}
        <View style={styles.searchWrap}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by table or order #..."
            placeholderTextColor={Colors.textFaint}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterRow}>
          {filtersWithCounts.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterPill, filter === f.key && styles.filterPillActive]}
              onPress={() => {
                hapticTap();
                setFilter(f.key);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterPillText, filter === f.key && styles.filterPillTextActive]}>
                {f.label} ({f.count})
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          key={numColumns}
          data={filtered}
          keyExtractor={item => item.time}
          numColumns={numColumns}
          contentContainerStyle={styles.list}
          columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
          renderItem={renderTicket}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={7}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyBadge}>
                <Text style={styles.emptyBadgeText}>NO RECORDS</Text>
              </View>
              <Text style={styles.emptyText}>
                {search.trim() ? 'No orders match your search.' : 'No orders recorded yet.'}
              </Text>
            </View>
          }
        />
      </View>

      {/* In-Place Non-Destructive Order Editor */}
      <EditOrderModal
        visible={!!editingTicket}
        ticket={editingTicket}
        onClose={() => setEditingTicket(null)}
        onSave={updateOrderDetails}
        onLoadIntoCart={handleEditTicket}
        menuItems={menuItems}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  summaryWrap: { paddingHorizontal: Spacing.xxl - 4, paddingBottom: Spacing.xl - 6 },
  summaryRow: { flexDirection: 'row', gap: Spacing.md },
  summaryCard: {
    flex: 1, backgroundColor: Colors.bgCard, borderRadius: Radii.xl, paddingVertical: Spacing.xl - 6,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.borderLight,
  },
  summaryValue: { fontSize: FontSizes.giant, fontWeight: FontWeights.black },
  summaryLabel: { color: Colors.textFaint, fontSize: FontSizes.sm, fontWeight: FontWeights.bold, textTransform: 'uppercase', marginTop: 2 },

  contentContainer: {
    flex: 1, backgroundColor: Colors.bgSurface,
    borderTopLeftRadius: Radii.sheet - 8, borderTopRightRadius: Radii.sheet - 8, overflow: 'hidden',
  },
  searchWrap: { paddingHorizontal: Spacing.xl - 6, paddingTop: Spacing.xl - 6, paddingBottom: Spacing.sm },
  searchInput: {
    backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radii.xl, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    color: Colors.textPrimary, fontSize: FontSizes.lg, fontWeight: FontWeights.normal,
  },
  filterRow: { flexDirection: 'row', paddingHorizontal: Spacing.xl - 6, gap: Spacing.sm, marginBottom: Spacing.md - 2 },
  filterPill: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radii.pill,
    backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border,
  },
  filterPillActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  filterPillText: { color: Colors.textDim, fontSize: FontSizes.body, fontWeight: FontWeights.bold },
  filterPillTextActive: { color: Colors.bg, fontWeight: FontWeights.black },

  list: { padding: Spacing.xl - 6, paddingBottom: 80, gap: Spacing.md },
  columnWrapper: { gap: Spacing.md },

  ticketBox: {
    backgroundColor: Colors.bgCard, borderRadius: Radii.card,
    borderWidth: 1, borderColor: Colors.borderLight, overflow: 'hidden',
  },
  ticketHeader: {
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderColor: Colors.borderLight,
    gap: 4,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  headerMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 2,
  },
  ticketTotal: {
    color: Colors.gold,
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.black,
  },
  orderIdRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  orderIdPill: {
    backgroundColor: Colors.goldDim, paddingHorizontal: Spacing.sm, paddingVertical: 3,
    borderRadius: Radii.sm, borderWidth: 1, borderColor: Colors.goldBorder,
  },
  orderIdText: { color: Colors.gold, fontSize: FontSizes.body - 1, fontWeight: FontWeights.black, letterSpacing: 0.5 },
  offlineTicketBadge: {
    backgroundColor: Colors.redDim, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: Radii.sm, borderWidth: 1, borderColor: Colors.redBorder,
  },
  offlineTicketText: { color: Colors.red, fontSize: 10, fontWeight: FontWeights.black },
  ticketTime: { color: Colors.textFaint, fontSize: FontSizes.xs, fontWeight: FontWeights.semibold },
  ticketTable: { color: Colors.textPrimary, fontSize: FontSizes.xl, fontWeight: FontWeights.black, flex: 1, marginRight: 8 },

  itemsSection: { paddingHorizontal: Spacing.xl - 6, paddingVertical: Spacing.md },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 5 },
  itemBullet: { color: Colors.textGhost, fontSize: FontSizes.md },
  itemText: { color: Colors.textMuted, fontSize: FontSizes.md, fontWeight: FontWeights.semibold, flex: 1 },
  itemNoteHighlight: { color: '#F59E0B', fontWeight: FontWeights.bold },

  orderNoteRow: {
    marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderColor: Colors.borderLight,
  },
  orderNoteText: { color: Colors.textDim, fontSize: FontSizes.body - 1, fontWeight: FontWeights.normal, fontStyle: 'italic' },

  footerActions: {
    flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.xl - 6,
    paddingVertical: Spacing.md, borderTopWidth: 1, borderColor: Colors.borderLight,
  },
  btnDanger: {
    backgroundColor: Colors.redDim, paddingHorizontal: Spacing.xl - 6, paddingVertical: Spacing.md - 2,
    borderRadius: Radii.lg, borderWidth: 1, borderColor: Colors.redBorder,
  },
  btnPrimary: { backgroundColor: Colors.gold, paddingHorizontal: Spacing.xl - 6, paddingVertical: Spacing.md - 2, borderRadius: Radii.lg },
  btnTextDanger: { color: Colors.red, fontWeight: FontWeights.extrabold, fontSize: FontSizes.body },
  btnTextBlack: { color: Colors.black, fontWeight: FontWeights.black, fontSize: FontSizes.body },

  emptyWrap: { alignItems: 'center', paddingTop: 60 },
  emptyBadge: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.full,
    borderWidth: 1.5,
    borderColor: Colors.borderFocus,
    backgroundColor: Colors.bgSurface,
    marginBottom: Spacing.lg,
  },
  emptyBadgeText: {
    color: Colors.textDim,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.black,
    letterSpacing: 1.5,
  },
  emptyText: { color: Colors.textFaint, fontSize: FontSizes.xl, fontWeight: FontWeights.bold, textAlign: 'center' },
});