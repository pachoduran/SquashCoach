import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

// =============================================================================
// SOLUCIÓN ROBUSTA PARA EXPO-SQLITE
// Usa una única conexión y manejo síncrono para evitar NullPointerException
// =============================================================================

// Variable global única para la base de datos
let db: SQLite.SQLiteDatabase | null = null;
let isInitialized = false;
let initPromise: Promise<void> | null = null;

// Mutex simple para serializar operaciones
let operationInProgress = false;
const operationQueue: Array<{
  operation: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = async () => {
  if (operationInProgress || operationQueue.length === 0) return;
  
  operationInProgress = true;
  
  while (operationQueue.length > 0) {
    const item = operationQueue.shift()!;
    try {
      const result = await item.operation();
      item.resolve(result);
    } catch (error) {
      item.reject(error);
    }
    // Pequeña pausa para estabilidad
    await new Promise(r => setTimeout(r, 10));
  }
  
  operationInProgress = false;
};

const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
  return new Promise((resolve, reject) => {
    operationQueue.push({ operation, resolve, reject });
    processQueue();
  });
};

// Inicialización de la base de datos
const initializeDatabase = async (): Promise<void> => {
  if (isInitialized && db) {
    return;
  }
  
  if (initPromise) {
    await initPromise;
    return;
  }
  
  initPromise = (async () => {
    try {
      console.log('[DB] Inicializando base de datos...');
      
      // Abrir base de datos de forma síncrona
      db = SQLite.openDatabaseSync('squash_analyzer.db');
      console.log('[DB] Base de datos abierta');
      
      // Crear tablas usando execSync para evitar problemas async
      db.execSync(`
        CREATE TABLE IF NOT EXISTS players (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          nickname TEXT,
          created_at TEXT NOT NULL
        );
      `);
      
      db.execSync(`
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
      
      db.execSync(`
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
      
      db.execSync(`
        CREATE TABLE IF NOT EXISTS custom_reasons (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          is_active INTEGER DEFAULT 1
        );
      `);
      
      // Insertar motivos predeterminados
      const defaultReasons = [
        'Winner', 'Error forzado', 'Error no forzado', 'Let',
        'Drop shot', 'Boast', 'Volley', 'Drive', 'Error en la red', 'Fuera'
      ];
      
      for (const reason of defaultReasons) {
        try {
          db.runSync('INSERT OR IGNORE INTO custom_reasons (name, is_active) VALUES (?, 1)', [reason]);
        } catch (e) {
          // Ignorar errores de duplicados
        }
      }
      
      isInitialized = true;
      console.log('[DB] ✅ Base de datos inicializada correctamente');
    } catch (error) {
      console.error('[DB] ❌ Error inicializando:', error);
      db = null;
      isInitialized = false;
      throw error;
    } finally {
      initPromise = null;
    }
  })();
  
  await initPromise;
};

// =============================================================================
// WRAPPER SEGURO PARA OPERACIONES
// Usa métodos síncronos internamente para evitar NullPointerException
// =============================================================================

class SafeDatabase {
  private getDb(): SQLite.SQLiteDatabase {
    if (!db) {
      throw new Error('Base de datos no inicializada');
    }
    return db;
  }
  
  async runAsync(sql: string, params: any[] = []): Promise<SQLite.SQLiteRunResult> {
    return enqueue(async () => {
      await initializeDatabase();
      const database = this.getDb();
      // Usar método síncrono envuelto en promise
      return database.runSync(sql, params);
    });
  }
  
  async getAllAsync<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return enqueue(async () => {
      await initializeDatabase();
      const database = this.getDb();
      // Usar método síncrono envuelto en promise
      return database.getAllSync(sql, params) as T[];
    });
  }
  
  async getFirstAsync<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    return enqueue(async () => {
      await initializeDatabase();
      const database = this.getDb();
      // Usar método síncrono envuelto en promise
      return database.getFirstSync(sql, params) as T | null;
    });
  }
  
  async execAsync(sql: string): Promise<void> {
    return enqueue(async () => {
      await initializeDatabase();
      const database = this.getDb();
      database.execSync(sql);
    });
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
