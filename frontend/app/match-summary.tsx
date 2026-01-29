import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getDatabase } from '@/src/store/database';
import { useLanguage } from '@/src/context/LanguageContext';
import { SquashCourt } from '@/src/components/SquashCourt';
import { format } from 'date-fns';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface MatchData {
  id: number;
  player1_id: number;
  player2_id: number;
  player1_nickname: string;
  player2_nickname: string;
  winner_nickname: string;
  player1_games: number;
  player2_games: number;
  date: string;
  tournament_name?: string;
}

interface PointData {
  id: number;
  position_x: number;
  position_y: number;
  winner_player_id: number;
  reason: string;
  game_number: number;
  point_number: number;
  player1_score: number;
  player2_score: number;
}

interface GameResult {
  game_number: number;
  player1_score: number;
  player2_score: number;
}

export default function MatchSummary() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const matchId = parseInt(params.matchId as string);

  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [allPoints, setAllPoints] = useState<PointData[]>([]);
  const [gameResults, setGameResults] = useState<GameResult[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtro por game
  const [selectedGame, setSelectedGame] = useState<number | 'all'>('all');
  
  // Navegación de puntos
  const [selectedPointIndex, setSelectedPointIndex] = useState(0);
  
  // Filtro de estadísticas por jugador
  const [statsFilter, setStatsFilter] = useState<'all' | 'player1' | 'player2'>('all');

  useEffect(() => {
    loadMatchSummary();
  }, []);

  // Reset punto seleccionado cuando cambia el filtro de game
  useEffect(() => {
    setSelectedPointIndex(0);
  }, [selectedGame]);

  const loadMatchSummary = async () => {
    try {
      const db = await getDatabase();
      
      const match = await db.getFirstAsync(
        `SELECT 
          m.*,
          p1.id as player1_id,
          p2.id as player2_id,
          p1.nickname as player1_nickname,
          p2.nickname as player2_nickname,
          pw.nickname as winner_nickname
        FROM matches m
        JOIN players p1 ON m.player1_id = p1.id
        JOIN players p2 ON m.player2_id = p2.id
        LEFT JOIN players pw ON m.winner_id = pw.id
        WHERE m.id = ?`,
        [matchId]
      );

      setMatchData(match as MatchData);

      const pointsData = await db.getAllAsync(
        'SELECT * FROM points WHERE match_id = ? ORDER BY game_number, point_number',
        [matchId]
      );
      setAllPoints(pointsData as PointData[]);

      const gamesData = await db.getAllAsync(
        'SELECT * FROM game_results WHERE match_id = ? ORDER BY game_number',
        [matchId]
      );
      setGameResults(gamesData as GameResult[]);

    } catch (error) {
      console.error('Error cargando resumen:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar puntos según el game seleccionado
  const filteredPoints = selectedGame === 'all' 
    ? allPoints 
    : allPoints.filter(p => p.game_number === selectedGame);

  const goToPreviousPoint = () => {
    if (selectedPointIndex > 0) {
      setSelectedPointIndex(selectedPointIndex - 1);
    }
  };

  const goToNextPoint = () => {
    if (selectedPointIndex < filteredPoints.length - 1) {
      setSelectedPointIndex(selectedPointIndex + 1);
    }
  };

  const getReasonStats = () => {
    let points = filteredPoints;
    
    if (statsFilter === 'player1' && matchData) {
      points = points.filter(p => p.winner_player_id === matchData.player1_id);
    } else if (statsFilter === 'player2' && matchData) {
      points = points.filter(p => p.winner_player_id === matchData.player2_id);
    }
    
    const reasonCounts: { [key: string]: number } = {};
    points.forEach(p => {
      reasonCounts[p.reason] = (reasonCounts[p.reason] || 0) + 1;
    });
    
    return Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5
  };

  // Obtener lista de games disponibles
  const availableGames = [...new Set(allPoints.map(p => p.game_number))].sort();

  if (loading || !matchData) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Cargando...</Text>
      </View>
    );
  }

  const selectedPoint = filteredPoints[selectedPointIndex];
  const player1Points = filteredPoints.filter(p => p.winner_player_id === matchData.player1_id);
  const player2Points = filteredPoints.filter(p => p.winner_player_id === matchData.player2_id);
  const reasonStats = getReasonStats();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Análisis</Text>
        <TouchableOpacity onPress={() => router.push('/')} style={styles.homeButton}>
          <Ionicons name="home" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Resultado compacto */}
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            {matchData.tournament_name && (
              <Text style={styles.tournamentText}>{matchData.tournament_name}</Text>
            )}
            <Text style={styles.dateText}>
              {format(new Date(matchData.date), "dd/MM/yyyy")}
            </Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.playerNameCompact}>{matchData.player1_nickname}</Text>
            <View style={styles.scoreBox}>
              <Text style={styles.gamesCountCompact}>{matchData.player1_games} - {matchData.player2_games}</Text>
            </View>
            <Text style={styles.playerNameCompact}>{matchData.player2_nickname}</Text>
          </View>
        </View>

        {/* Selector de Game */}
        <View style={styles.gameSelector}>
          <TouchableOpacity
            style={[styles.gameSelectorBtn, selectedGame === 'all' && styles.gameSelectorBtnActive]}
            onPress={() => setSelectedGame('all')}
          >
            <Text style={[styles.gameSelectorText, selectedGame === 'all' && styles.gameSelectorTextActive]}>
              Todos
            </Text>
          </TouchableOpacity>
          {availableGames.map(game => (
            <TouchableOpacity
              key={game}
              style={[styles.gameSelectorBtn, selectedGame === game && styles.gameSelectorBtnActive]}
              onPress={() => setSelectedGame(game)}
            >
              <Text style={[styles.gameSelectorText, selectedGame === game && styles.gameSelectorTextActive]}>
                G{game}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Cancha y navegación - Compacto */}
        {filteredPoints.length > 0 && (
          <View style={styles.courtSection}>
            <SquashCourt
              points={filteredPoints.map((p, index) => ({
                x: p.position_x,
                y: p.position_y,
                isWin: p.winner_player_id === matchData.player1_id,
                score: `${p.player1_score}-${p.player2_score}`,
                isSelected: index === selectedPointIndex,
              }))}
              selectedPointIndex={selectedPointIndex}
              showSelectedHighlight={true}
              compact={true}
            />
            
            {/* Info del punto + Navegación en línea */}
            <View style={styles.pointNavRow}>
              <TouchableOpacity 
                style={styles.navBtnSmall}
                onPress={() => setSelectedPointIndex(0)}
                disabled={selectedPointIndex === 0}
              >
                <Ionicons name="play-skip-back" size={18} color={selectedPointIndex === 0 ? "#CCC" : "#2196F3"} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.navBtnSmall}
                onPress={goToPreviousPoint}
                disabled={selectedPointIndex === 0}
              >
                <Ionicons name="chevron-back" size={22} color={selectedPointIndex === 0 ? "#CCC" : "#2196F3"} />
              </TouchableOpacity>
              
              <View style={styles.pointInfoCompact}>
                <Text style={styles.pointScoreCompact}>
                  {selectedPoint?.player1_score}-{selectedPoint?.player2_score}
                </Text>
                <Text style={styles.pointDetailCompact}>
                  {selectedPoint?.winner_player_id === matchData.player1_id 
                    ? matchData.player1_nickname 
                    : matchData.player2_nickname} • {selectedPoint?.reason}
                </Text>
              </View>
              
              <TouchableOpacity 
                style={styles.navBtnSmall}
                onPress={goToNextPoint}
                disabled={selectedPointIndex === filteredPoints.length - 1}
              >
                <Ionicons name="chevron-forward" size={22} color={selectedPointIndex === filteredPoints.length - 1 ? "#CCC" : "#2196F3"} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.navBtnSmall}
                onPress={() => setSelectedPointIndex(filteredPoints.length - 1)}
                disabled={selectedPointIndex === filteredPoints.length - 1}
              >
                <Ionicons name="play-skip-forward" size={18} color={selectedPointIndex === filteredPoints.length - 1 ? "#CCC" : "#2196F3"} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.pointCounter}>
              Punto {selectedPointIndex + 1} de {filteredPoints.length}
            </Text>
          </View>
        )}

        {/* Estadísticas compactas */}
        <View style={styles.statsRow}>
          <View style={styles.statMini}>
            <Text style={styles.statValueMini}>{filteredPoints.length}</Text>
            <Text style={styles.statLabelMini}>Total</Text>
          </View>
          <View style={[styles.statMini, { borderLeftWidth: 2, borderLeftColor: '#2196F3' }]}>
            <Text style={[styles.statValueMini, { color: '#2196F3' }]}>{player1Points.length}</Text>
            <Text style={styles.statLabelMini}>{matchData.player1_nickname.substring(0, 6)}</Text>
          </View>
          <View style={[styles.statMini, { borderLeftWidth: 2, borderLeftColor: '#FF5722' }]}>
            <Text style={[styles.statValueMini, { color: '#FF5722' }]}>{player2Points.length}</Text>
            <Text style={styles.statLabelMini}>{matchData.player2_nickname.substring(0, 6)}</Text>
          </View>
          <View style={styles.statMini}>
            <Text style={styles.statValueMini}>
              {filteredPoints.length > 0 ? Math.round((player1Points.length / filteredPoints.length) * 100) : 0}%
            </Text>
            <Text style={styles.statLabelMini}>Efect.</Text>
          </View>
        </View>

        {/* Motivos con filtros */}
        <View style={styles.reasonsSection}>
          <View style={styles.filterRow}>
            <Text style={styles.sectionTitleSmall}>Motivos</Text>
            <View style={styles.filterBtns}>
              <TouchableOpacity 
                style={[styles.filterBtnMini, statsFilter === 'all' && styles.filterBtnMiniActive]}
                onPress={() => setStatsFilter('all')}
              >
                <Text style={[styles.filterBtnText, statsFilter === 'all' && styles.filterBtnTextActive]}>Todos</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.filterBtnMini, statsFilter === 'player1' && styles.filterBtnMiniActive]}
                onPress={() => setStatsFilter('player1')}
              >
                <Text style={[styles.filterBtnText, statsFilter === 'player1' && { color: '#2196F3' }]}>
                  {matchData.player1_nickname.substring(0, 5)}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.filterBtnMini, statsFilter === 'player2' && styles.filterBtnMiniActive]}
                onPress={() => setStatsFilter('player2')}
              >
                <Text style={[styles.filterBtnText, statsFilter === 'player2' && { color: '#FF5722' }]}>
                  {matchData.player2_nickname.substring(0, 5)}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.reasonsGrid}>
            {reasonStats.map((stat, index) => {
              const maxCount = Math.max(...reasonStats.map(s => s.count));
              const colors = ['#4CAF50', '#2196F3', '#FF9800', '#F44336', '#9C27B0'];
              const pct = maxCount > 0 ? (stat.count / maxCount) * 100 : 0;
              return (
                <View key={index} style={styles.reasonItem}>
                  <View style={styles.reasonBarBg}>
                    <View style={[styles.reasonBarFill, { width: `${pct}%`, backgroundColor: colors[index % colors.length] }]} />
                  </View>
                  <Text style={styles.reasonText}>{stat.reason.substring(0, 12)}</Text>
                  <Text style={styles.reasonCount}>{stat.count}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Games en línea */}
        {gameResults.length > 0 && (
          <View style={styles.gamesRow}>
            {gameResults.map((game) => (
              <View key={game.game_number} style={styles.gameChip}>
                <Text style={styles.gameChipTitle}>G{game.game_number}</Text>
                <Text style={[
                  styles.gameChipScore,
                  game.player1_score > game.player2_score ? styles.winScore : styles.loseScore
                ]}>
                  {game.player1_score}-{game.player2_score}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.newMatchButton} onPress={() => router.push('/new-match')}>
          <Ionicons name="add-circle" size={20} color="#FFF" />
          <Text style={styles.newMatchText}>Nuevo Partido</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#1E3A5F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
  },
  homeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
  },
  resultCard: {
    backgroundColor: '#FFF',
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tournamentText: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '600',
  },
  dateText: {
    fontSize: 12,
    color: '#666',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playerNameCompact: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  scoreBox: {
    backgroundColor: '#1E3A5F',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  gamesCountCompact: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  gameSelector: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 6,
  },
  gameSelectorBtn: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#FFF',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  gameSelectorBtnActive: {
    backgroundColor: '#1E3A5F',
    borderColor: '#1E3A5F',
  },
  gameSelectorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  gameSelectorTextActive: {
    color: '#FFF',
  },
  courtSection: {
    backgroundColor: '#FFF',
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
  },
  pointNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 4,
  },
  navBtnSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F7FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointInfoCompact: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  pointScoreCompact: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E3A5F',
  },
  pointDetailCompact: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  pointCounter: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 10,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  statMini: {
    flex: 1,
    alignItems: 'center',
    paddingLeft: 8,
  },
  statValueMini: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabelMini: {
    fontSize: 10,
    color: '#666',
  },
  reasonsSection: {
    backgroundColor: '#FFF',
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitleSmall: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  filterBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  filterBtnMini: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F5F7FA',
  },
  filterBtnMiniActive: {
    backgroundColor: '#E3F2FD',
  },
  filterBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  filterBtnTextActive: {
    color: '#333',
  },
  reasonsGrid: {
    gap: 6,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reasonBarBg: {
    flex: 1,
    height: 20,
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  reasonBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  reasonText: {
    fontSize: 11,
    color: '#666',
    width: 80,
  },
  reasonCount: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    width: 24,
    textAlign: 'right',
  },
  gamesRow: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 10,
    gap: 8,
    justifyContent: 'center',
  },
  gameChip: {
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 60,
  },
  gameChipTitle: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
  },
  gameChipScore: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  winScore: {
    color: '#4CAF50',
  },
  loseScore: {
    color: '#F44336',
  },
  footer: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  newMatchButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  newMatchText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    marginLeft: 6,
  },
});
