import React, { useContext, useState, useMemo } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, FlatList,
  RefreshControl, TextInput, Alert, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../../context/AuthContext';
import { PosContext, Ticket } from '../../context/PosContext';
import Header from '../../components/Header';
import StatusBadge from '../../components/StatusBadge';
import { useIsTablet } from '../../constants/layout';
import { Colors, Spacing, Radii, FontSizes, FontWeights } from '../../constants/theme';

export default function ChefHistoryScreen() {
  const { lockTerminal } = useContext(AuthContext);
  const {
    tickets,
    recallTicketToKitchen,
    isOffline,
    refreshing,
    onRefresh,
  } = useContext(PosContext);

  const isTablet = useIsTablet();
  const { width } = useWindowDimensions();
  const numColumns = Math.max(1, Math.min(4, Math.floor(width / 340)));

  const [search, setSearch] = useState('');

  // Completed tickets
  const completedTickets = useMemo(() => {
    return tickets.filter(t => t.status === 'completed' || t.status === 'cancelled');
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    if (!search.trim()) return completedTickets;
    const q = search.toLowerCase();
    return completedTickets.filter(t => {
      const matchTable = t.table.toLowerCase().includes(q);
      const matchItems = t.items.some(i => i.name.toLowerCase().includes(q));
      return matchTable || matchItems;
    });
  }, [completedTickets, search]);

  const handleRecall = (ticket: Ticket) => {
    Alert.alert(
      'Recall to Kitchen',
      `Move order for ${ticket.table} back to Active Cooking?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Recall Order',
          onPress: () => recallTicketToKitchen(ticket),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <Header
        subtitle="KITCHEN ORDER ARCHIVE"
        isOffline={isOffline}
        onLock={lockTerminal}
      />

      {/* Search Input */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by table # or dish name..."
          placeholderTextColor={Colors.textDim}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
      </View>

      <FlatList
        data={filteredTickets}
        key={numColumns}
        numColumns={numColumns}
        keyExtractor={item => item.time}
        contentContainerStyle={[styles.list, isTablet && styles.listTablet]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
        renderItem={({ item }) => {
          const isCancelled = item.status === 'cancelled';
          const orderDate = new Date(item.time);
          const timeFormatted = orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          return (
            <View style={[
              styles.card,
              isCancelled && styles.cardCancelled,
              isTablet && styles.cardTablet,
            ]}>
              <View style={styles.cardHeader}>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[styles.orderIdText, isTablet && styles.orderIdTextTablet]}>
                      {item.orderId}
                    </Text>
                    <Text style={styles.typeLabel}>
                      • {item.table}
                    </Text>
                  </View>
                  <Text style={styles.timeText}>Ordered at {timeFormatted}</Text>
                </View>
                <StatusBadge status={item.status} />
              </View>

              <View style={styles.divider} />

              {/* Items */}
              <View style={styles.itemsList}>
                {item.items.map((it, idx) => {
                  const dishNote = it.notes || item.notes;
                  return (
                    <View key={idx} style={styles.itemRow}>
                      <Text style={styles.itemQty}>{it.qty}×</Text>
                      <Text style={styles.itemName}>{it.name}</Text>
                      {dishNote ? (
                        <Text style={styles.itemNotes}> • NOTE: {dishNote}</Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>

              {item.notes ? (
                <View style={styles.noteBox}>
                  <Text style={styles.noteText}>NOTE: {item.notes}</Text>
                </View>
              ) : null}

              {/* Recall Button */}
              {!isCancelled && (
                <TouchableOpacity
                  style={styles.recallBtn}
                  onPress={() => handleRecall(item)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.recallBtnText}>RECALL TO KITCHEN</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No Completed Orders</Text>
            <Text style={styles.emptySub}>Orders marked ready by the kitchen will appear here.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },

  searchBar: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  searchInput: {
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    color: Colors.textPrimary,
    fontSize: FontSizes.body,
  },

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
  cardCancelled: { opacity: 0.5 },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderIdText: { fontSize: FontSizes.title, fontWeight: FontWeights.black, color: Colors.gold, letterSpacing: 0.5 },
  orderIdTextTablet: { fontSize: FontSizes.hero },
  typeLabel: { fontSize: FontSizes.md, fontWeight: FontWeights.bold, color: Colors.textSecondary },
  timeText: { fontSize: FontSizes.sm, color: Colors.textDim, marginTop: 2, fontWeight: FontWeights.semibold },

  divider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: Spacing.md },

  itemsList: { gap: 6 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemQty: { fontSize: FontSizes.body, fontWeight: FontWeights.black, color: Colors.gold },
  itemName: { fontSize: FontSizes.body, fontWeight: FontWeights.semibold, color: Colors.textPrimary },
  itemNotes: { fontSize: FontSizes.sm, color: Colors.orange, fontStyle: 'italic' },

  noteBox: {
    backgroundColor: 'rgba(212,175,55,0.06)',
    padding: Spacing.sm,
    borderRadius: Radii.sm,
    marginTop: Spacing.sm,
  },
  noteText: { fontSize: FontSizes.sm, color: Colors.gold, fontWeight: FontWeights.semibold },

  recallBtn: {
    marginTop: Spacing.md,
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.goldBorder,
    paddingVertical: 10,
    borderRadius: Radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recallBtnText: {
    color: Colors.gold,
    fontSize: FontSizes.body,
    fontWeight: FontWeights.black,
    letterSpacing: 0.5,
  },

  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyEmoji: { fontSize: 60, marginBottom: 16 },
  emptyTitle: { fontSize: FontSizes.title, fontWeight: FontWeights.black, color: Colors.textPrimary },
  emptySub: { fontSize: FontSizes.body, color: Colors.textDim, marginTop: 6, textAlign: 'center' },
});
