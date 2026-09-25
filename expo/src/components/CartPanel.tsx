import React, { useContext } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { PosContext } from '../context/PosContext';
import { Colors, Spacing, Radii, FontSizes, FontWeights } from '../constants/theme';
import { hapticTap, hapticMedium, hapticWarning } from '../utils/haptics';

interface CartPanelProps {
  isTablet: boolean;
  onCloseSheet?: () => void;
  onOpenNotes: (item: { id: string; name: string; notes: string }) => void;
}

const ORDER_TYPE_OPTIONS = [
  { key: 'walk-in', label: 'Walk-in', value: 'Walk-in' },
  { key: 'parcel', label: 'Parcel', value: 'Parcel' },
  { key: 'catering', label: 'Catering Service', value: 'Catering Service' },
] as const;

export default function CartPanel({ isTablet, onCloseSheet, onOpenNotes }: CartPanelProps) {
  const {
    cart, updateCart, clearCart,
    tableNumber, setTableNumber,
    orderType, setOrderType,
    orderNotes, setOrderNotes,
    handlePlaceOrder, placingOrder,
  } = useContext(PosContext);

  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const cartQty = cart.reduce((s, i) => s + i.qty, 0);

  return (
    <View style={styles.cartWrap}>
      {/* Header */}
      <View style={styles.cartHeader}>
        {!isTablet && onCloseSheet ? (
          <TouchableOpacity onPress={onCloseSheet} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backText}>‹ BACK</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={styles.cartTitle}>Review Order</Text>
        {!isTablet && onCloseSheet ? (
          <TouchableOpacity onPress={onCloseSheet} style={styles.closeBtn} activeOpacity={0.7}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        ) : (
          !isTablet ? null : <View style={{ width: 32 }} />
        )}
      </View>

      {/* Type of Order Selection (Replaces table numbers) */}
      <View style={styles.typeWrap}>
        <Text style={styles.typeLabel}>TYPE OF ORDER</Text>
        <View style={styles.typeGrid}>
          {ORDER_TYPE_OPTIONS.map(opt => {
            const active = tableNumber === opt.value || orderType === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.typeCard, active && styles.typeCardActive]}
                onPress={() => {
                  hapticMedium();
                  setTableNumber(opt.value);
                  setOrderType(opt.key);
                }}
                activeOpacity={0.75}
              >
                <Text style={[styles.typeText, active && styles.typeTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Cart items */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {cart.length === 0 ? (
          <View style={styles.emptyCart}>
            <Text style={styles.emptyCartText}>Cart is empty</Text>
            <Text style={styles.emptyCartSub}>Select menu items to add to order</Text>
          </View>
        ) : (
          <>
            {cart.map(item => (
              <View key={item.id} style={styles.cartRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cartName}>{item.name}</Text>
                  {item.notes ? (
                    <Text style={styles.cartNotes} numberOfLines={1}>NOTE: {item.notes}</Text>
                  ) : null}
                  <Text style={styles.cartPrice}>₹{item.price * item.qty}</Text>
                </View>

                <TouchableOpacity
                  style={[styles.noteBtn, !!item.notes && styles.noteBtnActive]}
                  onPress={() => {
                    hapticTap();
                    onOpenNotes({ id: item.id, name: item.name, notes: item.notes || '' });
                  }}
                >
                  <Text style={[styles.noteBtnText, !!item.notes && styles.noteBtnTextActive]}>
                    {item.notes ? 'EDIT' : '+NOTE'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.cartQtyWrap}>
                  <TouchableOpacity
                    style={styles.cartQtyBtn}
                    onPress={() => {
                      hapticTap();
                      updateCart(item, -1);
                    }}
                  >
                    <Text style={styles.cartQtyBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.cartQtyVal}>{item.qty}</Text>
                  <TouchableOpacity
                    style={styles.cartQtyBtn}
                    onPress={() => {
                      hapticTap();
                      updateCart(item, 1);
                    }}
                  >
                    <Text style={styles.cartQtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {/* Special Instructions */}
            <View style={styles.specialNoteWrap}>
              <Text style={styles.specialNoteLabel}>SPECIAL INSTRUCTIONS</Text>
              <TextInput
                style={styles.specialNoteInput}
                placeholder="e.g. Extra spicy, less oil, pack separately..."
                placeholderTextColor={Colors.textFaint}
                value={orderNotes}
                onChangeText={setOrderNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </>
        )}
      </ScrollView>

      {/* Footer */}
      {cart.length > 0 && (
        <View style={styles.cartFooter}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalVal}>₹{cartTotal}</Text>
          </View>
          <TouchableOpacity
            style={styles.sendBtn}
            onPress={() => {
              if (onCloseSheet) onCloseSheet();
              handlePlaceOrder();
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.sendBtnText}>SEND TO KITCHEN ({cartQty})</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              hapticWarning();
              clearCart();
            }}
            style={styles.clearBtn}
          >
            <Text style={styles.clearBtnText}>Clear cart</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cartWrap: { flex: 1, paddingHorizontal: Spacing.xxl - 6, paddingBottom: Spacing.md - 2, paddingTop: 4 },
  cartHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.md, paddingBottom: Spacing.md, borderBottomWidth: 1, borderColor: Colors.border,
  },
  cartTitle: { color: Colors.textPrimary, fontSize: FontSizes.title, fontWeight: FontWeights.black },
  backBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.sm,
    backgroundColor: '#1C1C1F',
    borderWidth: 1,
    borderColor: '#2A2A2E',
  },
  backText: {
    color: Colors.gold,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.black,
    letterSpacing: 0.5,
  },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: Colors.textMuted, fontSize: FontSizes.md, fontWeight: FontWeights.black },

  typeWrap: { marginBottom: Spacing.md },
  typeLabel: { color: Colors.gold, fontSize: FontSizes.xs, fontWeight: FontWeights.black, letterSpacing: 1, marginBottom: 8 },
  typeGrid: { flexDirection: 'row', gap: 6 },
  typeCard: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: Radii.md,
    backgroundColor: '#18181B',
    borderWidth: 1.5,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeCardActive: {
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderColor: Colors.gold,
  },
  typeText: {
    fontSize: FontSizes.body - 1,
    fontWeight: FontWeights.bold,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  typeTextActive: {
    color: Colors.gold,
    fontWeight: FontWeights.black,
  },

  cartRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderColor: Colors.borderLight, gap: Spacing.md - 2,
  },
  cartName: { color: Colors.textPrimary, fontSize: FontSizes.md, fontWeight: FontWeights.bold },
  cartNotes: { color: '#FBBF24', fontSize: FontSizes.sm, marginTop: 1, fontWeight: FontWeights.semibold },
  cartPrice: { color: Colors.gold, fontSize: FontSizes.body, fontWeight: FontWeights.extrabold, marginTop: 2 },
  noteBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: Radii.sm,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteBtnActive: { backgroundColor: 'rgba(245,158,11,0.15)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' },
  noteBtnText: { color: Colors.textMuted, fontSize: FontSizes.xs, fontWeight: FontWeights.black },
  noteBtnTextActive: { color: '#FBBF24' },
  cartQtyWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.border, borderRadius: Radii.md, padding: 2 },
  cartQtyBtn: { width: 32, height: 32, backgroundColor: Colors.borderFocus, borderRadius: Radii.sm, alignItems: 'center', justifyContent: 'center' },
  cartQtyBtnText: { color: Colors.textPrimary, fontSize: 18, lineHeight: 22 },
  cartQtyVal: { color: Colors.textPrimary, fontSize: FontSizes.lg, fontWeight: FontWeights.black, marginHorizontal: Spacing.md - 2 },

  specialNoteWrap: {
    marginTop: Spacing.lg, marginBottom: Spacing.sm,
    backgroundColor: '#121215', borderRadius: Radii.lg,
    borderWidth: 1, borderColor: '#24242A', padding: Spacing.md,
  },
  specialNoteLabel: { color: Colors.gold, fontSize: FontSizes.xs, fontWeight: FontWeights.black, letterSpacing: 0.8, marginBottom: 6 },
  specialNoteInput: { color: Colors.textPrimary, fontSize: FontSizes.body, minHeight: 64, lineHeight: 20 },

  emptyCart: { alignItems: 'center', paddingTop: 60 },
  emptyCartText: { color: Colors.textDim, fontSize: FontSizes.lg, fontWeight: FontWeights.bold },
  emptyCartSub: { color: Colors.textGhost, fontSize: FontSizes.body, marginTop: 4 },

  cartFooter: { paddingTop: Spacing.md, borderTopWidth: 1, borderColor: Colors.border },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  totalLabel: { color: Colors.textMuted, fontSize: FontSizes.lg, fontWeight: FontWeights.bold },
  totalVal: { color: Colors.gold, fontSize: FontSizes.giant, fontWeight: FontWeights.black },
  sendBtn: { backgroundColor: Colors.gold, paddingVertical: Spacing.lg - 2, borderRadius: Radii.lg, alignItems: 'center' },
  sendBtnOff: { backgroundColor: '#2A2A2C' },
  sendBtnText: { color: Colors.bg, fontSize: FontSizes.lg, fontWeight: FontWeights.black, letterSpacing: 0.5 },
  clearBtn: { alignItems: 'center', paddingTop: Spacing.md - 2 },
  clearBtnText: { color: Colors.red, fontSize: FontSizes.body, fontWeight: FontWeights.bold },
});
