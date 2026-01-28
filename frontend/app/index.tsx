import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  StatusBar,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { initDatabase, getDatabase } from '@/src/store/database';
import { useAuth } from '@/src/context/AuthContext';
import { syncService } from '@/src/store/syncService';
import { format } from 'date-fns';

interface Match {
  id: number;
  player1_nickname: string;
  player2_nickname: string;
  date: string;
  status: string;
  player1_games: number;
  player2_games: number;
  player1_score: number;
  player2_score: number;
  current_game: number;
  tournament_name?: string;
}

export default function Index() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, login, logout } = useAuth();
  const [activeMatches, setActiveMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [hasPendingSync, setHasPendingSync] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadActiveMatches();
      checkPendingSync();
    }, [])
  );

  useEffect(() => {
    if (isAuthenticated && hasPendingSync) {
      handleSync();
    }
  }, [isAuthenticated, hasPendingSync]);

  const initializeApp = async () => {
    try {
      await initDatabase();
      await loadActiveMatches();
      await checkPendingSync();
    } catch (error) {
      console.error('Error inicializando app:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadActiveMatches = async () => {
    try {
      const db = await getDatabase();
      const result = await db.getAllAsync(`
        SELECT 
          m.id,
          m.date,
          m.status,
          m.player1_games,
          m.player2_games,
          m.current_game,
          m.tournament_name,
          p1.nickname as player1_nickname,
          p2.nickname as player2_nickname
        FROM matches m
        JOIN players p1 ON m.player1_id = p1.id
        JOIN players p2 ON m.player2_id = p2.id
        WHERE m.status = 'playing'
        ORDER BY m.date DESC
      `);
      setActiveMatches(result as Match[]);
    } catch (error) {
      console.error('Error cargando partidos activos:', error);
    }
  };

  const checkPendingSync = async () => {
    const pending = await syncService.hasPendingSync();
    setHasPendingSync(pending);
  };

  const handleSync = async () => {
    if (!isAuthenticated) {
      Alert.alert('Iniciar Sesión', 'Debes iniciar sesión para sincronizar', [
        { text: 'Cancelar' },
        { text: 'Iniciar Sesión', onPress: login }
      ]);
      return;
    }

    setSyncing(true);
    const result = await syncService.syncPendingMatches();
    setSyncing(false);

    if (result.success) {
      setHasPendingSync(false);
      if (result.message !== 'Nada que sincronizar') {
        Alert.alert('Sincronización', result.message);
      }
    }
  };

  const handleLogout = () => {
    Alert.alert('Cerrar Sesión', '¿Estás seguro?', [
      { text: 'Cancelar' },
      { text: 'Cerrar Sesión', onPress: logout, style: 'destructive' }
    ]);
  };

  const renderActiveMatch = ({ item }: { item: Match }) => (
    <TouchableOpacity
      style={styles.activeMatchCard}
      onPress={() => router.push({
        pathname: '/match-play',
        params: { matchId: item.id },
      })}
    >
      <View style={styles.matchLive}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>EN CURSO</Text>
      </View>
      
      <Text style={styles.matchPlayers}>
        {item.player1_nickname} vs {item.player2_nickname}
      </Text>
      
      <View style={styles.scoreContainer}>
        <Text style={styles.gamesScore}>
          {item.player1_games} - {item.player2_games}
        </Text>
        <Text style={styles.gameLabel}>Game {item.current_game}</Text>
      </View>
      
      {item.tournament_name && (
        <Text style={styles.tournamentName}>{item.tournament_name}</Text>
      )}
      
      <TouchableOpacity style={styles.continueButton}>
        <Text style={styles.continueButtonText}>Continuar</Text>
        <Ionicons name="play" size={16} color="#FFF" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1E3A5F" />
      
      {/* Header con usuario */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Squash Coach</Text>
          {isAuthenticated && user ? (
            <TouchableOpacity style={styles.userButton} onPress={handleLogout}>
              {user.picture ? (
                <Image source={{ uri: user.picture }} style={styles.userAvatar} />
              ) : (
                <Ionicons name="person-circle" size={32} color="#FFF" />
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.loginButton} onPress={login}>
              <Ionicons name="log-in-outline" size={20} color="#FFF" />
              <Text style={styles.loginButtonText}>Entrar</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {hasPendingSync && isAuthenticated && (
          <TouchableOpacity style={styles.syncBanner} onPress={handleSync} disabled={syncing}>
            <Ionicons name="cloud-upload-outline" size={18} color="#FFF" />
            <Text style={styles.syncBannerText}>
              {syncing ? 'Sincronizando...' : 'Partidos pendientes de sincronizar'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.content}>
        {/* Partidos en curso */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Partidos en Curso</Text>
        </View>

        {activeMatches.length > 0 ? (
          <FlatList
            data={activeMatches}
            renderItem={renderActiveMatch}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="tennisball-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>No hay partidos en curso</Text>
            <Text style={styles.emptySubtext}>
              Comienza un nuevo partido para empezar a analizar
            </Text>
          </View>
        )}
      </View>

      {/* Botones inferiores */}
      <View style={styles.bottomButtons}>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => router.push('/history')}
          >
            <Ionicons name="time-outline" size={22} color="#1E3A5F" />
            <Text style={styles.historyButtonText}>Historial</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.analysisButton}
            onPress={() => router.push('/analysis')}
          >
            <Ionicons name="analytics" size={22} color="#1E3A5F" />
            <Text style={styles.analysisButtonText}>Análisis</Text>
          </TouchableOpacity>
          
          {isAuthenticated && (
            <TouchableOpacity
              style={styles.cloudButton}
              onPress={() => router.push('/cloud-matches')}
            >
              <Ionicons name="cloud-outline" size={22} color="#1E3A5F" />
              <Text style={styles.cloudButtonText}>Nube</Text>
            </TouchableOpacity>
          )}
        </View>
        
        <TouchableOpacity
          style={styles.newMatchButton}
          onPress={() => router.push('/new-match')}
        >
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
  header: {
    backgroundColor: '#1E3A5F',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  userButton: {
    padding: 4,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  loginButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9800',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 8,
  },
  syncBannerText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  listContent: {
    paddingBottom: 20,
  },
  activeMatchCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  matchLive: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 6,
  },
  liveText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4CAF50',
    letterSpacing: 1,
  },
  matchPlayers: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
    marginBottom: 8,
  },
  gamesScore: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  gameLabel: {
    fontSize: 14,
    color: '#666',
  },
  tournamentName: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  continueButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  continueButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  bottomButtons: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  historyButton: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  historyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E3A5F',
  },
  analysisButton: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  analysisButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E3A5F',
  },
  cloudButton: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  cloudButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E3A5F',
  },
  newMatchButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  newMatchText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    marginLeft: 8,
  },
});
