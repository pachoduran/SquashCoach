import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  Vibration,
  ActivityIndicator,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { getDatabase } from '@/src/store/database';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { useSync } from '@/src/context/SyncContext';
import { SyncBanner } from '@/src/components/SyncBanner';

type Phase = 'setup' | 'pick-server' | 'playing' | 'rest';
type Side = 'L' | 'R';

interface PointHistory {
  p1: number;
  p2: number;
  server: 1 | 2;
  side: Side;
  scoredBy: 1 | 2;
}

interface GameDetail {
  game_number: number;
  p1: number;
  p2: number;
  winner: 1 | 2;
}

const REST_SECONDS = 90;

export default function ArbitrajeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { syncNow } = useSync();

  // ----- Estado de la pantalla -----
  const [phase, setPhase] = useState<Phase>('setup');
  const [loading, setLoading] = useState(true);

  // Datos del partido en curso (en SQLite cuando phase != 'setup')
  const [localId, setLocalId] = useState<number | null>(null);
  const [p1Name, setP1Name] = useState('');
  const [p2Name, setP2Name] = useState('');
  const [bestOf, setBestOf] = useState<1 | 3 | 5>(3);

  // Marcador
  const [p1Score, setP1Score] = useState(0);
  const [p2Score, setP2Score] = useState(0);
  const [p1Games, setP1Games] = useState(0);
  const [p2Games, setP2Games] = useState(0);
  const [currentGame, setCurrentGame] = useState(1);
  const [serverPlayer, setServerPlayer] = useState<1 | 2>(1);
  const [serverSide, setServerSide] = useState<Side>('R');
  const [gamesDetail, setGamesDetail] = useState<GameDetail[]>([]);
  const [history, setHistory] = useState<PointHistory[]>([]);
  const [matchStartTime, setMatchStartTime] = useState<number>(0);

  // Descanso entre games
  const [restSeconds, setRestSeconds] = useState(REST_SECONDS);
  const restTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Long-press detector
  const longPressTimerRef = useRef<{ [k: string]: NodeJS.Timeout | null }>({});

  // Audio beeps
  const beepRef = useRef<Audio.Sound | null>(null);
  const beepEndRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound: s1 } = await Audio.Sound.createAsync(require('@/assets/beep.wav'));
        beepRef.current = s1;
        const { sound: s2 } = await Audio.Sound.createAsync(require('@/assets/beep-end.wav'));
        beepEndRef.current = s2;
      } catch (e) {
        console.log('[Arbitraje] Audio load error', e);
      }
    })();
    return () => {
      beepRef.current?.unloadAsync().catch(() => {});
      beepEndRef.current?.unloadAsync().catch(() => {});
      if (restTimerRef.current) clearInterval(restTimerRef.current);
    };
  }, []);

  const playBeep = async (end = false) => {
    try {
      const ref = end ? beepEndRef.current : beepRef.current;
      if (ref) { await ref.replayAsync(); }
    } catch {}
    Vibration.vibrate(end ? 500 : 150);
  };

  // ----- Cargar partido en curso al entrar -----
  useFocusEffect(
    useCallback(() => {
      loadInProgress();
    }, [user])
  );

  const loadInProgress = async () => {
    try {
      const db = await getDatabase();
      const row: any = await db.getFirstAsync(
        `SELECT * FROM referee_matches WHERE status = 'in_progress' AND (user_id = ? OR user_id IS NULL OR user_id = '') ORDER BY id DESC LIMIT 1`,
        [user?.user_id || '']
      );
      if (row) {
        setLocalId(row.id);
        setP1Name(row.player1_name);
        setP2Name(row.player2_name);
        setBestOf(row.best_of as 1 | 3 | 5);
        setP1Games(row.player1_games);
        setP2Games(row.player2_games);
        setP1Score(row.current_p1);
        setP2Score(row.current_p2);
        setCurrentGame(row.current_game);
        setServerPlayer(row.server_player as 1 | 2);
        setServerSide(row.server_side as Side);
        try { setGamesDetail(JSON.parse(row.games_detail || '[]')); } catch {}
        const ts = Date.parse(row.date);
        setMatchStartTime(Number.isFinite(ts) ? ts : Date.now());
        setPhase('playing');
      } else {
        setPhase('setup');
      }
    } catch (e) {
      console.log('[Arbitraje] load error', e);
      setPhase('setup');
    } finally {
      setLoading(false);
    }
  };

  // ----- Persistencia: cada cambio relevante se guarda -----
  const persist = async (overrides: Partial<{
    p1: number; p2: number; g1: number; g2: number; game: number;
    sp: 1 | 2; side: Side; gd: GameDetail[]; status: string; winnerName: string | null;
    durationSec: number | null;
  }> = {}) => {
    if (!localId) return;
    try {
      const db = await getDatabase();
      await db.runAsync(
        `UPDATE referee_matches SET 
          current_p1 = ?, current_p2 = ?, player1_games = ?, player2_games = ?,
          current_game = ?, server_player = ?, server_side = ?, games_detail = ?,
          status = ?, winner_name = ?, duration_seconds = ?, synced = 0
         WHERE id = ?`,
        [
          overrides.p1 ?? p1Score,
          overrides.p2 ?? p2Score,
          overrides.g1 ?? p1Games,
          overrides.g2 ?? p2Games,
          overrides.game ?? currentGame,
          overrides.sp ?? serverPlayer,
          overrides.side ?? serverSide,
          JSON.stringify(overrides.gd ?? gamesDetail),
          overrides.status ?? 'in_progress',
          overrides.winnerName ?? null,
          overrides.durationSec ?? null,
          localId,
        ]
      );
    } catch (e) {
      console.log('[Arbitraje] persist error', e);
    }
  };

  // ----- Iniciar partido -----
  const handleStart = () => {
    if (!p1Name.trim() || !p2Name.trim()) {
      Alert.alert(t('common.error') || 'Error', 'Ingresa los 2 nombres');
      return;
    }
    setPhase('pick-server');
  };

  const handlePickServer = async (player: 1 | 2, side: Side) => {
    setServerPlayer(player);
    setServerSide(side);
    setP1Score(0); setP2Score(0);
    setP1Games(0); setP2Games(0);
    setCurrentGame(1);
    setGamesDetail([]);
    setHistory([]);

    const now = Date.now();
    setMatchStartTime(now);

    try {
      const db = await getDatabase();
      const res = await db.runAsync(
        `INSERT INTO referee_matches (
          user_id, player1_name, player2_name, best_of,
          player1_games, player2_games, games_detail,
          current_p1, current_p2, current_game, server_player, server_side,
          status, date, created_at
        ) VALUES (?, ?, ?, ?, 0, 0, '[]', 0, 0, 1, ?, ?, 'in_progress', ?, ?)`,
        [
          user?.user_id || '',
          p1Name.trim(),
          p2Name.trim(),
          bestOf,
          player,
          side,
          new Date(now).toISOString(),
          new Date(now).toISOString(),
        ]
      );
      setLocalId(res.lastInsertRowId);
      setPhase('playing');
    } catch (e) {
      console.log('[Arbitraje] start error', e);
      Alert.alert('Error', 'No se pudo iniciar el partido');
    }
  };

  // ----- Lógica de PARS: un game termina al llegar a 11 con 2 de diferencia -----
  const isGameOver = (a: number, b: number) => (a >= 11 || b >= 11) && Math.abs(a - b) >= 2;

  // ----- Lógica de cambio de lado/sacador después de cada punto -----
  const computeNextServer = (
    scorer: 1 | 2,
    prevServer: 1 | 2,
    prevSide: Side
  ): { server: 1 | 2; side: Side } => {
    if (scorer === prevServer) {
      // Mismo sacador, alterna de lado
      return { server: prevServer, side: prevSide === 'R' ? 'L' : 'R' };
    } else {
      // Cambio de sacador, mantenemos el lado por defecto en R (regla "elige al iniciar")
      return { server: scorer, side: 'R' };
    }
  };

  // ----- Marcar punto -----
  const scorePoint = async (scorer: 1 | 2) => {
    const newP1 = scorer === 1 ? p1Score + 1 : p1Score;
    const newP2 = scorer === 2 ? p2Score + 1 : p2Score;
    const next = computeNextServer(scorer, serverPlayer, serverSide);

    // Guardar historial para deshacer
    setHistory(h => [...h, { p1: p1Score, p2: p2Score, server: serverPlayer, side: serverSide, scoredBy: scorer }]);

    if (isGameOver(newP1, newP2)) {
      // Game terminado
      const winner: 1 | 2 = newP1 > newP2 ? 1 : 2;
      const newGD: GameDetail[] = [...gamesDetail, { game_number: currentGame, p1: newP1, p2: newP2, winner }];
      const newG1 = winner === 1 ? p1Games + 1 : p1Games;
      const newG2 = winner === 2 ? p2Games + 1 : p2Games;
      const gamesToWin = bestOf === 1 ? 1 : (bestOf === 3 ? 2 : 3);

      Vibration.vibrate([0, 200, 100, 200]);
      await playBeep(true);

      setP1Score(newP1); setP2Score(newP2);
      setP1Games(newG1); setP2Games(newG2);
      setGamesDetail(newGD);

      if (newG1 >= gamesToWin || newG2 >= gamesToWin) {
        // Match terminado
        const winnerName = newG1 > newG2 ? p1Name : p2Name;
        const durationSec = Math.round((Date.now() - matchStartTime) / 1000);
        await persist({
          p1: newP1, p2: newP2, g1: newG1, g2: newG2,
          gd: newGD, status: 'finished', winnerName, durationSec,
        });
        // Sync transparente
        syncNow().catch(() => {});
        router.replace({ pathname: '/arbitraje-summary', params: { id: String(localId) } });
        return;
      }

      // Hay otro game, iniciar descanso
      await persist({ p1: newP1, p2: newP2, g1: newG1, g2: newG2, gd: newGD });
      setPhase('rest');
      startRestTimer();
    } else {
      // Punto normal — el sistema asigna lado por defecto (alterna si mismo sacador, R si cambio)
      // El árbitro puede ajustar con los chips L/R sobre la celda del sacador
      setP1Score(newP1); setP2Score(newP2);
      setServerPlayer(next.server); setServerSide(next.side);
      await playBeep(false);
      await persist({ p1: newP1, p2: newP2, sp: next.server, side: next.side });
    }
  };

  // ----- Cambiar manualmente el lado del sacador actual -----
  const setServerSideManual = async (side: Side) => {
    if (side === serverSide) return;
    setServerSide(side);
    await persist({ side });
  };

  // ----- Restar punto (long press) -----
  const subtractPoint = async (player: 1 | 2) => {
    if (player === 1 && p1Score > 0) {
      const newP1 = p1Score - 1;
      setP1Score(newP1);
      Vibration.vibrate([0, 60, 60, 60]);
      await persist({ p1: newP1 });
    } else if (player === 2 && p2Score > 0) {
      const newP2 = p2Score - 1;
      setP2Score(newP2);
      Vibration.vibrate([0, 60, 60, 60]);
      await persist({ p2: newP2 });
    }
  };

  // ----- Deshacer último punto -----
  const undoLastPoint = async () => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory(h => h.slice(0, -1));
    setP1Score(last.p1);
    setP2Score(last.p2);
    setServerPlayer(last.server);
    setServerSide(last.side);
    Vibration.vibrate(80);
    await persist({ p1: last.p1, p2: last.p2, sp: last.server, side: last.side });
  };

  // ----- Touchable handlers con long press para restar -----
  const handlePressIn = (player: 1 | 2) => {
    longPressTimerRef.current[`p${player}`] = setTimeout(() => {
      subtractPoint(player);
      longPressTimerRef.current[`p${player}`] = null;
    }, 600);
  };
  const handlePressOut = (player: 1 | 2) => {
    const t = longPressTimerRef.current[`p${player}`];
    if (t) {
      clearTimeout(t);
      longPressTimerRef.current[`p${player}`] = null;
      scorePoint(player);
    }
  };

  // ----- Timer de descanso -----
  const startRestTimer = () => {
    setRestSeconds(REST_SECONDS);
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    restTimerRef.current = setInterval(() => {
      setRestSeconds(prev => {
        const next = prev - 1;
        // Avisos: a los 60s (=30 transcurridos), 30s y 10s restantes
        if (next === 60 || next === 30) {
          playBeep(false);
        } else if (next <= 10 && next > 0 && next % 2 === 0) {
          playBeep(false);
        } else if (next <= 0) {
          if (restTimerRef.current) clearInterval(restTimerRef.current);
          playBeep(true);
          startNextGame();
          return 0;
        }
        return next;
      });
    }, 1000);
  };

  const startNextGame = async () => {
    setP1Score(0); setP2Score(0);
    setCurrentGame(g => g + 1);
    setHistory([]);
    // Quien ganó el último game inicia el saque del siguiente (lado R por defecto, ajustable con chips)
    const lastGame = gamesDetail[gamesDetail.length - 1];
    const newServer: 1 | 2 = lastGame ? lastGame.winner : serverPlayer;
    setServerPlayer(newServer);
    setServerSide('R');
    setPhase('playing');
    await persist({ p1: 0, p2: 0, game: currentGame + 1, sp: newServer, side: 'R' });
  };

  const skipRest = async () => {
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    await startNextGame();
  };

  // ----- Cancelar arbitraje -----
  const cancelMatch = () => {
    Alert.alert('', t('referee.cancelConfirm'), [
      { text: t('common.cancel') || 'Cancelar' },
      {
        text: 'Sí',
        style: 'destructive',
        onPress: async () => {
          if (localId) {
            const db = await getDatabase();
            await db.runAsync('DELETE FROM referee_matches WHERE id = ?', [localId]);
          }
          setLocalId(null);
          setPhase('setup');
          setP1Name(''); setP2Name('');
        },
      },
    ]);
  };

  // ----- Finalizar manualmente (terminar antes) -----
  const finishEarly = () => {
    Alert.alert(t('referee.finishMatch'), '¿Terminar el partido ahora?', [
      { text: t('common.cancel') || 'Cancelar' },
      {
        text: 'Sí',
        onPress: async () => {
          const winnerName = p1Games > p2Games ? p1Name : (p2Games > p1Games ? p2Name : p1Name);
          const durationSec = Math.round((Date.now() - matchStartTime) / 1000);
          await persist({ status: 'finished', winnerName, durationSec });
          syncNow().catch(() => {});
          router.replace({ pathname: '/arbitraje-summary', params: { id: String(localId) } });
        },
      },
    ]);
  };

  // ====================================================================
  // RENDER
  // ====================================================================

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#1E3A5F" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  // ---- SETUP ----
  if (phase === 'setup') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="arbitraje-back">
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('referee.newMatch')}</Text>
          <TouchableOpacity
            onPress={() => router.push('/arbitraje-history')}
            style={styles.backBtn}
            data-testid="arbitraje-history-btn"
          >
            <Ionicons name="time-outline" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>

        <SyncBanner />

        <ScrollView contentContainerStyle={styles.setupBody}>
          <Text style={styles.label}>{t('referee.player1Name')}</Text>
          <TextInput
            value={p1Name}
            onChangeText={setP1Name}
            style={styles.input}
            placeholder="Jugador 1"
            placeholderTextColor="#999"
            data-testid="ref-p1-name"
          />
          <Text style={styles.label}>{t('referee.player2Name')}</Text>
          <TextInput
            value={p2Name}
            onChangeText={setP2Name}
            style={styles.input}
            placeholder="Jugador 2"
            placeholderTextColor="#999"
            data-testid="ref-p2-name"
          />

          <Text style={styles.label}>{t('referee.format')}</Text>
          <View style={styles.formatRow}>
            {([1, 3, 5] as const).map(n => (
              <TouchableOpacity
                key={n}
                style={[styles.formatBtn, bestOf === n && styles.formatBtnActive]}
                onPress={() => setBestOf(n)}
                data-testid={`ref-bestof-${n}`}
              >
                <Text style={[styles.formatBtnText, bestOf === n && styles.formatBtnTextActive]}>
                  {n === 1 ? t('referee.singleSet') : (n === 3 ? t('referee.bestOf3') : t('referee.bestOf5'))}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.startBtn} onPress={handleStart} data-testid="ref-start-btn">
            <Ionicons name="play" size={22} color="#FFF" />
            <Text style={styles.startBtnText}>{t('referee.start')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.historyBigBtn}
            onPress={() => router.push('/arbitraje-history')}
            data-testid="ref-history-big-btn"
          >
            <Ionicons name="time-outline" size={22} color="#1E3A5F" />
            <Text style={styles.historyBigBtnText}>{t('referee.history')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ---- PICK SERVER ----
  if (phase === 'pick-server') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setPhase('setup')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('referee.whoServes')}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.pickServerBody}>
          {([1, 2] as const).map(pl => (
            <View key={pl} style={styles.pickRow}>
              <Text style={styles.pickPlayerName}>{pl === 1 ? p1Name : p2Name}</Text>
              <View style={styles.sideRow}>
                <TouchableOpacity
                  style={styles.sideBtn}
                  onPress={() => handlePickServer(pl, 'L')}
                  data-testid={`pick-${pl}-L`}
                >
                  <Text style={styles.sideBtnText}>← {t('referee.leftSide')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.sideBtn}
                  onPress={() => handlePickServer(pl, 'R')}
                  data-testid={`pick-${pl}-R`}
                >
                  <Text style={styles.sideBtnText}>{t('referee.rightSide')} →</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  // ---- REST ----
  if (phase === 'rest') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.restBody}>
          <Text style={styles.restLabel}>{t('referee.restingTime')}</Text>
          <Text style={styles.restCountdown}>{restSeconds}s</Text>
          <Text style={styles.restGames}>{p1Name} {p1Games} – {p2Games} {p2Name}</Text>
          <TouchableOpacity style={styles.skipRestBtn} onPress={skipRest} data-testid="skip-rest-btn">
            <Text style={styles.skipRestText}>Iniciar siguiente game</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ---- PLAYING ----
  const isP1Serving = serverPlayer === 1;
  // Sólo se puede elegir lado al inicio del game o tras un cambio de saque
  const canPickSide = history.length === 0 || history[history.length - 1].server !== serverPlayer;

  // Lista acumulada de puntos (estado DESPUÉS de cada punto) para la evolución
  const evolution = history.map((h, i) => {
    const newP1 = h.p1 + (h.scoredBy === 1 ? 1 : 0);
    const newP2 = h.p2 + (h.scoredBy === 2 ? 1 : 0);
    return { idx: i + 1, p1: newP1, p2: newP2, scoredBy: h.scoredBy };
  }).slice().reverse(); // último arriba

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.playHeader}>
        <TouchableOpacity onPress={cancelMatch} style={styles.iconBtn} data-testid="cancel-arbitraje-btn">
          <Ionicons name="close" size={22} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.gameLabel}>{t('referee.game')} {currentGame}</Text>
          <Text style={styles.gamesLine}>
            {p1Name} {p1Games} – {p2Games} {p2Name}  · BO{bestOf}
          </Text>
        </View>
        <TouchableOpacity onPress={undoLastPoint} style={styles.iconBtn} disabled={history.length === 0} data-testid="undo-btn">
          <Ionicons name="arrow-undo" size={22} color={history.length === 0 ? '#666' : '#FFF'} />
        </TouchableOpacity>
      </View>

      {/* Marcador grande arriba con botones L/R */}
      <View style={styles.scoreboard}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.scoreCell, styles.scoreCellP1]}
          onPressIn={() => handlePressIn(1)}
          onPressOut={() => handlePressOut(1)}
          data-testid="ref-score-p1"
        >
          {isP1Serving && (
            <View style={styles.sideToggleRow} pointerEvents="box-none">
              <TouchableOpacity
                style={[styles.sideToggleBox, styles.sideToggleBoxL, serverSide === 'L' && styles.sideToggleBoxLActive, !canPickSide && styles.sideToggleBoxLocked]}
                onPress={(e) => { e.stopPropagation?.(); if (canPickSide) setServerSideManual('L'); }}
                disabled={!canPickSide}
                data-testid="ref-p1-side-L"
              >
                <Text style={[styles.sideToggleText, serverSide !== 'L' && styles.sideToggleTextDim]}>L</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sideToggleBox, styles.sideToggleBoxR, serverSide === 'R' && styles.sideToggleBoxRActive, !canPickSide && styles.sideToggleBoxLocked]}
                onPress={(e) => { e.stopPropagation?.(); if (canPickSide) setServerSideManual('R'); }}
                disabled={!canPickSide}
                data-testid="ref-p1-side-R"
              >
                <Text style={[styles.sideToggleText, serverSide !== 'R' && styles.sideToggleTextDim]}>R</Text>
              </TouchableOpacity>
            </View>
          )}
          <Text style={styles.scorePlayerName}>{p1Name}</Text>
          <Text style={[styles.scoreBig, styles.scoreBigP1]}>{p1Score}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.scoreCell, styles.scoreCellP2]}
          onPressIn={() => handlePressIn(2)}
          onPressOut={() => handlePressOut(2)}
          data-testid="ref-score-p2"
        >
          {!isP1Serving && (
            <View style={styles.sideToggleRow} pointerEvents="box-none">
              <TouchableOpacity
                style={[styles.sideToggleBox, styles.sideToggleBoxL, serverSide === 'L' && styles.sideToggleBoxLActive, !canPickSide && styles.sideToggleBoxLocked]}
                onPress={(e) => { e.stopPropagation?.(); if (canPickSide) setServerSideManual('L'); }}
                disabled={!canPickSide}
                data-testid="ref-p2-side-L"
              >
                <Text style={[styles.sideToggleText, serverSide !== 'L' && styles.sideToggleTextDim]}>L</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sideToggleBox, styles.sideToggleBoxR, serverSide === 'R' && styles.sideToggleBoxRActive, !canPickSide && styles.sideToggleBoxLocked]}
                onPress={(e) => { e.stopPropagation?.(); if (canPickSide) setServerSideManual('R'); }}
                disabled={!canPickSide}
                data-testid="ref-p2-side-R"
              >
                <Text style={[styles.sideToggleText, serverSide !== 'R' && styles.sideToggleTextDim]}>R</Text>
              </TouchableOpacity>
            </View>
          )}
          <Text style={styles.scorePlayerName}>{p2Name}</Text>
          <Text style={[styles.scoreBig, styles.scoreBigP2]}>{p2Score}</Text>
        </TouchableOpacity>
      </View>

      {/* Evolución del partido (línea central) */}
      <View style={styles.evolutionWrap}>
        <View style={styles.evolutionHeader}>
          <Text style={[styles.evolutionHeaderText, { color: '#42A5F5' }]}>{p1Name}</Text>
          <Text style={[styles.evolutionHeaderText, { color: '#FFD54F' }]}>{p2Name}</Text>
        </View>
        <View style={styles.evolutionList}>
          {evolution.length === 0 ? (
            <Text style={styles.evolutionEmpty}>{t('referee.tapToScore')}</Text>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {evolution.map((p) => (
                <View key={p.idx} style={styles.evolutionRow}>
                  <View style={styles.evolutionLeft}>
                    {p.scoredBy === 1 && (
                      <Text style={[styles.evolutionPoint, { color: '#42A5F5' }]}>{p.p1}</Text>
                    )}
                  </View>
                  <View style={styles.evolutionCenterLine} />
                  <View style={styles.evolutionRight}>
                    {p.scoredBy === 2 && (
                      <Text style={[styles.evolutionPoint, { color: '#FFD54F' }]}>{p.p2}</Text>
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.finishBtn} onPress={finishEarly} data-testid="finish-early-btn">
          <Ionicons name="flag" size={18} color="#FFF" />
          <Text style={styles.finishText}>{t('referee.finishMatch')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E3A5F',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  setupBody: { padding: 20, backgroundColor: '#F5F7FA', flexGrow: 1 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginTop: 12, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: '#DDD', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: '#FFF',
  },
  formatRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  formatBtn: {
    flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#DDD',
    alignItems: 'center', backgroundColor: '#FFF',
  },
  formatBtnActive: { backgroundColor: '#1E3A5F', borderColor: '#1E3A5F' },
  formatBtnText: { fontSize: 14, fontWeight: '600', color: '#444' },
  formatBtnTextActive: { color: '#FFF' },
  startBtn: {
    marginTop: 30, backgroundColor: '#2E7D32', borderRadius: 12,
    paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  startBtnText: { color: '#FFF', fontSize: 18, fontWeight: '700' },

  // Pick server
  pickServerBody: { padding: 20, gap: 20, marginTop: 20 },
  pickRow: { backgroundColor: '#FFF', borderRadius: 12, padding: 16 },
  pickPlayerName: { fontSize: 18, fontWeight: '700', color: '#1E3A5F', marginBottom: 10, textAlign: 'center' },
  sideRow: { flexDirection: 'row', gap: 10 },
  sideBtn: { flex: 1, backgroundColor: '#1565C0', padding: 14, borderRadius: 10, alignItems: 'center' },
  sideBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  // Playing
  playHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#000', paddingHorizontal: 10, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#222',
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  headerCenter: { flex: 1, alignItems: 'center' },
  gameLabel: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  gamesLine: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  scoreboard: {
    flexDirection: 'row',
    backgroundColor: '#000',
    borderBottomWidth: 1, borderBottomColor: '#222',
  },
  scoreCell: {
    flex: 1, alignItems: 'center', justifyContent: 'flex-end',
    position: 'relative',
    height: 220,
    paddingTop: 100,
    paddingBottom: 16,
  },
  scoreCellP1: { backgroundColor: '#000', borderRightWidth: 1, borderRightColor: '#222' },
  scoreCellP2: { backgroundColor: '#000' },
  scorePlayerName: { color: '#FFF', fontSize: 16, fontWeight: '700', marginBottom: 0 },
  scoreBig: { fontSize: 110, fontWeight: '900', lineHeight: 120 },
  scoreBigP1: { color: '#42A5F5' },
  scoreBigP2: { color: '#FFD54F' },
  scoreHint: { position: 'absolute', bottom: 4, color: 'rgba(255,255,255,0.4)', fontSize: 10 },

  // Toggle L / R en la parte superior de la celda del sacador
  sideToggleRow: {
    position: 'absolute', top: 12, flexDirection: 'row', gap: 10, zIndex: 10,
  },
  sideToggleBox: {
    width: 75, height: 75, borderRadius: 12,
    borderWidth: 3,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  sideToggleBoxL: { borderColor: 'rgba(244,67,54,0.6)' },
  sideToggleBoxR: { borderColor: 'rgba(76,175,80,0.6)' },
  sideToggleBoxLActive: { backgroundColor: '#F44336', borderColor: '#F44336' },
  sideToggleBoxRActive: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  // Bloqueado: el árbitro NO puede cambiar el lado en mitad de un saque
  sideToggleBoxLocked: { opacity: 0.45 },
  sideToggleText: { color: '#FFF', fontSize: 36, fontWeight: '900' },
  sideToggleTextDim: { color: 'rgba(255,255,255,0.65)' },

  // Evolución del partido
  evolutionWrap: { flex: 1, backgroundColor: '#000' },
  evolutionHeader: {
    flexDirection: 'row', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#222',
  },
  evolutionHeaderText: {
    flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', letterSpacing: 1,
  },
  evolutionList: { flex: 1 },
  evolutionEmpty: {
    color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 20, fontSize: 12,
  },
  evolutionRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 3,
  },
  evolutionLeft: {
    flex: 1, alignItems: 'flex-end', paddingRight: 12,
  },
  evolutionRight: {
    flex: 1, alignItems: 'flex-start', paddingLeft: 12,
  },
  evolutionCenterLine: {
    width: 2, backgroundColor: '#333', alignSelf: 'stretch',
  },
  evolutionPoint: {
    fontSize: 22, fontWeight: '900',
  },

  bottomBar: { padding: 10, alignItems: 'center', backgroundColor: '#000', borderTopWidth: 1, borderTopColor: '#222' },
  finishBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF6F00',
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, gap: 6,
  },
  finishText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  // Rest
  restBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, backgroundColor: '#1E3A5F' },
  restLabel: { color: '#FFD54F', fontSize: 22, fontWeight: '600', marginBottom: 10 },
  restCountdown: { color: '#FFF', fontSize: 110, fontWeight: '900' },
  restGames: { color: '#FFF', fontSize: 18, marginTop: 20 },
  skipRestBtn: { marginTop: 40, backgroundColor: '#2E7D32', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  skipRestText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  // Botón grande de Historial bajo Start
  historyBigBtn: {
    marginTop: 14, backgroundColor: '#FFF', borderWidth: 2, borderColor: '#1E3A5F',
    borderRadius: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 10,
  },
  historyBigBtnText: { color: '#1E3A5F', fontSize: 18, fontWeight: '700' },
});
