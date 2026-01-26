import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getDatabase } from '@/store/database';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Match {
  id: number;
  player1_name: string;
  player2_name: string;
  date: string;
  status: string;
  winner_name?: string;
  player1_games: number;
  player2_games: number;
}

export default function History() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllMatches();
  }, []);

  const loadAllMatches = async () => {
    try {
      const db = await getDatabase();
      const result = await db.getAllAsync(`
        SELECT 
          m.id,
          m.date,
          m.status,
          m.player1_games,
          m.player2_games,
          p1.name as player1_name,
          p2.name as player2_name,
          pw.name as winner_name
        FROM matches m
        JOIN players p1 ON m.player1_id = p1.id
        JOIN players p2 ON m.player2_id = p2.id
        LEFT JOIN players pw ON m.winner_id = pw.id
        ORDER BY m.date DESC
      `);
      setMatches(result as Match[]);
    } catch (error) {
      console.error('Error cargando historial:', error);
    } finally {
      setLoading(false);
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
      
      {item.status === 'finished' && (
        <>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreText}>
              {item.player1_name}: {item.player1_games} - {item.player2_name}: {item.player2_games}
            </Text>
          </View>
          {item.winner_name && (
            <Text style={styles.winnerText}>Ganador: {item.winner_name}</Text>
          )}
        </>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Historial de Partidos</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Cargando...</Text>
        </View>
      ) : matches.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="tennisball-outline" size={64} color="#CCC" />
          <Text style={styles.emptyText}>No hay partidos registrados</Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          renderItem={renderMatch}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.matchList}
        />
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
  matchList: {
    paddingHorizontal: 20,
    paddingTop: 20,
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
    marginBottom: 8,
  },
  scoreRow: {
    marginBottom: 4,
  },
  scoreText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
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
});