import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  Modal,
  TextInput,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getDatabase } from '@/src/store/database';
import { useLanguage } from '@/src/context/LanguageContext';
import { useAuth } from '@/src/context/AuthContext';
import { SquashCourt } from '@/src/components/SquashCourt';
import { HeatmapCourt } from '@/src/components/HeatmapCourt';
import { format } from 'date-fns';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
}

interface GameResult {
  game_number: number;
  player1_score: number;
  player2_score: number;
}

export default function MatchSummary() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const matchId = params.matchId as string;
  const isCloudMatch = params.isCloudMatch === 'true';
  const { t } = useLanguage();
  const { sessionToken } = useAuth();

  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [allPoints, setAllPoints] = useState<PointData[]>([]);
  const [gameResults, setGameResults] = useState<GameResult[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtro por game
  const [selectedGame, setSelectedGame] = useState<number>(1);
  
  // Navegación de puntos
  const [selectedPointIndex, setSelectedPointIndex] = useState(0);
  
  // Filtro de estadísticas por jugador
  const [statsFilter, setStatsFilter] = useState<'all' | 'player1' | 'player2'>('all');

  // Vista de la cancha: 'points' | 'heatmap' | 'both'
  const [courtView, setCourtView] = useState<'points' | 'heatmap' | 'both'>('points');
  const [heatmapPlayer, setHeatmapPlayer] = useState<'player1' | 'player2'>('player1');
  
  // Edit point
  const [showEditPoint, setShowEditPoint] = useState(false);
  const [editReason, setEditReason] = useState('');
  const [editWinner, setEditWinner] = useState<number | null>(null);
  const REASONS = ['Drop', 'Boast', 'Paralela', 'Cross', 'Lob', 'Volea', 'Kill', 'Error', 'Let', 'Stroke', 'No Let', 'Nick', 'Dos paredes', 'Cruzada', 'Alta', 'Chapa', 'No contestó', 'Globo', 'Saque'];

  // Share
  const shareCardRef = useRef<any>(null);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    if (isCloudMatch) {
      loadCloudMatchSummary();
    } else {
      loadMatchSummary();
    }
  }, []);

  // Reset punto seleccionado cuando cambia el filtro de game
  useEffect(() => {
    setSelectedPointIndex(0);
  }, [selectedGame]);

  const loadCloudMatchSummary = async () => {
    try {
      const BACKEND_URL = 'https://lev.jsb.mybluehost.me:8001';
      const response = await fetch(`${BACKEND_URL}/api/matches/${matchId}`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Error cargando partido de la nube');
      }

      const data = await response.json();
      
      // Mapear datos de la nube al formato local
      const players = data.players || [];
      const player1 = players.find((p: any) => p.player_id === data.match.player1_id);
      const player2 = players.find((p: any) => p.player_id === data.match.player2_id);
      const winner = players.find((p: any) => p.player_id === data.match.winner_id);

      setMatchData({
        id: 0,
        player1_id: data.match.player1_id,
        player2_id: data.match.player2_id,
        player1_nickname: player1?.nickname || 'Jugador 1',
        player2_nickname: player2?.nickname || 'Jugador 2',
        winner_nickname: winner?.nickname || '',
        player1_games: data.match.player1_games,
        player2_games: data.match.player2_games,
        date: data.match.date,
        tournament_name: data.match.tournament_name,
      });

      // Mapear puntos
      const mappedPoints = (data.points || []).map((p: any, index: number) => ({
        id: index,
        position_x: p.position_x,
        position_y: p.position_y,
        winner_player_id: p.winner_player_id,
        reason: p.reason,
        game_number: p.game_number,
        point_number: p.point_number,
        player1_score: p.player1_score,
        player2_score: p.player2_score,
      }));
      setAllPoints(mappedPoints);

      // Mapear resultados de games
      const mappedGameResults = (data.game_results || []).map((g: any) => ({
        game_number: g.game_number,
        player1_score: g.player1_score,
        player2_score: g.player2_score,
      }));
      setGameResults(mappedGameResults);

    } catch (error) {
      console.error('Error cargando partido de la nube:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMatchSummary = async () => {
    try {
      const db = await getDatabase();
      
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
        [parseInt(matchId)]
      );

      setMatchData(match as MatchData);

      const pointsData = await db.getAllAsync(
        'SELECT * FROM points WHERE match_id = ? ORDER BY game_number, point_number',
        [parseInt(matchId)]
      );
      setAllPoints(pointsData as PointData[]);

      const gamesData = await db.getAllAsync(
        'SELECT * FROM game_results WHERE match_id = ? ORDER BY game_number',
        [parseInt(matchId)]
      );
      setGameResults(gamesData as GameResult[]);

    } catch (error) {
      console.error('Error cargando resumen:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar puntos según el game seleccionado
  const filteredPoints = allPoints.filter(p => p.game_number === selectedGame);

  const goToPreviousPoint = () => {
    if (selectedPointIndex > 0) {
      setSelectedPointIndex(selectedPointIndex - 1);
    }
  };

  const goToNextPoint = () => {
    if (selectedPointIndex < filteredPoints.length - 1) {
      setSelectedPointIndex(selectedPointIndex + 1);
    }
  };

  const getReasonStats = () => {
    let points = filteredPoints;
    
    if (statsFilter === 'player1' && matchData) {
      points = points.filter(p => p.winner_player_id === matchData.player1_id);
    } else if (statsFilter === 'player2' && matchData) {
      points = points.filter(p => p.winner_player_id === matchData.player2_id);
    }
    
    const reasonCounts: { [key: string]: number } = {};
    points.forEach(p => {
      if (p.reason && p.reason !== t('matchPlay.noReason') && p.reason !== 'Ninguna' && p.reason !== 'None') {
        reasonCounts[p.reason] = (reasonCounts[p.reason] || 0) + 1;
      }
    });
    
    return Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5
  };

  const openEditPoint = () => {
    if (!selectedPoint || isCloudMatch) return;
    setEditReason(selectedPoint.reason || '');
    setEditWinner(selectedPoint.winner_player_id);
    setShowEditPoint(true);
  };

  const saveEditPoint = async () => {
    if (!selectedPoint || !editWinner) return;
    try {
      const db = await getDatabase();
      await db.runAsync(
        'UPDATE points SET reason = ?, winner_player_id = ? WHERE id = ?',
        [editReason, editWinner, selectedPoint.id]
      );
      // Update local state
      const updated = allPoints.map(p => 
        p.id === selectedPoint.id ? { ...p, reason: editReason, winner_player_id: editWinner } : p
      );
      setAllPoints(updated);
      setShowEditPoint(false);
      Alert.alert('Listo', 'Punto actualizado');
    } catch (error) {
      console.error('Error editando punto:', error);
      Alert.alert('Error', 'No se pudo actualizar el punto');
    }
  };

  // Share functions
  const getShareText = () => {
    if (!matchData) return '';
    const winner = matchData.winner_id === matchData.player1_id 
      ? matchData.player1_nickname 
      : matchData.player2_nickname;
    const gameScores = gameResults.map(g => `${g.player1_score}-${g.player2_score}`).join(', ');
    const dateStr = matchData.date ? format(new Date(matchData.date), 'dd/MM/yyyy') : '';
    const tournamentStr = matchData.tournament ? `\nTorneo: ${matchData.tournament}` : '';
    
    return `Squash Match Result\n${matchData.player1_nickname} vs ${matchData.player2_nickname}\n${matchData.player1_games} - ${matchData.player2_games} (${gameScores})${tournamentStr}\nGanador: ${winner}\n${dateStr}\n\nSquash Coach App`;
  };

  const shareAsImage = async () => {
    if (!shareCardRef.current) return;
    setIsSharing(true);
    try {
      const uri = await shareCardRef.current.capture();
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Compartir resultado',
        });
      } else {
        Alert.alert('No disponible', 'La función de compartir no está disponible en este dispositivo');
      }
    } catch (error) {
      console.error('Error sharing image:', error);
      Alert.alert('Error', 'No se pudo compartir la imagen');
    } finally {
      setIsSharing(false);
    }
  };

  const shareViaWhatsApp = async () => {
    const text = getShareText();
    const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('WhatsApp', 'WhatsApp no está instalado');
      }
    } catch (error) {
      console.error('Error opening WhatsApp:', error);
    }
  };

  const showShareOptions = () => {
    Alert.alert(
      'Compartir Resultado',
      'Elige cómo compartir',
      [
        { text: 'Imagen', onPress: shareAsImage },
        { text: 'WhatsApp (texto)', onPress: shareViaWhatsApp },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  // Obtener lista de games disponibles
  const availableGames = [...new Set(allPoints.map(p => p.game_number))].sort();

  if (loading || !matchData) {
    return (
      <View style={styles.loadingContainer}>
        <Text>{t('common.loading')}</Text>
      </View>
    );
  }

  const selectedPoint = filteredPoints[selectedPointIndex];
  const player1Points = filteredPoints.filter(p => p.winner_player_id === matchData.player1_id);
  const player2Points = filteredPoints.filter(p => p.winner_player_id === matchData.player2_id);
  const reasonStats = getReasonStats();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('summary.title')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={showShareOptions} style={styles.homeButton} data-testid="share-match-btn">
            <Ionicons name="share-social" size={22} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/')} style={styles.homeButton}>
            <Ionicons name="home" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Resultado compacto */}
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            {matchData.tournament_name && (
              <Text style={styles.tournamentText}>{matchData.tournament_name}</Text>
            )}
            <Text style={styles.dateText}>
              {format(new Date(matchData.date), "dd/MM/yyyy")}
            </Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.playerNameCompact}>{matchData.player1_nickname}</Text>
            <View style={styles.scoreBox}>
              <Text style={styles.gamesCountCompact}>{matchData.player1_games} - {matchData.player2_games}</Text>
            </View>
            <Text style={styles.playerNameCompact}>{matchData.player2_nickname}</Text>
          </View>
        </View>

        {/* Selector de Game */}
        <View style={styles.gameSelector}>
          {availableGames.map(game => (
            <TouchableOpacity
              key={game}
              style={[styles.gameSelectorBtn, selectedGame === game && styles.gameSelectorBtnActive]}
              onPress={() => setSelectedGame(game)}
            >
              <Text style={[styles.gameSelectorText, selectedGame === game && styles.gameSelectorTextActive]}>
                Game {game}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Cancha y navegación - Compacto */}
        {filteredPoints.length > 0 && (
          <View style={styles.courtSection}>
            {/* Toggle Vista: Puntos | Heatmap | Ambos */}
            <View style={styles.viewToggle}>
              <TouchableOpacity
                style={[styles.viewToggleBtn, courtView === 'points' && styles.viewToggleBtnActive]}
                onPress={() => setCourtView('points')}
                data-testid="view-toggle-points"
              >
                <Ionicons name="locate" size={14} color={courtView === 'points' ? '#FFF' : '#666'} />
                <Text style={[styles.viewToggleText, courtView === 'points' && styles.viewToggleTextActive]}>
                  Bolas
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewToggleBtn, courtView === 'heatmap' && styles.viewToggleBtnActive]}
                onPress={() => setCourtView('heatmap')}
                data-testid="view-toggle-heatmap"
              >
                <Ionicons name="flame" size={14} color={courtView === 'heatmap' ? '#FFF' : '#666'} />
                <Text style={[styles.viewToggleText, courtView === 'heatmap' && styles.viewToggleTextActive]}>
                  Zonas
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewToggleBtn, courtView === 'both' && styles.viewToggleBtnActive]}
                onPress={() => setCourtView('both')}
                data-testid="view-toggle-both"
              >
                <Ionicons name="layers" size={14} color={courtView === 'both' ? '#FFF' : '#666'} />
                <Text style={[styles.viewToggleText, courtView === 'both' && styles.viewToggleTextActive]}>
                  Ambos
                </Text>
              </TouchableOpacity>
            </View>

            {courtView === 'points' ? (
              <>
                <SquashCourt
                  points={filteredPoints.map((p, index) => ({
                    x: p.position_x,
                    y: p.position_y,
                    isWin: p.winner_player_id === matchData.player1_id,
                    score: `${p.player1_score}-${p.player2_score}`,
                    isSelected: index === selectedPointIndex,
                  }))}
                  selectedPointIndex={selectedPointIndex}
                  showSelectedHighlight={true}
                  compact={true}
                />
                
                {/* Info del punto + Navegación en línea */}
                <View style={styles.pointNavRow}>
                  <TouchableOpacity 
                    style={styles.navBtnSmall}
                    onPress={() => setSelectedPointIndex(0)}
                    disabled={selectedPointIndex === 0}
                  >
                    <Ionicons name="play-skip-back" size={18} color={selectedPointIndex === 0 ? "#CCC" : "#2196F3"} />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.navBtnSmall}
                    onPress={goToPreviousPoint}
                    disabled={selectedPointIndex === 0}
                  >
                    <Ionicons name="chevron-back" size={22} color={selectedPointIndex === 0 ? "#CCC" : "#2196F3"} />
                  </TouchableOpacity>
                  
                  <View style={styles.pointInfoCompact}>
                    <Text style={styles.pointScoreCompact}>
                      {selectedPoint?.player1_score}-{selectedPoint?.player2_score}
                    </Text>
                    <Text style={styles.pointDetailCompact}>
                      {selectedPoint?.winner_player_id === matchData.player1_id 
                        ? matchData.player1_nickname 
                        : matchData.player2_nickname} • {selectedPoint?.reason}
                    </Text>
                  </View>

                  {!isCloudMatch && (
                    <TouchableOpacity style={styles.navBtnSmall} onPress={openEditPoint}>
                      <Ionicons name="pencil" size={18} color="#FF9800" />
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity 
                    style={styles.navBtnSmall}
                    onPress={goToNextPoint}
                    disabled={selectedPointIndex === filteredPoints.length - 1}
                  >
                    <Ionicons name="chevron-forward" size={22} color={selectedPointIndex === filteredPoints.length - 1 ? "#CCC" : "#2196F3"} />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.navBtnSmall}
                    onPress={() => setSelectedPointIndex(filteredPoints.length - 1)}
                    disabled={selectedPointIndex === filteredPoints.length - 1}
                  >
                    <Ionicons name="play-skip-forward" size={18} color={selectedPointIndex === filteredPoints.length - 1 ? "#CCC" : "#2196F3"} />
                  </TouchableOpacity>
                </View>
                
                <Text style={styles.pointCounter}>
                  Punto {selectedPointIndex + 1} de {filteredPoints.length}
                </Text>
              </>
            ) : (
              <>
                {/* Selector de jugador para el heatmap */}
                <View style={styles.heatmapPlayerToggle}>
                  <TouchableOpacity
                    style={[styles.heatmapPlayerBtn, heatmapPlayer === 'player1' && styles.heatmapPlayerBtnActive]}
                    onPress={() => setHeatmapPlayer('player1')}
                    data-testid="heatmap-player1"
                  >
                    <Text style={[styles.heatmapPlayerText, heatmapPlayer === 'player1' && styles.heatmapPlayerTextActive]}>
                      {matchData.player1_nickname}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.heatmapPlayerBtn, heatmapPlayer === 'player2' && styles.heatmapPlayerBtnActive]}
                    onPress={() => setHeatmapPlayer('player2')}
                    data-testid="heatmap-player2"
                  >
                    <Text style={[styles.heatmapPlayerText, heatmapPlayer === 'player2' && styles.heatmapPlayerTextActive]}>
                      {matchData.player2_nickname}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.heatmapHint}>
                  {courtView === 'both' ? 'Zonas + bolas: ' : 'Zonas donde '}
                  {heatmapPlayer === 'player1' ? matchData.player1_nickname : matchData.player2_nickname}
                  {courtView === 'both' ? '' : ' ganó sus puntos'}
                </Text>
                <HeatmapCourt
                  points={filteredPoints
                    .filter(p => p.winner_player_id === (heatmapPlayer === 'player1' ? matchData.player1_id : matchData.player2_id))
                    .map(p => ({ x: p.position_x, y: p.position_y }))
                  }
                  color={heatmapPlayer === 'player1' ? '#2196F3' : '#F44336'}
                  overlayPoints={courtView === 'both'
                    ? filteredPoints
                        .filter(p => p.winner_player_id === (heatmapPlayer === 'player1' ? matchData.player1_id : matchData.player2_id))
                        .map(p => ({ x: p.position_x, y: p.position_y }))
                    : undefined
                  }
                />
              </>
            )}
          </View>
        )}

        {/* Estadísticas compactas */}
        <View style={styles.statsRow}>
          <View style={styles.statMini}>
            <Text style={styles.statValueMini}>{filteredPoints.length}</Text>
            <Text style={styles.statLabelMini}>Total</Text>
          </View>
          <View style={[styles.statMini, { borderLeftWidth: 2, borderLeftColor: '#2196F3' }]}>
            <Text style={[styles.statValueMini, { color: '#2196F3' }]}>{player1Points.length}</Text>
            <Text style={styles.statLabelMini}>{matchData.player1_nickname.substring(0, 6)}</Text>
          </View>
          <View style={[styles.statMini, { borderLeftWidth: 2, borderLeftColor: '#FF5722' }]}>
            <Text style={[styles.statValueMini, { color: '#FF5722' }]}>{player2Points.length}</Text>
            <Text style={styles.statLabelMini}>{matchData.player2_nickname.substring(0, 6)}</Text>
          </View>
          <View style={styles.statMini}>
            <Text style={styles.statValueMini}>
              {filteredPoints.length > 0 ? Math.round((player1Points.length / filteredPoints.length) * 100) : 0}%
            </Text>
            <Text style={styles.statLabelMini}>Efect.</Text>
          </View>
        </View>

        {/* Motivos con filtros */}
        <View style={styles.reasonsSection}>
          <View style={styles.filterRow}>
            <Text style={styles.sectionTitleSmall}>Motivos</Text>
            <View style={styles.filterBtns}>
              <TouchableOpacity 
                style={[styles.filterBtnMini, statsFilter === 'all' && styles.filterBtnMiniActive]}
                onPress={() => setStatsFilter('all')}
              >
                <Text style={[styles.filterBtnText, statsFilter === 'all' && styles.filterBtnTextActive]}>Todos</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.filterBtnMini, statsFilter === 'player1' && styles.filterBtnMiniActive]}
                onPress={() => setStatsFilter('player1')}
              >
                <Text style={[styles.filterBtnText, statsFilter === 'player1' && { color: '#2196F3' }]}>
                  {matchData.player1_nickname.substring(0, 5)}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.filterBtnMini, statsFilter === 'player2' && styles.filterBtnMiniActive]}
                onPress={() => setStatsFilter('player2')}
              >
                <Text style={[styles.filterBtnText, statsFilter === 'player2' && { color: '#FF5722' }]}>
                  {matchData.player2_nickname.substring(0, 5)}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.reasonsGrid}>
            {reasonStats.map((stat, index) => {
              const maxCount = Math.max(...reasonStats.map(s => s.count));
              const colors = ['#4CAF50', '#2196F3', '#FF9800', '#F44336', '#9C27B0'];
              const pct = maxCount > 0 ? (stat.count / maxCount) * 100 : 0;
              return (
                <View key={index} style={styles.reasonItem}>
                  <View style={styles.reasonBarBg}>
                    <View style={[styles.reasonBarFill, { width: `${pct}%`, backgroundColor: colors[index % colors.length] }]} />
                  </View>
                  <Text style={styles.reasonText}>{stat.reason.substring(0, 12)}</Text>
                  <Text style={styles.reasonCount}>{stat.count}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Games en línea */}
        {gameResults.length > 0 && (
          <View style={styles.gamesRow}>
            {gameResults.map((game) => (
              <View key={game.game_number} style={styles.gameChip}>
                <Text style={styles.gameChipTitle}>G{game.game_number}</Text>
                <Text style={[
                  styles.gameChipScore,
                  game.player1_score > game.player2_score ? styles.winScore : styles.loseScore
                ]}>
                  {game.player1_score}-{game.player2_score}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Modal editar punto */}
      <Modal visible={showEditPoint} animationType="slide" transparent onRequestClose={() => setShowEditPoint(false)}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: '#FFF', borderRadius: 12, padding: 20, width: '85%', maxHeight: '80%' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1E3A5F', marginBottom: 12 }}>
              Editar Punto
            </Text>
            <Text style={{ fontSize: 14, color: '#666', marginBottom: 12 }}>
              Punto {selectedPointIndex + 1} - Score: {selectedPoint?.player1_score}-{selectedPoint?.player2_score}
            </Text>
            
            {/* Winner selector */}
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 8 }}>Ganador:</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              <TouchableOpacity
                onPress={() => setEditWinner(matchData!.player1_id)}
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
                  backgroundColor: editWinner === matchData?.player1_id ? '#E8F5E9' : '#f0f0f0',
                  borderWidth: 2,
                  borderColor: editWinner === matchData?.player1_id ? '#4CAF50' : '#E0E0E0',
                }}
              >
                <Text style={{ color: editWinner === matchData?.player1_id ? '#4CAF50' : '#666', fontWeight: '600', fontSize: 14 }}>
                  {matchData?.player1_nickname}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setEditWinner(matchData!.player2_id)}
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
                  backgroundColor: editWinner === matchData?.player2_id ? '#E8F5E9' : '#f0f0f0',
                  borderWidth: 2,
                  borderColor: editWinner === matchData?.player2_id ? '#4CAF50' : '#E0E0E0',
                }}
              >
                <Text style={{ color: editWinner === matchData?.player2_id ? '#4CAF50' : '#666', fontWeight: '600', fontSize: 14 }}>
                  {matchData?.player2_nickname}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 8 }}>Motivo:</Text>
            <ScrollView style={{ maxHeight: 200 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {REASONS.map(r => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setEditReason(r)}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                      backgroundColor: editReason === r ? '#2196F3' : '#f0f0f0',
                    }}
                  >
                    <Text style={{ color: editReason === r ? '#FFF' : '#333', fontSize: 14 }}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
              <TouchableOpacity onPress={() => setShowEditPoint(false)} style={{ padding: 10 }}>
                <Text style={{ color: '#666', fontSize: 16 }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveEditPoint} style={{ backgroundColor: '#2196F3', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}>
                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Shareable Card - Hidden off-screen for capture */}
      <ViewShot ref={shareCardRef} options={{ format: 'png', quality: 0.9 }}
        style={{ position: 'absolute', left: -9999, top: 0, width: 360 }}>
        <View style={shareStyles.card}>
          <View style={shareStyles.headerBar}>
            <Text style={shareStyles.appName}>SQUASH COACH</Text>
          </View>
          {matchData.tournament_name && (
            <Text style={shareStyles.tournament}>{matchData.tournament_name}</Text>
          )}
          <Text style={shareStyles.date}>{format(new Date(matchData.date), 'dd/MM/yyyy')}</Text>
          <View style={shareStyles.playersRow}>
            <View style={shareStyles.playerCol}>
              <Text style={[shareStyles.playerName, matchData.winner_id === matchData.player1_id && shareStyles.winnerName]}>
                {matchData.player1_nickname}
              </Text>
            </View>
            <View style={shareStyles.scoreCol}>
              <Text style={shareStyles.mainScore}>
                {matchData.player1_games} - {matchData.player2_games}
              </Text>
            </View>
            <View style={shareStyles.playerCol}>
              <Text style={[shareStyles.playerName, matchData.winner_id === matchData.player2_id && shareStyles.winnerName]}>
                {matchData.player2_nickname}
              </Text>
            </View>
          </View>
          {gameResults.length > 0 && (
            <View style={shareStyles.gamesRow}>
              {gameResults.map((g, i) => (
                <View key={i} style={shareStyles.gameChip}>
                  <Text style={shareStyles.gameChipText}>G{g.game_number}: {g.player1_score}-{g.player2_score}</Text>
                </View>
              ))}
            </View>
          )}
          {reasonStats.length > 0 && (
            <View style={shareStyles.reasonsSection}>
              <Text style={shareStyles.reasonsTitle}>Top Motivos</Text>
              {reasonStats.slice(0, 3).map((r, i) => (
                <View key={i} style={shareStyles.reasonRow}>
                  <Text style={shareStyles.reasonName}>{r.reason}</Text>
                  <Text style={shareStyles.reasonCount}>{r.count}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={shareStyles.footerBar}>
            <Text style={shareStyles.footerText}>squashcoach.app</Text>
          </View>
        </View>
      </ViewShot>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.newMatchButton} onPress={() => router.push('/new-match')}>
          <Ionicons name="add-circle" size={20} color="#FFF" />
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
  },
  homeButton: {
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
  resultCard: {
    backgroundColor: '#FFF',
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tournamentText: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '600',
  },
  dateText: {
    fontSize: 12,
    color: '#666',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playerNameCompact: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  scoreBox: {
    backgroundColor: '#1E3A5F',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  gamesCountCompact: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  gameSelector: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 6,
  },
  gameSelectorBtn: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#FFF',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  gameSelectorBtnActive: {
    backgroundColor: '#1E3A5F',
    borderColor: '#1E3A5F',
  },
  gameSelectorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  gameSelectorTextActive: {
    color: '#FFF',
  },
  courtSection: {
    backgroundColor: '#FFF',
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
  },
  pointNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 4,
  },
  navBtnSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F7FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointInfoCompact: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  pointScoreCompact: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E3A5F',
  },
  pointDetailCompact: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  pointCounter: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 10,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  statMini: {
    flex: 1,
    alignItems: 'center',
    paddingLeft: 8,
  },
  statValueMini: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabelMini: {
    fontSize: 10,
    color: '#666',
  },
  reasonsSection: {
    backgroundColor: '#FFF',
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitleSmall: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  filterBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  filterBtnMini: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F5F7FA',
  },
  filterBtnMiniActive: {
    backgroundColor: '#E3F2FD',
  },
  filterBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  filterBtnTextActive: {
    color: '#333',
  },
  reasonsGrid: {
    gap: 6,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reasonBarBg: {
    flex: 1,
    height: 20,
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  reasonBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  reasonText: {
    fontSize: 11,
    color: '#666',
    width: 80,
  },
  reasonCount: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    width: 24,
    textAlign: 'right',
  },
  gamesRow: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 10,
    gap: 8,
    justifyContent: 'center',
  },
  gameChip: {
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 60,
  },
  gameChipTitle: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
  },
  gameChipScore: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  winScore: {
    color: '#4CAF50',
  },
  loseScore: {
    color: '#F44336',
  },
  footer: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  newMatchButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  newMatchText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    marginLeft: 6,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    padding: 3,
    marginBottom: 10,
    gap: 4,
  },
  viewToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  viewToggleBtnActive: {
    backgroundColor: '#2196F3',
  },
  viewToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  viewToggleTextActive: {
    color: '#FFF',
  },
  heatmapPlayerToggle: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  heatmapPlayerBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
  },
  heatmapPlayerBtnActive: {
    backgroundColor: '#1E3A5F',
  },
  heatmapPlayerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  heatmapPlayerTextActive: {
    color: '#FFF',
  },
  heatmapHint: {
    fontSize: 11,
    color: '#888',
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
  },
});

