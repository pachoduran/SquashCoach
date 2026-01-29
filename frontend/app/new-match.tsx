import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  ScrollView,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getDatabase } from '@/src/store/database';
import { useLanguage } from '@/src/context/LanguageContext';
import { format } from 'date-fns';

interface Player {
  id: number;
  nickname: string;
}

export default function NewMatch() {
  const router = useRouter();
  const { t } = useLanguage();
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer1Id, setSelectedPlayer1Id] = useState<number | null>(null);
  const [selectedPlayer2Id, setSelectedPlayer2Id] = useState<number | null>(null);
  const [bestOf, setBestOf] = useState<3 | 5>(3);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newPlayerNickname, setNewPlayerNickname] = useState('');
  
  // Nuevos campos
  const [tournamentName, setTournamentName] = useState('');
  const [matchDate, setMatchDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState<number | null>(null);
  
  // Para iOS - modales de selección
  const [showPlayer1Picker, setShowPlayer1Picker] = useState(false);
  const [showPlayer2Picker, setShowPlayer2Picker] = useState(false);

  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = async () => {
    try {
      const db = await getDatabase();
      
      // Primero verificar qué columnas tiene la tabla
      let hasName = false;
      let hasNickname = false;
      try {
        const tableInfo = await db.getAllAsync("PRAGMA table_info(players)");
        hasName = (tableInfo as any[]).some((col: any) => col.name === 'name');
        hasNickname = (tableInfo as any[]).some((col: any) => col.name === 'nickname');
      } catch (e) {
        // Si falla, asumir tabla nueva
        hasNickname = true;
      }
      
      // Construir consulta según estructura
      let query = 'SELECT id, ';
      if (hasNickname && hasName) {
        query += 'COALESCE(nickname, name) as nickname';
      } else if (hasNickname) {
        query += 'nickname';
      } else if (hasName) {
        query += 'name as nickname';
      } else {
        query += 'nickname'; // fallback
      }
      query += ' FROM players ORDER BY nickname ASC';
      
      const result = await db.getAllAsync(query);
      setPlayers(result as Player[]);
    } catch (error) {
      console.error('Error cargando jugadores:', error);
    }
  };

  const addPlayer = async () => {
    if (!newPlayerNickname.trim()) {
      Alert.alert(t('common.error'), t('newMatch.nicknamePlaceholder'));
      return;
    }

    try {
      const db = await getDatabase();
      const nickname = newPlayerNickname.trim();
      
      // Verificar si ya existe un jugador con ese nombre
      const existingPlayer = players.find(
        p => p.nickname.toLowerCase() === nickname.toLowerCase()
      );
      
      if (existingPlayer) {
        Alert.alert(
          t('common.error'), 
          t('newMatch.playerExists') || 'Ya existe un jugador con ese nombre'
        );
        return;
      }
      
      // Verificar estructura de la tabla para saber qué columnas usar
      let tableInfo: any[] = [];
      try {
        tableInfo = await db.getAllAsync("PRAGMA table_info(players)");
      } catch (e) {
        tableInfo = [];
      }
      
      const hasName = tableInfo.some((col: any) => col.name === 'name');
      const hasNickname = tableInfo.some((col: any) => col.name === 'nickname');
      
      let result;
      if (hasName && hasNickname) {
        // Tabla con ambas columnas (versión intermedia)
        result = await db.runAsync(
          'INSERT INTO players (name, nickname, created_at) VALUES (?, ?, ?)',
          [nickname, nickname, new Date().toISOString()]
        );
      } else if (hasName && !hasNickname) {
        // Tabla antigua solo con name
        result = await db.runAsync(
          'INSERT INTO players (name, created_at) VALUES (?, ?)',
          [nickname, new Date().toISOString()]
        );
      } else {
        // Tabla nueva solo con nickname
        result = await db.runAsync(
          'INSERT INTO players (nickname, created_at) VALUES (?, ?)',
          [nickname, new Date().toISOString()]
        );
      }
      
      const newPlayer: Player = {
        id: result.lastInsertRowId,
        nickname: nickname,
      };

      setPlayers([...players, newPlayer].sort((a, b) => a.nickname.localeCompare(b.nickname)));
      setNewPlayerNickname('');
      setShowAddPlayer(false);
      Alert.alert(t('common.success'), t('newMatch.addPlayer'));
    } catch (error) {
      console.error('Error agregando jugador:', error);
      Alert.alert(t('common.error'), t('home.deleteError'));
    }
  };

  const startMatch = async () => {
    if (!selectedPlayer1Id || !selectedPlayer2Id) {
      Alert.alert('Error', 'Por favor selecciona ambos jugadores');
      return;
    }

    if (selectedPlayer1Id === selectedPlayer2Id) {
      Alert.alert('Error', 'Debes seleccionar jugadores diferentes');
      return;
    }

    try {
      const db = await getDatabase();
      const result = await db.runAsync(
        `INSERT INTO matches 
        (player1_id, player2_id, my_player_id, best_of, date, status, current_game, player1_games, player2_games, tournament_name, match_date) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          selectedPlayer1Id,
          selectedPlayer2Id,
          selectedPlayer1Id,
          bestOf,
          new Date().toISOString(),
          'playing',
          1,
          0,
          0,
          tournamentName.trim() || null,
          matchDate.toISOString().split('T')[0],
        ]
      );

      router.push({
        pathname: '/match-play',
        params: { matchId: result.lastInsertRowId },
      });
    } catch (error) {
      console.error('Error creando partido:', error);
      Alert.alert(t('common.error'), t('newMatch.selectBothPlayers'));
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setMatchDate(selectedDate);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('newMatch.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Información del Torneo */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>{t('newMatch.tournament')}</Text>
          
          <TextInput
            style={styles.textInput}
            placeholder={t('newMatch.tournamentPlaceholder')}
            value={tournamentName}
            onChangeText={setTournamentName}
            placeholderTextColor="#999"
          />
          
          <TouchableOpacity 
            style={styles.dateContainer}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={20} color="#2196F3" />
            <Text style={styles.dateText}>
              {format(matchDate, 'dd/MM/yyyy')}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#666" />
          </TouchableOpacity>
          
          {showDatePicker && (
            <DateTimePicker
              value={matchDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              maximumDate={new Date()}
            />
          )}
        </View>

        {/* Mi Jugador */}
        <View style={styles.selectorContainer}>
          <Text style={styles.selectorTitle}>{t('newMatch.myPlayer')}</Text>
          
          {Platform.OS === 'ios' ? (
            <TouchableOpacity 
              style={styles.pickerButton}
              onPress={() => setShowPlayer1Picker(true)}
            >
              <Text style={[styles.pickerButtonText, !selectedPlayer1Id && styles.pickerButtonPlaceholder]}>
                {selectedPlayer1Id 
                  ? players.find(p => p.id === selectedPlayer1Id)?.nickname 
                  : t('newMatch.selectPlayer')}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
          ) : (
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedPlayer1Id}
                onValueChange={(itemValue) => setSelectedPlayer1Id(itemValue)}
                style={styles.picker}
                dropdownIconColor="#333"
              >
                <Picker.Item label={t('newMatch.selectPlayer')} value={null} />
                {players.map((player) => (
                  <Picker.Item
                    key={player.id}
                    label={player.nickname}
                    value={player.id}
                  />
                ))}
              </Picker>
            </View>
          )}
          
          <TouchableOpacity
            style={styles.addPlayerButtonSmall}
            onPress={() => setShowAddPlayer(true)}
          >
            <Ionicons name="add-circle-outline" size={20} color="#2196F3" />
            <Text style={styles.addPlayerText}>{t('newMatch.addPlayer')}</Text>
          </TouchableOpacity>
        </View>

        {/* Oponente */}
        <View style={styles.selectorContainer}>
          <Text style={styles.selectorTitle}>{t('history.opponent')}</Text>
          
          {Platform.OS === 'ios' ? (
            <TouchableOpacity 
              style={styles.pickerButton}
              onPress={() => setShowPlayer2Picker(true)}
            >
              <Text style={[styles.pickerButtonText, !selectedPlayer2Id && styles.pickerButtonPlaceholder]}>
                {selectedPlayer2Id 
                  ? players.find(p => p.id === selectedPlayer2Id)?.nickname 
                  : t('newMatch.selectPlayer')}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
          ) : (
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedPlayer2Id}
                onValueChange={(itemValue) => setSelectedPlayer2Id(itemValue)}
                style={styles.picker}
                dropdownIconColor="#333"
              >
                <Picker.Item label={t('newMatch.selectPlayer')} value={null} />
                {players.map((player) => (
                  <Picker.Item
                    key={player.id}
                    label={player.nickname}
                    value={player.id}
                  />
                ))}
              </Picker>
            </View>
          )}
        </View>

        <View style={styles.bestOfContainer}>
          <Text style={styles.selectorTitle}>{t('newMatch.bestOf')}</Text>
          <View style={styles.bestOfButtons}>
            <TouchableOpacity
              style={[
                styles.bestOfButton,
                bestOf === 3 && styles.bestOfButtonSelected,
              ]}
              onPress={() => setBestOf(3)}
            >
              <Text
                style={[
                  styles.bestOfButtonText,
                  bestOf === 3 && styles.bestOfButtonTextSelected,
                ]}
              >
                {t('newMatch.bestOf')} 3
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.bestOfButton,
                bestOf === 5 && styles.bestOfButtonSelected,
              ]}
              onPress={() => setBestOf(5)}
            >
              <Text
                style={[
                  styles.bestOfButtonText,
                  bestOf === 5 && styles.bestOfButtonTextSelected,
                ]}
              >
                {t('newMatch.bestOf')} 5
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.startButton,
            (!selectedPlayer1Id || !selectedPlayer2Id) && styles.startButtonDisabled,
          ]}
          onPress={startMatch}
          disabled={!selectedPlayer1Id || !selectedPlayer2Id}
        >
          <Text style={styles.startButtonText}>{t('newMatch.startMatch')}</Text>
        </TouchableOpacity>
      </View>

      {/* Modal para agregar jugador */}
      <Modal
        visible={showAddPlayer}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddPlayer(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('newMatch.newPlayer')}</Text>
            
            <TextInput
              style={styles.input}
              placeholder={t('newMatch.nicknamePlaceholder')}
              value={newPlayerNickname}
              onChangeText={setNewPlayerNickname}
              placeholderTextColor="#999"
              autoCapitalize="words"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setShowAddPlayer(false);
                  setNewPlayerNickname('');
                }}
              >
                <Text style={styles.modalButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={addPlayer}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                  {t('newMatch.add')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para seleccionar Jugador 1 (iOS) */}
      <Modal
        visible={showPlayer1Picker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPlayer1Picker(false)}
      >
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
              selectedValue={selectedPlayer1Id}
              onValueChange={(itemValue) => setSelectedPlayer1Id(itemValue)}
              style={styles.iosPicker}
            >
              <Picker.Item label={t('newMatch.selectPlayer')} value={null} />
              {players.map((player) => (
                <Picker.Item
                  key={player.id}
                  label={player.nickname}
                  value={player.id}
                />
              ))}
            </Picker>
          </View>
        </View>
      </Modal>

      {/* Modal para seleccionar Jugador 2 (iOS) */}
      <Modal
        visible={showPlayer2Picker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPlayer2Picker(false)}
      >
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
              selectedValue={selectedPlayer2Id}
              onValueChange={(itemValue) => setSelectedPlayer2Id(itemValue)}
              style={styles.iosPicker}
            >
              <Picker.Item label={t('newMatch.selectPlayer')} value={null} />
              {players.map((player) => (
                <Picker.Item
                  key={player.id}
                  label={player.nickname}
                  value={player.id}
                />
              ))}
            </Picker>
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
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionContainer: {
    marginBottom: 24,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  textInput: {
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    padding: 14,
  },
  dateText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 10,
  },
  selectorContainer: {
    marginBottom: 24,
  },
  selectorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  pickerContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  picker: {
    height: 50,
    color: '#333',
  },
  // Estilos para iOS Picker Button
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#333',
  },
  pickerButtonPlaceholder: {
    color: '#999',
  },
  // Modal de Picker para iOS
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
  iosPicker: {
    height: 200,
  },
  addPlayerButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 8,
  },
  addPlayerText: {
    fontSize: 14,
    color: '#2196F3',
    marginLeft: 6,
    fontWeight: '500',
  },
  bestOfContainer: {
    marginBottom: 24,
  },
  bestOfButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  bestOfButton: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  bestOfButtonSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  bestOfButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  bestOfButtonTextSelected: {
    color: '#2196F3',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  startButton: {
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  startButtonDisabled: {
    backgroundColor: '#B0BEC5',
    shadowOpacity: 0,
    elevation: 0,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
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
