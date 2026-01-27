import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getDatabase } from '@/src/store/database';
import { SquashCourt } from '@/src/components/SquashCourt';
import { format } from 'date-fns';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface MatchData {
  id: number;
  player1_name: string;
  player2_name: string;
  my_player_name: string;
  winner_name: string;
  player1_games: number;
  player2_games: number;
  date: string;
}

interface PointData {
  position_x: number;
  position_y: number;
  winner_player_id: number;
  reason: string;
  game_number: number;
}

export default function MatchSummary() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const matchId = parseInt(params.matchId as string);

  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [points, setPoints] = useState<PointData[]>([]);
  const [reasonStats, setReasonStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMatchSummary();
  }, []);

  const loadMatchSummary = async () => {
    try {
      const db = await getDatabase();
      
      // Cargar datos del partido
      const match = await db.getFirstAsync(
        `SELECT 
          m.*,
          p1.name as player1_name,
          p2.name as player2_name,
          mp.name as my_player_name,
          pw.name as winner_name
        FROM matches m
        JOIN players p1 ON m.player1_id = p1.id
        JOIN players p2 ON m.player2_id = p2.id
        JOIN players mp ON m.my_player_id = mp.id
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

      // Calcular estadísticas de motivos
      const reasonsData = await db.getAllAsync(
        `SELECT reason, COUNT(*) as count 
         FROM points 
         WHERE match_id = ? 
         GROUP BY reason 
         ORDER BY count DESC`,
        [matchId]
      );

      const chartData = (reasonsData as any[]).map((item, index) => ({
        value: item.count,
        label: item.reason.substring(0, 10),
        frontColor: ['#4CAF50', '#2196F3', '#FF9800', '#F44336', '#9C27B0'][index % 5],
      }));

      setReasonStats(chartData);
    } catch (error) {
      console.error('Error cargando resumen:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !matchData) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Cargando...</Text>
      </View>
    );
  }

  const myPlayerIsPlayer1 = matchData.my_player_name === matchData.player1_name;
  const myPoints = points.filter(
    (p) =>
      (myPlayerIsPlayer1 && p.winner_player_id === 1) ||
      (!myPlayerIsPlayer1 && p.winner_player_id === 2)
  );
  const opponentPoints = points.filter((p) => !myPoints.includes(p));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Resumen del Partido</Text>
        <TouchableOpacity onPress={() => router.push('/')} style={styles.homeButton}>
          <Ionicons name="home" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Resultado Final */}
        <View style={styles.resultCard}>
          <Text style={styles.dateText}>
            {format(new Date(matchData.date), "dd/MM/yyyy - HH:mm")}
          </Text>
          <View style={styles.resultRow}>
            <View style={styles.playerResult}>
              <Text style={styles.playerName}>{matchData.player1_name}</Text>
              <Text style={styles.gamesCount}>{matchData.player1_games}</Text>
            </View>
            <Text style={styles.vs}>-</Text>
            <View style={styles.playerResult}>
              <Text style={styles.playerName}>{matchData.player2_name}</Text>
              <Text style={styles.gamesCount}>{matchData.player2_games}</Text>
            </View>
          </View>
          <View style={styles.winnerBadge}>
            <Ionicons name="trophy" size={20} color="#FFD700" />
            <Text style={styles.winnerText}>Ganador: {matchData.winner_name}</Text>
          </View>
        </View>

        {/* Mapa de Calor */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mapa de Calor - Dónde Terminaron los Puntos</Text>
          <SquashCourt
            points={points.map((p) => ({
              x: p.position_x,
              y: p.position_y,
              isWin: myPoints.includes(p),
            }))}
          />
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
              <Text style={styles.legendText}>Mis puntos ganados</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#F44336' }]} />
              <Text style={styles.legendText}>Puntos perdidos</Text>
            </View>
          </View>
        </View>

        {/* Estadísticas de Puntos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estadísticas de Puntos</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{points.length}</Text>
              <Text style={styles.statLabel}>Puntos Totales</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{myPoints.length}</Text>
              <Text style={styles.statLabel}>Mis Puntos</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{opponentPoints.length}</Text>
              <Text style={styles.statLabel}>Puntos Oponente</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {points.length > 0 ? ((myPoints.length / points.length) * 100).toFixed(0) : 0}%
              </Text>
              <Text style={styles.statLabel}>Efectividad</Text>
            </View>
          </View>
        </View>

        {/* Motivos de Puntos */}
        {reasonStats.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Motivos de Puntos</Text>
            <View style={styles.reasonsList}>
              {reasonStats.map((stat, index) => (
                <View key={index} style={styles.reasonBar}>
                  <Text style={styles.reasonLabel}>{stat.label}</Text>
                  <View style={styles.barContainer}>
                    <View
                      style={[
                        styles.bar,
                        {
                          width: `${(stat.value / Math.max(...reasonStats.map((s) => s.value))) * 100}%`,
                          backgroundColor: stat.frontColor,
                        },
                      ]}
                    />
                    <Text style={styles.barValue}>{stat.value}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Resumen por Game */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumen por Game</Text>
          {Array.from(new Set(points.map((p) => p.game_number))).map((gameNum) => {
            const gamePoints = points.filter((p) => p.game_number === gameNum);
            const lastPoint = gamePoints[gamePoints.length - 1];
            return (
              <View key={gameNum} style={styles.gameCard}>
                <Text style={styles.gameNumber}>Game {gameNum}</Text>
                <Text style={styles.gameScore}>
                  {matchData.player1_name}: {gamePoints.filter((p) => p.winner_player_id === 1).length}{' '}
                  - {matchData.player2_name}:{' '}
                  {gamePoints.filter((p) => p.winner_player_id === 2).length}
                </Text>
              </View>
            );
          })}
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
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontSize: 13,
    color: '#666',
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
    color: '#2196F3',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
  chartContainer: {
    alignItems: 'center',
    paddingVertical: 16,
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
  gameScore: {
    fontSize: 14,
    color: '#666',
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