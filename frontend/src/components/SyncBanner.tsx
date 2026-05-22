import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSync } from '@/src/context/SyncContext';
import { useLanguage } from '@/src/context/LanguageContext';

export const SyncBanner: React.FC = () => {
  const { isSyncing, isOnline, lastSyncAt, lastSyncStats } = useSync();
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<'syncing' | 'done' | 'offline'>('syncing');
  const opacity = useRef(new Animated.Value(0)).current;
  const lastSyncShownRef = useRef<Date | null>(null);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    if (!isOnline) {
      setMode('offline');
      setVisible(true);
    } else if (isSyncing) {
      setMode('syncing');
      setVisible(true);
    } else if (lastSyncAt && lastSyncAt !== lastSyncShownRef.current && lastSyncStats) {
      const hasChanges = lastSyncStats.uploaded > 0 || lastSyncStats.downloaded > 0;
      if (hasChanges) {
        lastSyncShownRef.current = lastSyncAt;
        setMode('done');
        setVisible(true);
        timeout = setTimeout(() => setVisible(false), 3000);
      } else {
        setVisible(false);
      }
    } else {
      setVisible(false);
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [isSyncing, isOnline, lastSyncAt, lastSyncStats]);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  if (!visible && (opacity as any)._value === 0) return null;

  const config = {
    syncing: { icon: 'sync', color: '#FF9800', text: t('sync.syncing') },
    done: {
      icon: 'cloud-done',
      color: '#4CAF50',
      text: lastSyncStats
        ? `${t('sync.updated')} (↑${lastSyncStats.uploaded} ↓${lastSyncStats.downloaded})`
        : t('sync.updated'),
    },
    offline: { icon: 'cloud-offline', color: '#9E9E9E', text: t('sync.offline') },
  }[mode];

  return (
    <Animated.View style={[styles.banner, { backgroundColor: config.color, opacity }]} data-testid="sync-banner">
      <Ionicons name={config.icon as any} size={14} color="#FFF" />
      <Text style={styles.text}>{config.text}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  text: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
