import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getDatabase } from '@/src/store/database';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { useSync } from '@/src/context/SyncContext';
import { SyncBanner } from '@/src/components/SyncBanner';

interface ActiveMatch {
  id: number;
  player1_nickname: string;
  player2_nickname: string;
  current_game: number;
  player1_score: number;
  player2_score: number;
  player1_games: number;
  player2_games: number;
  best_of: number;
  date: string;
}

export default function Partidos() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { syncNow } = useSync();
  const [activeMatches, setActiveMatches] = useState<ActiveMatch[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadActiveMatches = async () => {
    try {
      const db = await getDatabase();
      const matches = await db.getAllAsync(
        `SELECT m.*, 
          p1.nickname as player1_nickname, 
          p2.nickname as player2_nickname 
        FROM matches m
        LEFT JOIN players p1 ON m.player1_id = p1.id
        LEFT JOIN players p2 ON m.player2_id = p2.id
        WHERE m.status = 'playing' AND m.user_id = ?
        ORDER BY m.date DESC`,
        [user?.user_id || '']
      );
      setActiveMatches(matches as ActiveMatch[]);
    } catch (e) {
      console.log('[Partidos] Error cargando partidos activos:', e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadActiveMatches();
      // Sincronizar en segundo plano cada vez que se entra
      syncNow().then(() => loadActiveMatches()).catch(() => {});
    }, [user])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await syncNow();
    await loadActiveMatches();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="partidos-back-btn">
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('home.matches')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <SyncBanner />

      <FlatList
        data={[]}
        renderItem={() => null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View style={styles.content}>
            {/* Partidos en curso */}
            {activeMatches.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('home.matchesInProgress')}</Text>
                {activeMatches.map((match) => (
                  <TouchableOpacity
                    key={match.id}
                    style={styles.matchCard}
                    onPress={() => router.push({ pathname: '/match-play', params: { matchId: match.id } })}
                    data-testid={`active-match-${match.id}`}
                  >
                    <View style={styles.matchPlayers}>
                      <Text style={styles.matchPlayerName}>{match.player1_nickname}</Text>
                      <Text style={styles.matchVs}>vs</Text>
                      <Text style={styles.matchPlayerName}>{match.player2_nickname}</Text>
                    </View>
                    <View style={styles.matchScore}>
                      <Text style={styles.matchScoreText}>
                        Games: {match.player1_games} - {match.player2_games}
                      </Text>
                      <Text style={styles.matchGameText}>
                        Game {match.current_game}: {match.player1_score} - {match.player2_score}
                      </Text>
                    </View>
                    <Ionicons name="play-circle" size={28} color="#4CAF50" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Nuevo Partido */}
            <TouchableOpacity
              style={styles.newMatchBtn}
              onPress={() => router.push('/new-match')}
              data-testid="new-match-btn"
            >
              <View style={[styles.featureIcon, { backgroundColor: '#2196F3' }]}>
                <Ionicons name="add-circle" size={28} color="#FFF" />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{t('home.newMatch')}</Text>
                <Text style={styles.featureSub}>{t('partidos.newMatchDesc')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#999" />
            </TouchableOpacity>

            {/* Grid de opciones (sin botón Nube — sync es automática) */}
            <View style={styles.grid}>
              <TouchableOpacity
                style={styles.gridItem}
                onPress={() => router.push('/history')}
                data-testid="history-btn"
              >
                <View style={[styles.gridIcon, { backgroundColor: '#1E3A5F' }]}>
                  <Ionicons name="time-outline" size={24} color="#FFF" />
                </View>
                <Text style={styles.gridLabel}>{t('home.history')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.gridItem}
                onPress={() => router.push('/analysis')}
                data-testid="analysis-btn"
              >
                <View style={[styles.gridIcon, { backgroundColor: '#FF9800' }]}>
                  <Ionicons name="analytics" size={24} color="#FFF" />
                </View>
                <Text style={styles.gridLabel}>{t('home.analysis')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.gridItem}
                onPress={() => router.push('/share')}
                data-testid="share-btn"
              >
                <View style={[styles.gridIcon, { backgroundColor: '#9C27B0' }]}>
                  <Ionicons name="share-social-outline" size={24} color="#FFF" />
                </View>
                <Text style={styles.gridLabel}>{t('home.sharing')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    backgroundColor: '#1E3A5F',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  backBtn: {
    padding: 4,
    width: 40,
  },
  headerTitle: {
    flex: 1,
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 10,
  },
  matchCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  matchPlayers: {
    flex: 1,
  },
  matchPlayerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  matchVs: {
    fontSize: 11,
    color: '#999',
  },
  matchScore: {
    alignItems: 'flex-end',
    marginRight: 10,
  },
  matchScoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E3A5F',
  },
  matchGameText: {
    fontSize: 11,
    color: '#666',
  },
  newMatchBtn: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  featureIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#333',
  },
  featureSub: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridItem: {
    width: '47%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  gridIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
});
