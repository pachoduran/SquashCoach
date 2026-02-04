import * as SQLite from 'expo-sqlite';

// =============================================================================
// SOLUCIÓN PARA EXPO-SQLITE SDK 51
// =============================================================================

let db: SQLite.SQLiteDatabase | null = null;
let isInitialized = false;
let initPromise: Promise<void> | null = null;

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
      
      // SDK 51: usar openDatabase (no openDatabaseSync)
      db = SQLite.openDatabase('squash_analyzer.db');
      console.log('[DB] Base de datos abierta');
      
      // Crear tablas usando transacción
      await new Promise<void>((resolve, reject) => {
        db!.transaction(
          (tx) => {
            // Tabla de jugadores
            tx.executeSql(`
              CREATE TABLE IF NOT EXISTS players (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nickname TEXT NOT NULL,
                user_id TEXT,
                created_at TEXT NOT NULL
              );
            `);
            
            // Tabla de partidos
            tx.executeSql(`
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
            
            // Tabla de puntos
            tx.executeSql(`
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
            
            // Tabla de resultados de games
            tx.executeSql(`
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
            
            // Tabla de motivos personalizados
            tx.executeSql(`
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
              tx.executeSql(
                'INSERT OR IGNORE INTO custom_reasons (name, is_active) VALUES (?, 1)',
                [reason]
              );
            }
          },
          (error) => {
            console.error('[DB] Error en transacción:', error);
            reject(error);
          },
          () => {
            console.log('[DB] ✅ Tablas creadas correctamente');
            resolve();
          }
        );
      });
      
      // Migraciones para agregar columnas si no existen
      await runMigrations();
      
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

// Migraciones
const runMigrations = async (): Promise<void> => {
  if (!db) return;
  
  // Intentar agregar columnas si no existen
  const migrations = [
    "ALTER TABLE matches ADD COLUMN tournament_name TEXT",
    "ALTER TABLE matches ADD COLUMN match_date TEXT",
    "ALTER TABLE matches ADD COLUMN user_id TEXT",
    "ALTER TABLE players ADD COLUMN user_id TEXT",
  ];
  
  for (const sql of migrations) {
    try {
      await new Promise<void>((resolve) => {
        db!.transaction(
          (tx) => {
            tx.executeSql(sql);
          },
          () => resolve(), // Error = columna ya existe, ignorar
          () => resolve()
        );
      });
    } catch (e) {
      // Ignorar errores de columnas existentes
    }
  }
};

// =============================================================================
// WRAPPER PARA OPERACIONES
// =============================================================================

class SafeDatabase {
  async runAsync(sql: string, params: any[] = []): Promise<{ insertId?: number; rowsAffected: number }> {
    await initializeDatabase();
    
    return new Promise((resolve, reject) => {
      db!.transaction(
        (tx) => {
          tx.executeSql(
            sql,
            params,
            (_, result) => {
              resolve({
                insertId: result.insertId,
                rowsAffected: result.rowsAffected,
              });
            },
            (_, error) => {
              reject(error);
              return false;
            }
          );
        },
        (error) => reject(error)
      );
    });
  }
  
  async getAllAsync<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    await initializeDatabase();
    
    return new Promise((resolve, reject) => {
      db!.transaction(
        (tx) => {
          tx.executeSql(
            sql,
            params,
            (_, result) => {
              const rows: T[] = [];
              for (let i = 0; i < result.rows.length; i++) {
                rows.push(result.rows.item(i));
              }
              resolve(rows);
            },
            (_, error) => {
              reject(error);
              return false;
            }
          );
        },
        (error) => reject(error)
      );
    });
  }
  
  async getFirstAsync<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const results = await this.getAllAsync<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }
  
  async execAsync(sql: string): Promise<void> {
    await initializeDatabase();
    
    return new Promise((resolve, reject) => {
      db!.exec([{ sql, args: [] }], false, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
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
