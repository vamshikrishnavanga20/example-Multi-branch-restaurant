import React, { useContext, useState, useMemo } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, FlatList,
  RefreshControl, Vibration, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../../context/AuthContext';
import { PosContext, Ticket } from '../../context/PosContext';
import Header from '../../components/Header';
import KitchenTimer from '../../components/KitchenTimer';
import { Colors, Spacing, Radii, FontSizes, FontWeights, TABLET_BREAKPOINT } from '../../constants/theme';

type ChefFilter = 'all' | 'pending' | 'in_progress';

// ─── Single Ticket Card ───────────────────────────────────────────────────────
function ChefTicketCard({
  ticket,
  onMarkReady,
  onStartCooking,
  isTablet,
}: {
  ticket: Ticket;
  onMarkReady: () => void;
  onStartCooking: () => void;
  isTablet: boolean;
}) {
  const [readyPressed, setReadyPressed] = useState(false);

  const handleMarkReady = () => {
    if (readyPressed) return;
    setReadyPressed(true);
    Vibration.vibrate([0, 60, 40, 120]);
    onMarkReady();
    setTimeout(() => setReadyPressed(false), 3000);
  };

  const isNew = ticket.status === 'pending';
  const isCooking = ticket.status === 'in_progress';

  const displayOrderId = useMemo(() => {
    if (!ticket.orderId) return '#---';
    const clean = ticket.orderId.replace(/^#/, '');
    if (clean.length > 8) {
      return `#${clean.slice(-6).toUpperCase()}`;
    }
    return `#${clean.toUpperCase()}`;
  }, [ticket.orderId]);

  return (
    <View style={[
      styles.card,
      isCooking && styles.cardCooking,
      isTablet && styles.cardTablet,
    ]}>
      {/* Card Header: Order type, Order ID, and timer */}
      <View style={styles.cardHead}>
        <View style={styles.headInfo}>
          <View style={styles.tableRow}>
            <View style={[
              styles.typeBadge,
              ticket.orderType === 'parcel' && styles.typeBadgeParcel,
              ticket.orderType === 'catering' && styles.typeBadgeCatering,
            ]}>
              <Text style={[
                styles.typeBadgeText,
                ticket.orderType === 'parcel' && styles.typeBadgeTextParcel,
                ticket.orderType === 'catering' && styles.typeBadgeTextCatering,
              ]}>
                {ticket.table.toUpperCase()}
              </Text>
            </View>
            <Text
              style={[styles.orderIdText, isTablet && styles.orderIdTextTablet]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {displayOrderId}
            </Text>
            {ticket.isOffline && (
              <View style={styles.offlineTicketBadge}>
                <Text style={styles.offlineTicketText}>OFFLINE</Text>
              </View>
            )}
          </View>
          <KitchenTimer timestamp={ticket.time} />
        </View>

        {/* Subtle Cooking Status Badge */}
        {isCooking && (
          <View style={styles.cookingBadge}>
            <Text style={styles.cookingBadgeText}>IN PREP</Text>
          </View>
        )}
      </View>

      <View style={styles.divider} />

      {/* Culinary Item List: Clean, high-visibility rows without circular checkboxes */}
      <View style={styles.itemList}>
        {ticket.items.map((item, idx) => {
          const dishInstruction = item.notes || ticket.notes;
          return (
            <View key={`${item.item_id}-${idx}`} style={styles.itemRow}>
              <View style={[styles.qtyBadge, isTablet && styles.qtyBadgeTablet]}>
                <Text style={styles.qtyText}>{item.qty}×</Text>
              </View>
              <View style={styles.itemDetails}>
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

      {/* Order Level Special Instructions */}
      {ticket.notes ? (
        <View style={styles.orderNoteBox}>
          <Text style={styles.orderNoteLabel}>SPECIAL INSTRUCTIONS</Text>
          <Text style={styles.orderNoteText}>{ticket.notes}</Text>
        </View>
      ) : null}

      {/* Action Bar: Balanced, professional buttons without childish emojis */}
      <View style={styles.actionRow}>
        {isNew ? (
          <>
            <TouchableOpacity
              style={styles.prepBtn}
              onPress={onStartCooking}
              activeOpacity={0.8}
            >
              <Text style={styles.prepBtnText}>START PREP</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.readyBtn,
                styles.readyBtnFlex,
                readyPressed && styles.readyBtnPressed,
              ]}
              onPress={handleMarkReady}
              disabled={readyPressed}
              activeOpacity={0.8}
            >
              <Text style={styles.readyBtnText}>
                {readyPressed ? 'UPDATING...' : 'MARK READY'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[
              styles.readyBtn,
              styles.readyBtnFull,
              readyPressed && styles.readyBtnPressed,
            ]}
            onPress={handleMarkReady}
            disabled={readyPressed}
            activeOpacity={0.8}
          >
            <Text style={styles.readyBtnText}>
              {readyPressed ? 'UPDATING...' : 'MARK READY'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ChefLiveScreen() {
  const { lockTerminal } = useContext(AuthContext);
  const {
    tickets,
    markKitchenReady,
    markTicketInProgress,
    isOffline,
    refreshing,
    onRefresh,
  } = useContext(PosContext);

  const { width } = useWindowDimensions();
  // Scalable grid: 1 col (<680), 2 cols (680-1019), 3 cols (1020-1359), 4 cols (>=1360)
  const numColumns = Math.max(1, Math.min(4, Math.floor(width / 340)));
  const isTablet = width >= TABLET_BREAKPOINT;

  const [filter, setFilter] = useState<ChefFilter>('all');

  // Active tickets = pending or in_progress
  const activeTickets = useMemo(() => {
    return tickets.filter(t => t.status === 'pending' || t.status === 'in_progress');
  }, [tickets]);

  const pendingCount = activeTickets.filter(t => t.status === 'pending').length;
  const cookingCount = activeTickets.filter(t => t.status === 'in_progress').length;

  const filteredTickets = useMemo(() => {
    return activeTickets.filter(t => {
      if (filter === 'pending') return t.status === 'pending';
      if (filter === 'in_progress') return t.status === 'in_progress';
      return true;
    });
  }, [activeTickets, filter]);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <Header
        subtitle="KITCHEN LIVE DISPLAY"
        isOffline={isOffline}
        onLock={lockTerminal}
      />

      {/* Filter Tabs without emojis or rush */}
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.chip, filter === 'all' && styles.chipActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.chipText, filter === 'all' && styles.chipTextActive]}>
            All Active ({activeTickets.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.chip, filter === 'pending' && styles.chipActive]}
          onPress={() => setFilter('pending')}
        >
          <Text style={[styles.chipText, filter === 'pending' && styles.chipTextActive]}>
            Pending ({pendingCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.chip, filter === 'in_progress' && styles.chipActive]}
          onPress={() => setFilter('in_progress')}
        >
          <Text style={[styles.chipText, filter === 'in_progress' && styles.chipTextActive]}>
            In Prep ({cookingCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Orders Grid */}
      <FlatList
        data={filteredTickets}
        key={numColumns}
        numColumns={numColumns}
        keyExtractor={item => item.time}
        contentContainerStyle={[styles.list, isTablet && styles.listTablet]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
        renderItem={({ item }) => (
          <ChefTicketCard
            ticket={item}
            onMarkReady={() => markKitchenReady(item)}
            onStartCooking={() => markTicketInProgress(item)}
            isTablet={isTablet}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>Kitchen Queue is Clear</Text>
            <Text style={styles.emptySub}>All incoming orders will appear here automatically.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },

  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm,
    backgroundColor: '#0F0F12',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: Spacing.md + 2,
    paddingVertical: 7,
    borderRadius: Radii.sm,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  chipActive: {
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderColor: Colors.gold,
  },
  chipText: {
    fontSize: FontSizes.body,
    fontWeight: FontWeights.bold,
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },
  chipTextActive: {
    color: Colors.gold,
  },

  list: { padding: Spacing.sm, gap: Spacing.sm },
  listTablet: { padding: Spacing.md },

  card: {
    flex: 1,
    margin: 6,
    backgroundColor: '#121215',
    borderRadius: Radii.card,
    borderWidth: 1.5,
    borderColor: '#24242A',
    padding: Spacing.lg,
    justifyContent: 'space-between',
  },
  cardTablet: { minWidth: 300 },
  cardCooking: {
    borderColor: '#3F3F46',
    backgroundColor: '#141418',
  },

  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headInfo: { flex: 1, gap: 6, alignItems: 'flex-start', minWidth: 0 },
  tableRow: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%', flexShrink: 1 },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.sm,
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    flexShrink: 0,
  },
  typeBadgeText: {
    color: Colors.gold,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.black,
    letterSpacing: 0.6,
  },
  typeBadgeParcel: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderColor: 'rgba(245,158,11,0.4)',
    flexShrink: 0,
  },
  typeBadgeTextParcel: {
    color: '#FBBF24',
  },
  typeBadgeCatering: {
    backgroundColor: 'rgba(147,51,234,0.15)',
    borderColor: 'rgba(147,51,234,0.4)',
    flexShrink: 0,
  },
  typeBadgeTextCatering: {
    color: '#C084FC',
  },
  orderIdText: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.black,
    color: Colors.textPrimary,
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  orderIdTextTablet: {
    fontSize: FontSizes.xl,
  },

  offlineTicketBadge: {
    backgroundColor: Colors.redDim,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: Colors.redBorder,
  },
  offlineTicketText: { color: Colors.red, fontSize: FontSizes.xs, fontWeight: FontWeights.black, letterSpacing: 0.5 },

  cookingBadge: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.35)',
  },
  cookingBadgeText: {
    color: '#FBBF24',
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.black,
    letterSpacing: 0.5,
  },

  divider: { height: 1, backgroundColor: '#202026', marginVertical: Spacing.md },

  itemList: { gap: 10 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 3,
  },
  qtyBadge: {
    backgroundColor: '#1C1C20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: '#2E2E36',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 38,
  },
  qtyBadgeTablet: {
    minWidth: 44,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  qtyText: {
    color: Colors.gold,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.black,
  },
  itemDetails: { flex: 1 },
  itemName: { fontSize: FontSizes.md, fontWeight: FontWeights.bold, color: Colors.textPrimary },
  itemNameTablet: { fontSize: FontSizes.lg },
  itemNameInlineNote: {
    fontSize: FontSizes.sm + 1,
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
  itemNotes: { fontSize: FontSizes.sm, color: '#FDE68A', fontWeight: FontWeights.bold },

  orderNoteBox: {
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderRadius: Radii.md,
    padding: Spacing.sm + 2,
    borderWidth: 1,
    borderColor: Colors.goldBorder,
    marginTop: Spacing.md,
  },
  orderNoteLabel: { fontSize: FontSizes.xs, fontWeight: FontWeights.black, color: Colors.gold, letterSpacing: 0.5 },
  orderNoteText: { fontSize: FontSizes.body, color: Colors.textSecondary, fontWeight: FontWeights.semibold, marginTop: 2 },

  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#202026',
  },
  prepBtn: {
    flex: 1,
    backgroundColor: '#24242A',
    borderWidth: 1,
    borderColor: '#383842',
    paddingVertical: 12,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prepBtnText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.body,
    fontWeight: FontWeights.black,
    letterSpacing: 0.5,
  },
  readyBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readyBtnFlex: {
    flex: 1.2,
  },
  readyBtnFull: {
    flex: 1,
  },
  readyBtnPressed: {
    opacity: 0.6,
  },
  readyBtnText: {
    color: '#09090B',
    fontSize: FontSizes.body,
    fontWeight: FontWeights.black,
    letterSpacing: 0.5,
  },

  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 120,
  },
  emptyTitle: {
    fontSize: FontSizes.hero,
    fontWeight: FontWeights.black,
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
  emptySub: {
    fontSize: FontSizes.body,
    color: Colors.textDim,
    marginTop: 6,
    textAlign: 'center',
  },
});
