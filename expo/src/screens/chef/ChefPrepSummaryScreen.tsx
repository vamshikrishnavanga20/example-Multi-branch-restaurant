import React, { useContext, useMemo } from 'react';
import {
  StyleSheet, Text, View, FlatList, RefreshControl, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../../context/AuthContext';
import { PosContext, Ticket } from '../../context/PosContext';
import Header from '../../components/Header';
import { useIsTablet } from '../../constants/layout';
import { Colors, Spacing, Radii, FontSizes, FontWeights } from '../../constants/theme';

interface AggregatedItem {
  itemId: string;
  name: string;
  totalQty: number;
  tableBreakdown: Array<{
    table: string;
    qty: number;
    notes?: string;
    isRush?: boolean;
  }>;
}

export default function ChefPrepSummaryScreen() {
  const { lockTerminal } = useContext(AuthContext);
  const { tickets, isOffline, refreshing, onRefresh } = useContext(PosContext);

  const isTablet = useIsTablet();
  const { width } = useWindowDimensions();
  const numColumns = Math.max(1, Math.min(4, Math.floor(width / 340)));

  // Aggregate pending and in_progress items across all active tickets
  const prepList = useMemo(() => {
    const activeTickets = tickets.filter(
      t => t.status === 'pending' || t.status === 'in_progress'
    );

    const map = new Map<string, AggregatedItem>();

    activeTickets.forEach(ticket => {
      ticket.items.forEach(item => {
        // Skip items that the chef already crossed off as done
        if (item.done) return;

        const existing = map.get(item.name);
        const itemInstruction = item.notes || ticket.notes;
        if (existing) {
          existing.totalQty += item.qty;
          existing.tableBreakdown.push({
            table: ticket.table,
            qty: item.qty,
            notes: itemInstruction,
            isRush: ticket.isRush,
          });
        } else {
          map.set(item.name, {
            itemId: item.item_id,
            name: item.name,
            totalQty: item.qty,
            tableBreakdown: [
              {
                table: ticket.table,
                qty: item.qty,
                notes: itemInstruction,
                isRush: ticket.isRush,
              },
            ],
          });
        }
      });
    });

    // Sort by highest quantity first (most urgent batch)
    return Array.from(map.values()).sort((a, b) => b.totalQty - a.totalQty);
  }, [tickets]);

  const totalPortions = useMemo(() => {
    return prepList.reduce((acc, curr) => acc + curr.totalQty, 0);
  }, [prepList]);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <Header
        subtitle="BATCH PREP SHEET"
        isOffline={isOffline}
        onLock={lockTerminal}
      />

      {/* Summary Stat Banner */}
      <View style={styles.statBanner}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{prepList.length}</Text>
          <Text style={styles.statLabel}>Unique Dishes</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: Colors.gold }]}>{totalPortions}</Text>
          <Text style={styles.statLabel}>Total Portions Needed</Text>
        </View>
      </View>

      <FlatList
        data={prepList}
        key={numColumns}
        numColumns={numColumns}
        keyExtractor={item => item.name}
        contentContainerStyle={[styles.list, isTablet && styles.listTablet]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
        renderItem={({ item }) => (
          <View style={[styles.card, isTablet && styles.cardTablet]}>
            {/* Card Top: Dish Name & Total Badge */}
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.dishName, isTablet && styles.dishNameTablet]}>
                  {item.name}
                </Text>
              </View>
              <View style={styles.totalBadge}>
                <Text style={styles.totalBadgeText}>{item.totalQty}×</Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Table breakdown */}
            <Text style={styles.breakdownHeader}>ORDERS FOR THIS DISH:</Text>
            <View style={styles.breakdownList}>
              {item.tableBreakdown.map((tb, idx) => (
                <View key={idx} style={styles.tableRow}>
                  <View style={styles.tableRowLeft}>
                    <Text style={styles.tableBullet}>•</Text>
                    <Text style={styles.tableLabel}>{tb.table}</Text>
                  </View>
                  <Text style={styles.tableQty}>{tb.qty} portion{tb.qty > 1 ? 's' : ''}</Text>
                  {tb.notes ? (
                    <Text style={styles.itemNotes}> • NOTE: {tb.notes}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No Active Prep Needed</Text>
            <Text style={styles.emptySub}>All dishes for current active orders have been completed.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },

  statBanner: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCard,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statBox: { alignItems: 'center' },
  statNumber: { fontSize: FontSizes.hero, fontWeight: FontWeights.black, color: Colors.textPrimary },
  statLabel: { fontSize: FontSizes.xs, fontWeight: FontWeights.bold, color: Colors.textDim, textTransform: 'uppercase', marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: Colors.border },

  list: { padding: Spacing.md, gap: Spacing.md },
  listTablet: { padding: Spacing.lg },

  card: {
    flex: 1,
    margin: Spacing.xs,
    backgroundColor: Colors.bgCard,
    borderRadius: Radii.card,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  cardTablet: { minWidth: 320 },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  dishName: {
    fontSize: FontSizes.title,
    fontWeight: FontWeights.black,
    color: Colors.textPrimary,
  },
  dishNameTablet: { fontSize: FontSizes.hero },

  totalBadge: {
    backgroundColor: Colors.goldDim,
    borderWidth: 1.5,
    borderColor: Colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.pill,
  },
  totalBadgeText: {
    color: Colors.gold,
    fontSize: FontSizes.title,
    fontWeight: FontWeights.black,
  },

  divider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: Spacing.md },

  breakdownHeader: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.black,
    color: Colors.textDim,
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  breakdownList: { gap: 6 },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  tableRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tableBullet: { color: Colors.gold, fontSize: FontSizes.body, fontWeight: FontWeights.black },
  tableLabel: { fontSize: FontSizes.body, fontWeight: FontWeights.black, color: Colors.textSecondary },
  tableQty: { fontSize: FontSizes.body, fontWeight: FontWeights.bold, color: Colors.gold },
  itemNotes: { fontSize: FontSizes.sm, color: Colors.orange, fontStyle: 'italic' },

  rushMiniBadge: {
    backgroundColor: Colors.redDim,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: Colors.redBorder,
  },
  rushMiniText: { color: Colors.red, fontSize: 9, fontWeight: FontWeights.black },

  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyEmoji: { fontSize: 60, marginBottom: 16 },
  emptyTitle: { fontSize: FontSizes.title, fontWeight: FontWeights.black, color: Colors.textPrimary },
  emptySub: { fontSize: FontSizes.body, color: Colors.textDim, marginTop: 6, textAlign: 'center' },
});
