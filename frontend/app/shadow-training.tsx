import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Vibration,
  ScrollView,
  Alert,
  Dimensions,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { getDatabase } from '@/src/store/database';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { syncService } from '@/src/store/syncService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COURT_WIDTH = SCREEN_WIDTH * 0.95;
const COURT_HEIGHT = COURT_WIDTH * 1.51; // Ratio real de la imagen

// 12 zonas como un reloj sobre la cancha (posiciones exactas de la imagen del usuario)
const ZONES_12: { id: number; x: number; y: number }[] = [
  { id: 1,  x: 0.88, y: 0.05 },
  { id: 2,  x: 0.88, y: 0.27 },
  { id: 3,  x: 0.88, y: 0.47 },
  { id: 4,  x: 0.88, y: 0.68 },
  { id: 5,  x: 0.88, y: 0.85 },
  { id: 6,  x: 0.48, y: 0.93 },
  { id: 7,  x: 0.10, y: 0.90 },
  { id: 8,  x: 0.10, y: 0.68 },
  { id: 9,  x: 0.10, y: 0.47 },
  { id: 10, x: 0.10, y: 0.27 },
  { id: 11, x: 0.10, y: 0.05 },
  { id: 12, x: 0.48, y: 0.05 },
];

// 6 zonas (esquinas y laterales como en la imagen del usuario)
const ZONES_6: { id: number; x: number; y: number }[] = [
  { id: 1, x: 0.88, y: 0.05 },
  { id: 2, x: 0.88, y: 0.47 },
  { id: 3, x: 0.88, y: 0.93 },
  { id: 4, x: 0.10, y: 0.93 },
  { id: 5, x: 0.10, y: 0.47 },
  { id: 6, x: 0.10, y: 0.05 },
];

const INTERVAL_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 8, 10];
const DURATION_OPTIONS = [30, 45, 60, 90, 120, 180];
const REST_OPTIONS = [10, 15, 20, 30, 45, 60];
const SETS_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10];

type Phase = 'config' | 'countdown' | 'active' | 'rest' | 'complete';

