/**
 * NotificationContext — In-app toast notification system.
 *
 * Provides `showNotification(title, body, type)` to any component.
 * Renders a slide-down toast at the top of the screen with auto-dismiss.
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import NotificationToast from '../components/NotificationToast';
import { AuthContext } from './AuthContext';

export type NotificationType = 'success' | 'warning' | 'info' | 'order_ready';

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
}

interface NotificationContextType {
  showNotification: (title: string, body: string, type?: NotificationType) => void;
}

export const NotificationContext = createContext<NotificationContextType>({
  showNotification: () => {},
});

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { userRole } = useContext(AuthContext);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const idCounter = useRef(0);

  const showNotification = useCallback((title: string, body: string, type: NotificationType = 'info') => {
    // Suppress all in-app notifications if user is currently inside Admin mode
    if (userRole === 'admin') return;

    const id = `notif-${Date.now()}-${++idCounter.current}`;
    setNotifications(prev => [...prev, { id, title, body, type }]);
  }, [userRole]);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      {userRole !== 'admin' && (
        <NotificationToast
          notifications={notifications}
          onDismiss={dismissNotification}
        />
      )}
    </NotificationContext.Provider>
  );
};
