import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Vibration,
  Platform,
  StatusBar,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '@/src/context/LanguageContext';

// Funciones opcionales: si expo-keep-awake no esta disponible, no pasa nada.
async function keepAwakeOn() {
  try {
    // @ts-ignore
    const m = require('expo-keep-awake');
    if (m && typeof m.activateKeepAwakeAsync === 'function') {
      await m.activateKeepAwakeAsync();
    }
  } catch (_e) {}
}

function keepAwakeOff() {
  try {
    // @ts-ignore
    const m = require('expo-keep-awake');
    if (m && typeof m.deactivateKeepAwake === 'function') {
      m.deactivateKeepAwake();
    }
  } catch (_e) {}
}

type Phase = 'idle' | 'preparing' | 'work' | 'rest' | 'cycle_rest' | 'done';

interface Config {
  workSec: number;
  restSec: number;
  prepSec: number;
  rounds: number;
  cycles: number;
  cycleRestSec: number;
}

const DEFAULTS: Config = {
  workSec: 30,
  restSec: 15,
  prepSec: 3,
  rounds: 8,
  cycles: 1,
  cycleRestSec: 60,
};

const STORAGE_KEY = 'squashcoach_timer_config_v1';

const COLORS = {
  work: '#2E7D32',       // verde
  rest: '#C62828',       // rojo (descanso)
  prep: '#F57C00',       // naranja (ultimos segundos)
  cycleRest: '#6A1B9A',  // morado
  done: '#37474F',       // gris
  idle: '#263238',
};

function fmt(s: number): string {
  const m = Math.floor(Math.max(0, s) / 60);
  const sec = Math.max(0, s) % 60;
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// "00:00" = 5 chars. En monospace cada char ~0.55 de fontSize.
// Queremos que el texto ocupe ~85% del ancho.
const BIG_TIME_FONT = Math.floor((SCREEN_WIDTH * 0.85) / (5 * 0.55));

function vibrateBeep() {
  // Pito fuerte de 1 segundo (perceptible como un pitazo)
  try {
    if (Platform.OS === 'android') {
      Vibration.vibrate(300);
    } else {
      Vibration.vibrate();
    }
  } catch (_e) {}
}

function vibrateLong() {
  // Cambio de fase: vibracion doble fuerte
  try {
    if (Platform.OS === 'android') {
      Vibration.vibrate([0, 500, 150, 500]);
    } else {
      Vibration.vibrate();
    }
  } catch (_e) {}
}

// Sonidos: assets locales del proyecto
let _soundShort: any = null;
let _soundLong: any = null;
let _soundsLoaded = false;

async function loadSounds() {
  if (_soundsLoaded) return;
  try {
    // @ts-ignore
    const ExpoAv = require('expo-av');
    if (!ExpoAv || !ExpoAv.Audio) return;
    try {
      await ExpoAv.Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
      });
    } catch (_e) {}
    try {
      const s1 = await ExpoAv.Audio.Sound.createAsync(
        require('../assets/sounds/beep.wav'),
        { volume: 1.0, shouldPlay: false }
      );
      _soundShort = s1.sound;
    } catch (_e) {}
    try {
      const s2 = await ExpoAv.Audio.Sound.createAsync(
        require('../assets/sounds/beep_long.wav'),
        { volume: 1.0, shouldPlay: false }
      );
      _soundLong = s2.sound;
    } catch (_e) {}
    _soundsLoaded = true;
  } catch (_e) {}
}

async function unloadSounds() {
  try {
    if (_soundShort) { await _soundShort.unloadAsync(); _soundShort = null; }
    if (_soundLong) { await _soundLong.unloadAsync(); _soundLong = null; }
    _soundsLoaded = false;
  } catch (_e) {}
}

function playShort() {
  vibrateBeep();
  if (_soundShort) {
    _soundShort.replayAsync().catch(() => {});
  }
}

function playLong() {
  vibrateLong();
  if (_soundLong) {
    _soundLong.replayAsync().catch(() => {});
  }
}

