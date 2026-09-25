import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { NotificationProvider } from './src/context/NotificationContext';
import ErrorBoundary from './src/components/ErrorBoundary';
import AppNavigator from './src/navigation/AppNavigator';
import { initOfflineDatabase } from './lib/offlineQueue';
import { registerForPushNotificationsAsync } from './src/services/notificationService';

// Initialize offline SQLite database on phone startup
initOfflineDatabase();

/**
 * Production-grade QueryClient configuration.
 *
 * - retry: 3 attempts with exponential backoff
 * - gcTime: 30 minutes before garbage-collecting inactive queries
 * - staleTime: 5 minutes before considering data stale
 * - refetchOnReconnect: auto-refresh when network comes back
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 15000),
      gcTime: 1000 * 60 * 30,
      staleTime: 1000 * 60 * 5,
      refetchOnReconnect: 'always',
    },
    mutations: {
      retry: 2,
      retryDelay: 1000,
    },
  },
});

export default function App() {
  useEffect(() => {
    registerForPushNotificationsAsync();
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <AuthProvider>
            <NotificationProvider>
              <AppNavigator />
            </NotificationProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}