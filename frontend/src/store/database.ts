// Re-export basado en plataforma
// Metro automáticamente elige:
// - database.native.ts para iOS/Android
// - database.web.ts para web

export * from './database.native';
