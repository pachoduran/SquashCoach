import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getDatabase } from '@/src/store/database';
import { useLanguage } from '@/src/context/LanguageContext';
import { useAuth } from '@/src/context/AuthContext';
import { HeatmapCourt } from '@/src/components/HeatmapCourt';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Player {
  id: number;
  nickname: string;
  is_mine?: number;
  category?: string;
}

interface Tournament {
  id: number;
  name: string;
}

interface PointData {
  position_x: number;
  position_y: number;
  winner_player_id: number;
  player1_id: number;
  reason: string;
}

export default function AnalysisScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();

  const getPlayerLabel = (player: Player) => {
    let label = player.nickname;
    if (player.category) label += ` (${player.category})`;
    if (player.is_mine) label = `★ ${label}`;
    return label;
  };
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer1, setSelectedPlayer1] = useState<number | null>(null);
  const [selectedPlayer2, setSelectedPlayer2] = useState<number | null>(null);
  
  // Fechas - por defecto: hace 1 mes hasta hoy
  const getDefaultDateFrom = () => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date;
  };
  const [dateFrom, setDateFrom] = useState<Date | null>(getDefaultDateFrom());
  const [dateTo, setDateTo] = useState<Date | null>(new Date());
  const [showDateFromPicker, setShowDateFromPicker] = useState(false);
  const [showDateToPicker, setShowDateToPicker] = useState(false);
  
  const [points, setPoints] = useState<PointData[]>([]);
  const [matchCount, setMatchCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Estadísticas
  const [player1Wins, setPlayer1Wins] = useState(0);
  const [player2Wins, setPlayer2Wins] = useState(0);
  
  // Tournament filter
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<number | null>(null);
  const [showTournamentPicker, setShowTournamentPicker] = useState(false);
  
  // Reason stats
  const [reasonStats, setReasonStats] = useState<{ reason: string; p1Count: number; p2Count: number }[]>([]);

  // Para iOS - modales de selección
  const [showPlayer1Picker, setShowPlayer1Picker] = useState(false);
  const [showPlayer2Picker, setShowPlayer2Picker] = useState(false);

  useEffect(() => {
    loadPlayers();
    loadTournaments();
  }, []);

  const loadTournaments = async () => {
    try {
      const db = await getDatabase();
      const userId = user?.user_id || '';
      const result = await db.getAllAsync(
        'SELECT id, name FROM tournaments WHERE user_id = ? OR user_id IS NULL ORDER BY name ASC',
        [userId]
      );
      setTournaments(result as Tournament[]);
    } catch (error) {
      console.error('Error cargando torneos:', error);
    }
  };

  const loadPlayers = async () => {
    try {
      const db = await getDatabase();
      const userId = user?.user_id || '';
      const result = await db.getAllAsync(
        'SELECT id, nickname, COALESCE(is_mine, 0) as is_mine, category FROM players WHERE user_id = ? OR user_id IS NULL ORDER BY is_mine DESC, nickname ASC',
        [userId]
      );
      setPlayers(result as Player[]);
    } catch (error) {
      console.error('Error cargando jugadores:', error);
    }
  };

  const loadAnalysis = async () => {
    if (!selectedPlayer1 && !selectedPlayer2 && !selectedTournament) {
      Alert.alert('Filtro requerido', 'Selecciona al menos un jugador o un torneo');
      return;
    }
    
    setLoading(true);
    setHasSearched(true);
    try {
      const db = await getDatabase();
      
      let matchQuery = `
        SELECT id, player1_id, player2_id FROM matches 
        WHERE status = 'finished'
      `;
      let params: any[] = [];
      
      if (selectedPlayer1 && selectedPlayer2) {
        matchQuery += ` AND ((player1_id = ? AND player2_id = ?) OR (player1_id = ? AND player2_id = ?))`;
        params.push(selectedPlayer1, selectedPlayer2, selectedPlayer2, selectedPlayer1);
      } else if (selectedPlayer1) {
        matchQuery += ` AND (player1_id = ? OR player2_id = ?)`;
        params.push(selectedPlayer1, selectedPlayer1);
      } else if (selectedPlayer2) {
        matchQuery += ` AND (player1_id = ? OR player2_id = ?)`;
        params.push(selectedPlayer2, selectedPlayer2);
      }
      
      if (dateFrom) {
        matchQuery += ` AND date >= ?`;
        params.push(format(dateFrom, 'yyyy-MM-dd') + 'T00:00:00');
      }
      if (dateTo) {
        matchQuery += ` AND date <= ?`;
        params.push(format(dateTo, 'yyyy-MM-dd') + 'T23:59:59');
      }
      if (selectedTournament) {
        matchQuery += ` AND tournament_name = (SELECT name FROM tournaments WHERE id = ?)`;
        params.push(selectedTournament);
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
      
      const matchIds = matches.map(m => m.id);
      const placeholders = matchIds.map(() => '?').join(',');
      
      const pointsData = await db.getAllAsync(
        `SELECT p.position_x, p.position_y, p.winner_player_id, p.reason, m.player1_id
         FROM points p
         JOIN matches m ON p.match_id = m.id
         WHERE p.match_id IN (${placeholders})`,
        matchIds
      ) as PointData[];
      
      setPoints(pointsData);
      
      let p1Wins = 0;
      let p2Wins = 0;
      const reasonMap: { [key: string]: { p1: number; p2: number } } = {};
      
      pointsData.forEach(point => {
        const isPlayer1InMatch = point.player1_id === selectedPlayer1;
        const pointWonByPlayer1InMatch = point.winner_player_id === point.player1_id;
        const wonByP1 = (isPlayer1InMatch && pointWonByPlayer1InMatch) || (!isPlayer1InMatch && !pointWonByPlayer1InMatch);
        
        if (wonByP1) {
          p1Wins++;
        } else {
          p2Wins++;
        }
        
        // Track reason stats
        const reason = point.reason || 'Sin motivo';
        if (!reasonMap[reason]) reasonMap[reason] = { p1: 0, p2: 0 };
        if (wonByP1) reasonMap[reason].p1++;
        else reasonMap[reason].p2++;
      });
      
      setPlayer1Wins(p1Wins);
      setPlayer2Wins(p2Wins);
      
      // Build reason stats sorted by total
      const rStats = Object.entries(reasonMap)
        .map(([reason, counts]) => ({ reason, p1Count: counts.p1, p2Count: counts.p2 }))
        .sort((a, b) => (b.p1Count + b.p2Count) - (a.p1Count + a.p2Count));
      setReasonStats(rStats);
      
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

  const handleDateFromChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS !== 'ios') setShowDateFromPicker(false);
    if (selectedDate) {
      setDateFrom(selectedDate);
    }
  };

  const handleDateToChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS !== 'ios') setShowDateToPicker(false);
    if (selectedDate) {
      setDateTo(selectedDate);
    }
  };

  const clearDateFrom = () => setDateFrom(null);
  const clearDateTo = () => setDateTo(null);

  const player1Data = players.find(p => p.id === selectedPlayer1);
  const player2Data = players.find(p => p.id === selectedPlayer2);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('analysis.title')}</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Selectores de jugadores */}
        <View style={styles.selectorsCard}>
          <Text style={styles.sectionTitle}>{t('analysis.selectPlayers')}</Text>
          
          {/* Jugador 1 */}
          <View style={styles.pickerSection}>
            <Text style={styles.pickerLabel}>{t('newMatch.myPlayer')}</Text>
            {Platform.OS === 'ios' ? (
              <TouchableOpacity 
                style={styles.iosPickerButton}
                onPress={() => setShowPlayer1Picker(true)}
              >
                <Text style={[styles.iosPickerButtonText, !selectedPlayer1 && styles.iosPickerPlaceholder]}>
                  {selectedPlayer1 
                    ? getPlayerLabel(players.find(p => p.id === selectedPlayer1)!)
                    : t('newMatch.selectPlayer')}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
            ) : (
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedPlayer1}
                  onValueChange={(value) => setSelectedPlayer1(value)}
                  style={styles.picker}
                  itemStyle={styles.pickerItem}
                >
                  <Picker.Item label={t('newMatch.selectPlayer')} value={null} />
                  {players.map((player) => (
                    <Picker.Item key={player.id} label={getPlayerLabel(player)} value={player.id} />
                  ))}
                </Picker>
              </View>
            )}
          </View>
          
          <View style={styles.vsContainer}>
            <View style={styles.vsLine} />
            <Text style={styles.vsText}>VS</Text>
            <View style={styles.vsLine} />
          </View>
          
          {/* Jugador 2 */}
          <View style={styles.pickerSection}>
            <Text style={styles.pickerLabel}>{t('history.opponent')}</Text>
            {Platform.OS === 'ios' ? (
              <TouchableOpacity 
                style={styles.iosPickerButton}
                onPress={() => setShowPlayer2Picker(true)}
              >
                <Text style={[styles.iosPickerButtonText, !selectedPlayer2 && styles.iosPickerPlaceholder]}>
                  {selectedPlayer2 
                    ? getPlayerLabel(players.find(p => p.id === selectedPlayer2)!)
                    : t('newMatch.selectPlayer')}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
            ) : (
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedPlayer2}
                  onValueChange={(value) => setSelectedPlayer2(value)}
                  style={styles.picker}
                  itemStyle={styles.pickerItem}
                >
                  <Picker.Item label={t('newMatch.selectPlayer')} value={null} />
                  {players.filter(p => p.id !== selectedPlayer1).map((player) => (
                    <Picker.Item key={player.id} label={getPlayerLabel(player)} value={player.id} />
                  ))}
                </Picker>
              </View>
            )}
          </View>
          
          {/* Filtros de fecha */}
          <Text style={[styles.pickerLabel, { marginTop: 16 }]}>{t('analysis.dateRange')}</Text>
          <View style={styles.dateFilters}>
            <TouchableOpacity 
              style={styles.dateButton}
              onPress={() => setShowDateFromPicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color="#2196F3" />
              <Text style={styles.dateButtonText}>
                {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : t('common.from')}
              </Text>
              {dateFrom && (
                <TouchableOpacity onPress={clearDateFrom} style={styles.clearDateBtn}>
                  <Ionicons name="close-circle" size={18} color="#999" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.dateButton}
              onPress={() => setShowDateToPicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color="#2196F3" />
              <Text style={styles.dateButtonText}>
                {dateTo ? format(dateTo, 'dd/MM/yyyy') : t('common.to')}
              </Text>
              {dateTo && (
                <TouchableOpacity onPress={clearDateTo} style={styles.clearDateBtn}>
                  <Ionicons name="close-circle" size={18} color="#999" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </View>
          
          {/* Date Pickers */}
          {Platform.OS !== 'ios' && showDateFromPicker && (
            <DateTimePicker
              value={dateFrom || new Date()}
              mode="date"
              display="default"
              onChange={handleDateFromChange}
              maximumDate={dateTo || new Date()}
            />
          )}
          
          {Platform.OS !== 'ios' && showDateToPicker && (
            <DateTimePicker
              value={dateTo || new Date()}
              mode="date"
              display="default"
              onChange={handleDateToChange}
              minimumDate={dateFrom || undefined}
              maximumDate={new Date()}
            />
          )}
          
          {/* Tournament filter */}
          <>
            <Text style={[styles.pickerLabel, { marginTop: 16 }]}>Torneo (opcional)</Text>
            {tournaments.length === 0 ? (
              <View style={[styles.iosPickerButton, { backgroundColor: '#f5f5f5' }]}>
                <Text style={[styles.iosPickerButtonText, styles.iosPickerPlaceholder]}>
                  No hay torneos registrados
                </Text>
              </View>
            ) : Platform.OS === 'ios' ? (
                <TouchableOpacity 
                  style={styles.iosPickerButton}
                  onPress={() => setShowTournamentPicker(true)}
                >
                  <Text style={[styles.iosPickerButtonText, !selectedTournament && styles.iosPickerPlaceholder]}>
                    {selectedTournament 
                      ? tournaments.find(t => t.id === selectedTournament)?.name 
                      : 'Todos los torneos'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#666" />
                </TouchableOpacity>
              ) : (
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={selectedTournament}
                    onValueChange={(value) => setSelectedTournament(value)}
                    style={styles.picker}
                    itemStyle={styles.pickerItem}
                  >
                    <Picker.Item label="Todos los torneos" value={null} />
                    {tournaments.map((tour) => (
                      <Picker.Item key={tour.id} label={tour.name} value={tour.id} />
                    ))}
                  </Picker>
                </View>
              )}
          </>

          <TouchableOpacity
            style={[styles.analyzeButton, (!selectedPlayer1 && !selectedPlayer2 && !selectedTournament) && styles.analyzeButtonDisabled]}
            onPress={loadAnalysis}
            disabled={(!selectedPlayer1 && !selectedPlayer2 && !selectedTournament) || loading}
          >
            <Ionicons name="analytics" size={20} color="#FFF" />
            <Text style={styles.analyzeButtonText}>
              {loading ? t('common.loading') : t('analysis.analyze')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Resultados */}
        {matchCount > 0 && (
          <>
            {/* Estadísticas resumen */}
            <View style={styles.statsCard}>
              <Text style={styles.matchCountText}>
                {matchCount} {t('analysis.matchesAnalyzed')} • {points.length} {t('analysis.totalPoints')}
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
              
              <View style={styles.percentBar}>
                <View style={[styles.percentFill, { 
                  flex: player1Wins || 1, 
                  backgroundColor: '#2196F3',
                  borderTopLeftRadius: 4,
                  borderBottomLeftRadius: 4,
                }]} />
                <View style={[styles.percentFill, { 
                  flex: player2Wins || 1, 
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
                {player1Data?.nickname}
              </Text>
              <Text style={styles.heatmapSubtitle}>Donde gana sus puntos</Text>
              <HeatmapCourt 
                points={getHeatmapData('player1')} 
                color="#2196F3"
              />
            </View>

            <View style={styles.heatmapSection}>
              <Text style={styles.heatmapTitle}>
                {player2Data?.nickname}
              </Text>
              <Text style={styles.heatmapSubtitle}>Donde gana sus puntos</Text>
              <HeatmapCourt 
                points={getHeatmapData('player2')} 
                color="#FF5722"
              />
            </View>

            {/* Reason Statistics */}
            {reasonStats.length > 0 && (
              <View style={styles.reasonStatsCard}>
                <Text style={styles.reasonStatsTitle}>Estadísticas por Motivo</Text>
                <View style={styles.reasonStatsHeader}>
                  <Text style={styles.reasonHeaderLabel}>Motivo</Text>
                  <Text style={[styles.reasonHeaderValue, { color: '#2196F3' }]}>{player1Data?.nickname?.substring(0, 8)}</Text>
                  <Text style={[styles.reasonHeaderValue, { color: '#FF5722' }]}>{player2Data?.nickname?.substring(0, 8)}</Text>
                  <Text style={styles.reasonHeaderValue}>Total</Text>
                </View>
                {reasonStats.map((stat, index) => {
                  const total = stat.p1Count + stat.p2Count;
                  const maxTotal = Math.max(...reasonStats.map(s => s.p1Count + s.p2Count));
                  const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
                  return (
                    <View key={index} style={styles.reasonStatRow}>
                      <Text style={styles.reasonStatName}>{stat.reason}</Text>
                      <Text style={[styles.reasonStatValue, { color: '#2196F3' }]}>{stat.p1Count}</Text>
                      <Text style={[styles.reasonStatValue, { color: '#FF5722' }]}>{stat.p2Count}</Text>
                      <Text style={styles.reasonStatTotal}>{total}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}

        {matchCount === 0 && hasSearched && !loading && (
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

      {/* Modal Picker Jugador 1 (iOS) */}
      <Modal visible={showPlayer1Picker} animationType="slide" transparent onRequestClose={() => setShowPlayer1Picker(false)}>
        <View style={styles.pickerModalOverlay}>
          <View style={styles.pickerModalContent}>
            <View style={styles.pickerModalHeader}>
              <TouchableOpacity onPress={() => setShowPlayer1Picker(false)}>
                <Text style={styles.pickerModalCancel}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <Text style={styles.pickerModalTitle}>{t('newMatch.myPlayer')}</Text>
              <TouchableOpacity onPress={() => setShowPlayer1Picker(false)}>
                <Text style={styles.pickerModalDone}>OK</Text>
              </TouchableOpacity>
            </View>
            <Picker
              selectedValue={selectedPlayer1}
              onValueChange={(value) => setSelectedPlayer1(value)}
              style={styles.iosModalPicker}
              itemStyle={styles.iosModalPickerItem}
            >
              <Picker.Item label={t('newMatch.selectPlayer')} value={null} color="#999" />
              {players.map((player) => (
                <Picker.Item key={player.id} label={player.nickname} value={player.id} color="#333" />
              ))}
            </Picker>
          </View>
        </View>
      </Modal>

      {/* Modal Picker Jugador 2 (iOS) */}
      <Modal visible={showPlayer2Picker} animationType="slide" transparent onRequestClose={() => setShowPlayer2Picker(false)}>
        <View style={styles.pickerModalOverlay}>
          <View style={styles.pickerModalContent}>
            <View style={styles.pickerModalHeader}>
              <TouchableOpacity onPress={() => setShowPlayer2Picker(false)}>
                <Text style={styles.pickerModalCancel}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <Text style={styles.pickerModalTitle}>{t('history.opponent')}</Text>
              <TouchableOpacity onPress={() => setShowPlayer2Picker(false)}>
                <Text style={styles.pickerModalDone}>OK</Text>
              </TouchableOpacity>
            </View>
            <Picker
              selectedValue={selectedPlayer2}
              onValueChange={(value) => setSelectedPlayer2(value)}
              style={styles.iosModalPicker}
              itemStyle={styles.iosModalPickerItem}
            >
              <Picker.Item label={t('newMatch.selectPlayer')} value={null} color="#999" />
              {players.filter(p => p.id !== selectedPlayer1).map((player) => (
                <Picker.Item key={player.id} label={player.nickname} value={player.id} color="#333" />
              ))}
            </Picker>
          </View>
        </View>
      </Modal>

      {/* Modal Picker Torneo (iOS) */}
      <Modal visible={showTournamentPicker} animationType="slide" transparent onRequestClose={() => setShowTournamentPicker(false)}>
        <View style={styles.pickerModalOverlay}>
          <View style={styles.pickerModalContent}>
            <View style={styles.pickerModalHeader}>
              <TouchableOpacity onPress={() => setShowTournamentPicker(false)}>
                <Text style={styles.pickerModalCancel}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <Text style={styles.pickerModalTitle}>Torneo</Text>
              <TouchableOpacity onPress={() => setShowTournamentPicker(false)}>
                <Text style={styles.pickerModalDone}>OK</Text>
              </TouchableOpacity>
            </View>
            <Picker
              selectedValue={selectedTournament}
              onValueChange={(value) => setSelectedTournament(value)}
              style={styles.iosModalPicker}
              itemStyle={styles.iosModalPickerItem}
            >
              <Picker.Item label="Todos los torneos" value={null} color="#999" />
              {tournaments.map((tour) => (
                <Picker.Item key={tour.id} label={tour.name} value={tour.id} color="#333" />
              ))}
            </Picker>
          </View>
        </View>
      </Modal>

      {/* iOS Date Modals */}
      {Platform.OS === 'ios' && showDateFromPicker && (
        <Modal visible={true} animationType="slide" transparent onRequestClose={() => setShowDateFromPicker(false)}>
          <View style={styles.pickerModalOverlay}>
            <View style={styles.pickerModalContent}>
              <View style={styles.pickerModalHeader}>
                <TouchableOpacity onPress={() => setShowDateFromPicker(false)}>
                  <Text style={styles.pickerModalCancel}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <Text style={styles.pickerModalTitle}>{t('common.from')}</Text>
                <TouchableOpacity onPress={() => setShowDateFromPicker(false)}>
                  <Text style={styles.pickerModalDone}>OK</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={dateFrom || new Date()}
                mode="date"
                display="inline"
                onChange={(e, d) => { if (d) setDateFrom(d); }}
                maximumDate={dateTo || new Date()}
                style={{ height: 340 }}
              />
            </View>
          </View>
        </Modal>
      )}

      {Platform.OS === 'ios' && showDateToPicker && (
        <Modal visible={true} animationType="slide" transparent onRequestClose={() => setShowDateToPicker(false)}>
          <View style={styles.pickerModalOverlay}>
            <View style={styles.pickerModalContent}>
              <View style={styles.pickerModalHeader}>
                <TouchableOpacity onPress={() => setShowDateToPicker(false)}>
                  <Text style={styles.pickerModalCancel}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <Text style={styles.pickerModalTitle}>{t('common.to')}</Text>
                <TouchableOpacity onPress={() => setShowDateToPicker(false)}>
                  <Text style={styles.pickerModalDone}>OK</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={dateTo || new Date()}
                mode="date"
                display="inline"
                onChange={(e, d) => { if (d) setDateTo(d); }}
                minimumDate={dateFrom || undefined}
                maximumDate={new Date()}
                style={{ height: 340 }}
              />
            </View>
          </View>
        </Modal>
      )}
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
    marginBottom: 16,
  },
  pickerSection: {
    marginBottom: 8,
  },
  pickerLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
    fontWeight: '500',
  },
  pickerContainer: {
    backgroundColor: '#F5F7FA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  picker: {
    height: 56,
    width: '100%',
  },
  pickerItem: {
    fontSize: 16,
    height: 56,
  },
  vsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  vsLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  vsText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#999',
    marginHorizontal: 12,
  },
  dateFilters: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 8,
  },
  dateButtonText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  clearDateBtn: {
    padding: 2,
  },
  analyzeButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 20,
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
  iosPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F7FA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 14,
  },
  iosPickerButtonText: {
    fontSize: 16,
    color: '#333',
  },
  iosPickerPlaceholder: {
    color: '#999',
  },
  pickerModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  pickerModalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 30,
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  pickerModalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
  },
  pickerModalCancel: {
    fontSize: 17,
    color: '#999',
  },
  pickerModalDone: {
    fontSize: 17,
    color: '#2196F3',
    fontWeight: '600',
  },
  iosModalPicker: {
    height: 200,
  },
  iosModalPickerItem: {
    fontSize: 18,
    color: '#333',
  },
  reasonStatsCard: {
    backgroundColor: '#FFF',
    marginTop: 12,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
  },
  reasonStatsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  reasonStatsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginBottom: 8,
  },
  reasonHeaderLabel: {
    flex: 2,
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  reasonHeaderValue: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  reasonStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  reasonStatName: {
    flex: 2,
    fontSize: 13,
    color: '#333',
  },
  reasonStatValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  reasonStatTotal: {
    flex: 1,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
});
