import * as SQLite from 'expo-sqlite';

// Inicializar base de datos
export const initDatabase = async () => {
  try {
    const db = await SQLite.openDatabaseAsync('squash_analyzer.db');
    
    // Tabla de jugadores
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        nickname TEXT,
        created_at TEXT NOT NULL
      );
    `);
    
    // Tabla de partidos
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
        FOREIGN KEY (player1_id) REFERENCES players (id),
        FOREIGN KEY (player2_id) REFERENCES players (id),
        FOREIGN KEY (my_player_id) REFERENCES players (id)
      );
    `);
    
    // Tabla de puntos
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
    
    // Tabla de motivos personalizados
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS custom_reasons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        is_active INTEGER DEFAULT 1
      );
    `);
    
    // Insertar motivos predeterminados si no existen
    const defaultReasons = [
      'Winner',
      'Error forzado',
      'Error no forzado',
      'Let',
      'Drop shot',
      'Boast',
      'Volley',
      'Drive',
      'Error en la red',
      'Fuera'
    ];
    
    for (const reason of defaultReasons) {
      await db.runAsync(
        'INSERT OR IGNORE INTO custom_reasons (name, is_active) VALUES (?, 1)',
        [reason]
      );
    }
    
    console.log('Base de datos inicializada correctamente');
    return db;
  } catch (error) {
    console.error('Error inicializando base de datos:', error);
    throw error;
  }
};

// Obtener instancia de la base de datos
let dbInstance: SQLite.SQLiteDatabase | null = null;

export const getDatabase = async () => {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync('squash_analyzer.db');
  }
  return dbInstance;
};
