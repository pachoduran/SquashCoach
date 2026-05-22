import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { BarChart } from 'react-native-gifted-charts';
import { getDatabase } from '@/src/store/database';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { useSync } from '@/src/context/SyncContext';
import { SyncBanner } from '@/src/components/SyncBanner';
import { syncService } from '@/src/store/syncService';

interface Routine {
  id: number;
  user_id?: string;
  name?: string | null;
  date: string;
  zone_mode: number;
  interval_time: number;
  set_duration: number;
  rest_duration: number;
  number_of_sets: number;
  completed_sets: number;
  total_zones_visited: number;
  created_at: string;
  synced?: number;
  server_id?: string | null;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const startOfWeek = (d: Date): Date => {
  const date = new Date(d);
  const day = date.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day); // Mon = start
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

const formatTime = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatDate = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
};

const totalSeconds = (r: Routine): number =>
  r.completed_sets * r.set_duration + Math.max(0, r.completed_sets - 1) * r.rest_duration;

export default function ShadowHistory() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { syncNow } = useSync();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadRoutines = useCallback(async () => {
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync(
        'SELECT * FROM shadow_routines WHERE user_id = ? OR user_id IS NULL ORDER BY date DESC',
        [user?.user_id || '']
      );
      setRoutines(rows as Routine[]);
    } catch (e) {
      console.log('[ShadowHistory] Error cargando rutinas:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadRoutines();
      // Sync transparente en segundo plano via SyncContext
      syncNow().then(() => loadRoutines()).catch(() => {});
    }, [loadRoutines, syncNow])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await syncNow();
      await loadRoutines();
    } finally {
      setRefreshing(false);
    }
  };

  const deleteRoutine = (r: Routine) => {
    Alert.alert(
      t('shadowHistory.deleteTitle'),
      t('shadowHistory.deleteMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const db = await getDatabase();
              if (r.server_id) {
                await syncService.deleteShadowRoutineCloud(r.server_id);
              }
              await db.runAsync('DELETE FROM shadow_routines WHERE id = ?', [r.id]);
              await loadRoutines();
            } catch (e) {
              console.error('[ShadowHistory] Error eliminando:', e);
            }
          },
        },
      ]
    );
  };

  const repeatRoutine = (r: Routine) => {
    router.push({
      pathname: '/shadow-training',
      params: {
        zoneMode: String(r.zone_mode),
        intervalTime: String(r.interval_time),
        setDuration: String(r.set_duration),
        restDuration: String(r.rest_duration),
        numberOfSets: String(r.number_of_sets),
      },
    });
  };

  // ===== Chart data: last 8 weeks sessions =====
  const buildChartData = () => {
    const now = new Date();
    const weeks: { label: string; start: Date }[] = [];
    for (let i = 7; i >= 0; i--) {
      const s = startOfWeek(now);
      s.setDate(s.getDate() - i * 7);
      weeks.push({
        label: `${s.getDate()}/${s.getMonth() + 1}`,
        start: s,
      });
    }
    const counts = weeks.map((w, idx) => {
      const next = new Date(w.start);
      next.setDate(next.getDate() + 7);
      const count = routines.filter(r => {
        const d = new Date(r.date);
        return d >= w.start && d < next;
      }).length;
      return {
        value: count,
        label: w.label,
        frontColor: '#FF5722',
        topLabelComponent: () => (
          count > 0 ? <Text style={styles.barTop}>{count}</Text> : null
        ),
      };
    });
    return counts;
  };

  const chartData = buildChartData();
  const maxVal = Math.max(1, ...chartData.map(d => d.value));

  const renderItem = ({ item }: { item: Routine }) => {
    const cloudIcon = item.synced ? 'cloud-done-outline' : 'cloud-upload-outline';
    const cloudColor = item.synced ? '#4CAF50' : '#FF9800';
    return (
      <View style={styles.card} data-testid={`routine-card-${item.id}`}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardDate}>{formatDate(item.date)}</Text>
            <Text style={styles.cardName} numberOfLines={1}>
              {item.name || `${item.zone_mode} ${t('shadowHistory.zones')} · ${item.completed_sets}/${item.number_of_sets} ${t('shadowHistory.sets')}`}
            </Text>
          </View>
          <Ionicons name={cloudIcon} size={20} color={cloudColor} />
        </View>

        <View style={styles.cardStats}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{item.zone_mode}</Text>
            <Text style={styles.statLabel}>{t('shadowHistory.zones')}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{item.completed_sets}/{item.number_of_sets}</Text>
            <Text style={styles.statLabel}>{t('shadowHistory.sets')}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{item.interval_time}s</Text>
            <Text style={styles.statLabel}>{t('shadowHistory.interval')}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{formatTime(totalSeconds(item))}</Text>
            <Text style={styles.statLabel}>{t('shadowHistory.duration')}</Text>
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.repeatBtn]}
            onPress={() => repeatRoutine(item)}
            data-testid={`repeat-routine-${item.id}`}
          >
            <Ionicons name="refresh-circle-outline" size={20} color="#FFF" />
            <Text style={styles.actionBtnText}>{t('shadowHistory.repeat')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={() => deleteRoutine(item)}
            data-testid={`delete-routine-${item.id}`}
          >
            <Ionicons name="trash-outline" size={18} color="#F44336" />
            <Text style={[styles.actionBtnText, { color: '#F44336' }]}>{t('common.delete')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="shadow-history-back-btn">
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('shadowHistory.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <SyncBanner />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF5722" />
        </View>
      ) : (
        <FlatList
          data={routines}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            <View>
              {/* Summary card */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryNumber}>{routines.length}</Text>
                  <Text style={styles.summaryLabel}>{t('shadowHistory.totalSessions')}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryNumber}>
                    {routines.reduce((acc, r) => acc + r.total_zones_visited, 0)}
                  </Text>
                  <Text style={styles.summaryLabel}>{t('shadowHistory.totalZones')}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryNumber}>
                    {formatTime(routines.reduce((acc, r) => acc + totalSeconds(r), 0))}
                  </Text>
                  <Text style={styles.summaryLabel}>{t('shadowHistory.totalTime')}</Text>
                </View>
              </View>

              {/* Chart */}
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>{t('shadowHistory.chartTitle')}</Text>
                <BarChart
                  data={chartData}
                  barWidth={22}
                  spacing={14}
                  initialSpacing={10}
                  endSpacing={10}
                  noOfSections={Math.min(4, maxVal)}
                  maxValue={Math.max(1, maxVal)}
                  yAxisThickness={0}
                  xAxisThickness={1}
                  xAxisColor="#E0E0E0"
                  yAxisTextStyle={{ color: '#999', fontSize: 10 }}
                  xAxisLabelTextStyle={{ color: '#666', fontSize: 9 }}
                  barBorderRadius={4}
                  hideRules
                  width={SCREEN_WIDTH - 80}
                />
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="footsteps-outline" size={64} color="#CCC" />
              <Text style={styles.emptyText}>{t('shadowHistory.emptyTitle')}</Text>
              <Text style={styles.emptySub}>{t('shadowHistory.emptySub')}</Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push('/shadow-training')}
                data-testid="empty-start-shadow-btn"
              >
                <Text style={styles.emptyBtnText}>{t('shadowHistory.startNow')}</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: {
    backgroundColor: '#1E3A5F',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  backBtn: { padding: 4, width: 40 },
  syncBtn: { padding: 6, width: 40, alignItems: 'flex-end' },
  headerTitle: {
    flex: 1,
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 14, paddingBottom: 40 },
  summaryCard: {
    backgroundColor: '#FFF',
    flexDirection: 'row',
    padding: 16,
    borderRadius: 14,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, backgroundColor: '#E0E0E0', marginHorizontal: 8 },
  summaryNumber: { fontSize: 22, fontWeight: '800', color: '#1E3A5F' },
  summaryLabel: { fontSize: 11, color: '#666', marginTop: 2, textAlign: 'center' },
  chartCard: {
    backgroundColor: '#FFF',
    padding: 14,
    borderRadius: 14,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  barTop: { color: '#FF5722', fontSize: 10, fontWeight: 'bold', marginBottom: 2 },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#FF5722',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  cardDate: { fontSize: 11, color: '#999', fontWeight: '600' },
  cardName: { fontSize: 15, fontWeight: '700', color: '#333', marginTop: 2 },
  cardStats: {
    flexDirection: 'row',
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    padding: 8,
    marginBottom: 10,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 15, fontWeight: '700', color: '#1E3A5F' },
  statLabel: { fontSize: 10, color: '#666', marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 8,
    gap: 6,
  },
  repeatBtn: { backgroundColor: '#FF5722' },
  deleteBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#F44336',
  },
  actionBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  emptyContainer: {
    alignItems: 'center',
    padding: 30,
    marginTop: 40,
  },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#666', marginTop: 14 },
  emptySub: { fontSize: 13, color: '#999', marginTop: 6, textAlign: 'center' },
  emptyBtn: {
    backgroundColor: '#FF5722',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
    marginTop: 18,
  },
  emptyBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});
