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
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getDatabase } from '@/src/store/database';

interface Player {
  id: number;
  name: string;
  nickname?: string;
}

export default function NewMatch() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer1Id, setSelectedPlayer1Id] = useState<number | null>(null);
  const [selectedPlayer2Id, setSelectedPlayer2Id] = useState<number | null>(null);
  const [bestOf, setBestOf] = useState<3 | 5>(3);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerNickname, setNewPlayerNickname] = useState('');

  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = async () => {
    try {
      const db = await getDatabase();
      const result = await db.getAllAsync(
        'SELECT * FROM players ORDER BY name ASC'
      );
      setPlayers(result as Player[]);
    } catch (error) {
      console.error('Error cargando jugadores:', error);
    }
  };

  const addPlayer = async () => {
    if (!newPlayerName.trim()) {
      Alert.alert('Error', 'Por favor ingresa un nombre');
      return;
    }

    try {
      const db = await getDatabase();
      const result = await db.runAsync(
        'INSERT INTO players (name, nickname, created_at) VALUES (?, ?, ?)',
        [newPlayerName.trim(), newPlayerNickname.trim() || null, new Date().toISOString()]
      );
      
      const newPlayer: Player = {
        id: result.lastInsertRowId,
        name: newPlayerName.trim(),
        nickname: newPlayerNickname.trim() || undefined,
      };

      setPlayers([...players, newPlayer]);
      setNewPlayerName('');
      setNewPlayerNickname('');
      setShowAddPlayer(false);
      Alert.alert('Éxito', 'Jugador agregado correctamente');
    } catch (error) {
      console.error('Error agregando jugador:', error);
      Alert.alert('Error', 'No se pudo agregar el jugador');
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
        (player1_id, player2_id, my_player_id, best_of, date, status, current_game, player1_games, player2_games) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          selectedPlayer1Id,  // Mi jugador
          selectedPlayer2Id,  // Oponente
          selectedPlayer1Id,  // my_player_id siempre es player1
          bestOf,
          new Date().toISOString(),
          'playing',
          1,
          0,
          0,
        ]
      );

      router.push({
        pathname: '/match-play',
        params: { matchId: result.lastInsertRowId },
      });
    } catch (error) {
      console.error('Error creando partido:', error);
      Alert.alert('Error', 'No se pudo crear el partido');
    }
  };

  const PlayerSelector = ({
    title,
    selectedPlayer,
    onSelect,
  }: {
    title: string;
    selectedPlayer: Player | null;
    onSelect: (player: Player) => void;
  }) => (
    <View style={styles.selectorContainer}>
      <Text style={styles.selectorTitle}>{title}</Text>
      {selectedPlayer ? (
        <View style={styles.selectedPlayer}>
          <Text style={styles.selectedPlayerName}>{selectedPlayer.name}</Text>
          {selectedPlayer.nickname && (
            <Text style={styles.selectedPlayerNick}>({selectedPlayer.nickname})</Text>
          )}
          <TouchableOpacity
            style={styles.changeButton}
            onPress={() => onSelect(null as any)}
          >
            <Text style={styles.changeButtonText}>Cambiar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {players.map((player) => (
            <TouchableOpacity
              key={player.id}
              style={styles.playerButton}
              onPress={() => onSelect(player)}
            >
              <Text style={styles.playerButtonText}>{player.name}</Text>
              {player.nickname && (
                <Text style={styles.playerButtonNick}>({player.nickname})</Text>
              )}
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.addPlayerButton}
            onPress={() => setShowAddPlayer(true)}
          >
            <Ionicons name="add-circle-outline" size={24} color="#2196F3" />
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nuevo Partido</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Mi Jugador */}
        <View style={styles.selectorContainer}>
          <Text style={styles.selectorTitle}>Mi Jugador</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedPlayer1Id}
              onValueChange={(itemValue) => setSelectedPlayer1Id(itemValue)}
              style={styles.picker}
            >
              <Picker.Item label="Selecciona tu jugador" value={null} />
              {players.map((player) => (
                <Picker.Item
                  key={player.id}
                  label={player.nickname ? `${player.name} (${player.nickname})` : player.name}
                  value={player.id}
                />
              ))}
            </Picker>
          </View>
          <TouchableOpacity
            style={styles.addPlayerButtonSmall}
            onPress={() => setShowAddPlayer(true)}
          >
            <Ionicons name="add-circle-outline" size={20} color="#2196F3" />
            <Text style={styles.addPlayerText}>Agregar nuevo jugador</Text>
          </TouchableOpacity>
        </View>

        {/* Oponente */}
        <View style={styles.selectorContainer}>
          <Text style={styles.selectorTitle}>Oponente</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedPlayer2Id}
              onValueChange={(itemValue) => setSelectedPlayer2Id(itemValue)}
              style={styles.picker}
            >
              <Picker.Item label="Selecciona oponente" value={null} />
              {players.map((player) => (
                <Picker.Item
                  key={player.id}
                  label={player.nickname ? `${player.name} (${player.nickname})` : player.name}
                  value={player.id}
                />
              ))}
            </Picker>
          </View>
        </View>

        <View style={styles.bestOfContainer}>
          <Text style={styles.selectorTitle}>Formato del Partido</Text>
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
                Mejor de 3
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
                Mejor de 5
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
          <Text style={styles.startButtonText}>Comenzar Partido</Text>
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
            <Text style={styles.modalTitle}>Nuevo Jugador</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Nombre *"
              value={newPlayerName}
              onChangeText={setNewPlayerName}
              placeholderTextColor="#999"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Nickname (opcional)"
              value={newPlayerNickname}
              onChangeText={setNewPlayerNickname}
              placeholderTextColor="#999"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowAddPlayer(false)}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={addPlayer}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                  Agregar
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
  selectorContainer: {
    marginBottom: 24,
  },
  selectorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  selectedPlayer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedPlayerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  selectedPlayerNick: {
    fontSize: 14,
    color: '#666',
    marginRight: 12,
  },
  changeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
  },
  changeButtonText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },
  playerButton: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  playerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  playerButtonNick: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  addPlayerButton: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  myPlayerContainer: {
    marginBottom: 24,
  },
  pickerContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
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
    marginBottom: 12,
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
});