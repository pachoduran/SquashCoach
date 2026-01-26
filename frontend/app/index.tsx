import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { initDatabase, getDatabase } from '../store/database';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Match {
  id: number;
  player1_name: string;
  player2_name: string;
  date: string;
  status: string;
  winner_name?: string;
}

export default function Index() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      await initDatabase();
      await loadMatches();
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
          p1.name as player1_name,
          p2.name as player2_name,
          pw.name as winner_name
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
          {item.player1_name} vs {item.player2_name}
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
        {format(new Date(item.date), "d 'de' MMMM, yyyy - HH:mm", { locale: es })}
      </Text>
      {item.winner_name && (
        <Text style={styles.winnerText}>Ganador: {item.winner_name}</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1E3A5F" />
      
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Squash Analyzer</Text>
          <Text style={styles.subtitle}>Análisis de Partidos</Text>
        </View>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => router.push('/settings')}
        >
          <Ionicons name="settings-outline" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Partidos Recientes</Text>
          <TouchableOpacity onPress={() => router.push('/history')}>
            <Text style={styles.viewAllText}>Ver todos</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Cargando...</Text>
          </View>
        ) : matches.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="tennisball-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>No hay partidos registrados</Text>
            <Text style={styles.emptySubtext}>
              Comienza tu primer partido para ver el análisis
            </Text>
          </View>
        ) : (
          <FlatList
            data={matches}
            renderItem={renderMatch}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.matchList}
          />
        )}
      </View>

      <View style={styles.bottomButtons}>
        <TouchableOpacity
          style={styles.newMatchButton}
          onPress={() => router.push('/new-match')}
        >
          <Ionicons name="add-circle" size={28} color="#FFF" />
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
    paddingVertical: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
  },
  subtitle: {
    fontSize: 14,
    color: '#B0BEC5',
    marginTop: 4,
  },
  settingsButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  viewAllText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },
  matchList: {
    paddingHorizontal: 20,
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
    fontWeight: '500',
    color: '#666',
  },
  matchDate: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  winnerText: {
    fontSize: 13,
    color: '#4CAF50',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  bottomButtons: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  newMatchButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  newMatchText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginLeft: 8,
  },
});