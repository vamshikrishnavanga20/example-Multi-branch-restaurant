import React, { useContext, useState, useRef, useEffect } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, FlatList,
  RefreshControl, Vibration, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import { PosContext, Ticket } from '../context/PosContext';
import Header from '../components/Header';
import StatusBadge from '../components/StatusBadge';
import KitchenTimer from '../components/KitchenTimer';
import { useIsTablet } from '../constants/layout';
import { Colors, Spacing, Radii, FontSizes, FontWeights } from '../constants/theme';
import { hapticSuccess, hapticTap } from '../utils/haptics';

// ─── Single Ticket Card ───────────────────────────────────────────────────────
function TicketCard({
  ticket,
  onMarkReady,
  isOffline,
  isTablet,
}: {
  ticket: Ticket;
  onMarkReady: () => void;
  isOffline: boolean;
  isTablet: boolean;
}) {
  const [pressed, setPressed] = useState(false);

  const handlePress = () => {
    if (pressed || isOffline) return;
    setPressed(true);
    hapticSuccess();
    Vibration.vibrate([0, 60, 40, 120]);
    onMarkReady();
    // Re-enable after 3 seconds to prevent accidental double-tap
    setTimeout(() => setPressed(false), 3000);
  };

  const isNew     = ticket.status === 'pending';
  const isCooking = ticket.status === 'in_progress';

  return (
    <View style={[
      styles.card,
      isCooking && styles.cardCooking,
      isTablet && styles.cardTablet,
    ]}>
      {/* Header */}
      <View style={styles.cardHead}>
        <View style={{ gap: 4, alignItems: 'flex-start' }}>
          <Text style={[styles.tableText, isTablet && styles.tableTextTablet]}>{ticket.table}</Text>
          <KitchenTimer timestamp={ticket.time} />
        </View>
        <StatusBadge
          status={ticket.status}
          label={isNew ? 'NEW' : isCooking ? 'COOKING' : undefined}
        />
      </View>

      <View style={styles.divider} />

      {/* Items */}
      <View style={styles.itemList}>
        {ticket.items.map((item, idx) => {
          const dishInstruction = item.notes || (ticket as any).notes;
          return (
            <View key={`${item.item_id}-${idx}`} style={styles.itemRow}>
              <Text style={[styles.itemQty, isTablet && styles.itemQtyTablet]}>{item.qty}×</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemName, isTablet && styles.itemNameTablet]}>
                  {item.name}
                  {dishInstruction ? (
                    <Text style={styles.itemNameInlineNote}> • {dishInstruction}</Text>
                  ) : null}
                </Text>
                {dishInstruction ? (
                  <View style={styles.noteChip}>
                    <Text style={styles.noteChipLabel}>NOTE:</Text>
                    <Text style={styles.itemNotes}>{dishInstruction}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>

      {/* Order notes */}
      {(ticket as any).notes ? (
        <View style={styles.orderNoteBox}>
          <Text style={styles.orderNoteText}>NOTE: {(ticket as any).notes}</Text>
        </View>
      ) : null}

      {/* Mark Ready button */}
      <TouchableOpacity
        style={[
          styles.readyBtn,
          isTablet && styles.readyBtnTablet,
          pressed && styles.readyBtnPressed,
          isOffline && { opacity: 0.4 },
        ]}
        onPress={handlePress}
        disabled={isOffline || pressed}
        activeOpacity={0.8}
      >
        <Text style={[styles.readyBtnText, isTablet && styles.readyBtnTextTablet]}>
          {isOffline ? 'OFFLINE' : pressed ? 'Sending...' : 'MARK AS READY'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function KDSScreen() {
  const { lockTerminal } = useContext(AuthContext);
  const {
    tickets, isOffline, markKitchenReady,
    refreshing, onRefresh,
  } = useContext(PosContext);

  const isTablet = useIsTablet();
  const { width } = useWindowDimensions();
  const numColumns = isTablet ? (width >= 1024 ? 3 : 2) : 1;

  const [showDone, setShowDone] = useState(false);

  const pendingTickets    = tickets.filter(t => t.status === 'pending');
  const inProgressTickets = tickets.filter(t => t.status === 'in_progress');
  const completedTickets  = tickets.filter(t => t.status === 'completed');

  const activeTickets = [...inProgressTickets, ...pendingTickets].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  );

  // Vibrate when a new order arrives
  const prevCount = useRef(pendingTickets.length);
  useEffect(() => {
    if (pendingTickets.length > prevCount.current) {
      Vibration.vibrate([0, 150, 100, 250]);
    }
    prevCount.current = pendingTickets.length;
  }, [pendingTickets.length]);

  const renderTicket = ({ item }: { item: Ticket }) => (
    <TicketCard
      key={item.time}
      ticket={item}
      isOffline={isOffline}
      isTablet={isTablet}
      onMarkReady={() => markKitchenReady(item)}
    />
  );

  const subtitleText = activeTickets.length === 0
    ? 'All clear'
    : `${pendingTickets.length} new · ${inProgressTickets.length} cooking`;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {/* Header */}
      <Header
        subtitle={subtitleText}
        isOffline={isOffline}
        onLock={lockTerminal}
      />

      {/* Orders */}
      <FlatList
        key={numColumns}
        data={activeTickets}
        keyExtractor={item => item.time}
        numColumns={numColumns}
        contentContainerStyle={[
          styles.list,
          isTablet && styles.listTablet,
        ]}
        columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
        renderItem={renderTicket}
        removeClippedSubviews
        maxToRenderPerBatch={8}
        windowSize={5}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyBadge}>
              <Text style={styles.emptyBadgeText}>ALL CLEAR</Text>
            </View>
            <Text style={styles.emptyTitle}>Kitchen Caught Up</Text>
            <Text style={styles.emptyHint}>No pending orders. Pull down to refresh.</Text>
          </View>
        }
        ListFooterComponent={
          completedTickets.length > 0 ? (
            <View style={isTablet ? { marginHorizontal: -Spacing.sm } : undefined}>
              <TouchableOpacity
                style={styles.doneToggle}
                onPress={() => setShowDone(v => !v)}
              >
                <Text style={styles.doneToggleText}>
                  {showDone ? '▲' : '▼'}{'  '}
                  {completedTickets.length} Completed order{completedTickets.length > 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
              {showDone && completedTickets.slice(0, 10).map(t => (
                <View key={t.time} style={styles.doneCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={styles.doneTable}>{t.table}</Text>
                    <Text style={styles.doneTime}>
                      {new Date(t.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  {t.items.map((item, idx) => (
                    <Text key={idx} style={styles.doneItem}>• {item.qty}× {item.name}</Text>
                  ))}
                </View>
              ))}
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },

  list: { paddingHorizontal: Spacing.xl - 6, paddingTop: Spacing.sm, paddingBottom: 60, gap: Spacing.xl - 6 },
  listTablet: { paddingHorizontal: Spacing.lg },
  columnWrapper: { gap: Spacing.md },

  card: {
    flex: 1,
    backgroundColor: Colors.bgCard, borderRadius: Radii.card,
    borderWidth: 1.5, borderColor: Colors.border, overflow: 'hidden',
  },
  cardCooking: { borderColor: 'rgba(249,115,22,0.4)' },
  cardTablet: { minHeight: 200 },

  cardHead: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: Spacing.lg, paddingBottom: Spacing.md,
  },
  tableText: { color: Colors.textPrimary, fontSize: FontSizes.hero, fontWeight: FontWeights.black },
  tableTextTablet: { fontSize: FontSizes.display },

  divider: { height: 1, backgroundColor: Colors.borderLight, marginHorizontal: Spacing.lg },

  itemList: { padding: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm, gap: Spacing.md - 2 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md - 2 },
  itemQty: { color: Colors.gold, fontSize: 17, fontWeight: FontWeights.black, minWidth: 30 },
  itemQtyTablet: { fontSize: 19 },
  itemName: { color: Colors.textPrimary, fontSize: 17, fontWeight: FontWeights.bold },
  itemNameTablet: { fontSize: 19 },
  itemNameInlineNote: {
    fontSize: FontSizes.body,
    fontWeight: FontWeights.black,
    color: '#F59E0B',
  },
  noteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(245,158,11,0.12)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.sm,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.35)',
  },
  noteChipLabel: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.black,
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  itemNotes: { color: '#FDE68A', fontSize: FontSizes.body - 1, fontWeight: FontWeights.bold },

  orderNoteBox: {
    marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
    backgroundColor: Colors.bgSurface, borderRadius: Radii.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  orderNoteText: { color: Colors.textMuted, fontSize: FontSizes.body, fontStyle: 'italic' },

  readyBtn: {
    margin: Spacing.xl - 6, marginTop: 4, backgroundColor: Colors.gold,
    paddingVertical: Spacing.lg, borderRadius: Radii.xl, alignItems: 'center',
  },
  readyBtnTablet: { paddingVertical: Spacing.xl, marginTop: Spacing.sm },
  readyBtnPressed: { backgroundColor: '#888', opacity: 0.7 },
  readyBtnText: { color: Colors.bg, fontSize: FontSizes.xl, fontWeight: FontWeights.black, letterSpacing: 0.5 },
  readyBtnTextTablet: { fontSize: FontSizes.xxl },

  empty: { alignItems: 'center', paddingTop: 80 },
  emptyBadge: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.full,
    borderWidth: 1.5,
    borderColor: Colors.green,
    backgroundColor: 'rgba(16,185,129,0.1)',
    marginBottom: Spacing.lg,
  },
  emptyBadgeText: {
    color: Colors.green,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.black,
    letterSpacing: 1.5,
  },
  emptyTitle: { color: Colors.textPrimary, fontSize: FontSizes.hero, fontWeight: FontWeights.black, marginBottom: 6 },
  emptyHint: { color: Colors.textGhost, fontSize: FontSizes.body, fontWeight: FontWeights.semibold },

  doneToggle: {
    paddingVertical: Spacing.lg, alignItems: 'center',
    borderTopWidth: 1, borderColor: Colors.borderLight, marginTop: Spacing.sm,
  },
  doneToggleText: { color: Colors.textFaint, fontSize: FontSizes.md, fontWeight: FontWeights.bold },
  doneCard: {
    backgroundColor: Colors.bgSurface, borderRadius: Radii.xl, padding: Spacing.xl - 6,
    borderWidth: 1, borderColor: Colors.borderLight, marginBottom: Spacing.sm, opacity: 0.6,
    marginHorizontal: Spacing.xl - 6,
  },
  doneTable: { color: Colors.textFaint, fontSize: FontSizes.lg, fontWeight: FontWeights.extrabold },
  doneTime: { color: Colors.textGhost, fontSize: FontSizes.body, fontWeight: FontWeights.semibold },
  doneItem: { color: Colors.textGhost, fontSize: FontSizes.md, fontWeight: FontWeights.semibold, marginTop: 6 },
});