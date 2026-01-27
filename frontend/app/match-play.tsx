import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  ScrollView,
  Alert,
  Pressable,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getDatabase } from '@/src/store/database';
import { SquashCourt } from '@/src/components/SquashCourt';
import { ScoreBoard } from '@/src/components/ScoreBoard';

interface Player {
  id: number;
  name: string;
  nickname?: string;
}

interface Match {
  id: number;
  player1: Player;
  player2: Player;
  myPlayer: Player;
  bestOf: number;
  currentGame: number;
  player1Games: number;
  player2Games: number;
  player1Score: number;
  player2Score: number;
  status: string;
}

interface Point {
  positionX: number;
  positionY: number;
  winnerPlayerId?: number;
  reason?: string;
  myPlayerPosX?: number;
  myPlayerPosY?: number;
  opponentPosX?: number;
  opponentPosY?: number;
}

export default function MatchPlay() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const matchId = parseInt(params.matchId as string);

  const [match, setMatch] = useState<Match | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
  const [showPointModal, setShowPointModal] = useState(false);
  const [selectingPosition, setSelectingPosition] = useState<'myPlayer' | 'opponent' | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [gamePoints, setGamePoints] = useState<Array<{ x: number; y: number; isWin: boolean; score: string }>>([]);
  const [playerPositions, setPlayerPositions] = useState<Array<{ x: number; y: number; isPlayer1: boolean; score: string }>>([]);
  const [showAllPositions, setShowAllPositions] = useState(false);

  useEffect(() => {
    loadMatch();
    loadReasons();
  }, []);

  const loadMatch = async () => {
    try {
      const db = await getDatabase();
      const result = await db.getFirstAsync(
        `SELECT 
          m.*,
          p1.id as p1_id, p1.name as p1_name, p1.nickname as p1_nickname,
          p2.id as p2_id, p2.name as p2_name, p2.nickname as p2_nickname,
          mp.id as mp_id, mp.name as mp_name, mp.nickname as mp_nickname
        FROM matches m
        JOIN players p1 ON m.player1_id = p1.id
        JOIN players p2 ON m.player2_id = p2.id
        JOIN players mp ON m.my_player_id = mp.id
        WHERE m.id = ?`,
        [matchId]
      );

      if (result) {
        const matchData: any = result;
        setMatch({
          id: matchData.id,
          player1: {
            id: matchData.p1_id,
            name: matchData.p1_name,
            nickname: matchData.p1_nickname,
          },
          player2: {
            id: matchData.p2_id,
            name: matchData.p2_name,
            nickname: matchData.p2_nickname,
          },
          myPlayer: {
            id: matchData.mp_id,
            name: matchData.mp_name,
            nickname: matchData.mp_nickname,
          },
          bestOf: matchData.best_of,
          currentGame: matchData.current_game,
          player1Games: matchData.player1_games,
          player2Games: matchData.player2_games,
          player1Score: 0,
          player2Score: 0,
          status: matchData.status,
        });

        // Cargar puntos del game actual
        await loadCurrentGamePoints(matchData.current_game);
      }
    } catch (error) {
      console.error('Error cargando partido:', error);
      Alert.alert('Error', 'No se pudo cargar el partido');
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentGamePoints = async (gameNumber: number) => {
    try {
      const db = await getDatabase();
      const points = await db.getAllAsync(
        `SELECT * FROM points 
         WHERE match_id = ? AND game_number = ? 
         ORDER BY point_number ASC`,
        [matchId, gameNumber]
      );

      if (points.length > 0) {
        const lastPoint: any = points[points.length - 1];
        setMatch((prev) =>
          prev
            ? {
                ...prev,
                player1Score: lastPoint.player1_score,
                player2Score: lastPoint.player2_score,
              }
            : null
        );
        
        // Cargar puntos para visualización en la cancha
        const visualPoints = points.map((p: any) => ({
          x: p.position_x,
          y: p.position_y,
          isWin: p.winner_player_id === matchData.p1_id, // Jugador 1 = azul
          score: `${p.player1_score}-${p.player2_score}`,
        }));
        setGamePoints(visualPoints);
        
        // Cargar posiciones de jugadores
        const positions: Array<{ x: number; y: number; isPlayer1: boolean; score: string }> = [];
        points.forEach((p: any) => {
          if (p.my_player_pos_x !== null && p.my_player_pos_y !== null) {
            positions.push({
              x: p.my_player_pos_x,
              y: p.my_player_pos_y,
              isPlayer1: true, // Mi jugador siempre es jugador 1
              score: `${p.player1_score}-${p.player2_score}`,
            });
          }
          if (p.opponent_pos_x !== null && p.opponent_pos_y !== null) {
            positions.push({
              x: p.opponent_pos_x,
              y: p.opponent_pos_y,
              isPlayer1: false,
              score: `${p.player1_score}-${p.player2_score}`,
            });
          }
        });
        setPlayerPositions(positions);
      }
    } catch (error) {
      console.error('Error cargando puntos:', error);
    }
  };

  const loadReasons = async () => {
    try {
      const db = await getDatabase();
      const result = await db.getAllAsync(
        'SELECT name FROM custom_reasons WHERE is_active = 1 ORDER BY name ASC'
      );
      setReasons(result.map((r: any) => r.name));
    } catch (error) {
      console.error('Error cargando motivos:', error);
    }
  };

  const handleCourtPress = (x: number, y: number) => {
    if (selectingPosition === 'myPlayer') {
      setCurrentPoint({ ...currentPoint!, myPlayerPosX: x, myPlayerPosY: y });
      setSelectingPosition(null);
      setShowPointModal(true);
    } else if (selectingPosition === 'opponent') {
      setCurrentPoint({ ...currentPoint!, opponentPosX: x, opponentPosY: y });
      setSelectingPosition(null);
      setShowPointModal(true);
    } else {
      // Nuevo flujo: solo marcar posición, usuario elige ganador en modal
      setCurrentPoint({
        positionX: x,
        positionY: y,
      });
      setShowPointModal(true);
    }
  };

  const savePoint = async () => {
    if (!currentPoint || !currentPoint.winnerPlayerId || !currentPoint.reason) {
      Alert.alert('Error', 'Por favor completa todos los datos del punto');
      return;
    }

    if (!match) return;

    try {
      const db = await getDatabase();
      
      // Calcular nuevo marcador
      let newPlayer1Score = match.player1Score;
      let newPlayer2Score = match.player2Score;
      
      if (currentPoint.winnerPlayerId === match.player1.id) {
        newPlayer1Score++;
      } else {
        newPlayer2Score++;
      }

      // Obtener número de puntos en este game
      const pointCount = await db.getFirstAsync(
        'SELECT COUNT(*) as count FROM points WHERE match_id = ? AND game_number = ?',
        [matchId, match.currentGame]
      );

      const pointNumber = ((pointCount as any)?.count || 0) + 1;

      // Guardar punto
      await db.runAsync(
        `INSERT INTO points 
        (match_id, position_x, position_y, winner_player_id, reason, 
         my_player_pos_x, my_player_pos_y, opponent_pos_x, opponent_pos_y,
         game_number, point_number, player1_score, player2_score, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          matchId,
          currentPoint.positionX,
          currentPoint.positionY,
          currentPoint.winnerPlayerId,
          currentPoint.reason,
          currentPoint.myPlayerPosX || null,
          currentPoint.myPlayerPosY || null,
          currentPoint.opponentPosX || null,
          currentPoint.opponentPosY || null,
          match.currentGame,
          pointNumber,
          newPlayer1Score,
          newPlayer2Score,
          new Date().toISOString(),
        ]
      );

      // Verificar si el game terminó (11 puntos con diferencia de 2)
      const gameFinished =
        (newPlayer1Score >= 11 && newPlayer1Score - newPlayer2Score >= 2) ||
        (newPlayer2Score >= 11 && newPlayer2Score - newPlayer1Score >= 2);

      if (gameFinished) {
        const player1GamesWon = newPlayer1Score > newPlayer2Score ? 1 : 0;
        const player2GamesWon = newPlayer2Score > newPlayer1Score ? 1 : 0;
        const newPlayer1Games = match.player1Games + player1GamesWon;
        const newPlayer2Games = match.player2Games + player2GamesWon;

        // Verificar si el partido terminó
        const gamesNeeded = Math.ceil(match.bestOf / 2);
        const matchFinished = newPlayer1Games >= gamesNeeded || newPlayer2Games >= gamesNeeded;

        if (matchFinished) {
          const winnerId =
            newPlayer1Games > newPlayer2Games ? match.player1.id : match.player2.id;

          await db.runAsync(
            'UPDATE matches SET status = ?, winner_id = ?, player1_games = ?, player2_games = ? WHERE id = ?',
            ['finished', winnerId, newPlayer1Games, newPlayer2Games, matchId]
          );

          Alert.alert(
            'Partido Finalizado',
            `¡${newPlayer1Games > newPlayer2Games ? match.player1.name : match.player2.name} ganó el partido!`,
            [
              {
                text: 'Ver Resumen',
                onPress: () => {
                  router.replace({
                    pathname: '/match-summary',
                    params: { matchId },
                  });
                },
              },
            ]
          );
        } else {
          // Iniciar siguiente game
          await db.runAsync(
            'UPDATE matches SET current_game = ?, player1_games = ?, player2_games = ? WHERE id = ?',
            [match.currentGame + 1, newPlayer1Games, newPlayer2Games, matchId]
          );

          Alert.alert(
            'Game Finalizado',
            `Game ${match.currentGame} terminado. Iniciando Game ${match.currentGame + 1}`,
            [{ text: 'OK', onPress: () => loadMatch() }]
          );
        }
      } else {
        // Actualizar marcador y agregar punto al array de visualización
        setMatch({
          ...match,
          player1Score: newPlayer1Score,
          player2Score: newPlayer2Score,
        });
        
        const newPoint = {
          x: currentPoint.positionX,
          y: currentPoint.positionY,
          isWin: currentPoint.winnerPlayerId === match.player1.id,
          score: `${newPlayer1Score}-${newPlayer2Score}`,
        };
        setGamePoints([...gamePoints, newPoint]);
        
        // Agregar posiciones de jugadores si fueron registradas
        if (currentPoint.myPlayerPosX !== undefined) {
          setPlayerPositions([
            ...playerPositions,
            {
              x: currentPoint.myPlayerPosX,
              y: currentPoint.myPlayerPosY!,
              isPlayer1: true,
              score: `${newPlayer1Score}-${newPlayer2Score}`,
            },
          ]);
        }
        if (currentPoint.opponentPosX !== undefined) {
          setPlayerPositions((prev) => [
            ...prev,
            {
              x: currentPoint.opponentPosX!,
              y: currentPoint.opponentPosY!,
              isPlayer1: false,
              score: `${newPlayer1Score}-${newPlayer2Score}`,
            },
          ]);
        }
      }

      setShowPointModal(false);
      setCurrentPoint(null);
      setSelectingPosition(null);
    } catch (error) {
      console.error('Error guardando punto:', error);
      Alert.alert('Error', 'No se pudo guardar el punto');
    }
  };

  if (loading || !match) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Cargando...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Partido en Curso</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.compactHeader}>
          <ScoreBoard
            player1Name={match.player1.name}
            player2Name={match.player2.name}
            player1Score={match.player1Score}
            player2Score={match.player2Score}
            player1Games={match.player1Games}
            player2Games={match.player2Games}
            currentGame={match.currentGame}
            isPlayer1My={true}
          />
          
          <View style={styles.actionRow}>
            <View style={styles.instruction}>
              <Text style={styles.instructionText}>
                {selectingPosition === 'myPlayer' && 'Toca tu posición'}
                {selectingPosition === 'opponent' && 'Toca posición oponente'}
                {!selectingPosition && 'Toca donde terminó el punto'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.toggleButton}
              onPress={() => setShowAllPositions(!showAllPositions)}
            >
              <Ionicons 
                name={showAllPositions ? 'eye-off' : 'eye'} 
                size={20} 
                color="#FFF" 
              />
            </TouchableOpacity>
          </View>
        </View>

        <SquashCourt
          onCourtPress={handleCourtPress}
          points={gamePoints}
          showPositions={
            currentPoint?.myPlayerPosX !== undefined || currentPoint?.opponentPosX !== undefined
          }
          playerPosition={
            currentPoint?.myPlayerPosX !== undefined
              ? { x: currentPoint.myPlayerPosX, y: currentPoint.myPlayerPosY! }
              : undefined
          }
          opponentPosition={
            currentPoint?.opponentPosX !== undefined
              ? { x: currentPoint.opponentPosX, y: currentPoint.opponentPosY! }
              : undefined
          }
          player1Color="#2196F3"
          player2Color="#FF5722"
          playerPositions={playerPositions}
          showAllPositions={showAllPositions}
        />
      </ScrollView>

      {/* Modal de registro de punto */}
      <Modal
        visible={showPointModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPointModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Detalles del Punto</Text>

            {/* Ganador */}
            <Text style={styles.modalLabel}>¿Quién ganó el punto?</Text>
            <View style={styles.winnerButtons}>
              <TouchableOpacity
                style={[
                  styles.winnerButton,
                  currentPoint?.winnerPlayerId === match.player1.id &&
                    styles.winnerButtonSelected,
                ]}
                onPress={() =>
                  setCurrentPoint({ ...currentPoint!, winnerPlayerId: match.player1.id })
                }
              >
                <Text
                  style={[
                    styles.winnerButtonText,
                    currentPoint?.winnerPlayerId === match.player1.id &&
                      styles.winnerButtonTextSelected,
                  ]}
                >
                  {match.player1.name}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.winnerButton,
                  currentPoint?.winnerPlayerId === match.player2.id &&
                    styles.winnerButtonSelected,
                ]}
                onPress={() =>
                  setCurrentPoint({ ...currentPoint!, winnerPlayerId: match.player2.id })
                }
              >
                <Text
                  style={[
                    styles.winnerButtonText,
                    currentPoint?.winnerPlayerId === match.player2.id &&
                      styles.winnerButtonTextSelected,
                  ]}
                >
                  {match.player2.name}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Motivo */}
            <Text style={styles.modalLabel}>Motivo</Text>
            <ScrollView style={styles.reasonsScroll} nestedScrollEnabled>
              <View style={styles.reasonsGrid}>
                {reasons.map((reason) => (
                  <TouchableOpacity
                    key={reason}
                    style={[
                      styles.reasonButton,
                      currentPoint?.reason === reason && styles.reasonButtonSelected,
                    ]}
                    onPress={() => setCurrentPoint({ ...currentPoint!, reason })}
                  >
                    <Text
                      style={[
                        styles.reasonButtonText,
                        currentPoint?.reason === reason && styles.reasonButtonTextSelected,
                      ]}
                    >
                      {reason}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Posiciones */}
            <Text style={styles.modalLabel}>Posiciones (Opcional)</Text>
            <View style={styles.positionButtons}>
              <TouchableOpacity
                style={styles.positionButton}
                onPress={() => {
                  setShowPointModal(false);
                  setSelectingPosition('myPlayer');
                }}
              >
                <Ionicons name="navigate" size={20} color="#2196F3" />
                <Text style={styles.positionButtonText}>Mi Posición</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.positionButton}
                onPress={() => {
                  setShowPointModal(false);
                  setSelectingPosition('opponent');
                }}
              >
                <Ionicons name="navigate" size={20} color="#FF9800" />
                <Text style={styles.positionButtonText}>Oponente</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setShowPointModal(false);
                  setCurrentPoint(null);
                  setSelectingPosition(null);
                }}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={savePoint}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                  Guardar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  content: {
    flex: 1,
  },
  compactHeader: {
    paddingHorizontal: 15,
    paddingTop: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 8,
  },
  instruction: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  instructionText: {
    fontSize: 13,
    color: '#1976D2',
    textAlign: 'center',
  },
  toggleButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    padding: 10,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  instructionContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  instruction: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 16,
    color: '#1976D2',
    marginLeft: 12,
    flex: 1,
  },
  registerPointButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  registerPointText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    marginTop: 8,
  },
  winnerButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  winnerButton: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  winnerButtonSelected: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  winnerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  winnerButtonTextSelected: {
    color: '#4CAF50',
  },
  reasonsScroll: {
    maxHeight: 200,
    marginBottom: 16,
  },
  reasonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonButton: {
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  reasonButtonSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  reasonButtonText: {
    fontSize: 14,
    color: '#666',
  },
  reasonButtonTextSelected: {
    color: '#2196F3',
    fontWeight: '600',
  },
  positionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  positionButton: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  positionButtonText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
  },
  modalButtonPrimary: {
    backgroundColor: '#2196F3',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modalButtonTextPrimary: {
    color: '#FFF',
  },
});
