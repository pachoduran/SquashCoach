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
        nickname: p.nickname,
        category: p.category || null,
        gender: p.gender || null,
        country: p.country || null,
        city: p.city || null,
        club: p.club || null,
        is_mine: p.is_mine || 0,
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

        // Sync tournaments too
        await this.syncTournaments();

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

  async syncPlayers(): Promise<number> {
    const sessionToken = await this.getSessionToken();
    if (!sessionToken) {
      console.log('[Sync] syncPlayers: No hay token de sesión');
      return 0;
    }

    const isOnline = await this.isOnline();
    if (!isOnline) {
      console.log('[Sync] syncPlayers: Sin conexión');
      return 0;
    }

    try {
      const db = await getDatabase();
      
      // Get local players
      const localPlayers = await db.getAllAsync('SELECT id, nickname, category, gender, country, city, club, COALESCE(is_mine, 0) as is_mine FROM players ORDER BY nickname ASC');
      console.log(`[Sync] syncPlayers: ${(localPlayers as any[]).length} jugadores locales`);
      
      // Get cloud players
      const cloudPlayers = await this.getCloudPlayers();
      console.log(`[Sync] syncPlayers: ${cloudPlayers.length} jugadores en la nube`);
      const cloudNicknames = new Set(cloudPlayers.map((p: any) => p.nickname));
      
      let uploaded = 0;
      for (const lp of localPlayers as any[]) {
        if (!cloudNicknames.has(lp.nickname)) {
          try {
            const response = await fetch(`${BACKEND_URL}/api/players`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`
              },
              body: JSON.stringify({
                nickname: lp.nickname,
                category: lp.category || null,
                gender: lp.gender || null,
                country: lp.country || null,
                city: lp.city || null,
                club: lp.club || null,
                is_mine: lp.is_mine || 0,
              })
            });
            if (response.ok) {
              uploaded++;
              console.log(`[Sync] Jugador subido: ${lp.nickname}`);
            } else {
              const errText = await response.text();
              console.error(`[Sync] Error subiendo jugador ${lp.nickname}: ${response.status} ${errText}`);
            }
          } catch (e) {
            console.error(`[Sync] Error subiendo jugador ${lp.nickname}:`, e);
          }
        }
      }
      
      console.log(`[Sync] syncPlayers completado: ${uploaded} nuevos jugadores subidos`);
      return uploaded;
    } catch (error) {
      console.error('[Sync] Error sincronizando jugadores:', error);
      return 0;
    }
  }

  async syncTournaments(): Promise<number> {
    const sessionToken = await this.getSessionToken();
    if (!sessionToken) return 0;

    const isOnline = await this.isOnline();
    if (!isOnline) return 0;

    try {
      const db = await getDatabase();
      const localTournaments = await db.getAllAsync('SELECT id, name, user_id FROM tournaments ORDER BY name ASC');
      console.log(`[Sync] syncTournaments: ${(localTournaments as any[]).length} torneos locales`);

      // Get cloud tournaments
      const response = await fetch(`${BACKEND_URL}/api/tournaments`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      const cloudTournaments = response.ok ? await response.json() : [];
      const cloudNames = new Set(cloudTournaments.map((t: any) => t.name));

      let uploaded = 0;
      for (const lt of localTournaments as any[]) {
        if (!cloudNames.has(lt.name)) {
          try {
            const res = await fetch(`${BACKEND_URL}/api/tournaments`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`
              },
              body: JSON.stringify({ name: lt.name })
            });
            if (res.ok) {
              uploaded++;
              console.log(`[Sync] Torneo subido: ${lt.name}`);
            }
          } catch (e) {
            console.error(`[Sync] Error subiendo torneo ${lt.name}:`, e);
          }
        }
      }

      console.log(`[Sync] syncTournaments completado: ${uploaded} nuevos torneos subidos`);
      return uploaded;
    } catch (error) {
      console.error('[Sync] Error sincronizando torneos:', error);
      return 0;
    }
  }

  async restoreTournamentsFromCloud(userId: string): Promise<number> {
    const sessionToken = await this.getSessionToken();
    if (!sessionToken) return 0;

    try {
      const response = await fetch(`${BACKEND_URL}/api/tournaments`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      if (!response.ok) return 0;

      const cloudTournaments = await response.json();
      if (!cloudTournaments.length) return 0;

      const db = await getDatabase();
      let restored = 0;

      for (const ct of cloudTournaments) {
        const existing = await db.getFirstAsync(
          'SELECT id FROM tournaments WHERE name = ? AND (user_id = ? OR user_id IS NULL)',
          [ct.name, userId]
        );
        if (!existing) {
          await db.runAsync(
            'INSERT INTO tournaments (name, user_id, created_at) VALUES (?, ?, ?)',
            [ct.name, userId, ct.created_at || new Date().toISOString()]
          );
          restored++;
          console.log(`[Sync] Torneo restaurado: ${ct.name}`);
        }
      }

      console.log(`[Sync] restoreTournaments completado: ${restored} torneos restaurados`);
      return restored;
    } catch (error) {
      console.error('[Sync] Error restaurando torneos:', error);
      return 0;
    }
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

    // Get user_id from AsyncStorage
    let userId = '';
    try {
      const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const authData = JSON.parse(stored);
        userId = authData.user?.user_id || '';
      }
    } catch (e) {}

    console.log('[Sync] ===== RESTAURANDO DESDE LA NUBE =====');
    let playersRestored = 0;
    let matchesRestored = 0;

    try {
      const db = await getDatabase();

      // 1. Restore players from cloud
      const cloudPlayers = await this.getCloudPlayers();
      console.log(`[Sync] Jugadores en la nube: ${cloudPlayers.length}`);
      
      for (const cp of cloudPlayers) {
        try {
          const existing = await db.getFirstAsync(
            'SELECT id FROM players WHERE nickname = ?',
            [cp.nickname]
          );
          if (!existing) {
            await db.runAsync(
              'INSERT INTO players (nickname, created_at, user_id, category, gender, country, city, club, is_mine) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [cp.nickname, cp.created_at || new Date().toISOString(), userId,
               cp.category || null, cp.gender || null, cp.country || null,
               cp.city || null, cp.club || null, cp.is_mine || 0]
            );
            playersRestored++;
            console.log(`[Sync] Jugador restaurado: ${cp.nickname}`);
          }
        } catch (playerError) {
          console.error('[Sync] Error restaurando jugador:', cp.nickname, playerError);
        }
      }

      // 2. Restore tournaments from cloud
      const tournamentsRestored = await this.restoreTournamentsFromCloud(userId);
      console.log(`[Sync] Torneos restaurados: ${tournamentsRestored}`);

      // 3. Restore matches from cloud
      const cloudMatches = await this.getCloudMatches();
      console.log(`[Sync] Partidos en la nube: ${cloudMatches.length}`);

      for (const cm of cloudMatches) {
        try {
          // The cloud match list returns match_id as the identifier
          const serverMatchId = cm.match_id;
          if (!serverMatchId) {
            console.log('[Sync] Partido sin match_id, saltando');
            continue;
          }

          // Download full match detail
          let matchDetail;
          try {
            matchDetail = await this.downloadMatch(serverMatchId);
          } catch (downloadErr) {
            console.error('[Sync] Error descargando partido:', serverMatchId, downloadErr);
            continue;
          }
          if (!matchDetail) continue;

          // The response structure is: { match: {...}, points: [...], game_results: [...], players: [...] }
          const matchData = matchDetail.match;
          const matchPlayers = matchDetail.players || [];
          const matchPoints = matchDetail.points || [];
          const matchGameResults = matchDetail.game_results || [];

          if (!matchData) {
            console.log('[Sync] Sin datos de partido en detalle');
            continue;
          }

          // Find player nicknames from the players array using server player_ids
          const p1Server = matchPlayers.find((p: any) => p.player_id === matchData.player1_id);
          const p2Server = matchPlayers.find((p: any) => p.player_id === matchData.player2_id);

          if (!p1Server || !p2Server) {
            console.log(`[Sync] No se encontraron jugadores para partido ${serverMatchId}`);
            continue;
          }

          // Get local player IDs by nickname
          const p1Local = await db.getFirstAsync('SELECT id FROM players WHERE nickname = ?', [p1Server.nickname]) as any;
          const p2Local = await db.getFirstAsync('SELECT id FROM players WHERE nickname = ?', [p2Server.nickname]) as any;

          if (!p1Local || !p2Local) {
            console.log(`[Sync] Jugadores locales no encontrados: ${p1Server.nickname}, ${p2Server.nickname}`);
            continue;
          }

          // Resolve winner local ID
          let winnerLocalId = null;
          if (matchData.winner_id) {
            const winnerServer = matchPlayers.find((p: any) => p.player_id === matchData.winner_id);
            if (winnerServer) {
              const winnerLocal = await db.getFirstAsync('SELECT id FROM players WHERE nickname = ?', [winnerServer.nickname]) as any;
              winnerLocalId = winnerLocal?.id || null;
            }
          }

          // Resolve my_player local ID
          let myPlayerLocalId = null;
          if (matchData.my_player_id) {
            const myPlayerServer = matchPlayers.find((p: any) => p.player_id === matchData.my_player_id);
            if (myPlayerServer) {
              const myPlayerLocal = await db.getFirstAsync('SELECT id FROM players WHERE nickname = ?', [myPlayerServer.nickname]) as any;
              myPlayerLocalId = myPlayerLocal?.id || null;
            }
          }

          // Check if match already exists locally (by players + date)
          const existingMatch = await db.getFirstAsync(
            'SELECT id FROM matches WHERE player1_id = ? AND player2_id = ? AND date = ?',
            [p1Local.id, p2Local.id, matchData.date]
          );
          if (existingMatch) {
            console.log(`[Sync] Partido ya existe localmente, saltando`);
            continue;
          }

          const matchDate = matchData.date || new Date().toISOString();
          const result = await db.runAsync(
            `INSERT INTO matches (player1_id, player2_id, my_player_id, best_of, winner_id, date, status, current_game, player1_games, player2_games, tournament_name, match_date, user_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [p1Local.id, p2Local.id, myPlayerLocalId || p1Local.id, matchData.best_of || 3, winnerLocalId, matchDate,
             matchData.status || 'finished', matchData.current_game || 1, matchData.player1_games || 0,
             matchData.player2_games || 0, matchData.tournament_name || null, matchData.match_date || null, userId]
          );

          const localMatchId = result.lastInsertRowId;
          console.log(`[Sync] Partido restaurado: ${p1Server.nickname} vs ${p2Server.nickname} (local ID: ${localMatchId})`);

          // Build a map from server player_id to local player id for points/results
          const serverToLocalPlayerMap: Record<string, number> = {};
          for (const sp of matchPlayers) {
            const localP = await db.getFirstAsync('SELECT id FROM players WHERE nickname = ?', [sp.nickname]) as any;
            if (localP) {
              serverToLocalPlayerMap[sp.player_id] = localP.id;
            }
          }

          // Restore points
          for (const pt of matchPoints) {
            try {
              const ptWinnerLocalId = serverToLocalPlayerMap[pt.winner_player_id] || p1Local.id;
              await db.runAsync(
                `INSERT INTO points (match_id, position_x, position_y, winner_player_id, reason, my_player_pos_x, my_player_pos_y, opponent_pos_x, opponent_pos_y, game_number, point_number, player1_score, player2_score, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [localMatchId, pt.position_x || 0, pt.position_y || 0, ptWinnerLocalId, pt.reason || '',
                 pt.my_player_pos_x || 0, pt.my_player_pos_y || 0, pt.opponent_pos_x || 0, pt.opponent_pos_y || 0,
                 pt.game_number || 1, pt.point_number || 0, pt.player1_score || 0, pt.player2_score || 0,
                 pt.created_at || new Date().toISOString()]
              );
            } catch (ptErr) {
              console.error('[Sync] Error restaurando punto:', ptErr);
            }
          }

          // Restore game results
          for (const gr of matchGameResults) {
            try {
              const grWinnerLocalId = gr.winner_id ? (serverToLocalPlayerMap[gr.winner_id] || null) : null;
              await db.runAsync(
                `INSERT INTO game_results (match_id, game_number, player1_score, player2_score, winner_id)
                 VALUES (?, ?, ?, ?, ?)`,
                [localMatchId, gr.game_number || 1, gr.player1_score || 0, gr.player2_score || 0, grWinnerLocalId]
              );
            } catch (grErr) {
              console.error('[Sync] Error restaurando game result:', grErr);
            }
          }

          matchesRestored++;
        } catch (matchError) {
          console.error('[Sync] Error restaurando partido:', matchError);
        }
      }

      // 3.5 Extract tournaments from restored matches (backup method)
      try {
        const matchTournaments = await db.getAllAsync(
          "SELECT DISTINCT tournament_name FROM matches WHERE tournament_name IS NOT NULL AND tournament_name != ''"
        );
        for (const mt of matchTournaments as any[]) {
          const exists = await db.getFirstAsync(
            'SELECT id FROM tournaments WHERE name = ?',
            [mt.tournament_name]
          );
          if (!exists) {
            await db.runAsync(
              'INSERT INTO tournaments (name, user_id, created_at) VALUES (?, ?, ?)',
              [mt.tournament_name, userId, new Date().toISOString()]
            );
            console.log(`[Sync] Torneo extraído de partidos: ${mt.tournament_name}`);
          }
        }
      } catch (extractErr) {
        console.error('[Sync] Error extrayendo torneos de partidos:', extractErr);
      }

      console.log(`[Sync] ===== RESTAURACIÓN COMPLETA: ${playersRestored} jugadores, ${tournamentsRestored} torneos, ${matchesRestored} partidos =====`);
      return {
        success: true,
        message: `Restaurados: ${playersRestored} jugadores, ${tournamentsRestored} torneos, ${matchesRestored} partidos`,
        playersRestored,
        matchesRestored
      };
    } catch (error) {
      console.error('[Sync] Error restaurando:', error);
      return { success: false, message: 'Error restaurando datos', playersRestored, matchesRestored };
    }
  }

  // ============================================================================
  // SHADOW ROUTINES SYNC
  // ============================================================================

  async syncShadowRoutines(): Promise<number> {
    const sessionToken = await this.getSessionToken();
    if (!sessionToken) return 0;

    const isOnline = await this.isOnline();
    if (!isOnline) return 0;

    try {
      const db = await getDatabase();
      const unsynced = await db.getAllAsync(
        'SELECT * FROM shadow_routines WHERE synced = 0 OR synced IS NULL'
      );
      console.log(`[Sync] syncShadowRoutines: ${(unsynced as any[]).length} rutinas pendientes`);

      let uploaded = 0;
      for (const r of unsynced as any[]) {
        try {
          const res = await fetch(`${BACKEND_URL}/api/shadow-routines`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({
              local_id: r.id,
              name: r.name || null,
              date: r.date,
              zone_mode: r.zone_mode,
              interval_time: r.interval_time,
              set_duration: r.set_duration,
              rest_duration: r.rest_duration,
              number_of_sets: r.number_of_sets,
              completed_sets: r.completed_sets,
              total_zones_visited: r.total_zones_visited,
            })
          });
          if (res.ok) {
            const data = await res.json();
            await db.runAsync(
              'UPDATE shadow_routines SET synced = 1, server_id = ? WHERE id = ?',
              [data.routine_id || null, r.id]
            );
            uploaded++;
            console.log(`[Sync] Rutina sombra subida: ${r.id} -> ${data.routine_id}`);
          } else {
            const errText = await res.text();
            console.error(`[Sync] Error subiendo rutina ${r.id}: ${res.status} ${errText}`);
          }
        } catch (e) {
          console.error(`[Sync] Error subiendo rutina ${r.id}:`, e);
        }
      }

      console.log(`[Sync] syncShadowRoutines completado: ${uploaded} subidas`);
      return uploaded;
    } catch (error) {
      console.error('[Sync] Error sincronizando rutinas sombras:', error);
      return 0;
    }
  }

  async restoreShadowRoutinesFromCloud(userId: string): Promise<number> {
    const sessionToken = await this.getSessionToken();
    if (!sessionToken) return 0;

    try {
      const response = await fetch(`${BACKEND_URL}/api/shadow-routines`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      if (!response.ok) return 0;

      const cloudRoutines = await response.json();
      if (!cloudRoutines.length) return 0;

      const db = await getDatabase();
      let restored = 0;

      for (const cr of cloudRoutines) {
        try {
          const existing = await db.getFirstAsync(
            'SELECT id FROM shadow_routines WHERE server_id = ?',
            [cr.routine_id]
          );
          if (existing) continue;

          await db.runAsync(
            `INSERT INTO shadow_routines (
              user_id, name, date, zone_mode, interval_time, set_duration,
              rest_duration, number_of_sets, completed_sets, total_zones_visited,
              created_at, synced, server_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
            [
              userId,
              cr.name || null,
              cr.date,
              cr.zone_mode,
              cr.interval_time,
              cr.set_duration,
              cr.rest_duration,
              cr.number_of_sets,
              cr.completed_sets,
              cr.total_zones_visited,
              cr.created_at || new Date().toISOString(),
              cr.routine_id,
            ]
          );
          restored++;
        } catch (e) {
          console.error('[Sync] Error restaurando rutina sombra:', e);
        }
      }

      console.log(`[Sync] restoreShadowRoutines: ${restored} restauradas`);
      return restored;
    } catch (error) {
      console.error('[Sync] Error restaurando rutinas sombras:', error);
      return 0;
    }
  }

  async deleteShadowRoutineCloud(serverId: string): Promise<boolean> {
    const sessionToken = await this.getSessionToken();
    if (!sessionToken || !serverId) return false;

    try {
      const res = await fetch(`${BACKEND_URL}/api/shadow-routines/${serverId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      return res.ok;
    } catch (e) {
      console.error('[Sync] Error eliminando rutina en la nube:', e);
      return false;
    }
  }
}

export const syncService = new SyncService();
