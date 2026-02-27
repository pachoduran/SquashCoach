# Squash Coach V3 - PRD

## Problema Original
App móvil React Native (Expo) para tracking y análisis de partidos de squash. El objetivo principal es publicarla en Google Play Store.

## Stack Técnico
- **Frontend**: React Native con Expo SDK 54 (React 19.1.0, RN 0.81.5)
- **Backend**: FastAPI en Bluehost (https://lev.jsb.mybluehost.me:8001)
- **DB**: SQLite local + sincronización cloud
- **Build**: EAS Build (cloud)
- **Repo**: https://github.com/pachoduran/SquashCoach

## Funcionalidades Implementadas
- Autenticación (Email/Password & Google) con cloud sync
- Base de datos SQLite local para almacenamiento offline
- Creación de partidos y seguimiento en tiempo real
- Resúmenes detallados y análisis de partidos (heatmaps)
- Vista de partidos guardados en la nube
- Flujo completo de eliminación de cuenta (Play Store compliance)
- Logo personalizado integrado
- Privacy Policy y Data Deletion docs

## Estado Actual - Feb 2026

### Completado en esta sesión
- Corregida incompatibilidad Kotlin/Compose para build Expo SDK 54
  - Añadido `kotlinVersion = "2.2.0"` en `android/build.gradle`
  - Instalado y configurado plugin `expo-build-properties` en `app.json`
  - Actualizado `buildToolsVersion` a `"35.0.0"`

### Bloqueador Resuelto
- **Error original**: "Compose Compiler requires Kotlin version 1.9.25 but you appear to be using Kotlin version 1.9.24"
- **Solución**: Forzar Kotlin 2.2.0 (compatible con Expo SDK 54 / RN 0.81) vía `build.gradle` + `expo-build-properties` plugin

### Pendiente - Requiere Acción del Usuario
1. Guardar cambios a GitHub (usar "Save to Github" en Emergent)
2. Pull en local y ejecutar `eas build --profile production`
3. Subir AAB generado a Google Play Console -> Closed Testing
4. Configurar 12 testers y comenzar período de 14 días

### Backlog
- Verificar endpoint DELETE /api/auth/account en Bluehost
- Pruebas de regresión post-build exitoso

## Configuración Android (Google Play)
- `targetSdkVersion`: 35 (requerido por Google Play)
- `compileSdkVersion`: 35
- `buildToolsVersion`: 35.0.0
- `kotlinVersion`: 2.2.0
- `minSdkVersion`: 23

## Credenciales de Test
- App Test User: googleplayreview@squashcoach.app / ReviewSquash2025!
