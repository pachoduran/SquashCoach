import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getDatabase } from '@/src/store/database';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { useSync } from '@/src/context/SyncContext';
import { SyncBanner } from '@/src/components/SyncBanner';
import { syncService } from '@/src/store/syncService';
import { format } from 'date-fns';

interface RefereeRow {
  id: number;
  player1_name: string;
  player2_name: string;
  player1_games: number;
  player2_games: number;
  winner_name: string | null;
  best_of: number;
  date: string;
  duration_seconds: number | null;
  status: string;
  server_id: string | null;
}

export default function ArbitrajeHistory() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { syncNow } = useSync();

  const [rows, setRows] = useState<RefereeRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const db = await getDatabase();
    const r = await db.getAllAsync(
      `SELECT * FROM referee_matches WHERE user_id = ? OR user_id IS NULL OR user_id = '' ORDER BY date DESC`,
      [user?.user_id || '']
    );
    setRows(r as RefereeRow[]);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
      syncNow().then(() => load()).catch(() => {});
    }, [load, syncNow])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try { await syncNow(); await load(); } finally { setRefreshing(false); }
  };

  const remove = (row: RefereeRow) => {
    Alert.alert('', t('referee.deleteConfirm'), [
      { text: t('common.cancel') || 'Cancelar' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          const db = await getDatabase();
          await db.runAsync('DELETE FROM referee_matches WHERE id = ?', [row.id]);
          if (row.server_id) await syncService.deleteRefereeMatchCloud(row.server_id);
          load();
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: RefereeRow }) => {
    const isInProg = item.status === 'in_progress';
    return (
      <TouchableOpacity
        style={[styles.row, isInProg && styles.rowInProgress]}
        onPress={() => {
          if (isInProg) {
            router.push('/arbitraje');
          } else {
            router.push({ pathname: '/arbitraje-summary', params: { id: String(item.id) } });
          }
        }}
        onLongPress={() => remove(item)}
        data-testid={`ref-history-row-${item.id}`}
      >
        <View style={{ flex: 1 }}>
          <View style={styles.namesRow}>
            <Text style={styles.name}>{item.player1_name}</Text>
            <Text style={styles.scoreText}>{item.player1_games} - {item.player2_games}</Text>
            <Text style={styles.name}>{item.player2_name}</Text>
          </View>
          <Text style={styles.metaText}>
            {isInProg ? '⏳ En curso · ' : ''}
            {format(new Date(item.date), 'dd MMM yyyy · HH:mm')} · BO{item.best_of}
            {item.winner_name ? ` · 🏆 ${item.winner_name}` : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#999" />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="arb-hist-back">
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('referee.history')}</Text>
        <View style={{ width: 40 }} />
      </View>
      <SyncBanner />
      <FlatList
        data={rows}
        keyExtractor={r => String(r.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>{t('referee.noMatches')}</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1E3A5F', paddingHorizontal: 12, paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 10, padding: 14, gap: 10,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 1,
  },
  rowInProgress: { borderLeftWidth: 4, borderLeftColor: '#FF9800' },
  namesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  name: { fontSize: 15, fontWeight: '700', color: '#1E3A5F', flex: 1 },
  scoreText: { fontSize: 18, fontWeight: '900', color: '#1565C0', marginHorizontal: 10 },
  metaText: { fontSize: 11, color: '#888' },
  empty: { textAlign: 'center', color: '#999', marginTop: 30 },
});
