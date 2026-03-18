import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Alert,
  Platform,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getDatabase } from '@/src/store/database';
import { useLanguage } from '@/src/context/LanguageContext';
import { useAuth } from '@/src/context/AuthContext';
import { syncService } from '@/src/store/syncService';
import { format } from 'date-fns';
import { adService } from '@/src/services/adService';
import { PLAYER_CATEGORIES, GENDER_OPTIONS, COUNTRIES } from '@/src/utils/playerConstants';

interface Player {
  id: number;
  nickname: string;
  category?: string;
  gender?: string;
  country?: string;
  city?: string;
  club?: string;
  is_mine: number;
}

interface Tournament {
  id: number;
  name: string;
}

export default function NewMatch() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user, isAuthenticated } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer1Id, setSelectedPlayer1Id] = useState<number | null>(null);
  const [selectedPlayer2Id, setSelectedPlayer2Id] = useState<number | null>(null);
  const [bestOf, setBestOf] = useState<3 | 5>(3);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newPlayerNickname, setNewPlayerNickname] = useState('');
  
  // New player fields
  const [newPlayerCategory, setNewPlayerCategory] = useState('');
  const [newPlayerGender, setNewPlayerGender] = useState('');
  const [newPlayerCountry, setNewPlayerCountry] = useState('');
  const [newPlayerCity, setNewPlayerCity] = useState('');
  const [newPlayerClub, setNewPlayerClub] = useState('');
  const [newPlayerIsMine, setNewPlayerIsMine] = useState(true);
  
  // Pickers for new player fields (iOS)
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  
  // Tournament fields
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | null>(null);
  const [showAddTournament, setShowAddTournament] = useState(false);
  const [newTournamentName, setNewTournamentName] = useState('');
  const [showTournamentPicker, setShowTournamentPicker] = useState(false);
  
  // Date and match fields
  const [matchDate, setMatchDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  
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

  const addTournament = async () => {
    if (!newTournamentName.trim()) {
      Alert.alert('Error', 'Ingresa el nombre del torneo');
      return;
    }
    try {
      const db = await getDatabase();
      const userId = user?.user_id || null;
      const result = await db.runAsync(
        'INSERT INTO tournaments (name, user_id, created_at) VALUES (?, ?, ?)',
        [newTournamentName.trim(), userId, new Date().toISOString()]
      );
      const newTournament: Tournament = { id: result.lastInsertRowId, name: newTournamentName.trim() };
      setTournaments([...tournaments, newTournament].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedTournamentId(result.lastInsertRowId);
      setNewTournamentName('');
      setShowAddTournament(false);
      
      // Auto-sync tournament to cloud
      try {
        await syncService.syncTournaments();
        console.log('[Tournament] Synced to cloud');
      } catch (e) {
        console.log('[Tournament] Sync failed, will retry later');
      }
    } catch (error) {
      console.error('Error agregando torneo:', error);
      Alert.alert('Error', 'No se pudo crear el torneo');
    }
  };

  const loadPlayers = async () => {
    try {
      const db = await getDatabase();
      const userId = user?.user_id || '';
      
      // Load players with new fields, sort: mine first, then alphabetically
      const result = await db.getAllAsync(
        `SELECT id, nickname, category, gender, country, city, club, COALESCE(is_mine, 0) as is_mine 
         FROM players WHERE user_id = ? OR user_id IS NULL 
         ORDER BY is_mine DESC, nickname ASC`,
        [userId]
      );
      setPlayers(result as Player[]);
    } catch (error) {
      console.error('Error cargando jugadores:', error);
    }
  };

  const resetPlayerForm = () => {
    setNewPlayerNickname('');
    setNewPlayerCategory('');
    setNewPlayerGender('');
    setNewPlayerCountry('');
    setNewPlayerCity('');
    setNewPlayerClub('');
    setNewPlayerIsMine(true);
    setShowAddPlayer(false);
  };

  const addPlayer = async () => {
    if (!newPlayerNickname.trim()) {
      Alert.alert(t('common.error'), t('newMatch.nicknamePlaceholder'));
      return;
    }

    try {
      const db = await getDatabase();
      const nickname = newPlayerNickname.trim();
      
      const existingPlayer = players.find(
        p => p.nickname.toLowerCase() === nickname.toLowerCase()
      );
      
      if (existingPlayer) {
        Alert.alert(t('common.error'), t('newMatch.playerExists') || 'Ya existe un jugador con ese nombre');
        return;
      }
      
      const userId = user?.user_id || null;
      const result = await db.runAsync(
        `INSERT INTO players (nickname, created_at, user_id, category, gender, country, city, club, is_mine) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          nickname,
          new Date().toISOString(),
          userId,
          newPlayerCategory || null,
          newPlayerGender || null,
          newPlayerCountry || null,
          newPlayerCity.trim() || null,
          newPlayerClub.trim() || null,
          newPlayerIsMine ? 1 : 0,
        ]
      );
      
      const newPlayer: Player = {
        id: result.lastInsertRowId,
        nickname: nickname,
        category: newPlayerCategory || undefined,
        gender: newPlayerGender || undefined,
        country: newPlayerCountry || undefined,
        city: newPlayerCity.trim() || undefined,
        club: newPlayerClub.trim() || undefined,
        is_mine: newPlayerIsMine ? 1 : 0,
      };

      // Sort: mine first, then alphabetically
      const updated = [...players, newPlayer].sort((a, b) => {
        if (a.is_mine !== b.is_mine) return b.is_mine - a.is_mine;
        return a.nickname.localeCompare(b.nickname);
      });
      setPlayers(updated);
      resetPlayerForm();
      
      // Auto-sync player to cloud immediately
      if (isAuthenticated) {
        try {
          await syncService.syncPlayers();
          console.log('[Sync] Player sync completed for:', nickname);
        } catch (syncErr) {
          console.error('[Sync] Error uploading player:', syncErr);
        }
      }
      
      Alert.alert(t('common.success'), t('newMatch.addPlayer'));
    } catch (error: any) {
      console.error('Error agregando jugador:', error);
      const errorMsg = error?.message || error?.toString() || 'Error desconocido';
      Alert.alert(t('common.error'), `${t('newMatch.addPlayerError')}: ${errorMsg}`);
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
      // Mostrar anuncio antes de iniciar el partido
      await adService.showInterstitialAd();
      
      const db = await getDatabase();
      const userId = user?.user_id || null;
      const tournamentName = selectedTournamentId 
        ? tournaments.find(t => t.id === selectedTournamentId)?.name || null 
        : null;
      
      const result = await db.runAsync(
        `INSERT INTO matches 
        (player1_id, player2_id, my_player_id, best_of, date, status, current_game, player1_games, player2_games, tournament_name, match_date, user_id, tournament_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          tournamentName,
          matchDate.toISOString().split('T')[0],
          userId,
          selectedTournamentId,
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

  // Helper to get player label with "mine" indicator
  const getPlayerLabel = (player: Player) => {
    const mine = player.is_mine ? ' (Mio)' : '';
    const cat = player.category ? ` - ${player.category}` : '';
    return `${player.nickname}${mine}${cat}`;
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
          
          {Platform.OS === 'ios' ? (
            <TouchableOpacity 
              style={styles.pickerButton}
              onPress={() => setShowTournamentPicker(true)}
            >
              <Text style={[styles.pickerButtonText, !selectedTournamentId && styles.pickerButtonPlaceholder]}>
                {selectedTournamentId 
                  ? tournaments.find(t => t.id === selectedTournamentId)?.name 
                  : 'Seleccionar torneo (opcional)'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
          ) : (
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedTournamentId}
                onValueChange={(itemValue) => setSelectedTournamentId(itemValue)}
                style={styles.picker}
                dropdownIconColor="#333"
              >
                <Picker.Item label="Seleccionar torneo (opcional)" value={null} />
                {tournaments.map((tour) => (
                  <Picker.Item key={tour.id} label={tour.name} value={tour.id} />
                ))}
              </Picker>
            </View>
          )}

          <TouchableOpacity
            style={styles.addPlayerButtonSmall}
            onPress={() => setShowAddTournament(true)}
          >
            <Ionicons name="add-circle-outline" size={20} color="#2196F3" />
            <Text style={styles.addPlayerText}>Nuevo torneo</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.dateContainer, { marginTop: 12 }]}
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
                  ? getPlayerLabel(players.find(p => p.id === selectedPlayer1Id)!)
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
                    label={getPlayerLabel(player)}
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
                  ? getPlayerLabel(players.find(p => p.id === selectedPlayer2Id)!)
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
                    label={getPlayerLabel(player)}
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
        onRequestClose={resetPlayerForm}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <Text style={styles.modalTitle}>{t('newMatch.newPlayer')}</Text>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Nickname (obligatorio) */}
              <TextInput
                style={styles.input}
                placeholder={t('newMatch.nicknamePlaceholder')}
                value={newPlayerNickname}
                onChangeText={setNewPlayerNickname}
                placeholderTextColor="#999"
                autoCapitalize="words"
              />
              
              {/* Es mi jugador? (obligatorio) */}
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Mi jugador</Text>
                <Switch
                  value={newPlayerIsMine}
                  onValueChange={setNewPlayerIsMine}
                  trackColor={{ false: '#ccc', true: '#81b0ff' }}
                  thumbColor={newPlayerIsMine ? '#2196F3' : '#f4f3f4'}
                />
                <Text style={[styles.switchValueText, { color: newPlayerIsMine ? '#2196F3' : '#999' }]}>
                  {newPlayerIsMine ? 'Mio' : 'Contrincante'}
                </Text>
              </View>

              {/* Categoria (opcional) */}
              <Text style={styles.fieldLabel}>Categoria (opcional)</Text>
              {Platform.OS === 'ios' ? (
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setShowCategoryPicker(true)}
                >
                  <Text style={[styles.pickerButtonText, !newPlayerCategory && styles.pickerButtonPlaceholder]}>
                    {newPlayerCategory || 'Sin categoria'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#666" />
                </TouchableOpacity>
              ) : (
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={newPlayerCategory}
                    onValueChange={setNewPlayerCategory}
                    style={styles.picker}
                  >
                    <Picker.Item label="Sin categoria" value="" />
                    {PLAYER_CATEGORIES.map((cat) => (
                      <Picker.Item key={cat} label={cat} value={cat} />
                    ))}
                  </Picker>
                </View>
              )}

              {/* Genero (opcional) */}
              <Text style={styles.fieldLabel}>Genero (opcional)</Text>
              {Platform.OS === 'ios' ? (
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setShowGenderPicker(true)}
                >
                  <Text style={[styles.pickerButtonText, !newPlayerGender && styles.pickerButtonPlaceholder]}>
                    {newPlayerGender ? GENDER_OPTIONS.find(g => g.value === newPlayerGender)?.label : 'Sin especificar'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#666" />
                </TouchableOpacity>
              ) : (
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={newPlayerGender}
                    onValueChange={setNewPlayerGender}
                    style={styles.picker}
                  >
                    <Picker.Item label="Sin especificar" value="" />
                    {GENDER_OPTIONS.map((g) => (
                      <Picker.Item key={g.value} label={g.label} value={g.value} />
                    ))}
                  </Picker>
                </View>
              )}

              {/* Pais (opcional) */}
              <Text style={styles.fieldLabel}>Pais (opcional)</Text>
              {Platform.OS === 'ios' ? (
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setShowCountryPicker(true)}
                >
                  <Text style={[styles.pickerButtonText, !newPlayerCountry && styles.pickerButtonPlaceholder]}>
                    {newPlayerCountry || 'Seleccionar pais'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#666" />
                </TouchableOpacity>
              ) : (
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={newPlayerCountry}
                    onValueChange={setNewPlayerCountry}
                    style={styles.picker}
                  >
                    <Picker.Item label="Seleccionar pais" value="" />
                    {COUNTRIES.map((c) => (
                      <Picker.Item key={c} label={c} value={c} />
                    ))}
                  </Picker>
                </View>
              )}

              {/* Ciudad (opcional) */}
              <TextInput
                style={styles.input}
                placeholder="Ciudad (opcional)"
                value={newPlayerCity}
                onChangeText={setNewPlayerCity}
                placeholderTextColor="#999"
                autoCapitalize="words"
              />

              {/* Club (opcional) */}
              <TextInput
                style={styles.input}
                placeholder="Club / Agrupacion (opcional)"
                value={newPlayerClub}
                onChangeText={setNewPlayerClub}
                placeholderTextColor="#999"
                autoCapitalize="words"
              />
            </ScrollView>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={resetPlayerForm}
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

      {/* Modal para agregar torneo */}
      <Modal
        visible={showAddTournament}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddTournament(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nuevo Torneo</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre del torneo"
              value={newTournamentName}
              onChangeText={setNewTournamentName}
              placeholderTextColor="#999"
              autoCapitalize="words"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => { setShowAddTournament(false); setNewTournamentName(''); }}
              >
                <Text style={styles.modalButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={addTournament}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>Crear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* iOS Picker Modals - presentationStyle for iPad compatibility */}
      <Modal visible={showCategoryPicker} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={() => setShowCategoryPicker(false)}>
        <View style={styles.pickerModalOverlay}>
          <View style={styles.pickerModalContent}>
            <View style={styles.pickerModalHeader}>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                <Text style={styles.pickerModalCancel}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <Text style={styles.pickerModalTitle}>Categoria</Text>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                <Text style={styles.pickerModalDone}>OK</Text>
              </TouchableOpacity>
            </View>
            <Picker selectedValue={newPlayerCategory} onValueChange={setNewPlayerCategory} style={styles.iosPicker} itemStyle={{ fontSize: 18, color: '#333' }}>
              <Picker.Item label="Sin categoria" value="" />
              {PLAYER_CATEGORIES.map((cat) => (<Picker.Item key={cat} label={cat} value={cat} />))}
            </Picker>
          </View>
        </View>
      </Modal>

      <Modal visible={showGenderPicker} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={() => setShowGenderPicker(false)}>
        <View style={styles.pickerModalOverlay}>
          <View style={styles.pickerModalContent}>
            <View style={styles.pickerModalHeader}>
              <TouchableOpacity onPress={() => setShowGenderPicker(false)}>
                <Text style={styles.pickerModalCancel}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <Text style={styles.pickerModalTitle}>Genero</Text>
              <TouchableOpacity onPress={() => setShowGenderPicker(false)}>
                <Text style={styles.pickerModalDone}>OK</Text>
              </TouchableOpacity>
            </View>
            <Picker selectedValue={newPlayerGender} onValueChange={setNewPlayerGender} style={styles.iosPicker} itemStyle={{ fontSize: 18, color: '#333' }}>
              <Picker.Item label="Sin especificar" value="" />
              {GENDER_OPTIONS.map((g) => (<Picker.Item key={g.value} label={g.label} value={g.value} />))}
            </Picker>
          </View>
        </View>
      </Modal>

      <Modal visible={showCountryPicker} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={() => setShowCountryPicker(false)}>
        <View style={styles.pickerModalOverlay}>
          <View style={styles.pickerModalContent}>
            <View style={styles.pickerModalHeader}>
              <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
                <Text style={styles.pickerModalCancel}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <Text style={styles.pickerModalTitle}>Pais</Text>
              <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
                <Text style={styles.pickerModalDone}>OK</Text>
              </TouchableOpacity>
            </View>
            <Picker selectedValue={newPlayerCountry} onValueChange={setNewPlayerCountry} style={styles.iosPicker} itemStyle={{ fontSize: 18, color: '#333' }}>
              <Picker.Item label="Seleccionar pais" value="" />
              {COUNTRIES.map((c) => (<Picker.Item key={c} label={c} value={c} />))}
            </Picker>
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
              itemStyle={{ fontSize: 18, color: '#333' }}
            >
              <Picker.Item label={t('newMatch.selectPlayer')} value={null} color="#999" />
              {players.map((player) => (
                <Picker.Item
                  key={player.id}
                  label={getPlayerLabel(player)}
                  value={player.id}
                  color="#333"
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
              itemStyle={{ fontSize: 18, color: '#333' }}
            >
              <Picker.Item label={t('newMatch.selectPlayer')} value={null} color="#999" />
              {players.map((player) => (
                <Picker.Item
                  key={player.id}
                  label={getPlayerLabel(player)}
                  value={player.id}
                  color="#333"
                />
              ))}
            </Picker>
          </View>
        </View>
      </Modal>

      {/* Modal para seleccionar Torneo (iOS) */}
      <Modal
        visible={showTournamentPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTournamentPicker(false)}
      >
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
              selectedValue={selectedTournamentId}
              onValueChange={(itemValue) => setSelectedTournamentId(itemValue)}
              style={styles.iosPicker}
              itemStyle={{ fontSize: 18, color: '#333' }}
            >
              <Picker.Item label="Sin torneo" value={null} color="#999" />
              {tournaments.map((tour) => (
                <Picker.Item key={tour.id} label={tour.name} value={tour.id} color="#333" />
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginBottom: 8,
    gap: 10,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  switchValueText: {
    fontSize: 14,
    fontWeight: '500',
    minWidth: 90,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
    marginTop: 8,
  },
});
