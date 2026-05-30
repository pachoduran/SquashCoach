import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Vibration,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '@/src/context/LanguageContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================================
// AUDIO LAZY LOAD
// ============================================================================

type Sample = { sound: any } | null;
const samples: Record<string, Sample> = {
  tick: null,
  accent: null,
  kick: null,
  snare: null,
  hihat: null,
};

async function loadSamples() {
  try {
    // @ts-ignore
    const ExpoAv = require('expo-av');
    if (!ExpoAv?.Audio?.Sound) return;
    try {
      await ExpoAv.Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
      });
    } catch (_e) {}

    const files: Record<string, any> = {
      tick: require('../assets/sounds/tick.wav'),
      accent: require('../assets/sounds/accent.wav'),
      kick: require('../assets/sounds/kick.wav'),
      snare: require('../assets/sounds/snare.wav'),
      hihat: require('../assets/sounds/hihat.wav'),
    };

    for (const key of Object.keys(files)) {
      if (samples[key]) continue;
      try {
        const r = await ExpoAv.Audio.Sound.createAsync(files[key], {
          volume: 1.0,
          shouldPlay: false,
        });
        samples[key] = r;
      } catch (_e) {}
    }
  } catch (_e) {}
}

async function unloadSamples() {
  for (const key of Object.keys(samples)) {
    try {
      await samples[key]?.sound?.unloadAsync();
    } catch (_e) {}
    samples[key] = null;
  }
}

function playSample(key: string) {
  const s = samples[key];
  if (!s) return;
  try {
    s.sound.setPositionAsync(0).then(() => s.sound.playAsync()).catch(() => {});
  } catch (_e) {}
}

// ============================================================================
// PATTERNS
// ============================================================================

type Mode = 'metronome' | 'drums';

// Cada patron es de 4 beats. Para cada beat indicamos que samples sonar.
// Subdivisiones para hi-hats (8th notes) usan offsets de 0.5
type Hit = { offset: number; sample: string };

function getPattern(mode: Mode, beatIndex: number): string[] {
  if (mode === 'metronome') {
    return beatIndex % 4 === 0 ? ['accent'] : ['tick'];
  }
  // drums: 4/4 estandar
  // Beat 0 (downbeat): kick + hihat
  // Beat 1: hihat
  // Beat 2: snare + hihat
  // Beat 3: hihat
  if (beatIndex % 4 === 0) return ['kick', 'hihat'];
  if (beatIndex % 4 === 2) return ['snare', 'hihat'];
  return ['hihat'];
}

// ============================================================================
// PRESETS
// ============================================================================

interface Preset {
  id: string;
  nameKey: string;
  bpmStart: number;
  bpmEnd?: number;   // si se define -> progresivo
  durationSec: number;
  mode: Mode;
  icon: string;
  color: string;
}

const PRESETS: Preset[] = [
  { id: 'warmup',     nameKey: 'rhythm.presets.warmup',     bpmStart: 80,  durationSec: 120, mode: 'metronome', icon: 'walk',         color: '#43A047' },
  { id: 'steady',     nameKey: 'rhythm.presets.steady',     bpmStart: 110, durationSec: 180, mode: 'drums',     icon: 'pulse',        color: '#1E88E5' },
  { id: 'resistance', nameKey: 'rhythm.presets.resistance', bpmStart: 130, durationSec: 240, mode: 'drums',     icon: 'flame',        color: '#FB8C00' },
  { id: 'sprint',     nameKey: 'rhythm.presets.sprint',     bpmStart: 170, durationSec: 60,  mode: 'drums',     icon: 'flash',        color: '#E53935' },
  { id: 'pyramid',    nameKey: 'rhythm.presets.pyramid',    bpmStart: 90,  bpmEnd: 160,      durationSec: 240, mode: 'drums',         icon: 'trending-up',  color: '#8E24AA' },
  { id: 'taper',      nameKey: 'rhythm.presets.taper',      bpmStart: 160, bpmEnd: 80,       durationSec: 180, mode: 'drums',         icon: 'trending-down',color: '#00897B' },
];

const LEVELS = [
  { nameKey: 'rhythm.levels.slow',     bpm: 80 },
  { nameKey: 'rhythm.levels.medium',   bpm: 110 },
  { nameKey: 'rhythm.levels.fast',     bpm: 140 },
  { nameKey: 'rhythm.levels.veryFast', bpm: 170 },
];

const DURATIONS = [30, 60, 90, 120, 150, 180, 210, 240]; // segundos

