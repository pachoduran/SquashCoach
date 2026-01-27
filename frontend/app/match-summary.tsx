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
import { SquashCourt } from '@/src/components/SquashCourt';
import { format } from 'date-fns';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  my_player_pos_x?: number;
  my_player_pos_y?: number;
  opponent_pos_x?: number;
  opponent_pos_y?: number;
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
  const [points, setPoints] = useState<PointData[]>([]);
  const [gameResults, setGameResults] = useState<GameResult[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estado para navegación de puntos
  const [selectedPointIndex, setSelectedPointIndex] = useState(0);
  
  // Estado para filtro de estadísticas por jugador
  const [statsFilter, setStatsFilter] = useState<'all' | 'player1' | 'player2'>('all');
  
  // Animación para el punto seleccionado
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadMatchSummary();
  }, []);

  useEffect(() => {
    // Animación de pulso para el punto seleccionado
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.5,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [selectedPointIndex]);

  const loadMatchSummary = async () => {
    try {
      const db = await getDatabase();
      
      // Cargar datos del partido
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

      // Cargar puntos
      const pointsData = await db.getAllAsync(
        'SELECT * FROM points WHERE match_id = ? ORDER BY game_number, point_number',
        [matchId]
      );
      setPoints(pointsData as PointData[]);

      // Cargar resultados de games
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

  const goToPreviousPoint = () => {
    if (selectedPointIndex > 0) {
      setSelectedPointIndex(selectedPointIndex - 1);
    }
  };

  const goToNextPoint = () => {
    if (selectedPointIndex < points.length - 1) {
      setSelectedPointIndex(selectedPointIndex + 1);
    }
  };

  const getReasonStats = () => {
    let filteredPoints = points;
    
    if (statsFilter === 'player1' && matchData) {
      filteredPoints = points.filter(p => p.winner_player_id === matchData.player1_id);
    } else if (statsFilter === 'player2' && matchData) {
      filteredPoints = points.filter(p => p.winner_player_id === matchData.player2_id);
    }
    
    const reasonCounts: { [key: string]: number } = {};
    filteredPoints.forEach(p => {
      reasonCounts[p.reason] = (reasonCounts[p.reason] || 0) + 1;
    });
    
    return Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);
  };

  if (loading || !matchData) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Cargando...</Text>
      </View>
    );
  }

  const selectedPoint = points[selectedPointIndex];
  const player1Points = points.filter(p => p.winner_player_id === matchData.player1_id);
  const player2Points = points.filter(p => p.winner_player_id === matchData.player2_id);
  const reasonStats = getReasonStats();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Análisis del Partido</Text>
        <TouchableOpacity onPress={() => router.push('/')} style={styles.homeButton}>
          <Ionicons name="home" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Resultado Final */}
        <View style={styles.resultCard}>
          {matchData.tournament_name && (
            <Text style={styles.tournamentText}>{matchData.tournament_name}</Text>
          )}
          <Text style={styles.dateText}>
            {format(new Date(matchData.date), "dd/MM/yyyy - HH:mm")}
          </Text>
          <View style={styles.resultRow}>
            <View style={styles.playerResult}>
              <Text style={styles.playerName}>{matchData.player1_nickname}</Text>
              <Text style={styles.gamesCount}>{matchData.player1_games}</Text>
            </View>
            <Text style={styles.vs}>-</Text>
            <View style={styles.playerResult}>
              <Text style={styles.playerName}>{matchData.player2_nickname}</Text>
              <Text style={styles.gamesCount}>{matchData.player2_games}</Text>
            </View>
          </View>
          <View style={styles.winnerBadge}>
            <Ionicons name="trophy" size={20} color="#FFD700" />
            <Text style={styles.winnerText}>Ganador: {matchData.winner_nickname}</Text>
          </View>
        </View>

        {/* Navegador de Puntos */}
        {points.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recorrido del Partido</Text>
            
            {/* Cancha con punto seleccionado */}
            <SquashCourt
              points={points.map((p, index) => ({
                x: p.position_x,
                y: p.position_y,
                isWin: p.winner_player_id === matchData.player1_id,
                isSelected: index === selectedPointIndex,
              }))}
              selectedPointIndex={selectedPointIndex}
              showSelectedHighlight={true}
            />
            
            {/* Información del punto seleccionado */}
            <View style={styles.pointInfoCard}>
              <View style={styles.pointScoreRow}>
                <Text style={styles.pointScoreLabel}>Marcador:</Text>
                <View style={styles.pointScoreBadge}>
                  <Text style={styles.pointScoreText}>
                    {selectedPoint.player1_score} - {selectedPoint.player2_score}
                  </Text>
                </View>
                <Text style={styles.gameLabel}>Game {selectedPoint.game_number}</Text>
              </View>
              
              <View style={styles.pointDetailRow}>
                <Ionicons 
                  name={selectedPoint.winner_player_id === matchData.player1_id ? "checkmark-circle" : "close-circle"} 
                  size={24} 
                  color={selectedPoint.winner_player_id === matchData.player1_id ? "#4CAF50" : "#F44336"} 
                />
                <View style={styles.pointDetailText}>
                  <Text style={styles.pointWinner}>
                    Ganó: {selectedPoint.winner_player_id === matchData.player1_id 
                      ? matchData.player1_nickname 
                      : matchData.player2_nickname}
                  </Text>
                  <Text style={styles.pointReason}>Motivo: {selectedPoint.reason}</Text>
                </View>
              </View>
            </View>
            
            {/* Controles de navegación */}
            <View style={styles.navigationControls}>
              <TouchableOpacity 
                style={[styles.navButton, selectedPointIndex === 0 && styles.navButtonDisabled]}
                onPress={() => setSelectedPointIndex(0)}
                disabled={selectedPointIndex === 0}
              >
                <Ionicons name="play-skip-back" size={24} color={selectedPointIndex === 0 ? "#CCC" : "#2196F3"} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.navButton, selectedPointIndex === 0 && styles.navButtonDisabled]}
                onPress={goToPreviousPoint}
                disabled={selectedPointIndex === 0}
              >
                <Ionicons name="chevron-back" size={28} color={selectedPointIndex === 0 ? "#CCC" : "#2196F3"} />
              </TouchableOpacity>
              
              <View style={styles.pointCounter}>
                <Text style={styles.pointCounterText}>
                  {selectedPointIndex + 1} / {points.length}
                </Text>
              </View>
              
              <TouchableOpacity 
                style={[styles.navButton, selectedPointIndex === points.length - 1 && styles.navButtonDisabled]}
                onPress={goToNextPoint}
                disabled={selectedPointIndex === points.length - 1}
              >
                <Ionicons name="chevron-forward" size={28} color={selectedPointIndex === points.length - 1 ? "#CCC" : "#2196F3"} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.navButton, selectedPointIndex === points.length - 1 && styles.navButtonDisabled]}
                onPress={() => setSelectedPointIndex(points.length - 1)}
                disabled={selectedPointIndex === points.length - 1}
              >
                <Ionicons name="play-skip-forward" size={24} color={selectedPointIndex === points.length - 1 ? "#CCC" : "#2196F3"} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Estadísticas de Puntos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estadísticas de Puntos</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{points.length}</Text>
              <Text style={styles.statLabel}>Puntos Totales</Text>
            </View>
            <View style={[styles.statCard, { borderLeftWidth: 3, borderLeftColor: '#2196F3' }]}>
              <Text style={[styles.statValue, { color: '#2196F3' }]}>{player1Points.length}</Text>
              <Text style={styles.statLabel}>{matchData.player1_nickname}</Text>
            </View>
            <View style={[styles.statCard, { borderLeftWidth: 3, borderLeftColor: '#FF5722' }]}>
              <Text style={[styles.statValue, { color: '#FF5722' }]}>{player2Points.length}</Text>
              <Text style={styles.statLabel}>{matchData.player2_nickname}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {points.length > 0 ? ((player1Points.length / points.length) * 100).toFixed(0) : 0}%
              </Text>
              <Text style={styles.statLabel}>% {matchData.player1_nickname}</Text>
            </View>
          </View>
        </View>

        {/* Motivos de Puntos por Jugador */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Motivos de Puntos</Text>
          
          {/* Filtros por jugador */}
          <View style={styles.filterButtons}>
            <TouchableOpacity 
              style={[styles.filterButton, statsFilter === 'all' && styles.filterButtonActive]}
              onPress={() => setStatsFilter('all')}
            >
              <Text style={[styles.filterButtonText, statsFilter === 'all' && styles.filterButtonTextActive]}>
                Todos
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.filterButton, statsFilter === 'player1' && styles.filterButtonActive, { borderColor: '#2196F3' }]}
              onPress={() => setStatsFilter('player1')}
            >
              <Text style={[styles.filterButtonText, statsFilter === 'player1' && { color: '#2196F3' }]}>
                {matchData.player1_nickname}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.filterButton, statsFilter === 'player2' && styles.filterButtonActive, { borderColor: '#FF5722' }]}
              onPress={() => setStatsFilter('player2')}
            >
              <Text style={[styles.filterButtonText, statsFilter === 'player2' && { color: '#FF5722' }]}>
                {matchData.player2_nickname}
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Lista de motivos */}
          <View style={styles.reasonsList}>
            {reasonStats.map((stat, index) => {
              const maxCount = Math.max(...reasonStats.map(s => s.count));
              const colors = ['#4CAF50', '#2196F3', '#FF9800', '#F44336', '#9C27B0', '#00BCD4', '#795548'];
              return (
                <View key={index} style={styles.reasonBar}>
                  <Text style={styles.reasonLabel}>{stat.reason}</Text>
                  <View style={styles.barContainer}>
                    <View
                      style={[
                        styles.bar,
                        {
                          width: `${(stat.count / maxCount) * 100}%`,
                          backgroundColor: colors[index % colors.length],
                        },
                      ]}
                    />
                    <Text style={styles.barValue}>{stat.count}</Text>
                  </View>
                </View>
              );
            })}
            {reasonStats.length === 0 && (
              <Text style={styles.noDataText}>No hay datos para mostrar</Text>
            )}
          </View>
        </View>

        {/* Resumen por Game */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumen por Game</Text>
          {gameResults.length > 0 ? (
            gameResults.map((game) => (
              <View key={game.game_number} style={styles.gameCard}>
                <Text style={styles.gameNumber}>Game {game.game_number}</Text>
                <View style={styles.gameScoreRow}>
                  <Text style={[styles.gamePlayerScore, game.player1_score > game.player2_score && styles.gameWinnerScore]}>
                    {matchData.player1_nickname}: {game.player1_score}
                  </Text>
                  <Text style={styles.gameScoreSeparator}>-</Text>
                  <Text style={[styles.gamePlayerScore, game.player2_score > game.player1_score && styles.gameWinnerScore]}>
                    {matchData.player2_nickname}: {game.player2_score}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            // Fallback si no hay game_results, calcular desde puntos
            Array.from(new Set(points.map(p => p.game_number))).map((gameNum) => {
              const gamePoints = points.filter(p => p.game_number === gameNum);
              const lastPoint = gamePoints[gamePoints.length - 1];
              return (
                <View key={gameNum} style={styles.gameCard}>
                  <Text style={styles.gameNumber}>Game {gameNum}</Text>
                  <View style={styles.gameScoreRow}>
                    <Text style={styles.gamePlayerScore}>
                      {matchData.player1_nickname}: {lastPoint?.player1_score || 0}
                    </Text>
                    <Text style={styles.gameScoreSeparator}>-</Text>
                    <Text style={styles.gamePlayerScore}>
                      {matchData.player2_nickname}: {lastPoint?.player2_score || 0}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.newMatchButton} onPress={() => router.push('/new-match')}>
          <Ionicons name="add-circle" size={24} color="#FFF" />
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
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    padding: 4,
  },
  homeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  content: {
    flex: 1,
  },
  resultCard: {
    backgroundColor: '#FFF',
    margin: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  tournamentText: {
    fontSize: 14,
    color: '#2196F3',
    textAlign: 'center',
    marginBottom: 4,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 16,
  },
  playerResult: {
    alignItems: 'center',
  },
  playerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  gamesCount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  vs: {
    fontSize: 24,
    color: '#999',
    fontWeight: 'bold',
  },
  winnerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8E1',
    padding: 12,
    borderRadius: 12,
  },
  winnerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F57C00',
    marginLeft: 8,
  },
  section: {
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  pointInfoCard: {
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  pointScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  pointScoreLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  pointScoreBadge: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pointScoreText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  gameLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
  },
  pointDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pointDetailText: {
    marginLeft: 12,
    flex: 1,
  },
  pointWinner: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  pointReason: {
    fontSize: 14,
    color: '#666',
  },
  navigationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F5F7FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  pointCounter: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#1E3A5F',
    borderRadius: 20,
    marginHorizontal: 8,
  },
  pointCounterText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
  filterButtons: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#F5F7FA',
    borderColor: '#333',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#333',
  },
  reasonsList: {
    gap: 12,
  },
  reasonBar: {
    marginBottom: 8,
  },
  reasonLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bar: {
    height: 24,
    borderRadius: 4,
    minWidth: 40,
  },
  barValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    minWidth: 30,
  },
  noDataText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
  },
  gameCard: {
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  gameNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  gameScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  gamePlayerScore: {
    fontSize: 14,
    color: '#666',
  },
  gameWinnerScore: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  gameScoreSeparator: {
    fontSize: 14,
    color: '#999',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  newMatchButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  newMatchText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginLeft: 8,
  },
});
