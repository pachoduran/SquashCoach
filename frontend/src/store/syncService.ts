import { getDatabase } from './database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';

const PENDING_SYNC_KEY = '@squash_coach_pending_sync';
const AUTH_STORAGE_KEY = '@squash_coach_auth';

// Get backend URL
const getBackendUrl = () => {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' ? window.location.origin : '';
  }
  // Use environment variable for mobile
  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (backendUrl) {
    console.log('[Sync] Using BACKEND_URL:', backendUrl);
    return backendUrl;
  }
  // Fallback
  const expoConfig = Constants.expoConfig as any;
  return expoConfig?.extra?.EXPO_BACKEND_URL || '';
};

const BACKEND_URL = getBackendUrl();

interface SyncData {
  players: any[];
  matches: any[];
  points: any[];
  game_results: any[];
}

class SyncService {
  private isSyncing = false;

  async getSessionToken(): Promise<string | null> {
    try {
      const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        return data.sessionToken;
      }
    } catch (error) {
      console.error('[Sync] Error getting session:', error);
    }
    return null;
  }

  async isOnline(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();
      return state.isConnected === true;
    } catch {
      return false;
    }
  }

  async markMatchForSync(matchId: number): Promise<void> {
    try {
      const pendingStr = await AsyncStorage.getItem(PENDING_SYNC_KEY);
      const pending = pendingStr ? JSON.parse(pendingStr) : { matchIds: [] };
      
      if (!pending.matchIds.includes(matchId)) {
        pending.matchIds.push(matchId);
        await AsyncStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(pending));
        console.log(`[Sync] Match ${matchId} marcado para sync`);
      }
    } catch (error) {
      console.error('[Sync] Error marking match:', error);
    }
  }

  async hasPendingSync(): Promise<boolean> {
    try {
      const pendingStr = await AsyncStorage.getItem(PENDING_SYNC_KEY);
      if (pendingStr) {
        const pending = JSON.parse(pendingStr);
        return pending.matchIds && pending.matchIds.length > 0;
      }
    } catch (error) {
      console.error('[Sync] Error checking pending:', error);
    }
    return false;
  }

  async syncPendingMatches(): Promise<{ success: boolean; message: string }> {
    if (this.isSyncing) {
      return { success: false, message: 'Sincronización en progreso' };
    }

    const sessionToken = await this.getSessionToken();
    if (!sessionToken) {
      return { success: false, message: 'No autenticado' };
    }

    const isOnline = await this.isOnline();
    if (!isOnline) {
      return { success: false, message: 'Sin conexión a internet' };
    }

    this.isSyncing = true;

    try {
      const pendingStr = await AsyncStorage.getItem(PENDING_SYNC_KEY);
      if (!pendingStr) {
        return { success: true, message: 'Nada que sincronizar' };
      }

      const pending = JSON.parse(pendingStr);
      if (!pending.matchIds || pending.matchIds.length === 0) {
        return { success: true, message: 'Nada que sincronizar' };
      }

      console.log(`[Sync] Sincronizando ${pending.matchIds.length} partidos...`);

      const db = await getDatabase();
      const syncData: SyncData = {
        players: [],
        matches: [],
        points: [],
        game_results: []
      };

      // Get all players
      const players = await db.getAllAsync('SELECT * FROM players');
      syncData.players = players.map((p: any) => ({
        local_id: p.id,
        nickname: p.nickname
      }));

      // Get pending matches
      for (const matchId of pending.matchIds) {
        const match = await db.getFirstAsync(
          'SELECT * FROM matches WHERE id = ?',
          [matchId]
        );

        if (match) {
          syncData.matches.push({
            local_id: (match as any).id,
            player1_local_id: (match as any).player1_id,
            player2_local_id: (match as any).player2_id,
            my_player_local_id: (match as any).my_player_id,
            best_of: (match as any).best_of,
            winner_local_id: (match as any).winner_id,
            date: (match as any).date,
            status: (match as any).status,
            current_game: (match as any).current_game,
            player1_games: (match as any).player1_games,
            player2_games: (match as any).player2_games,
            tournament_name: (match as any).tournament_name,
            match_date: (match as any).match_date
          });

          // Get points for this match
          const points = await db.getAllAsync(
            'SELECT * FROM points WHERE match_id = ?',
            [matchId]
          );

          for (const point of points) {
            syncData.points.push({
              local_id: (point as any).id,
              match_local_id: matchId,
              position_x: (point as any).position_x,
              position_y: (point as any).position_y,
              winner_player_local_id: (point as any).winner_player_id,
              reason: (point as any).reason,
              my_player_pos_x: (point as any).my_player_pos_x,
              my_player_pos_y: (point as any).my_player_pos_y,
              opponent_pos_x: (point as any).opponent_pos_x,
              opponent_pos_y: (point as any).opponent_pos_y,
              game_number: (point as any).game_number,
              point_number: (point as any).point_number,
              player1_score: (point as any).player1_score,
              player2_score: (point as any).player2_score
            });
          }

          // Get game results for this match
          const gameResults = await db.getAllAsync(
            'SELECT * FROM game_results WHERE match_id = ?',
            [matchId]
          );

          for (const gr of gameResults) {
            syncData.game_results.push({
              match_local_id: matchId,
              game_number: (gr as any).game_number,
              player1_score: (gr as any).player1_score,
              player2_score: (gr as any).player2_score,
              winner_local_id: (gr as any).winner_id
            });
          }
        }
      }

      // Send to server
      const response = await fetch(`${BACKEND_URL}/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify(syncData)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[Sync] Resultado:', result);

        // Clear pending
        await AsyncStorage.setItem(PENDING_SYNC_KEY, JSON.stringify({ matchIds: [] }));

        return {
          success: true,
          message: `Sincronizado: ${result.matches_synced} partidos, ${result.points_synced} puntos`
        };
      } else {
        const error = await response.text();
        console.error('[Sync] Error response:', error);
        return { success: false, message: 'Error del servidor' };
      }
    } catch (error) {
      console.error('[Sync] Error:', error);
      return { success: false, message: 'Error de sincronización' };
    } finally {
      this.isSyncing = false;
    }
  }

  async downloadMatch(matchServerId: string): Promise<any> {
    const sessionToken = await this.getSessionToken();
    if (!sessionToken) {
      throw new Error('No autenticado');
    }

    const response = await fetch(`${BACKEND_URL}/api/matches/${matchServerId}`, {
      headers: {
        'Authorization': `Bearer ${sessionToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Error descargando partido');
    }

    return response.json();
  }

  async getCloudMatches(): Promise<any[]> {
    const sessionToken = await this.getSessionToken();
    if (!sessionToken) {
      return [];
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/matches`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      if (response.ok) {
        return response.json();
      }
    } catch (error) {
      console.error('[Sync] Error getting cloud matches:', error);
    }

    return [];
  }

  async getCloudPlayers(): Promise<any[]> {
    const sessionToken = await this.getSessionToken();
    if (!sessionToken) {
      return [];
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/players`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      if (response.ok) {
        return response.json();
      }
    } catch (error) {
      console.error('[Sync] Error getting cloud players:', error);
    }

    return [];
  }
}

export const syncService = new SyncService();
