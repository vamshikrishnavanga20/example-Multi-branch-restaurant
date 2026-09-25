/**
 * ErrorBoundary — Catches unhandled JS errors and shows a recovery screen.
 *
 * Prevents white-screen crashes in production. Offers a "Reload" button.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Spacing, Radii, FontSizes, FontWeights } from '../constants/theme';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message || 'Unknown error' };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // In production, you'd send this to a crash reporting service
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.iconBadge}>
            <Text style={styles.iconText}>!</Text>
          </View>
          <Text style={styles.title}>System Recovery</Text>
          <Text style={styles.message}>
            An unexpected error occurred. The application state can be safely restored.
          </Text>
          <Text style={styles.errorDetail} numberOfLines={3}>
            {this.state.errorMessage}
          </Text>
          <TouchableOpacity style={styles.reloadBtn} onPress={this.handleReload} activeOpacity={0.85}>
            <Text style={styles.reloadText}>RESTART APPLICATION</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxxl,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: Colors.gold,
    backgroundColor: 'rgba(212, 160, 23, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  iconText: {
    color: Colors.gold,
    fontSize: 28,
    fontWeight: FontWeights.black,
  },
  title: {
    fontSize: FontSizes.display,
    fontWeight: FontWeights.black,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: FontSizes.lg,
    color: Colors.textDim,
    fontWeight: FontWeights.semibold,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  errorDetail: {
    fontSize: FontSizes.sm,
    color: Colors.textFaint,
    fontWeight: FontWeights.normal,
    textAlign: 'center',
    backgroundColor: Colors.bgInput,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radii.lg,
    overflow: 'hidden',
    marginBottom: Spacing.xxxl,
    maxWidth: '100%',
  },
  reloadBtn: {
    backgroundColor: Colors.gold,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xxxl,
    borderRadius: Radii.xxl,
  },
  reloadText: {
    color: Colors.bg,
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.black,
  },
});
