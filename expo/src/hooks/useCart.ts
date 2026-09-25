/**
 * useCart — Cart state management hook.
 *
 * Pure client-side state. No server or database dependency.
 * Handles add/remove items, per-item notes, and clearing.
 */

import { useState, useCallback } from 'react';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  notes?: string;
  is_veg?: boolean;
}

export function useCart() {
  const [cart, setCart] = useState<CartItem[]>([]);

  const updateCart = useCallback((item: { id: string; name: string; price: number; is_veg?: boolean }, delta: number) => {
    setCart(prev => {
      const exists = prev.find(i => i.id === item.id);
      if (!exists && delta > 0) {
        return [
          ...prev,
          {
            id: item.id,
            name: item.name,
            price: item.price,
            qty: 1,
            is_veg: item.is_veg,
            notes: '',
          },
        ];
      }
      if (exists) {
        const newQty = exists.qty + delta;
        if (newQty <= 0) return prev.filter(i => i.id !== item.id);
        return prev.map(i => (i.id === item.id ? { ...i, qty: newQty } : i));
      }
      return prev;
    });
  }, []);

  const updateCartItemNotes = useCallback((itemId: string, notes: string) => {
    setCart(prev => prev.map(i => (i.id === itemId ? { ...i, notes } : i)));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const cartQty = cart.reduce((s, i) => s + i.qty, 0);

  return {
    cart,
    setCart,
    updateCart,
    updateCartItemNotes,
    clearCart,
    cartTotal,
    cartQty,
  };
}
