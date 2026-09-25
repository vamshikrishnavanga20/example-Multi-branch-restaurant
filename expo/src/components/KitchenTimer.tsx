import React, { useState, useEffect } from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { Colors, FontSizes, FontWeights, Radii, Spacing } from '../constants/theme';

interface KitchenTimerProps {
  timestamp: string; // ISO string
}

export default function KitchenTimer({ timestamp }: KitchenTimerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startTime = new Date(timestamp).getTime();
    
    // Initial calculation
    setElapsed(Math.floor((Date.now() - startTime) / 1000));

    // Update every second
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [timestamp]);

  const totalSeconds = Math.max(0, elapsed);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hours = Math.floor(totalMinutes / 60);

  let formattedTime = '';
  if (hours >= 24) {
    formattedTime = '>24h';
  } else if (hours > 0) {
    const remainingMins = totalMinutes % 60;
    formattedTime = `${hours}h ${remainingMins}m`;
  } else {
    formattedTime = `${totalMinutes}:${seconds.toString().padStart(2, '0')}`;
  }
  
  // Enterprise KDS color-coding based on wait time
  let statusStyle = styles.normal;
  let textStyle = styles.textNormal;
  if (totalMinutes >= 20) {
    statusStyle = styles.critical;
    textStyle = styles.textCritical;
  } else if (totalMinutes >= 10) {
    statusStyle = styles.warning;
    textStyle = styles.textWarning;
  }

  return (
    <View style={[styles.container, statusStyle]}>
      <Text style={[styles.text, textStyle]}>{formattedTime}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: Radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: FontSizes.body - 1,
    fontWeight: FontWeights.black,
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
  },
  normal: {
    backgroundColor: '#1C1C1E',
    borderColor: '#2C2C2E',
  },
  textNormal: {
    color: '#A1A1AA',
  },
  warning: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderColor: 'rgba(245,158,11,0.4)',
  },
  textWarning: {
    color: '#FBBF24',
  },
  critical: {
    backgroundColor: 'rgba(239,68,68,0.18)',
    borderColor: 'rgba(239,68,68,0.5)',
  },
  textCritical: {
    color: '#F87171',
  },
});
