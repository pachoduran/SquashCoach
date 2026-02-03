import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
import Constants from 'expo-constants';

interface MatchDetail {
  match: {
    match_id: string;
    player1_id: string;
    player2_id: string;
    player1_games: number;
    player2_games: number;
    winner_id: string;
    date: string;
    status: string;
    tournament_name?: string;
    best_of: number;
  };
  players: Array<{
    player_id: string;
    nickname: string;
  }>;
  points: Array<{
    game_number: number;
    point_number: number;
    winner_player_id: string;
    reason: string;
    player1_score: number;
    player2_score: number;
  }>;
  game_results: Array<{
    game_number: number;
    player1_score: number;
    player2_score: number;
    winner_id: string;
  }>;
}

// Get backend URL
const getBackendUrl = () => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return '';
  }
  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (backendUrl) {
    return backendUrl;
  }
  const expoConfig = Constants.expoConfig as any;
  return expoConfig?.extra?.EXPO_BACKEND_URL || expoConfig?.hostUri?.split(':')[0] || '';
};

const BACKEND_URL = getBackendUrl();

export default function SharedMatchDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { sessionToken } = useAuth();
  const { t } = useLanguage();

  const userId = params.userId as string;
  const matchId = params.matchId as string;
  const userName = params.userName as string;

  const [matchData, setMatchData] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedGame, setSelectedGame] = useState<number | 'all'>('all');

  useEffect(() => {
    loadMatchDetail();
  }, [matchId]);

  const loadMatchDetail = async () => {
    if (!sessionToken || !userId || !matchId) return;
    
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/share/user/${userId}/matches/${matchId}`,
        {
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setMatchData(data);
      }
    } catch (error) {
      console.error('Error loading match detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPlayerName = (playerId: string) => {
    if (!matchData) return 'Player';
    const player = matchData.players.find(p => p.player_id === playerId);
    return player?.nickname || 'Player';
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const filteredPoints = selectedGame === 'all'
    ? matchData?.points || []
    : matchData?.points.filter(p => p.game_number === selectedGame) || [];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.title}>{t('summary.title')}</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      </SafeAreaView>
    );
  }

  if (!matchData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.title}>{t('summary.title')}</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>No se pudo cargar el partido</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { match, game_results } = matchData;
  const player1Name = getPlayerName(match.player1_id);
  const player2Name = getPlayerName(match.player2_id);
  const winnerName = getPlayerName(match.winner_id);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('summary.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Read Only Badge */}
        <View style={styles.sharedBadge}>
          <Ionicons name="eye-outline" size={16} color="#1976D2" />
          <Text style={styles.sharedBadgeText}>
            {t('share.sharedBy')}: {userName}
          </Text>
        </View>

        {/* Final Score Card */}
        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>{t('summary.finalScore')}</Text>
          
          <View style={styles.scoreRow}>
            <View style={styles.playerScore}>
              <Text style={[
                styles.playerName,
                match.winner_id === match.player1_id && styles.winnerName
              ]}>
                {player1Name}
              </Text>
              <Text style={[
                styles.gamesScore,
                match.winner_id === match.player1_id && styles.winnerScore
              ]}>
                {match.player1_games}
              </Text>
            </View>
            
            <Text style={styles.scoreDivider}>-</Text>
            
            <View style={styles.playerScore}>
              <Text style={[
                styles.gamesScore,
                match.winner_id === match.player2_id && styles.winnerScore
              ]}>
                {match.player2_games}
              </Text>
              <Text style={[
                styles.playerName,
                match.winner_id === match.player2_id && styles.winnerName
              ]}>
                {player2Name}
              </Text>
            </View>
          </View>

          {match.winner_id && (
            <View style={styles.winnerBadge}>
              <Ionicons name="trophy" size={18} color="#FFD700" />
              <Text style={styles.winnerText}>
                {t('summary.winner')}: {winnerName}
              </Text>
            </View>
          )}

          {match.tournament_name && (
            <Text style={styles.tournamentName}>{match.tournament_name}</Text>
          )}
          <Text style={styles.matchDate}>{formatDate(match.date)}</Text>
        </View>

        {/* Game by Game */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('summary.gameByGame')}</Text>
          
          {game_results.map((game, index) => (
            <View key={index} style={styles.gameResult}>
              <Text style={styles.gameNumber}>Game {game.game_number}</Text>
              <View style={styles.gameScoreContainer}>
                <Text style={[
                  styles.gamePlayerScore,
                  game.winner_id === match.player1_id && styles.gameWinnerScore
                ]}>
                  {game.player1_score}
                </Text>
                <Text style={styles.gameScoreDivider}>-</Text>
                <Text style={[
                  styles.gamePlayerScore,
                  game.winner_id === match.player2_id && styles.gameWinnerScore
                ]}>
                  {game.player2_score}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Point by Point */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('summary.pointByPoint')}</Text>
          
          {/* Game Filter */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.gameFilter}
          >
            <TouchableOpacity
              style={[
                styles.filterButton,
                selectedGame === 'all' && styles.filterButtonActive
              ]}
              onPress={() => setSelectedGame('all')}
            >
              <Text style={[
                styles.filterButtonText,
                selectedGame === 'all' && styles.filterButtonTextActive
              ]}>
                {t('summary.allGames')}
              </Text>
            </TouchableOpacity>
            
            {game_results.map((g) => (
              <TouchableOpacity
                key={g.game_number}
                style={[
                  styles.filterButton,
                  selectedGame === g.game_number && styles.filterButtonActive
                ]}
                onPress={() => setSelectedGame(g.game_number)}
              >
                <Text style={[
                  styles.filterButtonText,
                  selectedGame === g.game_number && styles.filterButtonTextActive
                ]}>
                  Game {g.game_number}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Points List */}
          {filteredPoints.length === 0 ? (
            <Text style={styles.noPointsText}>{t('summary.noPoints')}</Text>
          ) : (
            filteredPoints.map((point, index) => (
              <View key={index} style={styles.pointItem}>
                <View style={styles.pointInfo}>
                  <Text style={styles.pointNumber}>
                    {t('summary.point')} {point.point_number}
                  </Text>
                  {selectedGame === 'all' && (
                    <Text style={styles.pointGame}>G{point.game_number}</Text>
                  )}
                </View>
                <View style={styles.pointScore}>
                  <Text style={styles.pointScoreText}>
                    {point.player1_score} - {point.player2_score}
                  </Text>
                </View>
                <View style={styles.pointWinner}>
                  <Text style={styles.pointWinnerName}>
                    {getPlayerName(point.winner_player_id)}
                  </Text>
                  <Text style={styles.pointReason}>{point.reason}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  placeholder: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
  },
  content: {
    flex: 1,
  },
  sharedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E3F2FD',
    paddingVertical: 8,
    gap: 6,
  },
  sharedBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1976D2',
  },
  scoreCard: {
    backgroundColor: '#FFF',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scoreLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    maxWidth: 100,
  },
  winnerName: {
    color: '#4CAF50',
  },
  gamesScore: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#333',
  },
  winnerScore: {
    color: '#4CAF50',
  },
  scoreDivider: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#CCC',
    marginHorizontal: 16,
  },
  winnerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9C4',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 16,
    gap: 6,
  },
  winnerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F57F17',
  },
  tournamentName: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#666',
    marginTop: 12,
  },
  matchDate: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E3A5F',
    marginBottom: 12,
  },
  gameResult: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  gameNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  gameScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gamePlayerScore: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    minWidth: 30,
    textAlign: 'center',
  },
  gameWinnerScore: {
    color: '#4CAF50',
  },
  gameScoreDivider: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#CCC',
    marginHorizontal: 8,
  },
  gameFilter: {
    marginBottom: 12,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#1E3A5F',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#FFF',
  },
  noPointsText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
  },
  pointItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  pointInfo: {
    width: 80,
  },
  pointNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  pointGame: {
    fontSize: 11,
    color: '#999',
  },
  pointScore: {
    width: 60,
    alignItems: 'center',
  },
  pointScoreText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  pointWinner: {
    flex: 1,
  },
  pointWinnerName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4CAF50',
  },
  pointReason: {
    fontSize: 12,
    color: '#666',
  },
});
