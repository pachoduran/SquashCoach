import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Importación condicional de SQLite solo para móvil
const SQLite = Platform.OS !== 'web' ? require('expo-sqlite') : null;

// Mock database para web
class MockDatabase {
  private data: { [key: string]: any[] } = {
    players: [],
    matches: [],
    points: [],
    custom_reasons: [],
  };

  async execAsync(sql: string) {
    // Inicialización de tablas
    console.log('Mock DB: execAsync', sql.substring(0, 50));
  }

  async runAsync(sql: string, params: any[] = []) {
    console.log('Mock DB: runAsync', sql.substring(0, 50), params);
    
    // INSERT
    if (sql.toUpperCase().includes('INSERT INTO players')) {
      const id = this.data.players.length + 1;
      this.data.players.push({ id, name: params[0], nickname: params[1], created_at: params[2] });
      await this.saveData();
      return { lastInsertRowId: id };
    }
    
    if (sql.toUpperCase().includes('INSERT INTO matches')) {
      const id = this.data.matches.length + 1;
      this.data.matches.push({
        id,
        player1_id: params[0],
        player2_id: params[1],
        my_player_id: params[2],
        best_of: params[3],
        date: params[4],
        status: params[5],
        current_game: params[6],
        player1_games: params[7],
        player2_games: params[8],
      });
      await this.saveData();
      return { lastInsertRowId: id };
    }
    
    if (sql.toUpperCase().includes('INSERT INTO points')) {
      const id = this.data.points.length + 1;
      this.data.points.push({
        id,
        match_id: params[0],
        position_x: params[1],
        position_y: params[2],
        winner_player_id: params[3],
        reason: params[4],
        my_player_pos_x: params[5],
        my_player_pos_y: params[6],
        opponent_pos_x: params[7],
        opponent_pos_y: params[8],
        game_number: params[9],
        point_number: params[10],
        player1_score: params[11],
        player2_score: params[12],
        created_at: params[13],
      });
      await this.saveData();
      return { lastInsertRowId: id };
    }
    
    if (sql.toUpperCase().includes('INSERT INTO custom_reasons') || sql.toUpperCase().includes('INSERT OR IGNORE')) {
      const existing = this.data.custom_reasons.find((r: any) => r.name === params[0]);
      if (!existing) {
        const id = this.data.custom_reasons.length + 1;
        this.data.custom_reasons.push({ id, name: params[0], is_active: 1 });
        await this.saveData();
      }
      return { lastInsertRowId: this.data.custom_reasons.length };
    }
    
    // UPDATE
    if (sql.toUpperCase().includes('UPDATE matches')) {
      // Simplificado para demo
      await this.saveData();
    }
    
    if (sql.toUpperCase().includes('UPDATE custom_reasons')) {
      const id = params[1];
      const reason = this.data.custom_reasons.find((r: any) => r.id === id);
      if (reason) {
        reason.is_active = params[0];
        await this.saveData();
      }
    }
    
    // DELETE
    if (sql.toUpperCase().includes('DELETE FROM custom_reasons')) {
      this.data.custom_reasons = this.data.custom_reasons.filter((r: any) => r.id !== params[0]);
      await this.saveData();
    }
    
    return { lastInsertRowId: 0 };
  }

  async getAllAsync(sql: string, params: any[] = []) {
    console.log('Mock DB: getAllAsync', sql.substring(0, 50), params);
    
    if (sql.includes('FROM players')) {
      return this.data.players;
    }
    
    if (sql.includes('FROM custom_reasons')) {
      if (sql.includes('WHERE is_active = 1')) {
        return this.data.custom_reasons.filter((r: any) => r.is_active === 1);
      }
      return this.data.custom_reasons;
    }
    
    if (sql.includes('FROM matches')) {
      return this.data.matches.map((m: any) => ({
        ...m,
        player1_name: this.data.players.find((p: any) => p.id === m.player1_id)?.name || '',
        player2_name: this.data.players.find((p: any) => p.id === m.player2_id)?.name || '',
        winner_name: m.winner_id ? this.data.players.find((p: any) => p.id === m.winner_id)?.name : null,
      }));
    }
    
    if (sql.includes('FROM points')) {
      const matchId = params[0];
      return this.data.points.filter((p: any) => p.match_id === matchId);
    }
    
    return [];
  }

  async getFirstAsync(sql: string, params: any[] = []) {
    const results = await this.getAllAsync(sql, params);
    return results[0] || null;
  }

  private async saveData() {
    try {
      await AsyncStorage.setItem('squash_db', JSON.stringify(this.data));
    } catch (error) {
      console.error('Error saving mock DB:', error);
    }
  }

  async loadData() {
    try {
      const data = await AsyncStorage.getItem('squash_db');
      if (data) {
        this.data = JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading mock DB:', error);
    }
  }
}

let mockDb: MockDatabase | null = null;

// Inicializar base de datos
export const initDatabase = async () => {
  if (Platform.OS === 'web') {
    console.log('Usando Mock Database para Web');
    mockDb = new MockDatabase();
    await mockDb.loadData();
    
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
      await mockDb.runAsync(
        'INSERT OR IGNORE INTO custom_reasons (name, is_active) VALUES (?, 1)',
        [reason]
      );
    }
    
    return mockDb;
  }
  
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
let dbInstance: SQLite.SQLiteDatabase | MockDatabase | null = null;

export const getDatabase = async () => {
  if (Platform.OS === 'web') {
    if (!mockDb) {
      mockDb = new MockDatabase();
      await mockDb.loadData();
    }
    return mockDb;
  }
  
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync('squash_analyzer.db');
  }
  return dbInstance;
};
