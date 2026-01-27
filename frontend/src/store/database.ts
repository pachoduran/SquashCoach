import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

// =============================================================================
// SISTEMA DE COLA PARA OPERACIONES DE BASE DE DATOS
// Serializa TODAS las operaciones para evitar bloqueos por concurrencia
// =============================================================================

type QueuedOperation<T> = {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  id: number;
};

class DatabaseQueue {
  private queue: QueuedOperation<any>[] = [];
  private isProcessing = false;
  private operationCounter = 0;

  async add<T>(operation: () => Promise<T>): Promise<T> {
    const id = ++this.operationCounter;
    
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        execute: operation,
        resolve,
        reject,
        id,
      });
      
      console.log(`[DBQueue] Operación #${id} agregada. Cola: ${this.queue.length}`);
      this.processNext();
    });
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      
      try {
        console.log(`[DBQueue] Ejecutando operación #${item.id}...`);
        const result = await item.execute();
        console.log(`[DBQueue] Operación #${item.id} completada`);
        item.resolve(result);
      } catch (error) {
        console.error(`[DBQueue] Error en operación #${item.id}:`, error);
        item.reject(error);
      }
      
      // Pequeña pausa entre operaciones para estabilidad
      await this.sleep(5);
    }

    this.isProcessing = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStatus(): { queueLength: number; isProcessing: boolean } {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
    };
  }
}

const dbQueue = new DatabaseQueue();

// =============================================================================
// WRAPPER DE BASE DE DATOS CON COLA
// Envuelve la instancia de SQLite para que todas las operaciones pasen por cola
// =============================================================================

class SafeDatabase {
  private db: SQLite.SQLiteDatabase;

  constructor(database: SQLite.SQLiteDatabase) {
    this.db = database;
  }

  async runAsync(sql: string, params: any[] = []): Promise<SQLite.SQLiteRunResult> {
    return dbQueue.add(async () => {
      return await this.db.runAsync(sql, params);
    });
  }

  async getAllAsync<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return dbQueue.add(async () => {
      return await this.db.getAllAsync(sql, params);
    });
  }

  async getFirstAsync<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    return dbQueue.add(async () => {
      return await this.db.getFirstAsync(sql, params);
    });
  }

  async execAsync(sql: string): Promise<void> {
    return dbQueue.add(async () => {
      return await this.db.execAsync(sql);
    });
  }
}

// =============================================================================
// GESTIÓN DE LA INSTANCIA DE BASE DE DATOS
// =============================================================================

let rawDbInstance: SQLite.SQLiteDatabase | null = null;
let safeDbInstance: SafeDatabase | null = null;
let initializationPromise: Promise<SafeDatabase> | null = null;

const createTables = async (db: SQLite.SQLiteDatabase): Promise<void> => {
  console.log('[DB] Creando tablas...');
  
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
  
  // Insertar motivos predeterminados
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
  
  console.log('[DB] Tablas creadas correctamente');
};

// Inicializar base de datos
export const initDatabase = async (): Promise<SafeDatabase> => {
  // Si ya está inicializada, retornar
  if (safeDbInstance) {
    console.log('[DB] Base de datos ya inicializada');
    return safeDbInstance;
  }

  // Si hay una inicialización en progreso, esperar
  if (initializationPromise) {
    console.log('[DB] Esperando inicialización en progreso...');
    return initializationPromise;
  }

  // Crear promesa de inicialización
  initializationPromise = (async (): Promise<SafeDatabase> => {
    try {
      console.log('[DB] Inicializando base de datos...');
      console.log('[DB] Plataforma:', Platform.OS);
      
      // Abrir base de datos
      rawDbInstance = await SQLite.openDatabaseAsync('squash_analyzer.db');
      console.log('[DB] Base de datos abierta');
      
      // Crear tablas directamente (sin pasar por cola aún)
      await createTables(rawDbInstance);
      
      // Crear wrapper seguro
      safeDbInstance = new SafeDatabase(rawDbInstance);
      console.log('[DB] ✅ Base de datos lista');
      
      return safeDbInstance;
    } catch (error) {
      console.error('[DB] ❌ Error inicializando:', error);
      rawDbInstance = null;
      safeDbInstance = null;
      initializationPromise = null;
      throw error;
    }
  })();

  return initializationPromise;
};

// Obtener base de datos
export const getDatabase = async (): Promise<SafeDatabase> => {
  if (safeDbInstance) {
    return safeDbInstance;
  }
  
  return initDatabase();
};

// Función para obtener el estado de la cola (debugging)
export const getDatabaseStatus = () => {
  return {
    isInitialized: safeDbInstance !== null,
    queue: dbQueue.getStatus(),
  };
};

// Exportación por defecto para compatibilidad
export default {
  initDatabase,
  getDatabase,
  getDatabaseStatus,
};
