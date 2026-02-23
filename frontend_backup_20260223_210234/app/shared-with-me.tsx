import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
import Constants from 'expo-constants';

interface SharedByUser {
  permission_id: string;
  user_id: string;
  name: string;
  email: string;
  created_at: string;
}

interface SharedMatch {
  match_id: string;
  player1_id: string;
  player2_id: string;
  status: string;
  date: string;
  player1_games: number;
  player2_games: number;
  tournament_name?: string;
}

// Get backend URL
const getBackendUrl = () => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return '';
  }
  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (backendUrl) {
    return backendUrl;
  }
  const expoConfig = Constants.expoConfig as any;
  return expoConfig?.extra?.EXPO_BACKEND_URL || expoConfig?.hostUri?.split(':')[0] || '';
};

const BACKEND_URL = getBackendUrl();

export default function SharedWithMeScreen() {
  const router = useRouter();
  const { sessionToken, isAuthenticated } = useAuth();
  const { t } = useLanguage();

  const [sharedUsers, setSharedUsers] = useState<SharedByUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<SharedByUser | null>(null);
  const [userMatches, setUserMatches] = useState<SharedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        loadSharedWithMe();
      }
    }, [isAuthenticated])
  );

  const loadSharedWithMe = async () => {
    if (!sessionToken) return;
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/share/shared-with-me`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSharedUsers(data);
      }
    } catch (error) {
      console.error('Error loading shared with me:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserMatches = async (userId: string) => {
    if (!sessionToken) return;
    
    setLoadingMatches(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/share/user/${userId}/matches`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUserMatches(data);
      }
    } catch (error) {
      console.error('Error loading user matches:', error);
    } finally {
      setLoadingMatches(false);
    }
  };

  const selectUser = (user: SharedByUser) => {
    setSelectedUser(user);
    loadUserMatches(user.user_id);
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.title}>{t('share.sharedWithMe')}</Text>
          <View style={styles.placeholder} />
        </View>
        
        <View style={styles.emptyContainer}>
          <Ionicons name="log-in-outline" size={60} color="#CCC" />
          <Text style={styles.emptyText}>{t('home.loginRequired')}</Text>
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.loginButtonText}>{t('home.login')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const renderUserItem = ({ item }: { item: SharedByUser }) => (
    <TouchableOpacity
      style={[
        styles.userItem,
        selectedUser?.user_id === item.user_id && styles.userItemSelected
      ]}
      onPress={() => selectUser(item)}
    >
      <Ionicons 
        name="person-circle" 
        size={44} 
        color={selectedUser?.user_id === item.user_id ? '#FFF' : '#1E3A5F'} 
      />
      <View style={styles.userDetails}>
        <Text style={[
          styles.userName,
          selectedUser?.user_id === item.user_id && styles.userNameSelected
        ]}>
          {item.name}
        </Text>
        <Text style={[
          styles.userEmail,
          selectedUser?.user_id === item.user_id && styles.userEmailSelected
        ]}>
          {item.email}
        </Text>
      </View>
      <Ionicons 
        name="chevron-forward" 
        size={20} 
        color={selectedUser?.user_id === item.user_id ? '#FFF' : '#999'} 
      />
    </TouchableOpacity>
  );

  const renderMatchItem = ({ item }: { item: SharedMatch }) => (
    <TouchableOpacity
      style={styles.matchItem}
      onPress={() => {
        // Navigate to shared match detail
        router.push({
          pathname: '/shared-match-detail',
          params: { 
            userId: selectedUser?.user_id,
            matchId: item.match_id,
            userName: selectedUser?.name
          }
        });
      }}
    >
      <View style={styles.matchInfo}>
        <Text style={styles.matchScore}>
          {item.player1_games} - {item.player2_games}
        </Text>
        <Text style={styles.matchDate}>{formatDate(item.date)}</Text>
        {item.tournament_name && (
          <Text style={styles.matchTournament}>{item.tournament_name}</Text>
        )}
      </View>
      <View style={styles.matchBadge}>
        <Text style={styles.matchBadgeText}>{t('share.readOnly')}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#999" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('share.sharedWithMe')}</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color="#2196F3" style={{ marginTop: 60 }} />
        ) : sharedUsers.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={60} color="#CCC" />
            <Text style={styles.emptyStateText}>{t('share.noSharedWithMe')}</Text>
          </View>
        ) : (
          <>
            {/* Users List */}
            <View style={styles.usersSection}>
              <Text style={styles.sectionTitle}>{t('share.sharedBy')}</Text>
              <FlatList
                data={sharedUsers}
                renderItem={renderUserItem}
                keyExtractor={(item) => item.permission_id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.usersList}
              />
            </View>

            {/* Matches Section */}
            {selectedUser && (
              <View style={styles.matchesSection}>
                <Text style={styles.sectionTitle}>
                  {t('share.viewMatches')} - {selectedUser.name}
                </Text>
                
                {loadingMatches ? (
                  <ActivityIndicator size="large" color="#2196F3" style={{ marginTop: 40 }} />
                ) : userMatches.length === 0 ? (
                  <View style={styles.noMatchesState}>
                    <Ionicons name="tennisball-outline" size={40} color="#CCC" />
                    <Text style={styles.noMatchesText}>No hay partidos</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.matchesCount}>
                      {userMatches.length} {userMatches.length === 1 ? t('history.match') : t('share.matchesCount')}
                    </Text>
                    <FlatList
                      data={userMatches}
                      renderItem={renderMatchItem}
                      keyExtractor={(item) => item.match_id}
                      contentContainerStyle={styles.matchesList}
                      showsVerticalScrollIndicator={false}
                    />
                  </>
                )}
              </View>
            )}

            {!selectedUser && (
              <View style={styles.selectUserHint}>
                <Ionicons name="hand-left-outline" size={40} color="#CCC" />
                <Text style={styles.selectUserHintText}>
                  Selecciona un usuario para ver sus partidos
                </Text>
              </View>
            )}
          </>
        )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#FFF',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  usersSection: {
    backgroundColor: '#FFF',
    paddingTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  usersList: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginHorizontal: 4,
    minWidth: 200,
  },
  userItemSelected: {
    backgroundColor: '#1E3A5F',
  },
  userDetails: {
    flex: 1,
    marginLeft: 10,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  userNameSelected: {
    color: '#FFF',
  },
  userEmail: {
    fontSize: 12,
    color: '#666',
  },
  userEmailSelected: {
    color: '#CCC',
  },
  matchesSection: {
    flex: 1,
    backgroundColor: '#FFF',
    marginTop: 10,
    paddingTop: 16,
  },
  matchesCount: {
    fontSize: 12,
    color: '#999',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  matchesList: {
    padding: 16,
  },
  matchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  matchInfo: {
    flex: 1,
  },
  matchScore: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E3A5F',
  },
  matchDate: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  matchTournament: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 2,
  },
  matchBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  matchBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1976D2',
  },
  noMatchesState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noMatchesText: {
    fontSize: 14,
    color: '#999',
    marginTop: 10,
  },
  selectUserHint: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectUserHintText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 15,
    color: '#999',
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  loginButton: {
    marginTop: 20,
    backgroundColor: '#2196F3',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
