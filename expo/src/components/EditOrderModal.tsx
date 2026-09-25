import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, Modal,
  ScrollView, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import { Ticket, EditOrderPayload, EditOrderItem, OrderType } from '../context/PosContext';
import { Colors, Spacing, Radii, FontSizes, FontWeights } from '../constants/theme';
import { hapticTap, hapticSuccess, hapticWarning } from '../utils/haptics';

interface EditOrderModalProps {
  visible: boolean;
  ticket: Ticket | null;
  onClose: () => void;
  onSave: (payload: EditOrderPayload) => Promise<void>;
  onLoadIntoCart?: (ticket: Ticket) => void;
  menuItems: any[];
}

const STATUS_OPTIONS = [
  { key: 'pending', label: 'PENDING', color: Colors.gold, bg: Colors.goldDim, border: Colors.goldBorder },
  { key: 'in_progress', label: 'IN PREP', color: Colors.orange, bg: Colors.orangeDim, border: Colors.orangeBorder },
  { key: 'completed', label: 'SERVED', color: Colors.green, bg: Colors.greenDim, border: Colors.greenBorder },
  { key: 'cancelled', label: 'CANCEL', color: Colors.red, bg: Colors.redDim, border: Colors.redBorder },
] as const;

const ORDER_TYPES: { key: OrderType; label: string }[] = [
  { key: 'walk-in', label: 'Walk-in' },
  { key: 'parcel', label: 'Parcel' },
  { key: 'catering', label: 'Catering Service' },
];

const QUICK_TABLES = ['Table 1', 'Table 2', 'Table 3', 'Table 4', 'Table 5', 'Table 6', 'Parcel', 'Takeaway'];

