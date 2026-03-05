import { getDatabase } from './database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const PENDING_SYNC_KEY = '@squash_coach_pending_sync';
const AUTH_STORAGE_KEY = '@squash_coach_auth';

// HARDCODED URL para APK - igual que en AuthContext
const BACKEND_URL = 'https://lev.jsb.mybluehost.me:8001';

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
      console.log('[Sync] No hay token de sesión');
      return { success: false, message: 'No autenticado' };
    }

    const isOnline = await this.isOnline();
    if (!isOnline) {
      console.log('[Sync] Sin conexión');
      return { success: false, message: 'Sin conexión a internet' };
    }

    this.isSyncing = true;
    console.log('[Sync] ===== INICIANDO SINCRONIZACIÓN =====');
    console.log('[Sync] URL:', BACKEND_URL);

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
      console.log('[Sync] Enviando datos al servidor:', BACKEND_URL);
      console.log('[Sync] Token completo:', sessionToken);
      console.log('[Sync] Datos:', JSON.stringify(syncData).substring(0, 200));
      
      const response = await fetch(`${BACKEND_URL}/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify(syncData)
      });

      console.log('[Sync] Response status:', response.status);
      const responseText = await response.text();
      console.log('[Sync] Response body:', responseText);

      if (response.ok) {
        const result = JSON.parse(responseText);
        console.log('[Sync] Resultado:', result);

        // Clear pending
        await AsyncStorage.setItem(PENDING_SYNC_KEY, JSON.stringify({ matchIds: [] }));

        return {
          success: true,
          message: `Sincronizado: ${result.matches_synced} partidos, ${result.points_synced} puntos`
        };
      } else {
        console.error('[Sync] Error response:', responseText);
        return { success: false, message: `Error: ${responseText}` };
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

  async restoreFromCloud(): Promise<{ success: boolean; message: string; playersRestored: number; matchesRestored: number }> {
    const sessionToken = await this.getSessionToken();
    if (!sessionToken) {
      return { success: false, message: 'No autenticado', playersRestored: 0, matchesRestored: 0 };
    }

    const isOnline = await this.isOnline();
    if (!isOnline) {
      return { success: false, message: 'Sin conexión', playersRestored: 0, matchesRestored: 0 };
    }

    console.log('[Sync] ===== RESTAURANDO DESDE LA NUBE =====');
    let playersRestored = 0;
    let matchesRestored = 0;

    try {
      const db = await getDatabase();

      // 1. Restore players
      const cloudPlayers = await this.getCloudPlayers();
      console.log(`[Sync] Jugadores en la nube: ${cloudPlayers.length}`);
      
      for (const cp of cloudPlayers) {
        const existing = await db.getFirstAsync(
          'SELECT id FROM players WHERE nickname = ?',
          [cp.nickname]
        );
        if (!existing) {
          await db.runAsync('INSERT INTO players (nickname) VALUES (?)', [cp.nickname]);
          playersRestored++;
          console.log(`[Sync] Jugador restaurado: ${cp.nickname}`);
        }
      }

      // 2. Restore matches
      const cloudMatches = await this.getCloudMatches();
      console.log(`[Sync] Partidos en la nube: ${cloudMatches.length}`);

      for (const cm of cloudMatches) {
        try {
          const matchDetail = await this.downloadMatch(cm._id || cm.id);
          if (!matchDetail) continue;

          // Get local player IDs
          const p1 = await db.getFirstAsync('SELECT id FROM players WHERE nickname = ?', [matchDetail.player1_nickname]) as any;
          const p2 = await db.getFirstAsync('SELECT id FROM players WHERE nickname = ?', [matchDetail.player2_nickname]) as any;
          if (!p1 || !p2) continue;

          const winnerNickname = matchDetail.winner_nickname;
          let winnerId = null;
          if (winnerNickname) {
            const w = await db.getFirstAsync('SELECT id FROM players WHERE nickname = ?', [winnerNickname]) as any;
            winnerId = w?.id;
          }

          const myPlayerNickname = matchDetail.my_player_nickname;
          let myPlayerId = null;
          if (myPlayerNickname) {
            const mp = await db.getFirstAsync('SELECT id FROM players WHERE nickname = ?', [myPlayerNickname]) as any;
            myPlayerId = mp?.id;
          }

          // Check if match already exists locally (by date + players)
          const existingMatch = await db.getFirstAsync(
            'SELECT id FROM matches WHERE player1_id = ? AND player2_id = ? AND date = ?',
            [p1.id, p2.id, matchDetail.date]
          );
          if (existingMatch) continue;

          const result = await db.runAsync(
            `INSERT INTO matches (player1_id, player2_id, my_player_id, best_of, winner_id, date, status, current_game, player1_games, player2_games, tournament_name, match_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [p1.id, p2.id, myPlayerId, matchDetail.best_of || 3, winnerId, matchDetail.date, matchDetail.status || 'finished',
             matchDetail.current_game || 1, matchDetail.player1_games || 0, matchDetail.player2_games || 0,
             matchDetail.tournament_name || null, matchDetail.match_date || matchDetail.date]
          );

          const localMatchId = result.lastInsertRowId;

          // Restore points
          if (matchDetail.points && matchDetail.points.length > 0) {
            for (const pt of matchDetail.points) {
              const ptWinnerId = pt.winner_player_nickname === matchDetail.player1_nickname ? p1.id : p2.id;
              await db.runAsync(
                `INSERT INTO points (match_id, position_x, position_y, winner_player_id, reason, my_player_pos_x, my_player_pos_y, opponent_pos_x, opponent_pos_y, game_number, point_number, player1_score, player2_score)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [localMatchId, pt.position_x, pt.position_y, ptWinnerId, pt.reason,
                 pt.my_player_pos_x, pt.my_player_pos_y, pt.opponent_pos_x, pt.opponent_pos_y,
                 pt.game_number, pt.point_number, pt.player1_score, pt.player2_score]
              );
            }
          }

          // Restore game results
          if (matchDetail.game_results && matchDetail.game_results.length > 0) {
            for (const gr of matchDetail.game_results) {
              const grWinnerId = gr.winner_nickname === matchDetail.player1_nickname ? p1.id : p2.id;
              await db.runAsync(
                `INSERT INTO game_results (match_id, game_number, player1_score, player2_score, winner_id)
                 VALUES (?, ?, ?, ?, ?)`,
                [localMatchId, gr.game_number, gr.player1_score, gr.player2_score, grWinnerId]
              );
            }
          }

          matchesRestored++;
          console.log(`[Sync] Partido restaurado: ${matchDetail.player1_nickname} vs ${matchDetail.player2_nickname}`);
        } catch (matchError) {
          console.error('[Sync] Error restaurando partido:', matchError);
        }
      }

      return {
        success: true,
        message: `Restaurados: ${playersRestored} jugadores, ${matchesRestored} partidos`,
        playersRestored,
        matchesRestored
      };
    } catch (error) {
      console.error('[Sync] Error restaurando:', error);
      return { success: false, message: 'Error restaurando datos', playersRestored, matchesRestored };
    }
  }
}

export const syncService = new SyncService();