export default function TimerScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [config, setConfig] = useState<Config>(DEFAULTS);
  const [phase, setPhase] = useState<Phase>('idle');
  const [remaining, setRemaining] = useState(0);
  const [currentRound, setCurrentRound] = useState(1);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<any>(null);
  const phaseRef = useRef<Phase>('idle');
  const remainingRef = useRef(0);
  const roundRef = useRef(1);
  const cycleRef = useRef(1);

  // Cargar config guardado
  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(STORAGE_KEY);
        if (v) {
          const parsed = JSON.parse(v);
          setConfig({ ...DEFAULTS, ...parsed });
        }
      } catch (_e) {
        // ignore
      }
      loadSounds();
    })();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      keepAwakeOff();
      unloadSounds();
    };
  }, []);

  const saveConfig = useCallback(async (c: Config) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(c));
    } catch (_e) {
      // ignore
    }
  }, []);

  const updateConfig = (key: keyof Config, value: number) => {
    const v = Math.max(0, Math.floor(value || 0));
    const next = { ...config, [key]: v };
    setConfig(next);
    saveConfig(next);
  };

  const startTimer = async () => {
    // Validacion minima
    if (config.workSec < 1 || config.rounds < 1 || config.cycles < 1) {
      return;
    }
    await keepAwakeOn();
    phaseRef.current = 'work';
    remainingRef.current = config.workSec;
    roundRef.current = 1;
    cycleRef.current = 1;
    setPhase('work');
    setRemaining(config.workSec);
    setCurrentRound(1);
    setCurrentCycle(1);
    setRunning(true);
    playLong(); // arranque
    startInterval();
  };

  const startInterval = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(tick, 1000);
  };

  const tick = () => {
    let r = remainingRef.current - 1;
    const prepThreshold = config.prepSec;

    // Beep en los ultimos segundos de la fase (cuando r entra al rango prep)
    if (r > 0 && r <= prepThreshold) {
      playShort();
    }

    if (r > 0) {
      remainingRef.current = r;
      setRemaining(r);
      return;
    }

    // r llego a 0 -> transicion
    advancePhase();
  };

  const advancePhase = () => {
    const ph = phaseRef.current;
    const { workSec, restSec, rounds, cycles, cycleRestSec } = config;
    if (ph === 'work') {
      // Termino una serie de trabajo
      if (roundRef.current < rounds) {
        // Hay siguiente ronda, va a descanso
        phaseRef.current = 'rest';
        remainingRef.current = restSec > 0 ? restSec : 1;
        setPhase('rest');
        setRemaining(remainingRef.current);
        playLong();
      } else {
        // Termino la ultima ronda del ciclo
        if (cycleRef.current < cycles) {
          phaseRef.current = 'cycle_rest';
          remainingRef.current = cycleRestSec > 0 ? cycleRestSec : 1;
          setPhase('cycle_rest');
          setRemaining(remainingRef.current);
          playLong();
        } else {
          // Termino todo
          finishAll();
        }
      }
    } else if (ph === 'rest') {
      // Siguiente ronda
      roundRef.current = roundRef.current + 1;
      setCurrentRound(roundRef.current);
      phaseRef.current = 'work';
      remainingRef.current = workSec;
      setPhase('work');
      setRemaining(workSec);
      playLong();
    } else if (ph === 'cycle_rest') {
      // Siguiente ciclo
      cycleRef.current = cycleRef.current + 1;
      roundRef.current = 1;
      setCurrentCycle(cycleRef.current);
      setCurrentRound(1);
      phaseRef.current = 'work';
      remainingRef.current = workSec;
      setPhase('work');
      setRemaining(workSec);
      playLong();
    }
  };

  const finishAll = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    phaseRef.current = 'done';
    setPhase('done');
    setRemaining(0);
    setRunning(false);
    playLong();
    keepAwakeOff();
  };

  const pause = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setRunning(false);
  };

  const resume = () => {
    setRunning(true);
    startInterval();
  };

  const reset = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    phaseRef.current = 'idle';
    remainingRef.current = 0;
    roundRef.current = 1;
    cycleRef.current = 1;
    setPhase('idle');
    setRemaining(0);
    setCurrentRound(1);
    setCurrentCycle(1);
    setRunning(false);
    keepAwakeOff();
  };

  const phaseLabel = (): string => {
    switch (phase) {
      case 'idle': return t('timer.ready');
      case 'work': {
        if (remaining > 0 && remaining <= config.prepSec) return t('timer.prepare');
        return t('timer.work');
      }
      case 'rest': {
        if (remaining > 0 && remaining <= config.prepSec) return t('timer.prepare');
        return t('timer.rest');
      }
      case 'cycle_rest': {
        if (remaining > 0 && remaining <= config.prepSec) return t('timer.prepare');
        return t('timer.cycleRestPhase');
      }
      case 'done': return t('timer.completed');
      default: return '';
    }
  };

  const phaseColor = (): string => {
    if (phase === 'idle') return COLORS.idle;
    if (phase === 'done') return COLORS.done;
    if (remaining > 0 && remaining <= config.prepSec && phase !== 'cycle_rest') return COLORS.prep;
    if (phase === 'work') return COLORS.work;
    if (phase === 'rest') return COLORS.rest;
    if (phase === 'cycle_rest') return COLORS.cycleRest;
    return COLORS.idle;
  };

  const isConfigMode = phase === 'idle' || phase === 'done';
  const bgColor = phaseColor();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
      <StatusBar barStyle="light-content" backgroundColor={bgColor} />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (running) pause();
            router.back();
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          data-testid="timer-back"
        >
          <Ionicons name="chevron-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('timer.title')}</Text>
        <View style={{ width: 28 }} />
      </View>

      {isConfigMode ? (
        <ScrollView
          contentContainerStyle={styles.configScroll}
          showsVerticalScrollIndicator={false}
        >
          {phase === 'done' ? (
            <View style={styles.doneBanner}>
              <Ionicons name="trophy" size={48} color="#FFD700" />
              <Text style={styles.doneText}>{t('timer.completedMsg')}</Text>
            </View>
          ) : null}

          <View style={styles.configCard}>
            <Text style={styles.configTitle}>{t('timer.configuration')}</Text>

            <ConfigRow
              label={t("timer.workTime")}
              value={config.workSec}
              onChange={(v) => updateConfig('workSec', v)}
              testID="cfg-work"
            />
            <ConfigRow
              label={t("timer.restTime")}
              value={config.restSec}
              onChange={(v) => updateConfig('restSec', v)}
              testID="cfg-rest"
            />
            <ConfigRow
              label={t("timer.prepTime")}
              value={config.prepSec}
              onChange={(v) => updateConfig('prepSec', v)}
              testID="cfg-prep"
            />
            <ConfigRow
              label={t("timer.rounds")}
              value={config.rounds}
              onChange={(v) => updateConfig('rounds', v)}
              testID="cfg-rounds"
            />
            <ConfigRow
              label={t("timer.cycles")}
              value={config.cycles}
              onChange={(v) => updateConfig('cycles', v)}
              testID="cfg-cycles"
            />
            <ConfigRow
              label={t("timer.cycleRest")}
              value={config.cycleRestSec}
              onChange={(v) => updateConfig('cycleRestSec', v)}
              testID="cfg-cycle-rest"
            />

            <View style={styles.summaryBox}>
              <Text style={styles.summaryText}>
                {config.cycles} ciclo{config.cycles !== 1 ? 's' : ''} × {config.rounds} ronda{config.rounds !== 1 ? 's' : ''}
              </Text>
              <Text style={styles.summarySub}>
                Duración estimada: {fmt(estimateTotal(config))}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.startBtn}
            onPress={startTimer}
            data-testid="timer-start"
          >
            <Ionicons name="play" size={32} color="#FFF" />
            <Text style={styles.startBtnText}>{t('timer.start')}</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <View style={styles.runContainer}>
          <Text style={styles.phaseLabel} data-testid="timer-phase">
            {phaseLabel()}
          </Text>

          <Text
            style={styles.bigTime}
            data-testid="timer-time"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {fmt(remaining)}
          </Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>{t('timer.round')}</Text>
              <Text style={styles.metaValue}>
                {currentRound}/{config.rounds}
              </Text>
            </View>
            <View style={styles.metaSep} />
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>{t('timer.cycle')}</Text>
              <Text style={styles.metaValue}>
                {currentCycle}/{config.cycles}
              </Text>
            </View>
          </View>

          <View style={styles.controlsRow}>
            <TouchableOpacity
              style={[styles.ctrlBtn, styles.ctrlBtnGhost]}
              onPress={reset}
              data-testid="timer-reset"
            >
              <Ionicons name="stop" size={28} color="#FFF" />
              <Text style={styles.ctrlBtnText}>{t('timer.stop')}</Text>
            </TouchableOpacity>

            {running ? (
              <TouchableOpacity
                style={styles.ctrlBtnMain}
                onPress={pause}
                data-testid="timer-pause"
              >
                <Ionicons name="pause" size={36} color="#222" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.ctrlBtnMain}
                onPress={resume}
                data-testid="timer-resume"
              >
                <Ionicons name="play" size={36} color="#222" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.ctrlBtn, styles.ctrlBtnGhost]}
              onPress={() => advancePhase()}
              data-testid="timer-skip"
            >
              <Ionicons name="play-skip-forward" size={28} color="#FFF" />
              <Text style={styles.ctrlBtnText}>{t('timer.skip')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function estimateTotal(c: Config): number {
  const perCycle = c.workSec * c.rounds + c.restSec * Math.max(0, c.rounds - 1);
  return perCycle * c.cycles + c.cycleRestSec * Math.max(0, c.cycles - 1);
}

interface ConfigRowProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  testID?: string;
}

