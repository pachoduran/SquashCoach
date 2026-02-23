// =============================================================================
// MOCK DATABASE PARA WEB
// expo-sqlite no soporta web completamente, usamos datos mock para demostración
// =============================================================================

// Datos mock para demostración en web
const mockPlayers = [
  { id: 1, nickname: 'Juan', created_at: '2025-01-01T10:00:00' },
  { id: 2, nickname: 'Pedro', created_at: '2025-01-01T10:00:00' },
];

const mockMatches: any[] = [];
const mockGames: any[] = [];
const mockPoints: any[] = [];

let nextPlayerId = 3;
let nextMatchId = 1;
let nextGameId = 1;
let nextPointId = 1;

// Mock database object
const mockDb = {
  getAllSync: (query: string, params?: any[]) => {
    console.log('[WEB-DB Mock] getAllSync:', query.substring(0, 50));
    
    if (query.includes('FROM players')) {
      return [...mockPlayers];
    }
    if (query.includes('FROM matches')) {
      return [...mockMatches];
    }
    if (query.includes('FROM games')) {
      return [...mockGames];
    }
    if (query.includes('FROM points')) {
      return [...mockPoints];
    }
    return [];
  },
  
  getFirstSync: (query: string, params?: any[]) => {
    console.log('[WEB-DB Mock] getFirstSync:', query.substring(0, 50));
    
    if (query.includes('FROM players') && params?.[0]) {
      return mockPlayers.find(p => p.id === params[0]) || null;
    }
    if (query.includes('FROM matches') && params?.[0]) {
      return mockMatches.find(m => m.id === params[0]) || null;
    }
    return null;
  },
  
  runSync: (query: string, params?: any[]) => {
    console.log('[WEB-DB Mock] runSync:', query.substring(0, 50));
    
    if (query.includes('INSERT INTO players')) {
      const newPlayer = {
        id: nextPlayerId++,
        nickname: params?.[0] || 'Nuevo',
        created_at: params?.[1] || new Date().toISOString(),
      };
      mockPlayers.push(newPlayer);
      return { lastInsertRowId: newPlayer.id, changes: 1 };
    }
    
    if (query.includes('INSERT INTO matches')) {
      const newMatch = {
        id: nextMatchId++,
        player1_id: params?.[0],
        player2_id: params?.[1],
        my_player_id: params?.[2],
        best_of: params?.[3],
        status: 'playing',
        player1_games: 0,
        player2_games: 0,
        current_game: 1,
        date: params?.[4] || new Date().toISOString(),
        tournament_name: params?.[5] || null,
      };
      mockMatches.push(newMatch);
      return { lastInsertRowId: newMatch.id, changes: 1 };
    }
    
    if (query.includes('INSERT INTO games')) {
      const newGame = {
        id: nextGameId++,
        match_id: params?.[0],
        game_number: params?.[1],
        player1_score: 0,
        player2_score: 0,
      };
      mockGames.push(newGame);
      return { lastInsertRowId: newGame.id, changes: 1 };
    }
    
    if (query.includes('INSERT INTO points')) {
      const newPoint = {
        id: nextPointId++,
        game_id: params?.[0],
        winner_id: params?.[1],
        reason: params?.[2],
        shot_type: params?.[3],
        x: params?.[4],
        y: params?.[5],
      };
      mockPoints.push(newPoint);
      return { lastInsertRowId: newPoint.id, changes: 1 };
    }
    
    return { lastInsertRowId: 0, changes: 0 };
  },
  
  execSync: (query: string) => {
    console.log('[WEB-DB Mock] execSync:', query.substring(0, 50));
    // No-op for CREATE TABLE, etc.
  },
  
  getAllAsync: async (query: string, params?: any[]) => {
    return mockDb.getAllSync(query, params);
  },
  
  getFirstAsync: async (query: string, params?: any[]) => {
    return mockDb.getFirstSync(query, params);
  },
  
  runAsync: async (query: string, params?: any[]) => {
    return mockDb.runSync(query, params);
  },
};

let isInitialized = false;

export const initDatabase = async (): Promise<void> => {
  console.log('[WEB-DB] Inicializando base de datos mock para web...');
  isInitialized = true;
  console.log('[WEB-DB] Base de datos mock lista');
};

export const getDatabase = async (): Promise<typeof mockDb> => {
  if (!isInitialized) {
    await initDatabase();
  }
  return mockDb;
};
