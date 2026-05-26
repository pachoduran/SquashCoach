# PRD - Squash Coach

## Problema Original
Aplicación móvil (React Native / Expo) + backend (FastAPI / MongoDB) para análisis de partidos de squash y entrenamiento.

## Requisitos del Producto (vigentes)
1. **Home rediseñado**: dos accesos grandes — "Partidos" y "Sombras".
2. **Entrenamiento de Sombras**: zonas configurables, intervalos, señales visuales/audio.
3. **Historial y análisis de Sombras**: SQLite local + nube, posibilidad de "Repetir rutina".
4. **Local-first auto-sync** (esta sesión):
   - Lecturas/escrituras instantáneas en SQLite.
   - Sincronización en background al volver la conexión o al traer la app al foreground.
   - Banner discreto "Sincronizando…" / "Actualizado" / "Sin conexión".
   - Sin botón manual "Nube".
5. **Despliegue**: Backend en Bluehost (gestionado manualmente por el usuario vía SSH/systemd). Frontend compilado vía EAS.

## Arquitectura
```
/app/
├── backend/          FastAPI · MongoDB (deploy manual a Bluehost)
└── frontend/         Expo Router · React Native
    ├── app/          pantallas (index, partidos, sombras, shadow-training, shadow-history, history, analysis, ...)
    └── src/
        ├── context/  AuthContext · LanguageContext · SyncContext
        ├── components/ SyncBanner · TutorialModal · HeatmapCourt · ...
        ├── store/    database.native.ts · database.web.ts · syncService.ts
        └── i18n/     es.json · en.json
```

## Implementado en esta sesión
- **23/02/2026** Local-first auto-sync completado.
- **25/02/2026** Modo Árbitro completo (Bo1/Bo3/Bo5, timer 90s, persistencia in-progress, historial+nube).

## Despliegue Backend (Bluehost)
- **Ruta del backend**: `/var/www/squash-coach/server.py` (sin subcarpeta `backend/`)
- **Servicio systemd**: `squash-coach` → `/etc/systemd/system/squash-coach.service`

## Google OAuth (cuenta propia del usuario)
- **Proyecto Google Cloud**: `Squash Coach`
- **Web Client ID** (usado en código frontend y backend): `804061220370-kv76t65r6nc8c85a2rhhtu5kin7097s8.apps.googleusercontent.com`
- **Android Client ID** (solo registrado en Google Cloud para que funcione, NO se usa en código): `804061220370-p94811ladus1ca50qi9hn9ggj2kgaro7.apps.googleusercontent.com`
- **Android Package Name**: `com.sqcoash.app`
- **Android SHA-1**: `BF:31:99:F7:5C:CB:64:8F:F3:5C:B2:7A:52:DC:1B:AC:11:20:B3:75` (keystore EAS `Build Credentials RCQBQ0_fF5`)
- **Backend env var requerida**: `GOOGLE_CLIENT_ID=<Web Client ID>`
- **Librería frontend**: `@react-native-google-signin/google-signin@16.1.2` (requiere EAS Build, no Expo Go)
- **Librería backend**: `google-auth` (instalar con `pip install google-auth` en venv del servidor)
- **Procedimiento**: vía PuTTY/SSH
  1. `cd /var/www/squash-coach`
  2. `sudo cp server.py server.py.bak-$(date +%Y%m%d-%H%M%S)`
  3. `sudo curl -fsSL -o server.py.new https://ios-picker-update.preview.emergentagent.com/api/download-server-py`
     - ⚠️ El subdominio del preview de Emergent CAMBIA por sesión. Verifica el actual con `grep EXPO_PUBLIC_BACKEND_URL /app/frontend/.env` antes de pasarle la URL al usuario.
  4. `grep -c "referee-matches" server.py.new` (debe coincidir con la versión nueva)
  5. `sudo mv server.py.new server.py && sudo systemctl restart squash-coach`

## Estado actual
- Frontend: compila ✅ (`Web Bundled OK`, sin errores TS nuevos).
- Backend: ya desplegado por el usuario en Bluehost con endpoints `/api/shadow-routines`.
- Falta: usuario debe compilar APK EAS y validar UX completa.

## Backlog
- **P0** Confirmar en APK EAS que el banner aparece/desaparece correctamente.
- **P1** Verificar comportamiento offline → online.
- **P2** App web read-only para análisis de partidos (carryover).
- **P3** Refactor de `new-match.tsx` (archivo muy grande).
- **P3** Migrar fetch directo de torneos en `history.tsx` y `analysis.tsx` para que pase 100% por `syncService` (actualmente es redundante con SyncContext, pero no rompe nada).