const ConfigRow: React.FC<ConfigRowProps> = ({ label, value, onChange, testID }) => {
  return (
    <View style={styles.configRow}>
      <Text style={styles.configLabel}>{label}</Text>
      <View style={styles.configInputWrap}>
        <TouchableOpacity
          style={styles.stepBtn}
          onPress={() => onChange(value - 1)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="remove" size={20} color="#FFF" />
        </TouchableOpacity>
        <TextInput
          style={styles.configInput}
          value={String(value)}
          onChangeText={(t) => onChange(parseInt(t || '0', 10))}
          keyboardType="number-pad"
          data-testid={testID}
        />
        <TouchableOpacity
          style={styles.stepBtn}
          onPress={() => onChange(value + 1)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="add" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

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
  configScroll: { padding: 16, paddingBottom: 40 },
  doneBanner: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 14,
  },
  doneText: { color: '#FFF', fontSize: 18, fontWeight: '700', marginTop: 8 },
  configCard: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
  },
  configTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  configRow: { marginBottom: 14 },
  configLabel: { color: '#FFF', fontSize: 13, marginBottom: 6, fontWeight: '600' },
  configInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  configInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 6,
  },
  summaryBox: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
    alignItems: 'center',
  },
  summaryText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  summarySub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 4 },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    paddingVertical: 18,
    borderRadius: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 6,
  },
  startBtnText: { color: '#222', fontSize: 22, fontWeight: '800', letterSpacing: 1.5 },
  runContainer: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  phaseLabel: {
    color: '#FFF',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 10,
    textAlign: 'center',
  },
  bigTime: {
    color: '#FFF',
    fontSize: BIG_TIME_FONT,
    fontWeight: '900',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
    width: SCREEN_WIDTH * 0.85,
    textAlign: 'center',
    lineHeight: BIG_TIME_FONT * 1.05,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 36,
    marginBottom: 6,
  },
  metaItem: { alignItems: 'center' },
  metaLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 22, fontWeight: '700', letterSpacing: 2 },
  metaValue: { color: '#FFF', fontSize: 64, fontWeight: '900', marginTop: 6 },
  metaSep: { width: 2, height: 80, backgroundColor: 'rgba(255,255,255,0.4)' },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  ctrlBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 4,
  },
  ctrlBtnGhost: { backgroundColor: 'rgba(0,0,0,0.22)' },
  ctrlBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  ctrlBtnMain: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 6,
  },
});
