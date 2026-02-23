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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { initDatabase, getDatabase } from '@/src/store/database';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
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
  const { language, setLang, t } = useLanguage();
  const [activeMatches, setActiveMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [hasPendingSync, setHasPendingSync] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);

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
      // Si no hay usuario autenticado, no cargar partidos
      if (!user?.user_id) {
        setActiveMatches([]);
        return;
      }
      
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
        WHERE m.status = 'playing' AND (m.user_id = ? OR m.user_id IS NULL)
        ORDER BY m.date DESC
      `, [user.user_id]);
      setActiveMatches(result as Match[]);
    } catch (error) {
      console.error('Error cargando partidos activos:', error);
    }
  };

  // Recargar partidos cuando cambia el usuario
  useEffect(() => {
    if (isAuthenticated && user?.user_id) {
      loadActiveMatches();
    } else {
      setActiveMatches([]);
    }
  }, [user?.user_id]);

  const checkPendingSync = async () => {
    const pending = await syncService.hasPendingSync();
    setHasPendingSync(pending);
  };

  const handleSync = async () => {
    if (!isAuthenticated) {
      Alert.alert(t('home.loginRequired'), t('home.loginRequiredMsg'), [
        { text: t('common.cancel') },
        { text: t('home.login'), onPress: login }
      ]);
      return;
    }

    setSyncing(true);
    Alert.alert('Sync', 'Iniciando sincronización...');
    const result = await syncService.syncPendingMatches();
    setSyncing(false);

    // Siempre mostrar resultado
    Alert.alert('Sync Resultado', `${result.success ? 'OK' : 'Error'}: ${result.message}`);
    
    if (result.success) {
      setHasPendingSync(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(t('home.logout'), t('home.logoutConfirm'), [
      { text: t('common.cancel') },
      { text: t('home.logout'), onPress: logout, style: 'destructive' }
    ]);
  };

  const deleteMatch = async (matchId: number) => {
    Alert.alert(
      t('home.deleteMatch'),
      t('home.deleteConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const db = await getDatabase();
              // Eliminar puntos del partido
              await db.runAsync('DELETE FROM points WHERE match_id = ?', [matchId]);
              // Eliminar resultados de games
              await db.runAsync('DELETE FROM game_results WHERE match_id = ?', [matchId]);
              // Eliminar el partido
              await db.runAsync('DELETE FROM matches WHERE id = ?', [matchId]);
              
              // Recargar la lista
              await loadActiveMatches();
              Alert.alert(t('home.deleted'), t('home.matchDeleted'));
            } catch (error) {
              console.error('Error eliminando partido:', error);
              Alert.alert(t('common.error'), t('home.deleteError'));
            }
          }
        }
      ]
    );
  };

  const renderActiveMatch = ({ item }: { item: Match }) => (
    <View style={styles.activeMatchCard}>
      <TouchableOpacity
        style={styles.matchContent}
        onPress={() => router.push({
          pathname: '/match-play',
          params: { matchId: item.id },
        })}
      >
        <View style={styles.matchInfo}>
          <View style={styles.matchLive}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>{t('home.inProgress')}</Text>
          </View>
          <Text style={styles.matchPlayers} numberOfLines={1}>
            {item.player1_nickname} vs {item.player2_nickname}
          </Text>
          {item.tournament_name && (
            <Text style={styles.tournamentName} numberOfLines={1}>{item.tournament_name}</Text>
          )}
        </View>
        
        <View style={styles.scoreSection}>
          <Text style={styles.gamesScore}>{item.player1_games}-{item.player2_games}</Text>
          <Text style={styles.gameLabel}>G{item.current_game}</Text>
        </View>
        
        <View style={styles.playButton}>
          <Ionicons name="play" size={20} color="#FFF" />
        </View>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => deleteMatch(item.id)}
      >
        <Ionicons name="trash-outline" size={18} color="#F44336" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1E3A5F" />
      
      {/* Header con usuario */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          {/* Botón de idioma */}
          <TouchableOpacity 
            style={styles.langMenuButton} 
            onPress={() => setShowLanguageModal(true)}
          >
            <Ionicons name="globe-outline" size={22} color="#FFF" />
            <Text style={styles.langMenuText}>{language.toUpperCase()}</Text>
          </TouchableOpacity>
          
          <Text style={styles.title}>{t('home.title')}</Text>
          
          {isAuthenticated && user ? (
            <View style={styles.userArea}>
              <TouchableOpacity style={styles.userInfo} onPress={() => {}}>
                {user.picture ? (
                  <Image source={{ uri: user.picture }} style={styles.userAvatar} />
                ) : (
                  <Ionicons name="person-circle" size={28} color="#FFF" />
                )}
                <Text style={styles.userNameShort} numberOfLines={1}>
                  {user.name.split(' ')[0]}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.loginButton} onPress={() => router.push('/login')}>
              <Ionicons name="log-in-outline" size={20} color="#FFF" />
              <Text style={styles.loginButtonText}>{t('home.login')}</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {hasPendingSync && isAuthenticated && (
          <TouchableOpacity style={styles.syncBanner} onPress={handleSync} disabled={syncing}>
            <Ionicons name="cloud-upload-outline" size={18} color="#FFF" />
            <Text style={styles.syncBannerText}>
              {syncing ? t('home.syncing') : t('home.pendingSync')}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.content}>
        {/* Partidos en curso */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('home.matchesInProgress')}</Text>
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
            <Image 
              source={require('@/assets/images/icon.png')} 
              style={styles.emptyLogo}
              resizeMode="contain"
            />
            <Text style={styles.emptyText}>{t('home.noMatches')}</Text>
            <Text style={styles.emptySubtext}>
              {t('home.startMatch')}
            </Text>
          </View>
        )}
      </View>

      {/* Botones inferiores */}
      <View style={styles.bottomButtons}>
        {isAuthenticated ? (
          <>
            {/* Primera fila: Historial y Análisis */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.historyButton}
                onPress={() => router.push('/history')}
              >
                <Ionicons name="time-outline" size={20} color="#1E3A5F" />
                <Text style={styles.historyButtonText}>{t('home.history')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.analysisButton}
                onPress={() => router.push('/analysis')}
              >
                <Ionicons name="analytics" size={20} color="#1E3A5F" />
                <Text style={styles.analysisButtonText}>{t('home.analysis')}</Text>
              </TouchableOpacity>
            </View>
            
            {/* Segunda fila: Compartir y Nube */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.shareButton}
                onPress={() => router.push('/share')}
              >
                <Ionicons name="share-social-outline" size={20} color="#1E3A5F" />
                <Text style={styles.shareButtonText}>{t('home.sharing')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.cloudButton}
                onPress={() => router.push('/cloud-matches')}
              >
                <Ionicons name="cloud-outline" size={20} color="#1E3A5F" />
                <Text style={styles.cloudButtonText}>{t('home.cloud')}</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={styles.newMatchButton}
              onPress={() => router.push('/new-match')}
            >
              <Ionicons name="add-circle" size={22} color="#FFF" />
              <Text style={styles.newMatchText}>{t('home.newMatch')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={styles.loginRequiredButton}
            onPress={() => router.push('/login')}
          >
            <Ionicons name="log-in-outline" size={22} color="#FFF" />
            <Text style={styles.loginRequiredText}>{t('home.loginRequired')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Modal de selección de idioma */}
      <Modal
        visible={showLanguageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowLanguageModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('home.selectLanguage')}</Text>
            
            <TouchableOpacity
              style={[styles.modalLangButton, language === 'es' && styles.modalLangButtonActive]}
              onPress={() => { setLang('es'); setShowLanguageModal(false); }}
            >
              <Text style={[styles.modalLangText, language === 'es' && styles.modalLangTextActive]}>
                🇪🇸 Español
              </Text>
              {language === 'es' && <Ionicons name="checkmark" size={20} color="#FFF" />}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalLangButton, language === 'en' && styles.modalLangButtonActive]}
              onPress={() => { setLang('en'); setShowLanguageModal(false); }}
            >
              <Text style={[styles.modalLangText, language === 'en' && styles.modalLangTextActive]}>
                🇺🇸 English
              </Text>
              {language === 'en' && <Ionicons name="checkmark" size={20} color="#FFF" />}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  langMenuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
  },
  langMenuText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    flex: 1,
    textAlign: 'center',
  },
  userButton: {
    padding: 4,
  },
  userArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  userNameShort: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
    maxWidth: 80,
  },
  logoutButton: {
    backgroundColor: 'rgba(244,67,54,0.8)',
    padding: 8,
    borderRadius: 20,
  },
  userDetails: {
    alignItems: 'flex-start',
  },
  userName: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
    maxWidth: 100,
  },
  userStatus: {
    color: '#A5D6A7',
    fontSize: 10,
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
  },
  matchContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  matchInfo: {
    flex: 1,
  },
  matchLive: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
    marginRight: 4,
  },
  liveText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#4CAF50',
    letterSpacing: 0.5,
  },
  matchPlayers: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  scoreSection: {
    alignItems: 'center',
    marginHorizontal: 12,
  },
  gamesScore: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  gameLabel: {
    fontSize: 11,
    color: '#666',
  },
  tournamentName: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 2,
  },
  playButton: {
    backgroundColor: '#4CAF50',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyLogo: {
    width: 120,
    height: 120,
    marginBottom: 8,
    borderRadius: 12,
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
  languageSelector: {
    marginTop: 30,
    alignItems: 'center',
  },
  languageLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  languageButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  langButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#1E3A5F',
    backgroundColor: 'transparent',
  },
  langButtonActive: {
    backgroundColor: '#1E3A5F',
  },
  langButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E3A5F',
  },
  langButtonTextActive: {
    color: '#FFF',
  },
  bottomButtons: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  historyButton: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 4,
  },
  historyButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E3A5F',
  },
  analysisButton: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 4,
  },
  analysisButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E3A5F',
  },
  cloudButton: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 4,
  },
  cloudButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E3A5F',
  },
  shareButton: {
    flex: 1,
    backgroundColor: '#FFF3E0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 4,
  },
  shareButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E3A5F',
  },
  newMatchButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  newMatchText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFF',
    marginLeft: 8,
  },
  loginRequiredButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  loginRequiredText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  // Modal de idioma
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E3A5F',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalLangButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    marginBottom: 12,
  },
  modalLangButtonActive: {
    backgroundColor: '#1E3A5F',
    borderColor: '#1E3A5F',
  },
  modalLangText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  modalLangTextActive: {
    color: '#FFF',
  },
});