const shareStyles = StyleSheet.create({
  card: {
    backgroundColor: '#1E3A5F',
    borderRadius: 16,
    overflow: 'hidden',
    width: 360,
  },
  headerBar: {
    backgroundColor: '#0D2137',
    paddingVertical: 14,
    alignItems: 'center',
  },
  appName: {
    color: '#4FC3F7',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 3,
  },
  tournament: {
    color: '#90CAF9',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 10,
    fontWeight: '600',
  },
  date: {
    color: '#78909C',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  playersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  playerCol: {
    flex: 1,
    alignItems: 'center',
  },
  playerName: {
    color: '#B0BEC5',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  winnerName: {
    color: '#4CAF50',
    fontSize: 17,
    fontWeight: '800',
  },
  scoreCol: {
    paddingHorizontal: 16,
  },
  mainScore: {
    color: '#FFF',
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center',
  },
  gamesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  gameChip: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  gameChipText: {
    color: '#B0BEC5',
    fontSize: 13,
    fontWeight: '600',
  },
  reasonsSection: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 20,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  reasonsTitle: {
    color: '#78909C',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  reasonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  reasonName: {
    color: '#B0BEC5',
    fontSize: 13,
  },
  reasonCount: {
    color: '#4FC3F7',
    fontSize: 13,
    fontWeight: '700',
  },
  footerBar: {
    backgroundColor: '#0D2137',
    paddingVertical: 10,
    alignItems: 'center',
  },
  footerText: {
    color: '#546E7A',
    fontSize: 11,
    letterSpacing: 1,
  },
});
