import * as SQLite from 'expo-sqlite';

// =============================================================================
// SOLUCIÓN PARA EXPO-SQLITE SDK 51 - API NUEVA (openDatabaseSync)
// =============================================================================

let db: SQLite.SQLiteDatabase | null = null;
let isInitialized = false;

// Inicialización de la base de datos
const initializeDatabase = async (): Promise<void> => {
  if (isInitialized && db) {
    return;
  }
  
  try {
    console.log('[DB] Inicializando base de datos...');
    
    // SDK 51: usar openDatabaseSync (API nueva)
    db = SQLite.openDatabaseSync('squash_analyzer.db');
    console.log('[DB] Base de datos abierta');
    
    // Crear tablas
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nickname TEXT NOT NULL,
        user_id TEXT,
        created_at TEXT NOT NULL
      );
    `);
    
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player1_id INTEGER NOT NULL,
        player2_id INTEGER NOT NULL,
        my_player_id INTEGER NOT NULL,
        best_of INTEGER NOT NULL,
        winner_id INTEGER,
        date TEXT NOT NULL,
        status TEXT NOT NULL,
        current_game INTEGER DEFAULT 1,
        player1_games INTEGER DEFAULT 0,
        player2_games INTEGER DEFAULT 0,
        tournament_name TEXT,
        match_date TEXT,
        user_id TEXT,
        FOREIGN KEY (player1_id) REFERENCES players (id),
        FOREIGN KEY (player2_id) REFERENCES players (id),
        FOREIGN KEY (my_player_id) REFERENCES players (id)
      );
    `);
    
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS points (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_id INTEGER NOT NULL,
        position_x REAL NOT NULL,
        position_y REAL NOT NULL,
        winner_player_id INTEGER NOT NULL,
        reason TEXT NOT NULL,
        my_player_pos_x REAL,
        my_player_pos_y REAL,
        opponent_pos_x REAL,
        opponent_pos_y REAL,
        game_number INTEGER NOT NULL,
        point_number INTEGER NOT NULL,
        player1_score INTEGER NOT NULL,
        player2_score INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (match_id) REFERENCES matches (id)
      );
    `);
    
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS game_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_id INTEGER NOT NULL,
        game_number INTEGER NOT NULL,
        player1_score INTEGER NOT NULL,
        player2_score INTEGER NOT NULL,
        winner_id INTEGER,
        FOREIGN KEY (match_id) REFERENCES matches (id)
      );
    `);
    
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS custom_reasons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        is_active INTEGER DEFAULT 1
      );
    `);
    
    // Insertar motivos predeterminados - Nuevos motivos de squash
    const defaultReasons = [
      'Nick', 'Dos paredes', 'Drop', 'Paralela', 'Cruzada', 
      'Alta', 'Chapa', 'Stroke', 'No contestó', 'Globo', 
      'Kill', 'Volea', 'Saque'
    ];
    
    for (const reason of defaultReasons) {
      try {
        await db.runAsync(
          'INSERT OR IGNORE INTO custom_reasons (name, is_active) VALUES (?, 1)',
          [reason]
        );
      } catch (e) {
        // Ignorar si ya existe
      }
    }
    
    console.log('[DB] ✅ Tablas creadas correctamente');
    
    // Migraciones
    await runMigrations();
    
    isInitialized = true;
    console.log('[DB] ✅ Base de datos inicializada correctamente');
  } catch (error) {
    console.error('[DB] ❌ Error inicializando:', error);
    db = null;
    isInitialized = false;
    throw error;
  }
};

// Migraciones
const runMigrations = async (): Promise<void> => {
  if (!db) return;
  
  const migrations = [
    "ALTER TABLE matches ADD COLUMN tournament_name TEXT",
    "ALTER TABLE matches ADD COLUMN match_date TEXT",
    "ALTER TABLE matches ADD COLUMN user_id TEXT",
    "ALTER TABLE players ADD COLUMN user_id TEXT",
  ];
  
  for (const sql of migrations) {
    try {
      await db.execAsync(sql);
    } catch (e) {
      // Ignorar errores de columnas existentes
    }
  }
  
  // Migración de motivos: limpiar antiguos y agregar nuevos
  try {
    // Desactivar motivos antiguos
    const oldReasons = [
      'Winner', 'Error forzado', 'Error no forzado', 'Let',
      'Drop shot', 'Boast', 'Volley', 'Drive', 'Error en la red', 'Fuera'
    ];
    for (const reason of oldReasons) {
      await db.runAsync('UPDATE custom_reasons SET is_active = 0 WHERE name = ?', [reason]);
    }
    
    // Agregar nuevos motivos si no existen
    const newReasons = [
      'Nick', 'Dos paredes', 'Drop', 'Paralela', 'Cruzada', 
      'Alta', 'Chapa', 'Stroke', 'No contestó', 'Globo', 
      'Kill', 'Volea', 'Saque'
    ];
    for (const reason of newReasons) {
      await db.runAsync(
        'INSERT OR IGNORE INTO custom_reasons (name, is_active) VALUES (?, 1)',
        [reason]
      );
      // Asegurar que estén activos
      await db.runAsync('UPDATE custom_reasons SET is_active = 1 WHERE name = ?', [reason]);
    }
    console.log('[DB] ✅ Motivos actualizados');
  } catch (e) {
    console.log('[DB] Error actualizando motivos:', e);
  }
};

// =============================================================================
// WRAPPER PARA OPERACIONES
// =============================================================================

class SafeDatabase {
  async runAsync(sql: string, params: any[] = []): Promise<{ lastInsertRowId: number; changes: number }> {
    await initializeDatabase();
    const result = await db!.runAsync(sql, params);
    return {
      lastInsertRowId: result.lastInsertRowId,
      changes: result.changes,
    };
  }
  
  async getAllAsync<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    await initializeDatabase();
    return await db!.getAllAsync(sql, params) as T[];
  }
  
  async getFirstAsync<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    await initializeDatabase();
    return await db!.getFirstAsync(sql, params) as T | null;
  }
  
  async execAsync(sql: string): Promise<void> {
    await initializeDatabase();
    await db!.execAsync(sql);
  }
}

// Instancia única del wrapper
const safeDb = new SafeDatabase();

// =============================================================================
// EXPORTS
// =============================================================================

export const initDatabase = async (): Promise<SafeDatabase> => {
  await initializeDatabase();
  return safeDb;
};

export const getDatabase = async (): Promise<SafeDatabase> => {
  await initializeDatabase();
  return safeDb;
};

export default {
  initDatabase,
  getDatabase,
};
