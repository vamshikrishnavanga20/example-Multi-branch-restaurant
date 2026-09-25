import React, { useContext, useMemo } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, FlatList, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import { PosContext } from '../context/PosContext';
import { useNavigation } from '@react-navigation/native';

const TOTAL_TABLES = 20;

type TableStatus = 'free' | 'occupied' | 'needs_bill' | 'in_progress';

interface TableInfo {
  id: string;
  number: number;
  label: string;
  status: TableStatus;
  total: number;
  coverCount: number;
  pendingItems: number;
}

const STATUS_CONFIG: Record<TableStatus, { color: string; bg: string; label: string; icon: string }> = {
  free: { color: '#10B981', bg: 'rgba(16,185,129,0.12)', label: 'Available', icon: 'OPEN' },
  occupied: { color: '#D4AF37', bg: 'rgba(212,175,55,0.12)', label: 'Occupied', icon: 'ACTIVE' },
  in_progress: { color: '#F97316', bg: 'rgba(249,115,22,0.12)', label: 'Cooking', icon: 'PREP' },
  needs_bill: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', label: 'Bill Due', icon: 'BILL' },
};

export default function TableStatusScreen() {
  const { lockTerminal } = useContext(AuthContext);
  const { tickets, setTableNumber, setOrderType } = useContext(PosContext);
  const { width } = useWindowDimensions();
  const navigation = useNavigation();
  const numCols = width >= 768 ? 5 : 4;

  const tables: TableInfo[] = useMemo(() => {
    const tableMap: Record<string, Ticket> = {};

    // Get the most recent active ticket per table
    tickets.forEach((ticket: any) => {
      const table = ticket.table;
      if (!table || ticket.status === 'cancelled') return;
      if (!tableMap[table] || new Date(ticket.time) > new Date(tableMap[table].time)) {
        tableMap[table] = ticket;
      }
    });

    return Array.from({ length: TOTAL_TABLES }, (_, i) => {
      const num = i + 1;
      const key = `T-${num}`;
      const ticket = tableMap[key];

      if (!ticket) {
        return { id: key, number: num, label: key, status: 'free' as TableStatus, total: 0, coverCount: 0, pendingItems: 0 };
      }

      const pendingItems = ticket.items.filter((it: any) => !it.done).length;
      let status: TableStatus = 'free';

      if (ticket.status === 'pending') status = 'occupied';
      else if (ticket.status === 'in_progress') status = 'in_progress';
      else if (ticket.status === 'completed') status = 'needs_bill';

      return {
        id: key,
        number: num,
        label: key,
        status,
        total: ticket.total,
        coverCount: ticket.coverCount,
        pendingItems,
      };
    });
  }, [tickets]);

  const freeCount = tables.filter(t => t.status === 'free').length;
  const occupiedCount = tables.filter(t => t.status !== 'free').length;

  const handleTablePress = (table: TableInfo) => {
    if (table.status === 'free') {
      // Start a new order for this table
      setTableNumber(table.label);
      setOrderType('walk-in');
      (navigation as any).navigate('Menu');
    }
  };

  const renderTable = ({ item }: { item: TableInfo }) => {
    const config = STATUS_CONFIG[item.status];
    return (
      <TouchableOpacity
        style={[styles.tableCard, { backgroundColor: config.bg, borderColor: config.color }]}
        onPress={() => handleTablePress(item)}
        activeOpacity={item.status === 'free' ? 0.75 : 1}
      >
        <Text style={[styles.tableIcon, { color: config.color }]}>{config.icon}</Text>
        <Text style={[styles.tableLabel, { color: config.color }]}>{item.label}</Text>
        <Text style={styles.tableStatus}>{config.label}</Text>
        {item.status !== 'free' && (
          <>
            {item.coverCount > 0 && (
              <Text style={styles.tableMeta}>Covers: {item.coverCount}</Text>
            )}
            {item.total > 0 && (
              <Text style={styles.tableTotal}>₹{item.total}</Text>
            )}
          </>
        )}
        {item.status === 'free' && (
          <Text style={styles.tableTapHint}>Tap to seat</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.greeting}>Floor View</Text>
            <Text style={styles.headerRole}>Table Status</Text>
          </View>
          <TouchableOpacity onPress={lockTerminal} style={styles.lockBtn}>
            <Text style={styles.lockText}>LOCK</Text>
          </TouchableOpacity>
        </View>

        {/* Legend + Summary */}
        <View style={styles.legendRow}>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <View key={key} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: cfg.color }]} />
              <Text style={styles.legendText}>{cfg.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: '#10B981' }]}>{freeCount}</Text>
            <Text style={styles.summaryLabel}>Available</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: '#D4AF37' }]}>{occupiedCount}</Text>
            <Text style={styles.summaryLabel}>Occupied</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: '#FFF' }]}>{TOTAL_TABLES}</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>
        </View>
      </View>

      {/* Table Grid */}
      <View style={styles.contentContainer}>
        <FlatList
          data={tables}
          keyExtractor={item => item.id}
          numColumns={numCols}
          key={numCols}
          contentContainerStyle={styles.gridContainer}
          renderItem={renderTable}
        />
      </View>
    </SafeAreaView>
  );
}

// Type shim
type Ticket = any;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#09090B' },
  header: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 16, backgroundColor: '#09090B' },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  greeting: { fontSize: 24, fontWeight: '900', color: '#FFF' },
  headerRole: { fontSize: 12, fontWeight: '700', color: '#D4AF37', textTransform: 'uppercase', letterSpacing: 1, marginTop: 3 },
  lockBtn: {
    backgroundColor: 'rgba(239,68,68,0.08)', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
  },
  lockText: { color: '#EF4444', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  legendRow: { flexDirection: 'row', gap: 16, marginBottom: 14, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: '#71717A', fontSize: 12, fontWeight: '600' },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: {
    flex: 1, backgroundColor: '#111113', borderRadius: 14, paddingVertical: 12,
    alignItems: 'center', borderWidth: 1, borderColor: '#1A1A1D',
  },
  summaryValue: { fontSize: 24, fontWeight: '900' },
  summaryLabel: { color: '#52525B', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginTop: 2 },
  contentContainer: {
    flex: 1, backgroundColor: '#0D0D0F',
    borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden',
  },
  gridContainer: { padding: 12, gap: 10 },
  tableCard: {
    flex: 1, margin: 5, borderRadius: 18, borderWidth: 1.5,
    paddingVertical: 16, paddingHorizontal: 10, alignItems: 'center', minHeight: 110,
  },
  tableIcon: { fontSize: 22, marginBottom: 4 },
  tableLabel: { fontSize: 16, fontWeight: '900', marginBottom: 2 },
  tableStatus: { color: '#71717A', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  tableMeta: { color: '#A1A1AA', fontSize: 11, fontWeight: '600', marginBottom: 2 },
  tableTotal: { color: '#D4AF37', fontSize: 14, fontWeight: '900' },
  tableTapHint: { color: '#3F3F46', fontSize: 10, fontWeight: '600', marginTop: 4 },
});