export default function EditOrderModal({
  visible,
  ticket,
  onClose,
  onSave,
  onLoadIntoCart,
  menuItems,
}: EditOrderModalProps) {
  const [status, setStatus] = useState<'pending' | 'in_progress' | 'completed' | 'cancelled'>('pending');
  const [table, setTable] = useState('Walk-in');
  const [orderType, setOrderType] = useState<OrderType>('walk-in');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<EditOrderItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [showAddDish, setShowAddDish] = useState(false);
  const [dishSearch, setDishSearch] = useState('');

  // Sync state when ticket changes
  useEffect(() => {
    if (ticket) {
      setStatus((ticket.status as any) || 'pending');
      setTable(ticket.table || 'Walk-in');
      setOrderType(ticket.orderType || 'walk-in');
      setNotes(ticket.notes || '');
      setItems(
        ticket.items.map(i => ({
          ledger_id: i.ledger_id,
          item_id: i.item_id,
          qty: i.qty,
          price: i.price,
          name: i.name,
          notes: i.notes,
        }))
      );
      setShowAddDish(false);
      setDishSearch('');
    }
  }, [ticket]);

  // Adjust item quantity
  const updateItemQty = (index: number, delta: number) => {
    hapticTap();
    setItems(prev => {
      const next = [...prev];
      const current = next[index];
      const newQty = Math.max(0, current.qty + delta);
      if (newQty === 0) {
        // Confirm removal if needed
        next[index] = { ...current, qty: 0 };
      } else {
        next[index] = { ...current, qty: newQty };
      }
      return next;
    });
  };

  // Remove item completely
  const removeItem = (index: number) => {
    hapticWarning();
    setItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], qty: 0 };
      return next;
    });
  };

  // Add item from menu
  const addItemFromMenu = (menuItem: any) => {
    hapticTap();
    setItems(prev => {
      const existingIdx = prev.findIndex(i => i.item_id === menuItem.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          qty: updated[existingIdx].qty + 1,
        };
        return updated;
      }
      return [
        ...prev,
        {
          ledger_id: `new-${Date.now()}-${menuItem.id}`,
          item_id: menuItem.id,
          qty: 1,
          price: Number(menuItem.price) || 0,
          name: menuItem.name,
        },
      ];
    });
    setShowAddDish(false);
    setDishSearch('');
  };

  // Filtered menu items for add-on modal
  const filteredMenuItems = useMemo(() => {
    if (!dishSearch.trim()) return menuItems;
    return (menuItems as any[]).filter(m =>
      m.name.toLowerCase().includes(dishSearch.toLowerCase())
    );
  }, [menuItems, dishSearch]);

  // Calculate live total
  const calculatedTotal = useMemo(() => {
    return items.reduce((sum, i) => sum + i.qty * i.price, 0);
  }, [items]);

  const activeItemsCount = useMemo(() => {
    return items.filter(i => i.qty > 0).reduce((sum, i) => sum + i.qty, 0);
  }, [items]);

  // Save changes
  const handleSave = async () => {
    if (!ticket) return;

    if (activeItemsCount === 0 && status !== 'cancelled') {
      Alert.alert('Empty Order', 'An order must contain at least 1 item, or be marked Cancelled.');
      return;
    }

    if (status === 'cancelled') {
      Alert.alert(
        'Confirm Cancellation',
        'Are you sure you want to mark this order as CANCELLED?',
        [
          { text: 'Keep Active', style: 'cancel' },
          {
            text: 'Yes, Cancel Order',
            style: 'destructive',
            onPress: executeSave,
          },
        ]
      );
      return;
    }

    await executeSave();
  };

  const executeSave = async () => {
    if (!ticket) return;
    setSaving(true);
    try {
      await onSave({
        ticketTime: ticket.time,
        status,
        table,
        orderType,
        notes,
        items,
      });
      hapticSuccess();
      onClose();
    } catch (err) {
      console.warn('Edit order error:', err);
      Alert.alert('Error', 'Failed to update order. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!ticket) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text style={styles.sheetTitle}>EDIT ORDER</Text>
                <View style={styles.orderIdBadge}>
                  <Text style={styles.orderIdText}>{ticket.orderId}</Text>
                </View>
              </View>
              <Text style={styles.sheetSub}>
                Placed at {new Date(ticket.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Status Section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ORDER STATUS</Text>
              <View style={styles.chipRow}>
                {STATUS_OPTIONS.map(opt => {
                  const isSelected = status === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[
                        styles.statusChip,
                        { borderColor: isSelected ? opt.color : Colors.border },
                        isSelected && { backgroundColor: opt.bg },
                      ]}
                      onPress={() => {
                        hapticTap();
                        setStatus(opt.key);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.statusChipText,
                          { color: isSelected ? opt.color : Colors.textMuted },
                          isSelected && { fontWeight: FontWeights.black },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Order Type Section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ORDER TYPE</Text>
              <View style={styles.chipRow}>
                {ORDER_TYPES.map(type => {
                  const isSelected = orderType === type.key;
                  return (
                    <TouchableOpacity
                      key={type.key}
                      style={[
                        styles.typeChip,
                        isSelected && styles.typeChipActive,
                      ]}
                      onPress={() => {
                        hapticTap();
                        setOrderType(type.key);
                        if (type.key === 'parcel') setTable('Parcel');
                        else if (type.key === 'catering') setTable('Catering Service');
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.typeChipText, isSelected && styles.typeChipTextActive]}>
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Table / Location Section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>TABLE / LOCATION</Text>
              <TextInput
                style={styles.input}
                value={table}
                onChangeText={setTable}
                placeholder="e.g. Table 4"
                placeholderTextColor={Colors.textFaint}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickTableScroll}>
                {QUICK_TABLES.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.quickTableChip, table === t && styles.quickTableChipActive]}
                    onPress={() => {
                      hapticTap();
                      setTable(t);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.quickTableText, table === t && styles.quickTableTextActive]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Order Items Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>ORDER ITEMS ({activeItemsCount})</Text>
                <TouchableOpacity
                  style={styles.addDishHeaderBtn}
                  onPress={() => setShowAddDish(prev => !prev)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.addDishHeaderText}>
                    {showAddDish ? 'CLOSE DISH MENU' : '+ ADD DISH'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Add Dish Inline Search / List */}
              {showAddDish && (
                <View style={styles.addDishCard}>
                  <TextInput
                    style={styles.dishSearchInput}
                    placeholder="Search menu to add dish..."
                    placeholderTextColor={Colors.textFaint}
                    value={dishSearch}
                    onChangeText={setDishSearch}
                    autoFocus
                  />
                  <ScrollView style={styles.addDishScroll} nestedScrollEnabled>
                    {filteredMenuItems.slice(0, 10).map((menuItem: any) => (
                      <TouchableOpacity
                        key={menuItem.id}
                        style={styles.addDishRow}
                        onPress={() => addItemFromMenu(menuItem)}
                        activeOpacity={0.7}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.addDishName}>{menuItem.name}</Text>
                          <Text style={styles.addDishPrice}>₹{menuItem.price}</Text>
                        </View>
                        <View style={styles.addDishPlusBadge}>
                          <Text style={styles.addDishPlusText}>+ ADD</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Items List */}
              {items.map((item, idx) => {
                const isRemoved = item.qty === 0;
                return (
                  <View key={idx} style={[styles.itemCard, isRemoved && styles.itemCardRemoved]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemName, isRemoved && styles.itemNameRemoved]}>
                        {item.name}
                      </Text>
                      <Text style={styles.itemPrice}>₹{item.price} each</Text>
                    </View>

                    {isRemoved ? (
                      <TouchableOpacity
                        style={styles.restoreBtn}
                        onPress={() => updateItemQty(idx, 1)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.restoreBtnText}>RESTORE</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.stepperWrap}>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() => updateItemQty(idx, -1)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.stepBtnText}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.qtyText}>{item.qty}</Text>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() => updateItemQty(idx, 1)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.stepBtnText}>+</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.removeIconBtn}
                          onPress={() => removeItem(idx)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.removeIconText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Special Instructions */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>SPECIAL INSTRUCTIONS / NOTES</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="e.g. Extra spicy, no onions, parcel packing..."
                placeholderTextColor={Colors.textFaint}
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>

          {/* Footer Summary & Save */}
          <View style={styles.footer}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>UPDATED TOTAL</Text>
              <Text style={styles.totalValue}>₹{calculatedTotal.toLocaleString('en-IN')}</Text>
            </View>

            <View style={styles.actionRow}>
              {onLoadIntoCart && (
                <TouchableOpacity
                  style={styles.cartBtn}
                  onPress={() => {
                    hapticTap();
                    onLoadIntoCart(ticket);
                    onClose();
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cartBtnText}>PULL TO CART</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={Colors.black} />
                ) : (
                  <Text style={styles.saveBtnText}>SAVE CHANGES</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: Colors.bgSurface,
    borderTopLeftRadius: Radii.sheet,
    borderTopRightRadius: Radii.sheet,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderColor: Colors.borderLight,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sheetTitle: {
    color: Colors.textPrimary,
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.black,
    letterSpacing: 0.5,
  },
  orderIdBadge: {
    backgroundColor: Colors.goldDim,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: Colors.goldBorder,
  },
  orderIdText: {
    color: Colors.gold,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.black,
  },
  sheetSub: {
    color: Colors.textFaint,
    fontSize: FontSizes.body,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: Radii.full,
    backgroundColor: Colors.bgInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: Colors.textDim,
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
  },

  scrollContent: {
    maxHeight: 480,
  },
  scrollInner: {
    padding: Spacing.xl,
    gap: Spacing.xl,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionLabel: {
    color: Colors.textDim,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.black,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addDishHeaderBtn: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: Radii.sm,
    backgroundColor: Colors.goldDim,
    borderWidth: 1,
    borderColor: Colors.goldBorder,
  },
  addDishHeaderText: {
    color: Colors.gold,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.black,
    letterSpacing: 0.5,
  },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  statusChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.md,
    borderWidth: 1,
    backgroundColor: Colors.bgInput,
  },
  statusChipText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.bold,
    letterSpacing: 0.5,
  },

  typeChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgInput,
  },
  typeChipActive: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
  typeChipText: {
    color: Colors.textMuted,
    fontSize: FontSizes.body,
    fontWeight: FontWeights.bold,
  },
  typeChipTextActive: {
    color: Colors.black,
    fontWeight: FontWeights.black,
  },

  input: {
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
  },
  notesInput: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  quickTableScroll: {
    marginTop: Spacing.xs,
  },
  quickTableChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radii.sm,
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginRight: Spacing.xs,
  },
  quickTableChipActive: {
    borderColor: Colors.gold,
    backgroundColor: Colors.goldDim,
  },
  quickTableText: {
    color: Colors.textDim,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
  },
  quickTableTextActive: {
    color: Colors.gold,
    fontWeight: FontWeights.bold,
  },

  // Add Dish
  addDishCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderFocus,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  dishSearchInput: {
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.textPrimary,
    fontSize: FontSizes.body,
  },
  addDishScroll: {
    maxHeight: 160,
  },
  addDishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderColor: Colors.borderLight,
  },
  addDishName: {
    color: Colors.textPrimary,
    fontSize: FontSizes.body,
    fontWeight: FontWeights.semibold,
  },
  addDishPrice: {
    color: Colors.gold,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.bold,
  },
  addDishPlusBadge: {
    backgroundColor: Colors.gold,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radii.sm,
  },
  addDishPlusText: {
    color: Colors.black,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.black,
  },

  // Items List
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  itemCardRemoved: {
    opacity: 0.4,
    borderColor: Colors.redBorder,
  },
  itemName: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
  },
  itemNameRemoved: {
    textDecorationLine: 'line-through',
    color: Colors.red,
  },
  itemPrice: {
    color: Colors.gold,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    marginTop: 2,
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: Radii.sm,
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    color: Colors.textPrimary,
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.black,
  },
  qtyText: {
    color: Colors.textPrimary,
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.black,
    minWidth: 24,
    textAlign: 'center',
  },
  removeIconBtn: {
    padding: 6,
    marginLeft: 4,
  },
  removeIconText: {
    color: Colors.textFaint,
    fontSize: FontSizes.body,
    fontWeight: FontWeights.bold,
  },
  restoreBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radii.md,
    backgroundColor: Colors.goldDim,
    borderWidth: 1,
    borderColor: Colors.goldBorder,
  },
  restoreBtnText: {
    color: Colors.gold,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.black,
  },

  // Footer
  footer: {
    padding: Spacing.xl,
    borderTopWidth: 1,
    borderColor: Colors.borderLight,
    gap: Spacing.md,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    color: Colors.textDim,
    fontSize: FontSizes.body,
    fontWeight: FontWeights.bold,
    letterSpacing: 0.5,
  },
  totalValue: {
    color: Colors.gold,
    fontSize: FontSizes.display,
    fontWeight: FontWeights.black,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  cartBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.goldBorder,
    backgroundColor: Colors.bgInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBtnText: {
    color: Colors.gold,
    fontSize: FontSizes.body,
    fontWeight: FontWeights.black,
    letterSpacing: 0.5,
  },
  saveBtn: {
    flex: 2,
    paddingVertical: Spacing.md,
    borderRadius: Radii.lg,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: Colors.black,
    fontSize: FontSizes.body,
    fontWeight: FontWeights.black,
    letterSpacing: 0.5,
  },
});
