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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getDatabase } from '@/src/store/database';
import { useLanguage } from '@/src/context/LanguageContext';
import { HeatmapCourt } from '@/src/components/HeatmapCourt';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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
  const { t } = useLanguage();
  
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

  // Para iOS - modales de selección
  const [showPlayer1Picker, setShowPlayer1Picker] = useState(false);
  const [showPlayer2Picker, setShowPlayer2Picker] = useState(false);

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
    setHasSearched(true);
    try {
      const db = await getDatabase();
      
      let matchQuery = `
        SELECT id, player1_id, player2_id FROM matches 
        WHERE status = 'finished'
        AND ((player1_id = ? AND player2_id = ?) OR (player1_id = ? AND player2_id = ?))
      `;
      let params: any[] = [selectedPlayer1, selectedPlayer2, selectedPlayer2, selectedPlayer1];
      
      if (dateFrom) {
        matchQuery += ` AND date >= ?`;
        params.push(format(dateFrom, 'yyyy-MM-dd') + 'T00:00:00');
      }
      if (dateTo) {
        matchQuery += ` AND date <= ?`;
        params.push(format(dateTo, 'yyyy-MM-dd') + 'T23:59:59');
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
        `SELECT p.position_x, p.position_y, p.winner_player_id, m.player1_id
         FROM points p
         JOIN matches m ON p.match_id = m.id
         WHERE p.match_id IN (${placeholders})`,
        matchIds
      ) as PointData[];
      
      setPoints(pointsData);
      
      let p1Wins = 0;
      let p2Wins = 0;
      
      pointsData.forEach(point => {
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
                    ? players.find(p => p.id === selectedPlayer1)?.nickname 
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
                    <Picker.Item key={player.id} label={player.nickname} value={player.id} />
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
                    ? players.find(p => p.id === selectedPlayer2)?.nickname 
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
                    <Picker.Item key={player.id} label={player.nickname} value={player.id} />
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
          
          <TouchableOpacity
            style={[styles.analyzeButton, (!selectedPlayer1 || !selectedPlayer2) && styles.analyzeButtonDisabled]}
            onPress={loadAnalysis}
            disabled={!selectedPlayer1 || !selectedPlayer2 || loading}
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

            <View style={[styles.heatmapSection, { marginBottom: 20 }]}>
              <Text style={styles.heatmapTitle}>Todos los puntos</Text>
              <Text style={styles.heatmapSubtitle}>Distribución general</Text>
              <HeatmapCourt 
                points={getHeatmapData('all')} 
                color="#9C27B0"
              />
            </View>
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

      {/* iOS Date Modals */}
      {Platform.OS === 'ios' && (
        <Modal visible={showDateFromPicker} animationType="slide" transparent onRequestClose={() => setShowDateFromPicker(false)}>
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
                display="spinner"
                onChange={handleDateFromChange}
                maximumDate={dateTo || new Date()}
                style={{ height: 200 }}
              />
            </View>
          </View>
        </Modal>
      )}

      {Platform.OS === 'ios' && (
        <Modal visible={showDateToPicker} animationType="slide" transparent onRequestClose={() => setShowDateToPicker(false)}>
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
                display="spinner"
                onChange={handleDateToChange}
                minimumDate={dateFrom || undefined}
                maximumDate={new Date()}
                style={{ height: 200 }}
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
});
