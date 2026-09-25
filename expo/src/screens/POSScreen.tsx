import React, { useContext, useState, useMemo, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  TextInput, Keyboard, FlatList, Modal,
  ActivityIndicator, BackHandler, PanResponder, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import { PosContext } from '../context/PosContext';
import OrderSuccessModal from '../components/OrderSuccessModal';
import ItemNotesModal from '../components/ItemNotesModal';
import Header from '../components/Header';
import CartPanel from '../components/CartPanel';
import { useIsTablet, useResponsiveColumns } from '../constants/layout';
import { Colors, Spacing, Radii, FontSizes, FontWeights } from '../constants/theme';
import { hapticTap, hapticMedium, hapticWarning } from '../utils/haptics';

interface MenuItemCardProps {
  item: any;
  qty: number;
  notes?: string;
  onAdd: (item: any) => void;
  onSubtract: (item: any) => void;
  onOpenNotes: (item: any, notes: string) => void;
}

// ── Memoized Pure Item Card (60fps: Prevents other items from re-rendering on cart changes) ──
const MenuItemCard = React.memo(
  function MenuItemCard({ item, qty, notes, onAdd, onSubtract, onOpenNotes }: MenuItemCardProps) {
    const hasItem = qty > 0;
    return (
      <TouchableOpacity
        style={[styles.card, { flex: 1, margin: 5 }, hasItem && styles.cardActive]}
        onPress={() => {
          if (!hasItem) {
            onAdd(item);
          }
        }}
        onLongPress={() => hasItem && onOpenNotes(item, notes || '')}
        delayLongPress={450}
        activeOpacity={0.75}
      >
        <View style={styles.cardInner}>
          <Text style={styles.priceTag}>₹{item.price}</Text>
          <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
          {notes ? (
            <Text style={styles.cardNotePreview} numberOfLines={1}>Note: {notes}</Text>
          ) : null}
          {hasItem ? (
            <View style={styles.qtyRow}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => onSubtract(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Text style={styles.qtyBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.qtyValue}>{qty}</Text>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => onAdd(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.addText}>Tap to add +</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  },
  (prev, next) => {
    return (
      prev.item.id === next.item.id &&
      prev.item.price === next.item.price &&
      prev.item.name === next.item.name &&
      prev.qty === next.qty &&
      prev.notes === next.notes
    );
  }
);

export default function POSScreen() {
  const { lockTerminal } = useContext(AuthContext);
  const {
    categories, menuItems, cart, updateCart, updateCartItemNotes, clearCart,
    tableNumber, setTableNumber,
    orderNotes, setOrderNotes,
    handlePlaceOrder, placingOrder, isOffline,
    showSuccess, setShowSuccess, lastOrderSummary,
  } = useContext(PosContext);

  const isTablet = useIsTablet();
  const numColumns = useResponsiveColumns(2, 3);

  const [activeCategoryId, setActiveCategoryId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cartSheetOpen, setCartSheetOpen] = useState(false);
  const [notesItem, setNotesItem] = useState<{ id: string; name: string; notes: string } | null>(null);

  // Android hardware back button handler
  useEffect(() => {
    if (!cartSheetOpen) return;
    const onBackPress = () => {
      setCartSheetOpen(false);
      return true; // Prevents default exit behavior
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [cartSheetOpen]);

  // Swipe/slide down gesture to dismiss Review Order sheet
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return gestureState.dy > 12;
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 45 || gestureState.vy > 0.35) {
            setCartSheetOpen(false);
          }
        },
      }),
    []
  );

  const filteredItems = useMemo(() => {
    let items = menuItems as any[];
    if (activeCategoryId !== 'all') items = items.filter(i => i.category_id === activeCategoryId);
    if (searchQuery.trim()) items = items.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return items;
  }, [menuItems, activeCategoryId, searchQuery]);

  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const cartQty   = cart.reduce((s, i) => s + i.qty, 0);

  // O(1) quantity & notes lookup map for instantaneous item updates
  const cartQtyMap = useMemo(() => {
    const map: Record<string, { qty: number; notes: string }> = {};
    for (let i = 0; i < cart.length; i++) {
      const c = cart[i];
      map[c.id] = { qty: c.qty, notes: c.notes || '' };
    }
    return map;
  }, [cart]);

  // Stable callbacks — zero extra allocations
  const handleAdd = useCallback((item: any) => {
    hapticTap();
    updateCart(item, 1);
  }, [updateCart]);

  const handleSubtract = useCallback((item: any) => {
    hapticTap();
    updateCart(item, -1);
  }, [updateCart]);

  const handleOpenNotes = useCallback((item: any, notes: string) => {
    hapticMedium();
    setNotesItem({ id: item.id, name: item.name, notes });
  }, []);

  const renderMenuItem = useCallback(
    ({ item }: { item: any }) => {
      const entry = cartQtyMap[item.id];
      return (
        <MenuItemCard
          item={item}
          qty={entry ? entry.qty : 0}
          notes={entry ? entry.notes : undefined}
          onAdd={handleAdd}
          onSubtract={handleSubtract}
          onOpenNotes={handleOpenNotes}
        />
      );
    },
    [cartQtyMap, handleAdd, handleSubtract, handleOpenNotes]
  );


  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {/* Header */}
      <Header
        subtitle="TAKING ORDER"
        isOffline={isOffline}
        onLock={lockTerminal}
      />

      {/* Offline Notice Banner */}
      {isOffline && (
        <View style={styles.offlineNotice}>
          <Text style={styles.offlineNoticeText}>
            OFFLINE MODE: Orders are saved locally and will auto-sync when online.
          </Text>
        </View>
      )}

      <View style={[styles.body, isTablet && { flexDirection: 'row' }]}>
        {/* ── MENU ── */}
        <View style={{ flex: isTablet ? 3 : 1 }}>
          {/* Search */}
          <View style={styles.searchWrap}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search menu items..."
              placeholderTextColor={Colors.textDim}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>

          {/* Categories — FIXED: proper height, no clipping */}
          <View style={styles.catBar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.catScroll}
              keyboardShouldPersistTaps="handled"
            >
              <TouchableOpacity
                style={[styles.catPill, activeCategoryId === 'all' && styles.catPillOn]}
                onPress={() => {
                  hapticTap();
                  setActiveCategoryId('all');
                }}
              >
                <Text style={[styles.catText, activeCategoryId === 'all' && styles.catTextOn]}>All Dishes</Text>
              </TouchableOpacity>
              {(categories as any[]).map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catPill, activeCategoryId === cat.id && styles.catPillOn]}
                  onPress={() => {
                    hapticTap();
                    setActiveCategoryId(cat.id);
                  }}
                >
                  <Text style={[styles.catText, activeCategoryId === cat.id && styles.catTextOn]}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Grid */}
          <FlatList
            key={numColumns}
            data={filteredItems}
            keyExtractor={item => item.id}
            numColumns={numColumns}
            contentContainerStyle={styles.grid}
            renderItem={renderMenuItem}
            onScrollBeginDrag={Keyboard.dismiss}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews={Platform.OS === 'android'}
            maxToRenderPerBatch={12}
            updateCellsBatchingPeriod={30}
            windowSize={5}
            initialNumToRender={10}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                {searchQuery ? 'No dishes match your search.' : 'No items available.'}
              </Text>
            }
          />
        </View>

        {/* ── CART (tablet) ── */}
        {isTablet && (
          <View style={styles.tabletCart}>
            <CartPanel isTablet={true} onOpenNotes={setNotesItem} />
          </View>
        )}
      </View>

      {/* Floating cart button (phone) */}
      {!isTablet && cart.length > 0 && (
        <View style={styles.floatWrap}>
          <View style={styles.floatRow}>
            <TouchableOpacity
              style={styles.floatBtn}
              onPress={() => {
                hapticMedium();
                setCartSheetOpen(true);
              }}
              activeOpacity={0.9}
            >
              <View>
                <Text style={styles.floatItems}>{cartQty} item{cartQty > 1 ? 's' : ''}</Text>
                <Text style={styles.floatTotal}>₹{cartTotal}</Text>
              </View>
              <Text style={styles.floatReview}>Review Order ›</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.floatCancelBtn} 
              onPress={() => {
                hapticWarning();
                clearCart();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.floatCancelText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Cart bottom sheet (phone) */}
      {!isTablet && (
        <Modal
          visible={cartSheetOpen}
          animationType="slide"
          transparent
          onRequestClose={() => setCartSheetOpen(false)}
        >
          <View style={styles.sheetOverlay}>
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => setCartSheetOpen(false)}
            />
            <View style={styles.sheet}>
              <View style={styles.sheetHandleWrap} {...panResponder.panHandlers}>
                <View style={styles.sheetHandle} />
              </View>
              <CartPanel
                isTablet={false}
                onCloseSheet={() => setCartSheetOpen(false)}
                onOpenNotes={setNotesItem}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Per-item notes modal */}
      <ItemNotesModal
        visible={!!notesItem}
        itemName={notesItem?.name || ''}
        currentNotes={notesItem?.notes || ''}
        onSave={notes => notesItem && updateCartItemNotes(notesItem.id, notes)}
        onClose={() => setNotesItem(null)}
      />

      {/* Success modal */}
      <OrderSuccessModal
        visible={showSuccess}
        itemCount={lastOrderSummary?.itemCount ?? 0}
        total={lastOrderSummary?.total ?? 0}
        table={lastOrderSummary?.table ?? ''}
        orderId={lastOrderSummary?.orderId}
        onDismiss={() => setShowSuccess(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },

  offlineNotice: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(239,68,68,0.3)',
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
  },
  offlineNoticeText: {
    color: '#F87171',
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold,
  },

  body: { flex: 1, backgroundColor: Colors.bgSurface },

  searchWrap: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  searchInput: {
    backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radii.lg, paddingHorizontal: Spacing.xl - 6, paddingVertical: Spacing.md,
    color: Colors.textPrimary, fontSize: FontSizes.lg,
  },

  // ─── Category Bar — FIXED ─────────────────────────────────────────────────
  catBar: {
    height: 52,
    borderBottomWidth: 1,
    borderColor: Colors.borderLight,
  },
  catScroll: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  catPill: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md - 2,
    borderRadius: Radii.pill,
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.border,
    height: 36,
    justifyContent: 'center',
  },
  catPillOn: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  catText: { color: Colors.textDim, fontWeight: FontWeights.bold, fontSize: FontSizes.body },
  catTextOn: { color: Colors.bg, fontWeight: FontWeights.black },

  grid: { padding: 5, paddingBottom: 130 },
  card: {
    backgroundColor: Colors.bgInput, borderRadius: Radii.xxl, borderWidth: 1.5,
    borderColor: Colors.border, marginBottom: 5, overflow: 'hidden',
  },
  cardActive: { borderColor: Colors.gold, backgroundColor: Colors.bgElevated },
  cardInner: { padding: Spacing.xl - 6 },
  priceTag: { color: Colors.gold, fontWeight: FontWeights.black, fontSize: FontSizes.lg, marginBottom: 5 },
  cardName: { color: Colors.textSecondary, fontSize: FontSizes.md, fontWeight: FontWeights.bold, minHeight: 34, marginBottom: 4 },
  cardNotePreview: { color: Colors.textDim, fontSize: FontSizes.sm, marginBottom: 6 },
  addText: { color: Colors.gold, fontWeight: FontWeights.extrabold, fontSize: FontSizes.body, marginTop: 6 },
  qtyRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.border, borderRadius: Radii.md, padding: 3, marginTop: 6,
  },
  qtyBtn: {
    width: 32, height: 32, backgroundColor: Colors.borderFocus,
    borderRadius: Radii.sm, alignItems: 'center', justifyContent: 'center',
  },
  qtyBtnText: { color: Colors.textPrimary, fontSize: 20, lineHeight: 24 },
  qtyValue: { color: Colors.textPrimary, fontSize: FontSizes.xl, fontWeight: FontWeights.black },
  emptyText: { color: Colors.textFaint, textAlign: 'center', marginTop: 40, fontSize: FontSizes.md },

  tabletCart: { width: 340, borderLeftWidth: 1, borderColor: Colors.borderLight, backgroundColor: Colors.bgCard },

  // Cart styles moved to CartPanel.tsx

  floatWrap: { position: 'absolute', bottom: Spacing.lg, left: Spacing.md, right: Spacing.md, zIndex: 99 },
  floatRow: { flexDirection: 'row', gap: Spacing.md - 2, alignItems: 'stretch' },
  floatBtn: {
    flex: 1, backgroundColor: Colors.gold, borderRadius: Radii.pill, padding: Spacing.lg,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    elevation: 10, shadowColor: Colors.gold, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10,
  },
  floatCancelBtn: {
    backgroundColor: Colors.borderFocus, width: 56, borderRadius: Radii.pill,
    alignItems: 'center', justifyContent: 'center',
    elevation: 4, shadowColor: Colors.black, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 6,
  },
  floatCancelText: { color: Colors.red, fontSize: 20, fontWeight: FontWeights.black },
  floatItems: { color: Colors.bg, fontSize: FontSizes.sm, fontWeight: FontWeights.extrabold, opacity: 0.7 },
  floatTotal: { color: Colors.bg, fontSize: FontSizes.hero, fontWeight: FontWeights.black },
  floatReview: { color: Colors.bg, fontWeight: FontWeights.black, fontSize: FontSizes.md },

  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.bgCard, borderTopLeftRadius: Radii.sheet, borderTopRightRadius: Radii.sheet,
    paddingTop: Spacing.xs, paddingBottom: 40, height: '90%',
  },
  sheetHandleWrap: { width: '100%', paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  sheetHandle: { width: 44, height: 4, backgroundColor: '#3F3F46', borderRadius: 2 },
});