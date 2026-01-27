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
  winner_nickname?: string;
}

export default function Index() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, login, logout } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [hasPendingSync, setHasPendingSync] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadMatches();
      checkPendingSync();
    }, [])
  );

  // Auto-sync on app open if authenticated and has pending
  useEffect(() => {
    if (isAuthenticated && hasPendingSync) {
      handleSync();
    }
  }, [isAuthenticated, hasPendingSync]);

  const initializeApp = async () => {
    try {
      await initDatabase();
      await loadMatches();
      await checkPendingSync();
    } catch (error) {
      console.error('Error inicializando app:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMatches = async () => {
    try {
      const db = await getDatabase();
      const result = await db.getAllAsync(`
        SELECT 
          m.id,
          m.date,
          m.status,
          p1.nickname as player1_nickname,
          p2.nickname as player2_nickname,
          pw.nickname as winner_nickname
        FROM matches m
        JOIN players p1 ON m.player1_id = p1.id
        JOIN players p2 ON m.player2_id = p2.id
        LEFT JOIN players pw ON m.winner_id = pw.id
        ORDER BY m.date DESC
        LIMIT 10
      `);
      setMatches(result as Match[]);
    } catch (error) {
      console.error('Error cargando partidos:', error);
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
      Alert.alert('Sincronización', result.message);
    } else {
      Alert.alert('Error', result.message);
    }
  };

  const handleLogout = () => {
    Alert.alert('Cerrar Sesión', '¿Estás seguro?', [
      { text: 'Cancelar' },
      { text: 'Cerrar Sesión', onPress: logout, style: 'destructive' }
    ]);
  };

  const renderMatch = ({ item }: { item: Match }) => (
    <TouchableOpacity
      style={styles.matchCard}
      onPress={() => {
        if (item.status === 'finished') {
          router.push({
            pathname: '/match-summary',
            params: { matchId: item.id },
          });
        } else {
          router.push({
            pathname: '/match-play',
            params: { matchId: item.id },
          });
        }
      }}
    >
      <View style={styles.matchHeader}>
        <Text style={styles.matchPlayers}>
          {item.player1_nickname} vs {item.player2_nickname}
        </Text>
        <View
          style={[
            styles.statusBadge,
            item.status === 'finished' ? styles.finishedBadge : styles.playingBadge,
          ]}
        >
          <Text style={styles.statusText}>
            {item.status === 'finished' ? 'Finalizado' : 'En curso'}
          </Text>
        </View>
      </View>
      <Text style={styles.matchDate}>
        {format(new Date(item.date), "dd/MM/yyyy - HH:mm")}
      </Text>
      {item.winner_nickname && (
        <Text style={styles.winnerText}>Ganador: {item.winner_nickname}</Text>
      )}
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
        
        {/* Indicador de sync pendiente */}
        {hasPendingSync && isAuthenticated && (
          <TouchableOpacity style={styles.syncBanner} onPress={handleSync} disabled={syncing}>
            <Ionicons name="cloud-upload-outline" size={18} color="#FFF" />
            <Text style={styles.syncBannerText}>
              {syncing ? 'Sincronizando...' : 'Hay partidos pendientes de sincronizar'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Partidos Recientes</Text>
          {isAuthenticated && (
            <TouchableOpacity 
              style={styles.cloudButton}
              onPress={() => router.push('/cloud-matches')}
            >
              <Ionicons name="cloud-outline" size={18} color="#2196F3" />
              <Text style={styles.cloudButtonText}>Nube</Text>
            </TouchableOpacity>
          )}
        </View>

        {matches.length > 0 ? (
          <FlatList
            data={matches}
            renderItem={renderMatch}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="tennisball-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>No hay partidos aún</Text>
            <Text style={styles.emptySubtext}>
              Comienza un nuevo partido para empezar a analizar
            </Text>
          </View>
        )}
      </View>

      <View style={styles.bottomButtons}>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.analysisButton}
            onPress={() => router.push('/analysis')}
          >
            <Ionicons name="analytics" size={24} color="#1E3A5F" />
            <Text style={styles.analysisButtonText}>Análisis</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.newMatchButton}
            onPress={() => router.push('/new-match')}
          >
            <Ionicons name="add-circle" size={24} color="#FFF" />
            <Text style={styles.newMatchText}>Nuevo Partido</Text>
          </TouchableOpacity>
        </View>
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
  cloudButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  cloudButtonText: {
    color: '#2196F3',
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 20,
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
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  finishedBadge: {
    backgroundColor: '#E8F5E9',
  },
  playingBadge: {
    backgroundColor: '#FFF3E0',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  matchDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  winnerText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
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
    gap: 12,
  },
  analysisButton: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#1E3A5F',
  },
  analysisButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E3A5F',
    marginLeft: 6,
  },
  newMatchButton: {
    flex: 1,
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
    marginLeft: 6,
  },
});
