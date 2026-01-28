import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getDatabase } from '@/src/store/database';
import { format } from 'date-fns';
import { Platform } from 'react-native';

interface Match {
  id: number;
  player1_nickname: string;
  player2_nickname: string;
  date: string;
  status: string;
  winner_nickname?: string;
  player1_games: number;
  player2_games: number;
  tournament_name?: string;
}

interface Player {
  id: number;
  nickname: string;
}

interface Tournament {
  name: string;
}

export default function HistoryScreen() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  
  // Filtros
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [selectedTournament, setSelectedTournament] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [showDateFromPicker, setShowDateFromPicker] = useState(false);
  const [showDateToPicker, setShowDateToPicker] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMatches();
    }, [selectedPlayer, selectedTournament, dateFrom, dateTo])
  );

  const loadInitialData = async () => {
    try {
      const db = await getDatabase();
      
      // Cargar jugadores
      const playersData = await db.getAllAsync(
        'SELECT id, nickname FROM players ORDER BY nickname ASC'
      );
      setPlayers(playersData as Player[]);
      
      // Cargar torneos únicos
      const tournamentsData = await db.getAllAsync(
        "SELECT DISTINCT tournament_name as name FROM matches WHERE tournament_name IS NOT NULL AND tournament_name != '' ORDER BY tournament_name ASC"
      );
      setTournaments(tournamentsData as Tournament[]);
      
      await loadMatches();
    } catch (error) {
      console.error('Error cargando datos:', error);
    }
  };

  const loadMatches = async () => {
    setLoading(true);
    try {
      const db = await getDatabase();
      
      let query = `
        SELECT 
          m.id,
          m.date,
          m.status,
          m.player1_games,
          m.player2_games,
          m.tournament_name,
          p1.nickname as player1_nickname,
          p2.nickname as player2_nickname,
          pw.nickname as winner_nickname
        FROM matches m
        JOIN players p1 ON m.player1_id = p1.id
        JOIN players p2 ON m.player2_id = p2.id
        LEFT JOIN players pw ON m.winner_id = pw.id
        WHERE m.status = 'finished'
      `;
      
      const params: any[] = [];
      
      // Filtro por jugador
      if (selectedPlayer) {
        query += ` AND (m.player1_id = ? OR m.player2_id = ?)`;
        params.push(selectedPlayer, selectedPlayer);
      }
      
      // Filtro por torneo
      if (selectedTournament) {
        query += ` AND m.tournament_name = ?`;
        params.push(selectedTournament);
      }
      
      // Filtro por fecha desde
      if (dateFrom) {
        query += ` AND m.date >= ?`;
        params.push(format(dateFrom, 'yyyy-MM-dd') + 'T00:00:00');
      }
      
      // Filtro por fecha hasta
      if (dateTo) {
        query += ` AND m.date <= ?`;
        params.push(format(dateTo, 'yyyy-MM-dd') + 'T23:59:59');
      }
      
      query += ` ORDER BY m.date DESC`;
      
      const result = await db.getAllAsync(query, params);
      setMatches(result as Match[]);
    } catch (error) {
      console.error('Error cargando partidos:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSelectedPlayer(null);
    setSelectedTournament(null);
    setDateFrom(null);
    setDateTo(null);
  };

  const hasActiveFilters = selectedPlayer || selectedTournament || dateFrom || dateTo;

  const handleDateFromChange = (event: any, selectedDate?: Date) => {
    setShowDateFromPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDateFrom(selectedDate);
    }
  };

  const handleDateToChange = (event: any, selectedDate?: Date) => {
    setShowDateToPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDateTo(selectedDate);
    }
  };

  const renderMatch = ({ item }: { item: Match }) => (
    <TouchableOpacity
      style={styles.matchCard}
      onPress={() => router.push({
        pathname: '/match-summary',
        params: { matchId: item.id },
      })}
    >
      <View style={styles.matchHeader}>
        <Text style={styles.matchPlayers}>
          {item.player1_nickname} vs {item.player2_nickname}
        </Text>
        <Text style={styles.matchScore}>
          {item.player1_games} - {item.player2_games}
        </Text>
      </View>
      
      <View style={styles.matchDetails}>
        <Text style={styles.matchDate}>
          {format(new Date(item.date), "dd/MM/yyyy")}
        </Text>
        {item.tournament_name && (
          <View style={styles.tournamentBadge}>
            <Ionicons name="trophy-outline" size={12} color="#FF9800" />
            <Text style={styles.tournamentText}>{item.tournament_name}</Text>
          </View>
        )}
      </View>
      
      {item.winner_nickname && (
        <Text style={styles.winnerText}>
          <Ionicons name="checkmark-circle" size={14} color="#4CAF50" /> {item.winner_nickname}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Partidos Finalizados</Text>
        <TouchableOpacity 
          onPress={() => setShowFilters(!showFilters)} 
          style={[styles.filterToggle, hasActiveFilters && styles.filterToggleActive]}
        >
          <Ionicons name="filter" size={22} color="#FFF" />
          {hasActiveFilters && <View style={styles.filterDot} />}
        </TouchableOpacity>
      </View>

      {/* Panel de Filtros */}
      {showFilters && (
        <View style={styles.filtersPanel}>
          <View style={styles.filterRow}>
            <View style={styles.filterItem}>
              <Text style={styles.filterLabel}>Jugador</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedPlayer}
                  onValueChange={(value) => setSelectedPlayer(value)}
                  style={styles.picker}
                >
                  <Picker.Item label="Todos" value={null} />
                  {players.map((player) => (
                    <Picker.Item key={player.id} label={player.nickname} value={player.id} />
                  ))}
                </Picker>
              </View>
            </View>
            
            <View style={styles.filterItem}>
              <Text style={styles.filterLabel}>Torneo</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedTournament}
                  onValueChange={(value) => setSelectedTournament(value)}
                  style={styles.picker}
                >
                  <Picker.Item label="Todos" value={null} />
                  {tournaments.map((t, index) => (
                    <Picker.Item key={index} label={t.name} value={t.name} />
                  ))}
                </Picker>
              </View>
            </View>
          </View>
          
          <View style={styles.filterRow}>
            <TouchableOpacity 
              style={styles.dateButton}
              onPress={() => setShowDateFromPicker(true)}
            >
              <Ionicons name="calendar-outline" size={18} color="#2196F3" />
              <Text style={styles.dateButtonText}>
                {dateFrom ? format(dateFrom, 'dd/MM/yy') : 'Desde'}
              </Text>
              {dateFrom && (
                <TouchableOpacity onPress={() => setDateFrom(null)}>
                  <Ionicons name="close-circle" size={16} color="#999" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.dateButton}
              onPress={() => setShowDateToPicker(true)}
            >
              <Ionicons name="calendar-outline" size={18} color="#2196F3" />
              <Text style={styles.dateButtonText}>
                {dateTo ? format(dateTo, 'dd/MM/yy') : 'Hasta'}
              </Text>
              {dateTo && (
                <TouchableOpacity onPress={() => setDateTo(null)}>
                  <Ionicons name="close-circle" size={16} color="#999" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            
            {hasActiveFilters && (
              <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
                <Ionicons name="trash-outline" size={18} color="#F44336" />
              </TouchableOpacity>
            )}
          </View>
          
          <TouchableOpacity style={styles.applyButton} onPress={loadMatches}>
            <Text style={styles.applyButtonText}>Aplicar Filtros</Text>
          </TouchableOpacity>
          
          {showDateFromPicker && (
            <DateTimePicker
              value={dateFrom || new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateFromChange}
              maximumDate={dateTo || new Date()}
            />
          )}
          
          {showDateToPicker && (
            <DateTimePicker
              value={dateTo || new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateToChange}
              minimumDate={dateFrom || undefined}
              maximumDate={new Date()}
            />
          )}
        </View>
      )}

      {/* Resultados */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      ) : matches.length > 0 ? (
        <FlatList
          data={matches}
          renderItem={renderMatch}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={64} color="#CCC" />
          <Text style={styles.emptyText}>No se encontraron partidos</Text>
          {hasActiveFilters && (
            <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
              <Text style={styles.clearFiltersText}>Limpiar filtros</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Contador de resultados */}
      {!loading && matches.length > 0 && (
        <View style={styles.resultsCount}>
          <Text style={styles.resultsCountText}>
            {matches.length} partido{matches.length !== 1 ? 's' : ''} encontrado{matches.length !== 1 ? 's' : ''}
          </Text>
        </View>
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
  filterToggle: {
    padding: 4,
    position: 'relative',
  },
  filterToggleActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
  },
  filterDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF9800',
  },
  filtersPanel: {
    backgroundColor: '#FFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  filterItem: {
    flex: 1,
  },
  filterLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  pickerContainer: {
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  picker: {
    height: 44,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 6,
  },
  dateButtonText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  clearButton: {
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 60,
  },
  matchCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  matchPlayers: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  matchScore: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  matchDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  matchDate: {
    fontSize: 13,
    color: '#666',
  },
  tournamentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 4,
  },
  tournamentText: {
    fontSize: 11,
    color: '#FF9800',
    fontWeight: '500',
  },
  winnerText: {
    fontSize: 13,
    color: '#4CAF50',
    marginTop: 8,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  clearFiltersButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#E3F2FD',
    borderRadius: 20,
  },
  clearFiltersText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '600',
  },
  resultsCount: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: '#1E3A5F',
    borderRadius: 20,
    paddingVertical: 8,
    alignItems: 'center',
  },
  resultsCountText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '500',
  },
});
