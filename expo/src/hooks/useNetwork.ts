/**
 * useNetwork — Network connectivity hook.
 *
 * Subscribes to NetInfo and exposes `isOffline`.
 */

import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

export function useNetwork() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  return { isOffline };
}
