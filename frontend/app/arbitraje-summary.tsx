import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { getDatabase } from '@/src/store/database';
import { useLanguage } from '@/src/context/LanguageContext';
import { SyncBanner } from '@/src/components/SyncBanner';
import { format } from 'date-fns';

interface GameDetail {
  game_number: number;
  p1: number;
  p2: number;
  winner: 1 | 2;
}

interface RefereeMatch {
  id: number;
  player1_name: string;
  player2_name: string;
  best_of: number;
  player1_games: number;
  player2_games: number;
  games_detail: string;
  winner_name: string | null;
  date: string;
  duration_seconds: number | null;
  status: string;
}

export default function ArbitrajeSummary() {
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams();
  const id = params.id as string;

  const [data, setData] = useState<RefereeMatch | null>(null);
  const [games, setGames] = useState<GameDetail[]>([]);
  const cardRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      const db = await getDatabase();
      const row = await db.getFirstAsync('SELECT * FROM referee_matches WHERE id = ?', [parseInt(id)]);
      if (row) {
        setData(row as RefereeMatch);
        try { setGames(JSON.parse((row as any).games_detail || '[]')); } catch {}
      }
    })();
  }, [id]);

  const share = async () => {
    try {
      if (!cardRef.current) return;
      const uri = await cardRef.current.capture();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert('No disponible', 'Compartir no está disponible en este dispositivo');
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo compartir');
    }
  };

  if (!data) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={{ padding: 20 }}>Cargando…</Text>
      </SafeAreaView>
    );
  }

  const durationStr = data.duration_seconds
    ? `${Math.floor(data.duration_seconds / 60)}m ${data.duration_seconds % 60}s`
    : '—';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/')} style={styles.backBtn} data-testid="summary-back">
          <Ionicons name="home" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('referee.matchWinner')}</Text>
        <TouchableOpacity onPress={share} style={styles.backBtn} data-testid="summary-share">
          <Ionicons name="share-social" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      <SyncBanner />

      <ScrollView contentContainerStyle={styles.body}>
        <ViewShot ref={cardRef} options={{ format: 'png', quality: 1 }}>
          <View style={styles.card}>
            <Text style={styles.cardSubtitle}>{format(new Date(data.date), 'dd MMM yyyy · HH:mm')}</Text>

            <View style={styles.winnerBlock}>
              <Ionicons name="trophy" size={36} color="#FFD54F" />
              <Text style={styles.winnerName}>{data.winner_name || '—'}</Text>
              <Text style={styles.winnerLabel}>{t('referee.matchWinner')}</Text>
            </View>

            <View style={styles.scoreLine}>
              <Text style={styles.playerName}>{data.player1_name}</Text>
              <Text style={styles.bigScore}>{data.player1_games} – {data.player2_games}</Text>
              <Text style={styles.playerName}>{data.player2_name}</Text>
            </View>

            <Text style={styles.sectionTitle}>{t('referee.gamesDetail')}</Text>
            <View style={styles.gamesTable}>
              {games.map(g => (
                <View key={g.game_number} style={styles.gameRow}>
                  <Text style={styles.gameLabel}>G{g.game_number}</Text>
                  <Text style={[styles.gameScore, g.winner === 1 && styles.gameWinner]}>{g.p1}</Text>
                  <Text style={styles.gameSep}>–</Text>
                  <Text style={[styles.gameScore, g.winner === 2 && styles.gameWinner]}>{g.p2}</Text>
                </View>
              ))}
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.metaText}>{t('referee.duration')}: {durationStr}</Text>
              <Text style={styles.metaText}>BO{data.best_of}</Text>
            </View>
          </View>
        </ViewShot>

        <TouchableOpacity style={styles.newBtn} onPress={() => router.replace('/arbitraje')} data-testid="new-arbitraje-btn">
          <Ionicons name="add-circle" size={22} color="#FFF" />
          <Text style={styles.newBtnText}>{t('referee.newMatch')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#1E3A5F', paddingHorizontal: 10, paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  body: { padding: 16 },
  card: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 22,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  cardSubtitle: { textAlign: 'center', color: '#888', fontSize: 12, marginBottom: 14 },
  winnerBlock: { alignItems: 'center', marginBottom: 16 },
  winnerName: { fontSize: 26, fontWeight: '900', color: '#1E3A5F', marginTop: 6 },
  winnerLabel: { fontSize: 12, color: '#888', marginTop: 2 },
  scoreLine: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#F5F7FA', borderRadius: 10, padding: 14, marginVertical: 8,
  },
  playerName: { fontSize: 16, fontWeight: '700', color: '#1E3A5F', flex: 1, textAlign: 'center' },
  bigScore: { fontSize: 32, fontWeight: '900', color: '#1565C0' },
  sectionTitle: { marginTop: 16, fontSize: 13, fontWeight: '700', color: '#555', marginBottom: 6 },
  gamesTable: { gap: 6 },
  gameRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#FAFAFA', borderRadius: 8,
  },
  gameLabel: { fontWeight: '700', color: '#555', width: 36 },
  gameScore: { fontSize: 18, fontWeight: '700', color: '#444', flex: 1, textAlign: 'center' },
  gameWinner: { color: '#2E7D32' },
  gameSep: { fontSize: 16, color: '#999' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EEE' },
  metaText: { fontSize: 12, color: '#666' },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#2E7D32', borderRadius: 12, padding: 14, marginTop: 18,
  },
  newBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
