import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
import Constants from 'expo-constants';

interface SharedUser {
  permission_id: string;
  user_id: string;
  name: string;
  email: string;
  created_at: string;
}

interface SearchResult {
  user_id: string;
  name: string;
  email: string;
  phone?: string;
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

export default function ShareScreen() {
  const router = useRouter();
  const { sessionToken, isAuthenticated, user } = useAuth();
  const { t } = useLanguage();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [myShares, setMyShares] = useState<SharedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        loadMyShares();
      }
    }, [isAuthenticated])
  );

  const loadMyShares = async () => {
    if (!sessionToken) return;
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/share/my-shares`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setMyShares(data);
      }
    } catch (error) {
      console.error('Error loading shares:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (query: string) => {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/users/search?q=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Filter out users already shared with
        const sharedUserIds = myShares.map(s => s.user_id);
        const filtered = data.filter((u: SearchResult) => !sharedUserIds.includes(u.user_id));
        setSearchResults(filtered);
      }
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (text.length >= 3) {
      searchUsers(text);
    } else {
      setSearchResults([]);
    }
  };

  const shareWithUser = async (identifier: string) => {
    if (!sessionToken) return;

    setAdding(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ identifier })
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert(t('common.success'), t('share.shareSuccess'));
        setSearchQuery('');
        setSearchResults([]);
        await loadMyShares();
      } else {
        Alert.alert(t('common.error'), data.detail || t('share.userNotFound'));
      }
    } catch (error) {
      console.error('Error sharing:', error);
      Alert.alert(t('common.error'), 'Error de conexión');
    } finally {
      setAdding(false);
    }
  };

  const removeShare = async (userId: string, userName: string) => {
    Alert.alert(
      t('share.removeShare'),
      t('share.removeShareConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${BACKEND_URL}/api/share/${userId}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${sessionToken}`
                }
              });

              if (response.ok) {
                Alert.alert(t('common.success'), t('share.removed'));
                await loadMyShares();
              }
            } catch (error) {
              console.error('Error removing share:', error);
            }
          }
        }
      ]
    );
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.title}>{t('share.title')}</Text>
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

  const renderSearchResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      style={styles.searchResultItem}
      onPress={() => shareWithUser(item.email)}
      disabled={adding}
    >
      <View style={styles.userInfo}>
        <Ionicons name="person-circle-outline" size={40} color="#1E3A5F" />
        <View style={styles.userDetails}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => shareWithUser(item.email)}
        disabled={adding}
      >
        <Ionicons name="add" size={24} color="#FFF" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderShareItem = ({ item }: { item: SharedUser }) => (
    <View style={styles.shareItem}>
      <View style={styles.userInfo}>
        <Ionicons name="person-circle" size={44} color="#1E3A5F" />
        <View style={styles.userDetails}>
          <Text style={styles.shareName}>{item.name}</Text>
          <Text style={styles.shareEmail}>{item.email}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => removeShare(item.user_id, item.name)}
      >
        <Ionicons name="close-circle" size={28} color="#F44336" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.title}>{t('share.title')}</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Search Box */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={20} color="#666" />
            <TextInput
              style={styles.searchInput}
              placeholder={t('share.searchPlaceholder')}
              value={searchQuery}
              onChangeText={handleSearchChange}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            {searching && <ActivityIndicator size="small" color="#2196F3" />}
            {searchQuery.length > 0 && !searching && (
              <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>
          {searchQuery.length > 0 && searchQuery.length < 3 && (
            <Text style={styles.searchHint}>{t('share.searchHint')}</Text>
          )}
        </View>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <View style={styles.searchResultsContainer}>
            <Text style={styles.sectionTitle}>{t('share.addUser')}</Text>
            <FlatList
              data={searchResults}
              renderItem={renderSearchResult}
              keyExtractor={(item) => item.user_id}
              style={styles.searchResultsList}
              keyboardShouldPersistTaps="handled"
            />
          </View>
        )}

        {/* My Shares */}
        <View style={styles.sharesContainer}>
          <Text style={styles.sectionTitle}>{t('share.currentlySharing')}</Text>
          
          {loading ? (
            <ActivityIndicator size="large" color="#2196F3" style={{ marginTop: 40 }} />
          ) : myShares.length > 0 ? (
            <FlatList
              data={myShares}
              renderItem={renderShareItem}
              keyExtractor={(item) => item.permission_id}
              contentContainerStyle={styles.sharesList}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.emptyShares}>
              <Ionicons name="people-outline" size={50} color="#CCC" />
              <Text style={styles.emptySharesText}>{t('share.noShares')}</Text>
            </View>
          )}
        </View>

        {/* Link to Shared With Me */}
        <TouchableOpacity
          style={styles.sharedWithMeButton}
          onPress={() => router.push('/shared-with-me')}
        >
          <Ionicons name="folder-open-outline" size={22} color="#1E3A5F" />
          <Text style={styles.sharedWithMeText}>{t('share.sharedWithMe')}</Text>
          <Ionicons name="chevron-forward" size={22} color="#1E3A5F" />
        </TouchableOpacity>
      </KeyboardAvoidingView>
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
    paddingVertical: 14,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  placeholder: {
    width: 32,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  searchHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  searchResultsContainer: {
    backgroundColor: '#FFF',
    maxHeight: 200,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchResultsList: {
    paddingHorizontal: 16,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userDetails: {
    marginLeft: 10,
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  userEmail: {
    fontSize: 13,
    color: '#666',
  },
  addButton: {
    backgroundColor: '#4CAF50',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sharesContainer: {
    flex: 1,
    backgroundColor: '#FFF',
    marginTop: 10,
  },
  sharesList: {
    padding: 16,
  },
  shareItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  shareName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  shareEmail: {
    fontSize: 13,
    color: '#666',
  },
  removeButton: {
    padding: 4,
  },
  emptyShares: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 60,
  },
  emptySharesText: {
    fontSize: 15,
    color: '#999',
    marginTop: 12,
    textAlign: 'center',
  },
  sharedWithMeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#E3F2FD',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  sharedWithMeText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1E3A5F',
    marginLeft: 10,
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
