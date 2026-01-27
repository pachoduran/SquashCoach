import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { getDatabase } from '@/src/store/database';
import { HeatmapCourt } from '@/src/components/HeatmapCourt';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Player {
  id: number;
  nickname: string;
}

interface PointData {
  position_x: number;
  position_y: number;
  winner_player_id: number;
  player1_id: number;
}

export default function AnalysisScreen() {
  const router = useRouter();
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer1, setSelectedPlayer1] = useState<number | null>(null);
  const [selectedPlayer2, setSelectedPlayer2] = useState<number | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  const [points, setPoints] = useState<PointData[]>([]);
  const [matchCount, setMatchCount] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // Estadísticas
  const [player1Wins, setPlayer1Wins] = useState(0);
  const [player2Wins, setPlayer2Wins] = useState(0);

  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = async () => {
    try {
      const db = await getDatabase();
      const result = await db.getAllAsync(
        'SELECT id, nickname FROM players ORDER BY nickname ASC'
      );
      setPlayers(result as Player[]);
    } catch (error) {
      console.error('Error cargando jugadores:', error);
    }
  };

  const loadAnalysis = async () => {
    if (!selectedPlayer1 || !selectedPlayer2) return;
    
    setLoading(true);
    try {
      const db = await getDatabase();
      
      // Construir query para buscar partidos entre estos jugadores
      let matchQuery = `
        SELECT id, player1_id, player2_id FROM matches 
        WHERE status = 'finished'
        AND ((player1_id = ? AND player2_id = ?) OR (player1_id = ? AND player2_id = ?))
      `;
      let params: any[] = [selectedPlayer1, selectedPlayer2, selectedPlayer2, selectedPlayer1];
      
      // Agregar filtros de fecha si están presentes
      if (dateFrom) {
        matchQuery += ` AND date >= ?`;
        params.push(dateFrom + 'T00:00:00');
      }
      if (dateTo) {
        matchQuery += ` AND date <= ?`;
        params.push(dateTo + 'T23:59:59');
      }
      
      const matches = await db.getAllAsync(matchQuery, params) as any[];
      setMatchCount(matches.length);
      
      if (matches.length === 0) {
        setPoints([]);
        setPlayer1Wins(0);
        setPlayer2Wins(0);
        setLoading(false);
        return;
      }
      
      // Obtener todos los puntos de esos partidos
      const matchIds = matches.map(m => m.id);
      const placeholders = matchIds.map(() => '?').join(',');
      
      const pointsData = await db.getAllAsync(
        `SELECT p.position_x, p.position_y, p.winner_player_id, m.player1_id
         FROM points p
         JOIN matches m ON p.match_id = m.id
         WHERE p.match_id IN (${placeholders})`,
        matchIds
      ) as PointData[];
      
      setPoints(pointsData);
      
      // Calcular estadísticas
      let p1Wins = 0;
      let p2Wins = 0;
      
      pointsData.forEach(point => {
        // Determinar si el punto fue ganado por selectedPlayer1
        const isPlayer1InMatch = point.player1_id === selectedPlayer1;
        const pointWonByPlayer1InMatch = point.winner_player_id === point.player1_id;
        
        if ((isPlayer1InMatch && pointWonByPlayer1InMatch) || (!isPlayer1InMatch && !pointWonByPlayer1InMatch)) {
          p1Wins++;
        } else {
          p2Wins++;
        }
      });
      
      setPlayer1Wins(p1Wins);
      setPlayer2Wins(p2Wins);
      
    } catch (error) {
      console.error('Error cargando análisis:', error);
    } finally {
      setLoading(false);
    }
  };

  const getHeatmapData = (forPlayer: 'player1' | 'player2' | 'all') => {
    if (forPlayer === 'all') {
      return points.map(p => ({ x: p.position_x, y: p.position_y }));
    }
    
    return points.filter(point => {
      const isPlayer1InMatch = point.player1_id === selectedPlayer1;
      const pointWonByPlayer1InMatch = point.winner_player_id === point.player1_id;
      const wonBySelectedPlayer1 = (isPlayer1InMatch && pointWonByPlayer1InMatch) || (!isPlayer1InMatch && !pointWonByPlayer1InMatch);
      
      if (forPlayer === 'player1') {
        return wonBySelectedPlayer1;
      } else {
        return !wonBySelectedPlayer1;
      }
    }).map(p => ({ x: p.position_x, y: p.position_y }));
  };

  const player1Data = players.find(p => p.id === selectedPlayer1);
  const player2Data = players.find(p => p.id === selectedPlayer2);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Análisis Acumulado</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Selectores de jugadores */}
        <View style={styles.selectorsCard}>
          <Text style={styles.sectionTitle}>Seleccionar Jugadores</Text>
          
          <View style={styles.pickerRow}>
            <View style={styles.pickerWrapper}>
              <Text style={styles.pickerLabel}>Mi Jugador</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedPlayer1}
                  onValueChange={(value) => setSelectedPlayer1(value)}
                  style={styles.picker}
                >
                  <Picker.Item label="Seleccionar..." value={null} />
                  {players.map((player) => (
                    <Picker.Item key={player.id} label={player.nickname} value={player.id} />
                  ))}
                </Picker>
              </View>
            </View>
            
            <Text style={styles.vsText}>VS</Text>
            
            <View style={styles.pickerWrapper}>
              <Text style={styles.pickerLabel}>Oponente</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedPlayer2}
                  onValueChange={(value) => setSelectedPlayer2(value)}
                  style={styles.picker}
                >
                  <Picker.Item label="Seleccionar..." value={null} />
                  {players.filter(p => p.id !== selectedPlayer1).map((player) => (
                    <Picker.Item key={player.id} label={player.nickname} value={player.id} />
                  ))}
                </Picker>
              </View>
            </View>
          </View>
          
          {/* Filtros de fecha */}
          <View style={styles.dateFilters}>
            <View style={styles.dateInputWrapper}>
              <Text style={styles.dateLabel}>Desde</Text>
              <TextInput
                style={styles.dateInput}
                placeholder="YYYY-MM-DD"
                value={dateFrom}
                onChangeText={setDateFrom}
                placeholderTextColor="#999"
              />
            </View>
            <View style={styles.dateInputWrapper}>
              <Text style={styles.dateLabel}>Hasta</Text>
              <TextInput
                style={styles.dateInput}
                placeholder="YYYY-MM-DD"
                value={dateTo}
                onChangeText={setDateTo}
                placeholderTextColor="#999"
              />
            </View>
          </View>
          
          <TouchableOpacity
            style={[styles.analyzeButton, (!selectedPlayer1 || !selectedPlayer2) && styles.analyzeButtonDisabled]}
            onPress={loadAnalysis}
            disabled={!selectedPlayer1 || !selectedPlayer2 || loading}
          >
            <Ionicons name="analytics" size={20} color="#FFF" />
            <Text style={styles.analyzeButtonText}>
              {loading ? 'Analizando...' : 'Analizar'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Resultados */}
        {matchCount > 0 && (
          <>
            {/* Estadísticas resumen */}
            <View style={styles.statsCard}>
              <Text style={styles.matchCountText}>
                {matchCount} partido{matchCount !== 1 ? 's' : ''} analizados • {points.length} puntos
              </Text>
              
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { color: '#2196F3' }]}>{player1Wins}</Text>
                  <Text style={styles.statLabel}>{player1Data?.nickname}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { color: '#FF5722' }]}>{player2Wins}</Text>
                  <Text style={styles.statLabel}>{player2Data?.nickname}</Text>
                </View>
              </View>
              
              {/* Barra de porcentaje */}
              <View style={styles.percentBar}>
                <View style={[styles.percentFill, { 
                  flex: player1Wins, 
                  backgroundColor: '#2196F3',
                  borderTopLeftRadius: 4,
                  borderBottomLeftRadius: 4,
                }]} />
                <View style={[styles.percentFill, { 
                  flex: player2Wins, 
                  backgroundColor: '#FF5722',
                  borderTopRightRadius: 4,
                  borderBottomRightRadius: 4,
                }]} />
              </View>
              <View style={styles.percentLabels}>
                <Text style={styles.percentText}>
                  {points.length > 0 ? Math.round((player1Wins / points.length) * 100) : 0}%
                </Text>
                <Text style={styles.percentText}>
                  {points.length > 0 ? Math.round((player2Wins / points.length) * 100) : 0}%
                </Text>
              </View>
            </View>

            {/* Mapas de calor */}
            <View style={styles.heatmapSection}>
              <Text style={styles.heatmapTitle}>
                Zona de calor - {player1Data?.nickname}
              </Text>
              <Text style={styles.heatmapSubtitle}>Donde gana sus puntos</Text>
              <HeatmapCourt 
                points={getHeatmapData('player1')} 
                color="#2196F3"
              />
            </View>

            <View style={styles.heatmapSection}>
              <Text style={styles.heatmapTitle}>
                Zona de calor - {player2Data?.nickname}
              </Text>
              <Text style={styles.heatmapSubtitle}>Donde gana sus puntos</Text>
              <HeatmapCourt 
                points={getHeatmapData('player2')} 
                color="#FF5722"
              />
            </View>

            <View style={styles.heatmapSection}>
              <Text style={styles.heatmapTitle}>Todos los puntos</Text>
              <Text style={styles.heatmapSubtitle}>Distribución general</Text>
              <HeatmapCourt 
                points={getHeatmapData('all')} 
                color="#9C27B0"
              />
            </View>
          </>
        )}

        {matchCount === 0 && selectedPlayer1 && selectedPlayer2 && !loading && (
          <View style={styles.noDataCard}>
            <Ionicons name="information-circle-outline" size={48} color="#999" />
            <Text style={styles.noDataText}>
              No se encontraron partidos entre estos jugadores
            </Text>
            {(dateFrom || dateTo) && (
              <Text style={styles.noDataSubtext}>
                Intenta ajustar el rango de fechas
              </Text>
            )}
          </View>
        )}
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
    paddingVertical: 12,
  },
  backButton: {
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
  selectorsCard: {
    backgroundColor: '#FFF',
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickerWrapper: {
    flex: 1,
  },
  pickerLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  pickerContainer: {
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 44,
  },
  vsText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#999',
    marginTop: 16,
  },
  dateFilters: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  dateInputWrapper: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  dateInput: {
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#333',
  },
  analyzeButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  analyzeButtonDisabled: {
    backgroundColor: '#B0BEC5',
  },
  analyzeButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  statsCard: {
    backgroundColor: '#FFF',
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
  },
  matchCountText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 50,
    backgroundColor: '#E0E0E0',
  },
  percentBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 16,
    backgroundColor: '#E0E0E0',
  },
  percentFill: {
    height: '100%',
  },
  percentLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  percentText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  heatmapSection: {
    backgroundColor: '#FFF',
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  heatmapTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  heatmapSubtitle: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  noDataCard: {
    backgroundColor: '#FFF',
    marginTop: 20,
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
  },
  noDataSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 4,
  },
});