const STORAGE_KEY = 'squashcoach_rhythm_config_v1';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function RhythmScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [mode, setMode] = useState<Mode>('drums');
  const [bpm, setBpm] = useState(120);
  const [bpmEnd, setBpmEnd] = useState<number | null>(null); // null => no progresivo
  const [duration, setDuration] = useState(120); // segundos
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [currentBpm, setCurrentBpm] = useState(120);
  const [beatPulse, setBeatPulse] = useState(0); // 0..3 que beat suena

  const timeoutRef = useRef<any>(null);
  const startedAtRef = useRef<number>(0);
  const beatIndexRef = useRef(0);
  const elapsedTimerRef = useRef<any>(null);

  // Load saved config
  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(STORAGE_KEY);
        if (v) {
          const c = JSON.parse(v);
          if (c.mode) setMode(c.mode);
          if (typeof c.bpm === 'number') setBpm(c.bpm);
          if (typeof c.duration === 'number') setDuration(c.duration);
          if (c.bpmEnd === null || typeof c.bpmEnd === 'number') setBpmEnd(c.bpmEnd);
        }
      } catch (_e) {}
      loadSamples();
    })();
    return () => {
      stopAll();
      unloadSamples();
    };
  }, []);

  const saveConfig = useCallback(async (data: any) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_e) {}
  }, []);

  useEffect(() => {
    saveConfig({ mode, bpm, duration, bpmEnd });
  }, [mode, bpm, duration, bpmEnd]);

  const stopAll = () => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    if (elapsedTimerRef.current) { clearInterval(elapsedTimerRef.current); elapsedTimerRef.current = null; }
    setRunning(false);
    setBeatPulse(-1);
  };

  const computeCurrentBpm = (elapsedSec: number): number => {
    if (bpmEnd === null) return bpm;
    if (duration <= 0) return bpm;
    const t = Math.min(1, elapsedSec / duration);
    return Math.round(bpm + (bpmEnd - bpm) * t);
  };

  const tickBeat = () => {
    const now = Date.now();
    const elapsedSec = (now - startedAtRef.current) / 1000;
    if (elapsedSec >= duration) {
      // Fin
      Vibration.vibrate([0, 300, 100, 300]);
      stopAll();
      setElapsed(duration);
      return;
    }

    const beat = beatIndexRef.current;
    const beatInBar = beat % 4;
    setBeatPulse(beatInBar);

    // Reproducir samples del patron
    const hits = getPattern(mode, beat);
    hits.forEach((h) => playSample(h));

    // Vibracion fuerte en el downbeat
    if (beatInBar === 0) {
      try { Vibration.vibrate(40); } catch (_e) {}
    }

    beatIndexRef.current = beat + 1;

    // Calcular intervalo del proximo beat (BPM puede cambiar si progresivo)
    const bpmNow = computeCurrentBpm(elapsedSec);
    setCurrentBpm(bpmNow);
    const intervalMs = 60000 / bpmNow;

    timeoutRef.current = setTimeout(tickBeat, intervalMs);
  };

  const start = () => {
    if (running) return;
    setRunning(true);
    beatIndexRef.current = 0;
    startedAtRef.current = Date.now();
    setElapsed(0);
    setCurrentBpm(bpm);
    // Empieza inmediatamente con el primer beat
    tickBeat();
    // Timer de elapsed visible cada 100ms
    elapsedTimerRef.current = setInterval(() => {
      const e = Math.min(duration, Math.floor((Date.now() - startedAtRef.current) / 1000));
      setElapsed(e);
    }, 200);
  };

  const stop = () => {
    stopAll();
    setElapsed(0);
  };

  const applyPreset = (p: Preset) => {
    stopAll();
    setMode(p.mode);
    setBpm(p.bpmStart);
    setBpmEnd(p.bpmEnd ?? null);
    setDuration(p.durationSec);
  };

  const setLevel = (lvl: typeof LEVELS[0]) => {
    if (running) return;
    setBpm(lvl.bpm);
    setBpmEnd(null);
  };

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const bgGradient = running ? '#0D47A1' : '#1A237E';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgGradient }]}>
      <StatusBar barStyle="light-content" backgroundColor={bgGradient} />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => { stopAll(); router.back(); }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          data-testid="rhythm-back"
        >
          <Ionicons name="chevron-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('rhythm.title')}</Text>
        <View style={{ width: 28 }} />
      </View>

      {running ? (
        // ====================== PANTALLA EN VIVO ======================
        <View style={styles.runContainer}>
          <Text style={styles.bigBpm} data-testid="rhythm-current-bpm">
            {currentBpm}
          </Text>
          <Text style={styles.bpmLabel}>BPM</Text>

          <View style={styles.beatDotsRow}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  styles.beatDot,
                  beatPulse === i && (i === 0 ? styles.beatDotAccent : styles.beatDotActive),
                ]}
              />
            ))}
          </View>

          <View style={styles.elapsedRow}>
            <Text style={styles.elapsedText}>{fmtTime(elapsed)}</Text>
            <Text style={styles.elapsedSep}>/</Text>
            <Text style={styles.elapsedTotal}>{fmtTime(duration)}</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(elapsed / duration) * 100}%` }]} />
          </View>

          {bpmEnd !== null && (
            <Text style={styles.progressiveText}>
              {bpm} → {bpmEnd} BPM
            </Text>
          )}

          <TouchableOpacity style={styles.stopBtn} onPress={stop} data-testid="rhythm-stop">
            <Ionicons name="stop" size={32} color="#FFF" />
            <Text style={styles.stopBtnText}>{t('rhythm.stop')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // ====================== PANTALLA DE CONFIG ======================
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* MODO */}
          <Text style={styles.sectionTitle}>{t('rhythm.soundType')}</Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'metronome' && styles.modeBtnActive]}
              onPress={() => setMode('metronome')}
              data-testid="rhythm-mode-metronome"
            >
              <Ionicons name="musical-note-outline" size={22} color={mode === 'metronome' ? '#1A237E' : '#FFF'} />
              <Text style={[styles.modeBtnText, mode === 'metronome' && styles.modeBtnTextActive]}>{t('rhythm.metronome')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'drums' && styles.modeBtnActive]}
              onPress={() => setMode('drums')}
              data-testid="rhythm-mode-drums"
            >
              <Ionicons name="musical-notes" size={22} color={mode === 'drums' ? '#1A237E' : '#FFF'} />
              <Text style={[styles.modeBtnText, mode === 'drums' && styles.modeBtnTextActive]}>{t('rhythm.beat')}</Text>
            </TouchableOpacity>
          </View>

          {/* BPM */}
          <Text style={styles.sectionTitle}>{t('rhythm.speed')}</Text>
          <View style={styles.bpmCard}>
            <View style={styles.bpmRow}>
              <TouchableOpacity
                style={styles.bpmStep}
                onPress={() => setBpm(Math.max(40, bpm - 5))}
              >
                <Ionicons name="remove" size={28} color="#FFF" />
              </TouchableOpacity>
              <View style={styles.bpmDisplay}>
                <Text style={styles.bpmValue} data-testid="rhythm-bpm">{bpm}</Text>
                <Text style={styles.bpmUnit}>BPM</Text>
              </View>
              <TouchableOpacity
                style={styles.bpmStep}
                onPress={() => setBpm(Math.min(220, bpm + 5))}
              >
                <Ionicons name="add" size={28} color="#FFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.levelsRow}>
              {LEVELS.map((lvl) => (
                <TouchableOpacity
                  key={lvl.nameKey}
                  style={[styles.levelChip, bpm === lvl.bpm && styles.levelChipActive]}
                  onPress={() => setLevel(lvl)}
                >
                  <Text style={[styles.levelChipText, bpm === lvl.bpm && styles.levelChipTextActive]}>
                    {t(lvl.nameKey)}
                  </Text>
                  <Text style={[styles.levelChipBpm, bpm === lvl.bpm && styles.levelChipTextActive]}>
                    {lvl.bpm}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.progressiveBlock}>
              <View style={styles.progressiveHeader}>
                <Text style={styles.label}>{t('rhythm.progressive')}</Text>
                <TouchableOpacity
                  style={[styles.toggle, bpmEnd !== null && styles.toggleActive]}
                  onPress={() => setBpmEnd(bpmEnd === null ? bpm + 30 : null)}
                >
                  <View style={[styles.toggleKnob, bpmEnd !== null && styles.toggleKnobActive]} />
                </TouchableOpacity>
              </View>
              {bpmEnd !== null && (
                <View style={styles.bpmRow}>
                  <TouchableOpacity
                    style={styles.bpmStepSmall}
                    onPress={() => setBpmEnd(Math.max(40, bpmEnd - 5))}
                  >
                    <Ionicons name="remove" size={20} color="#FFF" />
                  </TouchableOpacity>
                  <View style={styles.bpmDisplaySmall}>
                    <Text style={styles.bpmValueSmall}>{bpm} → {bpmEnd}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.bpmStepSmall}
                    onPress={() => setBpmEnd(Math.min(220, bpmEnd + 5))}
                  >
                    <Ionicons name="add" size={20} color="#FFF" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* DURACION */}
          <Text style={styles.sectionTitle}>{t('rhythm.duration')}</Text>
          <View style={styles.durationsWrap}>
            {DURATIONS.map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.durationChip, duration === d && styles.durationChipActive]}
                onPress={() => setDuration(d)}
              >
                <Text style={[styles.durationChipText, duration === d && styles.durationChipTextActive]}>
                  {fmtTime(d)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* PRESETS */}
          <Text style={styles.sectionTitle}>{t('rhythm.programs')}</Text>
          <View style={styles.presetsGrid}>
            {PRESETS.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.presetCard, { backgroundColor: p.color }]}
                onPress={() => applyPreset(p)}
                data-testid={`rhythm-preset-${p.id}`}
              >
                <Ionicons name={p.icon as any} size={26} color="#FFF" />
                <Text style={styles.presetName}>{t(p.nameKey)}</Text>
                <Text style={styles.presetMeta}>
                  {p.bpmEnd ? `${p.bpmStart}→${p.bpmEnd}` : `${p.bpmStart}`} BPM
                </Text>
                <Text style={styles.presetMeta}>{fmtTime(p.durationSec)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* START */}
          <TouchableOpacity style={styles.startBtn} onPress={start} data-testid="rhythm-start">
            <Ionicons name="play" size={32} color="#1A237E" />
            <Text style={styles.startBtnText}>{t('rhythm.start')}</Text>
          </TouchableOpacity>

          <View style={{ height: 30 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  scrollContent: { padding: 16, paddingBottom: 30 },
  sectionTitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 10,
  },
  label: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 10 },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  modeBtnActive: { backgroundColor: '#FFF', borderColor: '#FFF' },
  modeBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  modeBtnTextActive: { color: '#1A237E' },

  bpmCard: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: 14,
  },
  bpmRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bpmStep: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.20)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bpmStepSmall: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.20)',
    justifyContent: 'center', alignItems: 'center',
  },
  bpmDisplay: {
    flex: 1, alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.20)',
    borderRadius: 10,
    paddingVertical: 8,
  },
  bpmDisplaySmall: {
    flex: 1, alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.20)',
    borderRadius: 8,
    paddingVertical: 6,
  },
  bpmValue: { color: '#FFF', fontSize: 42, fontWeight: '900', fontVariant: ['tabular-nums'] },
  bpmValueSmall: { color: '#FFF', fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  bpmUnit: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  levelsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  levelChip: {
    flex: 1,
    minWidth: '22%',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
  },
  levelChipActive: { backgroundColor: '#FFD600' },
  levelChipText: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600' },
  levelChipBpm: { color: '#FFF', fontSize: 14, fontWeight: '700', marginTop: 2 },
  levelChipTextActive: { color: '#1A237E' },
  progressiveBlock: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)' },
  progressiveHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  toggle: {
    width: 44, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.20)',
    padding: 3, justifyContent: 'center',
  },
  toggleActive: { backgroundColor: '#FFD600' },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF' },
  toggleKnobActive: { transform: [{ translateX: 18 }] },

  durationsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  durationChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  durationChipActive: { backgroundColor: '#FFD600' },
  durationChipText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  durationChipTextActive: { color: '#1A237E' },

  presetsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  presetCard: {
    width: (SCREEN_WIDTH - 32 - 10) / 2,
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
    gap: 4,
  },
  presetName: { color: '#FFF', fontSize: 14, fontWeight: '800', marginTop: 4 },
  presetMeta: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '600' },

  startBtn: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#FFF',
    paddingVertical: 18,
    borderRadius: 14,
    shadowColor: '#000', shadowOpacity: 0.25, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 6,
  },
  startBtnText: { color: '#1A237E', fontSize: 22, fontWeight: '900', letterSpacing: 1.5 },

  // ============ RUN MODE ============
  runContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  bigBpm: {
    color: '#FFF',
    fontSize: Math.floor(SCREEN_WIDTH * 0.45),
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    lineHeight: Math.floor(SCREEN_WIDTH * 0.50),
  },
  bpmLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 24, fontWeight: '800', letterSpacing: 4, marginTop: 4 },
  beatDotsRow: { flexDirection: 'row', gap: 18, marginTop: 30 },
  beatDot: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  beatDotActive: { backgroundColor: '#FFF', transform: [{ scale: 1.3 }] },
  beatDotAccent: { backgroundColor: '#FFD600', transform: [{ scale: 1.5 }] },
  elapsedRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 30 },
  elapsedText: { color: '#FFF', fontSize: 32, fontWeight: '900', fontVariant: ['tabular-nums'] },
  elapsedSep: { color: 'rgba(255,255,255,0.5)', fontSize: 26, fontWeight: '600' },
  elapsedTotal: { color: 'rgba(255,255,255,0.65)', fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
  progressBar: {
    width: SCREEN_WIDTH * 0.75,
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 5,
    overflow: 'hidden',
    marginTop: 12,
  },
  progressFill: { height: '100%', backgroundColor: '#FFD600' },
  progressiveText: { color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 8, fontWeight: '600' },
  stopBtn: {
    marginTop: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 26,
    borderRadius: 30,
    backgroundColor: '#D32F2F',
  },
  stopBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16, letterSpacing: 1.5 },
});