export default function ShadowTraining() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    zoneMode?: string;
    intervalTime?: string;
    setDuration?: string;
    restDuration?: string;
    numberOfSets?: string;
  }>();
  const { user } = useAuth();
  const { t } = useLanguage();
  const soundRef = useRef<Audio.Sound | null>(null);
  const soundStartRef = useRef<Audio.Sound | null>(null);
  const soundEndRef = useRef<Audio.Sound | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const zoneTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Config (with prefill support from route params)
  const [zoneMode, setZoneMode] = useState<6 | 12>(
    params.zoneMode === '12' ? 12 : 6
  );
  const [intervalTime, setIntervalTime] = useState(
    params.intervalTime ? parseFloat(params.intervalTime) : 4
  );
  const [setDuration, setSetDuration] = useState(
    params.setDuration ? parseInt(params.setDuration, 10) : 60
  );
  const [restDuration, setRestDuration] = useState(
    params.restDuration ? parseInt(params.restDuration, 10) : 30
  );
  const [numberOfSets, setNumberOfSets] = useState(
    params.numberOfSets ? parseInt(params.numberOfSets, 10) : 3
  );

  // Runtime
  const [phase, setPhase] = useState<Phase>('config');
  const [countdownVal, setCountdownVal] = useState(3);
  const [activeZone, setActiveZone] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [zonesVisited, setZonesVisited] = useState(0);
  const [totalZonesVisited, setTotalZonesVisited] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Load sounds
  useEffect(() => {
    const loadSounds = async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound: s1 } = await Audio.Sound.createAsync(require('@/assets/beep.wav'));
        soundRef.current = s1;
        const { sound: s2 } = await Audio.Sound.createAsync(require('@/assets/beep-start.wav'));
        soundStartRef.current = s2;
        const { sound: s3 } = await Audio.Sound.createAsync(require('@/assets/beep-end.wav'));
        soundEndRef.current = s3;
      } catch (e) {
        console.log('[Shadow] Error loading sounds:', e);
      }
    };
    loadSounds();
    return () => {
      soundRef.current?.unloadAsync();
      soundStartRef.current?.unloadAsync();
      soundEndRef.current?.unloadAsync();
      if (timerRef.current) clearInterval(timerRef.current);
      if (zoneTimerRef.current) clearInterval(zoneTimerRef.current);
    };
  }, []);

  const playBeep = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.setPositionAsync(0);
        await soundRef.current.playAsync();
      }
      Vibration.vibrate(200);
    } catch (e) {
      Vibration.vibrate(200);
    }
  };

  const playStartBeep = async () => {
    try {
      if (soundStartRef.current) {
        await soundStartRef.current.setPositionAsync(0);
        await soundStartRef.current.playAsync();
      }
      Vibration.vibrate(500);
    } catch (e) {
      Vibration.vibrate(500);
    }
  };

  const playEndBeep = async () => {
    try {
      if (soundEndRef.current) {
        await soundEndRef.current.setPositionAsync(0);
        await soundEndRef.current.playAsync();
      }
      Vibration.vibrate(800);
    } catch (e) {
      Vibration.vibrate(800);
    }
  };

  const getRandomZone = (currentZone: number | null): number => {
    const zones = zoneMode === 6 ? ZONES_6 : ZONES_12;
    let newZone: number;
    do {
      newZone = zones[Math.floor(Math.random() * zones.length)].id;
    } while (newZone === currentZone && zones.length > 1);
    return newZone;
  };

  // START TRAINING
  const startTraining = () => {
    Alert.alert(
      t('shadow.volumeTitle'),
      t('shadow.volumeMsg'),
      [{ text: t('shadow.understood'), onPress: () => {
        setPhase('countdown');
        setCountdownVal(3);
        setCurrentSet(1);
        setTotalZonesVisited(0);
      }}]
    );
  };

  // Countdown phase
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdownVal <= 0) {
      beginSet();
      return;
    }
    const t = setTimeout(() => {
      playBeep();
      setCountdownVal(prev => prev - 1);
    }, 1000);
    return () => clearTimeout(t);
  }, [phase, countdownVal]);

  const beginSet = () => {
    setPhase('active');
    setTimeRemaining(setDuration);
    setZonesVisited(0);
    const firstZone = getRandomZone(null);
    setActiveZone(firstZone);
    setZonesVisited(1);
    setTotalZonesVisited(prev => prev + 1);
    playStartBeep();
  };

  // Active phase - main timer
  useEffect(() => {
    if (phase !== 'active' || isPaused) return;
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          onSetFinished();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, isPaused, currentSet]);

  // Active phase - zone changes
  useEffect(() => {
    if (phase !== 'active' || isPaused) return;
    zoneTimerRef.current = setInterval(() => {
      const newZone = getRandomZone(activeZone);
      setActiveZone(newZone);
      setZonesVisited(prev => prev + 1);
      setTotalZonesVisited(prev => prev + 1);
      playBeep();
    }, intervalTime * 1000);
    return () => {
      if (zoneTimerRef.current) clearInterval(zoneTimerRef.current);
    };
  }, [phase, isPaused, intervalTime, activeZone]);

  const onSetFinished = () => {
    playEndBeep();
    if (currentSet >= numberOfSets) {
      setPhase('complete');
      setActiveZone(null);
    } else {
      setPhase('rest');
      setTimeRemaining(restDuration);
      setActiveZone(null);
    }
  };

  // Rest phase timer
  useEffect(() => {
    if (phase !== 'rest') return;
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          setCurrentSet(s => s + 1);
          setCountdownVal(3);
          setPhase('countdown');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  const togglePause = () => setIsPaused(prev => !prev);

  const stopTraining = () => {
    Alert.alert(t('shadow.stopTitle'), t('shadow.stopMsg'), [
      { text: t('common.no'), style: 'cancel' },
      {
        text: t('common.yes'),
        style: 'destructive',
        onPress: () => {
          if (timerRef.current) clearInterval(timerRef.current);
          if (zoneTimerRef.current) clearInterval(zoneTimerRef.current);
          setPhase('complete');
          setActiveZone(null);
        },
      },
    ]);
  };

  const saveRoutine = async () => {
    try {
      const db = await getDatabase();
      const nowIso = new Date().toISOString();
      const result = await db.runAsync(
        `INSERT INTO shadow_routines (user_id, date, zone_mode, interval_time, set_duration, rest_duration, number_of_sets, completed_sets, total_zones_visited, created_at, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          user?.user_id || '',
          nowIso,
          zoneMode,
          intervalTime,
          setDuration,
          restDuration,
          numberOfSets,
          currentSet,
          totalZonesVisited,
          nowIso,
        ]
      );
      console.log('[Shadow] Rutina guardada local id:', result.lastInsertRowId);
      Alert.alert(t('shadow.saved'), t('shadow.savedMsg'));
      // Fire-and-forget cloud sync
      syncService.syncShadowRoutines().catch(() => {});
      router.replace('/sombras');
    } catch (e) {
      console.error('[Shadow] Error saving:', e);
      Alert.alert('Error', t('shadow.saveError'));
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ===================== RENDER =====================

  const renderCourt = () => {
    const zones = zoneMode === 6 ? ZONES_6 : ZONES_12;
    const zoneSize = zoneMode === 6 ? 44 : 36;

    return (
      <ImageBackground
        source={require('@/assets/court-shadow.png')}
        style={[courtStyles.court, { width: COURT_WIDTH, height: COURT_HEIGHT }]}
        imageStyle={{ borderRadius: 4 }}
        resizeMode="cover"
      >
        {/* Zones */}
        {zones.map(zone => {
          const isActive = activeZone === zone.id;
          const left = zone.x * COURT_WIDTH - zoneSize / 2;
          const top = zone.y * COURT_HEIGHT - zoneSize / 2;

          return (
            <View
              key={zone.id}
              style={[
                courtStyles.zone,
                {
                  width: zoneSize,
                  height: zoneSize,
                  borderRadius: zoneSize / 2,
                  left,
                  top,
                },
                isActive && courtStyles.zoneActive,
                !isActive && phase === 'active' && courtStyles.zoneInactive,
              ]}
            >
              <Text style={[
                courtStyles.zoneLabel,
                isActive && courtStyles.zoneLabelActive,
                { fontSize: zoneMode === 6 ? 18 : 14 },
              ]}>
                {zone.id}
              </Text>
            </View>
          );
        })}
        {/* Numero gigante en el centro de la cancha durante ejecucion */}
        {phase === 'active' && activeZone !== null && !isPaused && (
          <View style={courtStyles.centerNumberWrap} pointerEvents="none">
            <Text style={courtStyles.centerNumber} adjustsFontSizeToFit numberOfLines={1}>
              {activeZone}
            </Text>
          </View>
        )}
      </ImageBackground>
    );
  };

  // CONFIG PHASE
  if (phase === 'config') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="shadow-back-btn">
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('shadow.title')}</Text>
          <TouchableOpacity
            onPress={() => router.push('/shadow-history')}
            style={styles.backBtn}
            data-testid="shadow-history-link"
          >
            <Ionicons name="time-outline" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.configScroll} showsVerticalScrollIndicator={false}>
          {/* Zone mode */}
          <Text style={styles.configLabel}>{t('shadow.zones')}</Text>
          <View style={styles.optionRow}>
            <TouchableOpacity
              style={[styles.optionBtn, zoneMode === 6 && styles.optionBtnActive]}
              onPress={() => setZoneMode(6)}
              data-testid="zone-mode-6"
            >
              <Text style={[styles.optionText, zoneMode === 6 && styles.optionTextActive]}>{t('shadow.zones6')}</Text>
              <Text style={[styles.optionSub, zoneMode === 6 && styles.optionSubActive]}>{t('shadow.oddZones')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.optionBtn, zoneMode === 12 && styles.optionBtnActive]}
              onPress={() => setZoneMode(12)}
              data-testid="zone-mode-12"
            >
              <Text style={[styles.optionText, zoneMode === 12 && styles.optionTextActive]}>{t('shadow.zones12')}</Text>
              <Text style={[styles.optionSub, zoneMode === 12 && styles.optionSubActive]}>{t('shadow.fullClock')}</Text>
            </TouchableOpacity>
          </View>

          {/* Preview */}
          <View style={styles.previewContainer}>
            {renderCourt()}
          </View>

          {/* Interval */}
          <Text style={styles.configLabel}>{t('shadow.timeBetween')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {INTERVAL_OPTIONS.map(v => (
              <TouchableOpacity
                key={v}
                style={[styles.chip, intervalTime === v && styles.chipActive]}
                onPress={() => setIntervalTime(v)}
              >
                <Text style={[styles.chipText, intervalTime === v && styles.chipTextActive]}>{v}s</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Set duration */}
          <Text style={styles.configLabel}>{t('shadow.setDuration')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {DURATION_OPTIONS.map(v => (
              <TouchableOpacity
                key={v}
                style={[styles.chip, setDuration === v && styles.chipActive]}
                onPress={() => setSetDuration(v)}
              >
                <Text style={[styles.chipText, setDuration === v && styles.chipTextActive]}>{formatTime(v)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Rest duration */}
          <Text style={styles.configLabel}>{t('shadow.restDuration')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {REST_OPTIONS.map(v => (
              <TouchableOpacity
                key={v}
                style={[styles.chip, restDuration === v && styles.chipActive]}
                onPress={() => setRestDuration(v)}
              >
                <Text style={[styles.chipText, restDuration === v && styles.chipTextActive]}>{v}s</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Number of sets */}
          <Text style={styles.configLabel}>{t('shadow.numberOfSets')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {SETS_OPTIONS.map(v => (
              <TouchableOpacity
                key={v}
                style={[styles.chip, numberOfSets === v && styles.chipActive]}
                onPress={() => setNumberOfSets(v)}
              >
                <Text style={[styles.chipText, numberOfSets === v && styles.chipTextActive]}>{v}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>{t('shadow.summary')}</Text>
            <Text style={styles.summaryLine}>{numberOfSets} {t('shadow.setsX')} {formatTime(setDuration)}</Text>
            <Text style={styles.summaryLine}>{t('shadow.restBetween')} {restDuration}s</Text>
            <Text style={styles.summaryLine}>{t('shadow.zoneChange')} {intervalTime}s</Text>
            <Text style={styles.summaryTotal}>
              {t('shadow.totalTime')}: ~{formatTime(numberOfSets * setDuration + (numberOfSets - 1) * restDuration)}
            </Text>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.startButton} onPress={startTraining} data-testid="start-shadow-btn">
            <Ionicons name="play-circle" size={26} color="#FFF" />
            <Text style={styles.startButtonText}>{t('shadow.startTraining')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // COUNTDOWN PHASE
  if (phase === 'countdown') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#1E3A5F' }]}>
        <View style={styles.countdownContainer}>
          <Text style={styles.countdownSetLabel}>{t('shadow.prepareSet')} {currentSet} {t('shadow.prepareOf')} {numberOfSets}</Text>
          <Text style={styles.countdownNumber}>{countdownVal > 0 ? countdownVal : 'GO!'}</Text>
          <Text style={styles.countdownSubtext}>{t('shadow.prepare')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ACTIVE + REST PHASES
  if (phase === 'active' || phase === 'rest') {
    return (
      <SafeAreaView style={[styles.container, phase === 'rest' ? { backgroundColor: '#263238' } : {}]}>
        {/* Top bar */}
        <View style={styles.trainingHeader}>
          <View style={styles.trainingInfo}>
            <Text style={styles.trainingSetText}>Serie {currentSet}/{numberOfSets}</Text>
            <View style={[styles.phaseBadge, phase === 'rest' ? { backgroundColor: '#FF9800' } : { backgroundColor: '#4CAF50' }]}>
              <Text style={styles.phaseBadgeText}>{phase === 'active' ? t('shadow.active') : t('shadow.rest')}</Text>
            </View>
          </View>
          <Text style={styles.trainingTimer}>{formatTime(timeRemaining)}</Text>
        </View>

        {/* Court */}
        <View style={styles.courtContainer}>
          {phase === 'active' ? (
            renderCourt()
          ) : (
            <View style={styles.restDisplay}>
              <Ionicons name="cafe-outline" size={60} color="#FF9800" />
              <Text style={styles.restText}>{t('shadow.restText')}</Text>
              <Text style={styles.restTimer}>{formatTime(timeRemaining)}</Text>
              <Text style={styles.restNext}>{t('shadow.nextSet')}</Text>
            </View>
          )}
        </View>

        {/* Stats bar - sin Mode durante ejecucion, solo Zones e Interval mas grandes */}
        {phase === 'active' && (
          <View style={styles.statsBar}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{zonesVisited}</Text>
              <Text style={styles.statLabel}>{t('shadow.zonesLabel')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{intervalTime}s</Text>
              <Text style={styles.statLabel}>{t('shadow.intervalLabel')}</Text>
            </View>
          </View>
        )}

        {/* Controls */}
        <View style={styles.controlsRow}>
          <TouchableOpacity style={styles.controlBtn} onPress={stopTraining} data-testid="stop-shadow-btn">
            <Ionicons name="stop-circle" size={28} color="#F44336" />
            <Text style={[styles.controlLabel, { color: '#F44336' }]}>{t('shadow.stop')}</Text>
          </TouchableOpacity>
          {phase === 'active' && (
            <TouchableOpacity style={styles.controlBtn} onPress={togglePause} data-testid="pause-shadow-btn">
              <Ionicons name={isPaused ? 'play-circle' : 'pause-circle'} size={28} color="#FFF" />
              <Text style={styles.controlLabel}>{isPaused ? t('shadow.resume') : t('shadow.pause')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // COMPLETE PHASE
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('shadow.complete')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.completeScroll} contentContainerStyle={styles.completeContent}>
        <Ionicons name="checkmark-circle" size={80} color="#4CAF50" style={{ alignSelf: 'center', marginBottom: 16 }} />
        <Text style={styles.completeTitle}>{t('shadow.wellDone')}</Text>

        <View style={styles.completeCard}>
          <View style={styles.completeRow}>
            <Text style={styles.completeLabel}>{t('shadow.zonesMode')}</Text>
            <Text style={styles.completeValue}>{zoneMode} ({t('shadow.clock')})</Text>
          </View>
          <View style={styles.completeRow}>
            <Text style={styles.completeLabel}>{t('shadow.setsCompleted')}</Text>
            <Text style={styles.completeValue}>{currentSet} / {numberOfSets}</Text>
          </View>
          <View style={styles.completeRow}>
            <Text style={styles.completeLabel}>{t('shadow.durationPerSet')}</Text>
            <Text style={styles.completeValue}>{formatTime(setDuration)}</Text>
          </View>
          <View style={styles.completeRow}>
            <Text style={styles.completeLabel}>{t('shadow.restBetweenSets')}</Text>
            <Text style={styles.completeValue}>{restDuration}s</Text>
          </View>
          <View style={styles.completeRow}>
            <Text style={styles.completeLabel}>{t('shadow.zoneInterval')}</Text>
            <Text style={styles.completeValue}>{intervalTime}s</Text>
          </View>
          <View style={styles.completeDivider} />
          <View style={styles.completeRow}>
            <Text style={styles.completeLabelBold}>{t('shadow.totalZones')}</Text>
            <Text style={styles.completeValueBold}>{totalZonesVisited}</Text>
          </View>
          <View style={styles.completeRow}>
            <Text style={styles.completeLabelBold}>{t('shadow.totalTimeLabel')}</Text>
            <Text style={styles.completeValueBold}>
              ~{formatTime(currentSet * setDuration + Math.max(0, currentSet - 1) * restDuration)}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.saveButton} onPress={saveRoutine} data-testid="save-shadow-btn">
          <Ionicons name="save" size={22} color="#FFF" />
          <Text style={styles.saveButtonText}>{t('shadow.saveRoutine')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ===================== COURT STYLES =====================
const courtStyles = StyleSheet.create({
  court: {
    borderRadius: 4,
    position: 'relative',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  zone: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  zoneActive: {
    backgroundColor: '#FF5722',
    borderColor: '#FFF',
    shadowColor: '#FF5722',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 10,
    transform: [{ scale: 1.2 }],
  },
  zoneInactive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.25)',
  },
  zoneLabel: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  zoneLabelActive: {
    fontSize: 22,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  centerNumberWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerNumber: {
    fontSize: COURT_WIDTH * 0.55,
    fontWeight: '900',
    color: '#FF5722',
    textShadowColor: 'rgba(255,255,255,0.95)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
    fontVariant: ['tabular-nums'],
  },
});

// ===================== STYLES =====================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    backgroundColor: '#1E3A5F',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  backBtn: {
    padding: 4,
    width: 40,
  },
  headerTitle: {
    flex: 1,
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // CONFIG
  configScroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  configLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    marginTop: 18,
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  optionBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#DDD',
    backgroundColor: '#FFF',
    alignItems: 'center',
  },
  optionBtnActive: {
    borderColor: '#2196F3',
    backgroundColor: '#E3F2FD',
  },
  optionText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  optionTextActive: {
    color: '#1565C0',
  },
  optionSub: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  optionSubActive: {
    color: '#1976D2',
  },
  previewContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  chipScroll: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#DDD',
    marginRight: 8,
    minWidth: 54,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  chipTextActive: {
    color: '#FFF',
  },
  summaryCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  summaryLine: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  summaryTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196F3',
    marginTop: 8,
  },
  // FOOTER
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  startButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  // COUNTDOWN
  countdownContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownSetLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  countdownNumber: {
    color: '#FFF',
    fontSize: 120,
    fontWeight: '900',
  },
  countdownSubtext: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 20,
    marginTop: 20,
  },
  // TRAINING
  trainingHeader: {
    backgroundColor: '#1E3A5F',
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trainingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trainingSetText: {
    color: '#FFF',
    fontSize: 30,
    fontWeight: '800',
  },
  phaseBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  phaseBadgeText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  trainingTimer: {
    color: '#FFF',
    fontSize: 56,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  courtContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 2,
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 56,
    fontWeight: '900',
    color: '#1E3A5F',
  },
  statLabel: {
    fontSize: 18,
    color: '#666',
    fontWeight: '700',
    letterSpacing: 1,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    paddingVertical: 8,
    backgroundColor: '#1E3A5F',
  },
  controlBtn: {
    alignItems: 'center',
    gap: 2,
  },
  controlLabel: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },
  // REST
  restDisplay: {
    alignItems: 'center',
    gap: 12,
  },
  restText: {
    color: '#FF9800',
    fontSize: 24,
    fontWeight: 'bold',
  },
  restTimer: {
    color: '#FFF',
    fontSize: 80,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  restNext: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
  // COMPLETE
  completeScroll: {
    flex: 1,
  },
  completeContent: {
    padding: 20,
  },
  completeTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  completeCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  completeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  completeLabel: {
    fontSize: 14,
    color: '#666',
  },
  completeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  completeDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 8,
  },
  completeLabelBold: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },
  completeValueBold: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  saveButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
});
