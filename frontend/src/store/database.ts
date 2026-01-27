import * as SQLite from 'expo-sqlite';

// Singleton para la base de datos
let dbInstance: SQLite.SQLiteDatabase | null = null;
let isInitializing = false;

// Cola de operaciones para serializar acceso a BD
let operationQueue: Array<() => Promise<any>> = [];
let isProcessingQueue = false;

// Procesar cola de operaciones
const processQueue = async () => {
  if (isProcessingQueue || operationQueue.length === 0) return;
  
  isProcessingQueue = true;
  
  while (operationQueue.length > 0) {
    const operation = operationQueue.shift();
    if (operation) {
      try {
        await operation();
      } catch (error) {
        console.error('Error en operación de cola:', error);
      }
    }
  }
  
  isProcessingQueue = false;
};

// Agregar operación a la cola
const queueOperation = <T>(operation: () => Promise<T>): Promise<T> => {
  return new Promise((resolve, reject) => {
    operationQueue.push(async () => {
      try {
        const result = await operation();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
    
    processQueue();
  });
};

// Resetear completamente la BD
const resetDatabase = async () => {
  console.log('RESETEANDO BASE DE DATOS COMPLETAMENTE...');
  
  // Limpiar cola
  operationQueue = [];
  isProcessingQueue = false;
  
  // Cerrar instancia anterior
  if (dbInstance) {
    try {
      await dbInstance.closeAsync();
      console.log('BD anterior cerrada');
    } catch (e) {
      console.log('Error cerrando BD:', e);
    }
    dbInstance = null;
  }
  
  // Esperar un momento
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Reinicializar
  await initDatabase();
  console.log('BD reseteada exitosamente');
};

// Inicializar base de datos
export const initDatabase = async () => {
  if (dbInstance && !isInitializing) {
    console.log('Base de datos ya existe');
    return dbInstance;
  }

  if (isInitializing) {
    console.log('Esperando inicialización...');
    let attempts = 0;
    while (isInitializing && attempts < 100) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    if (dbInstance) return dbInstance;
  }

  isInitializing = true;

  try {
    console.log('Abriendo base de datos...');
    const db = await SQLite.openDatabaseAsync('squash_analyzer.db');
    
    console.log('Creando tablas...');
    
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
    
    dbInstance = db;
    console.log('✅ Base de datos lista');
    return db;
  } catch (error) {
    console.error('❌ Error inicializando BD:', error);
    dbInstance = null;
    throw error;
  } finally {
    isInitializing = false;
  }
};

// Obtener BD con manejo de errores robusto
export const getDatabase = async () => {
  return queueOperation(async () => {
    try {
      if (!dbInstance) {
        console.log('Inicializando BD por primera vez...');
        await initDatabase();
      }
      
      // Verificar que la BD sigue válida
      if (dbInstance) {
        try {
          // Test simple para verificar que funciona
          await dbInstance.getFirstAsync('SELECT 1');
        } catch (testError: any) {
          console.log('BD no responde, reseteando...');
          await resetDatabase();
        }
      }
      
      if (!dbInstance) {
        throw new Error('No se pudo obtener la base de datos');
      }
      
      return dbInstance;
    } catch (error: any) {
      console.error('Error en getDatabase:', error);
      
      // Si hay error, intentar resetear
      if (error.message?.includes('NullPointerException') || 
          error.message?.includes('closed') ||
          error.message?.includes('invalid') ||
          error.message?.includes('prepareAsync')) {
        console.log('Detectado error crítico, reseteando BD...');
        await resetDatabase();
        
        if (!dbInstance) {
          throw new Error('No se pudo recuperar la base de datos');
        }
        
        return dbInstance;
      }
      
      throw error;
    }
  });
};

// Exportar función de reset para uso en emergencias
export const forceResetDatabase = resetDatabase;
