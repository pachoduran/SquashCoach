import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { syncService } from '@/src/store/syncService';
import { format } from 'date-fns';

interface CloudMatch {
  match_id: string;
  player1_id: string;
  player2_id: string;
  date: string;
  status: string;
  player1_games: number;
  player2_games: number;
  tournament_name?: string;
}

interface CloudPlayer {
  player_id: string;
  nickname: string;
}

export default function CloudMatchesScreen() {
  const router = useRouter();
  const { isAuthenticated, login } = useAuth();
  const [matches, setMatches] = useState<CloudMatch[]>([]);
  const [players, setPlayers] = useState<CloudPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadCloudData();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const loadCloudData = async () => {
    try {
      const [matchesData, playersData] = await Promise.all([
        syncService.getCloudMatches(),
        syncService.getCloudPlayers()
      ]);
      
      setMatches(matchesData);
      setPlayers(playersData);
    } catch (error) {
      console.error('Error cargando datos de la nube:', error);
      Alert.alert('Error', 'No se pudieron cargar los datos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadCloudData();
  };

  const getPlayerName = (playerId: string) => {
    const player = players.find(p => p.player_id === playerId);
    return player?.nickname || 'Desconocido';
  };

  const handleMatchPress = async (match: CloudMatch) => {
    // TODO: Download match data and show details
    Alert.alert(
      'Partido en la Nube',
      `${getPlayerName(match.player1_id)} vs ${getPlayerName(match.player2_id)}\n\nResultado: ${match.player1_games} - ${match.player2_games}`,
      [
        { text: 'Cerrar' },
        { 
          text: 'Ver Análisis', 
          onPress: () => {
            // Navigate to analysis with cloud data
            router.push({
              pathname: '/analysis',
              params: { 
                player1Id: match.player1_id,
                player2Id: match.player2_id 
              }
            });
          }
        }
      ]
    );
  };

  const renderMatch = ({ item }: { item: CloudMatch }) => (
    <TouchableOpacity
      style={styles.matchCard}
      onPress={() => handleMatchPress(item)}
    >
      <View style={styles.matchHeader}>
        <Text style={styles.matchPlayers}>
          {getPlayerName(item.player1_id)} vs {getPlayerName(item.player2_id)}
        </Text>
        <View style={styles.cloudBadge}>
          <Ionicons name="cloud" size={14} color="#2196F3" />
        </View>
      </View>
      
      <View style={styles.matchDetails}>
        <Text style={styles.matchScore}>
          {item.player1_games} - {item.player2_games}
        </Text>
        <Text style={styles.matchDate}>
          {format(new Date(item.date), "dd/MM/yyyy")}
        </Text>
      </View>
      
      {item.tournament_name && (
        <Text style={styles.tournamentName}>{item.tournament_name}</Text>
      )}
    </TouchableOpacity>
  );

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Partidos en la Nube</Text>
          <View style={{ width: 30 }} />
        </View>
        
        <View style={styles.notAuthContainer}>
          <Ionicons name="cloud-offline-outline" size={80} color="#CCC" />
          <Text style={styles.notAuthTitle}>No has iniciado sesión</Text>
          <Text style={styles.notAuthText}>
            Inicia sesión para ver tus partidos sincronizados en la nube
          </Text>
          <TouchableOpacity style={styles.loginButton} onPress={login}>
            <Ionicons name="log-in-outline" size={20} color="#FFF" />
            <Text style={styles.loginButtonText}>Iniciar Sesión</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Partidos en la Nube</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Cargando partidos...</Text>
        </View>
      ) : matches.length > 0 ? (
        <FlatList
          data={matches}
          renderItem={renderMatch}
          keyExtractor={(item) => item.match_id}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="cloud-outline" size={80} color="#CCC" />
          <Text style={styles.emptyTitle}>No hay partidos en la nube</Text>
          <Text style={styles.emptyText}>
            Los partidos que termines se sincronizarán automáticamente
          </Text>
        </View>
      )}

      {/* Stats Card */}
      {!loading && (
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{matches.length}</Text>
            <Text style={styles.statLabel}>Partidos</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{players.length}</Text>
            <Text style={styles.statLabel}>Jugadores</Text>
          </View>
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
  refreshButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
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
  cloudBadge: {
    backgroundColor: '#E3F2FD',
    padding: 6,
    borderRadius: 12,
  },
  matchDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matchScore: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  matchDate: {
    fontSize: 14,
    color: '#666',
  },
  tournamentName: {
    fontSize: 13,
    color: '#999',
    marginTop: 8,
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  notAuthContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  notAuthTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  notAuthText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  loginButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  statsCard: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E0E0E0',
  },
});
