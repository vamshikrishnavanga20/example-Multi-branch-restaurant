/**
 * BranchSelectScreen — First-launch screen for selecting the franchise terminal location.
 *
 * Fetches branches from the API, shows them in a premium dark card list.
 * On selection, saves the branch to AsyncStorage and transitions to PIN login.
 */

import React, { useEffect, useState, useContext } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, StyleSheet, Animated, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import { ActiveBranch } from '../../lib/branchStorage';
import { getBranches } from '../../services/api';
import { Colors, Spacing, Radii, FontSizes, FontWeights } from '../constants/theme';
import { hapticTap, hapticSuccess } from '../utils/haptics';

export default function BranchSelectScreen() {
  const { setActiveBranch } = useContext(AuthContext);
  const [branches, setBranches] = useState<ActiveBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.95));

  useEffect(() => {
    loadBranches();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }),
    ]).start();
  }, []);

  const loadBranches = async () => {
    setLoading(true);
    try {
      const list = await getBranches();
      setBranches(list.filter(b => b.status === 'active'));
    } catch (e) {
      console.warn('Failed to load branches:', e);
    }
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadBranches();
    setRefreshing(false);
  };

  const handleSelect = (branch: ActiveBranch) => {
    hapticSuccess();
    setActiveBranch(branch);
  };

  const renderBranch = ({ item, index }: { item: ActiveBranch; index: number }) => {
    const delay = index * 80;
    const itemFade = new Animated.Value(0);
    const itemSlide = new Animated.Value(30);

    Animated.parallel([
      Animated.timing(itemFade, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
      Animated.timing(itemSlide, { toValue: 0, duration: 400, delay, useNativeDriver: true }),
    ]).start();

    return (
      <Animated.View style={{ opacity: itemFade, transform: [{ translateY: itemSlide }] }}>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => {
            hapticTap();
            handleSelect(item);
          }}
        >
          <View style={styles.cardLeft}>
            <View style={styles.branchIconWrap}>
              <Text style={styles.branchIconText}>{item.code?.slice(0, 3) || 'POS'}</Text>
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={styles.cardCity}>{item.city || 'Flagship Hub'}</Text>
              {item.address ? (
                <Text style={styles.cardAddress} numberOfLines={1}>{item.address}</Text>
              ) : null}
            </View>
          </View>
          <View style={styles.cardRight}>
            <View style={styles.codeBadge}>
              <Text style={styles.codeBadgeText}>{item.code || 'POS'}</Text>
            </View>
            <Text style={styles.selectArrow}>›</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.View
        style={[styles.container, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}
      >
        {/* Header */}
        <View style={styles.headerWrap}>
          <Text style={styles.goldSubtitle}>EXAMPLE PROJECT ENTERPRISE</Text>
          <Text style={styles.title}>Select Terminal Location</Text>
          <Text style={styles.subtext}>
            Choose the restaurant branch for this POS device.{'\n'}
            All orders will be attributed to this branch.
          </Text>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Branch List */}
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={Colors.gold} />
            <Text style={styles.loadingText}>Loading branches...</Text>
          </View>
        ) : branches.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No Branches Found</Text>
            <Text style={styles.emptyText}>
              Add branches from the Admin Command Center, then pull down to refresh.
            </Text>
          </View>
        ) : (
          <FlatList
            data={branches}
            keyExtractor={item => item.id}
            renderItem={renderBranch}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={Colors.gold}
                colors={[Colors.gold]}
              />
            }
          />
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {branches.length} branch{branches.length !== 1 ? 'es' : ''} available
          </Text>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  container: {
    flex: 1,
    padding: Spacing.xxl,
  },

  // Header
  headerWrap: {
    marginBottom: Spacing.xl,
  },
  goldSubtitle: {
    color: Colors.gold,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.black,
    letterSpacing: 3,
    marginBottom: Spacing.sm,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: FontSizes.mega,
    fontWeight: FontWeights.black,
    marginBottom: Spacing.sm,
  },
  subtext: {
    color: Colors.textDim,
    fontSize: FontSizes.body,
    lineHeight: 20,
  },

  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: Spacing.xl,
  },

  // Branch Cards
  list: {
    gap: Spacing.md,
    paddingBottom: Spacing.huge,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radii.xxl,
    padding: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  branchIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.goldDim,
    borderWidth: 1,
    borderColor: Colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  branchIconText: {
    color: Colors.gold,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.black,
    letterSpacing: 0.5,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    color: Colors.textPrimary,
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    marginBottom: 2,
  },
  cardCity: {
    color: Colors.textDim,
    fontSize: FontSizes.body,
    fontWeight: FontWeights.semibold,
  },
  cardAddress: {
    color: Colors.textFaint,
    fontSize: FontSizes.xs,
    marginTop: 2,
  },

  cardRight: {
    alignItems: 'center',
    gap: 6,
  },
  codeBadge: {
    backgroundColor: Colors.goldDim,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: Colors.goldBorder,
  },
  codeBadgeText: {
    color: Colors.gold,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.black,
    letterSpacing: 0.5,
  },
  selectArrow: {
    color: Colors.textFaint,
    fontSize: 24,
    fontWeight: FontWeights.bold,
  },

  // Loading
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: Colors.textDim,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    marginTop: Spacing.md,
  },

  // Empty
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: FontSizes.title,
    fontWeight: FontWeights.bold,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    color: Colors.textDim,
    fontSize: FontSizes.md,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Footer
  footer: {
    paddingTop: Spacing.md,
    alignItems: 'center',
  },
  footerText: {
    color: Colors.textGhost,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
  },
});
