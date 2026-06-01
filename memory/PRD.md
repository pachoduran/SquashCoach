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
- **25/02/2026** Login con Google (OAuth propio del usuario, no Emergent-managed).
- **26/02/2026** Migración completa a Google Cloud Run + MongoDB Atlas M0:
  - Cloud Run: `https://squash-coach-api-804061220370.us-central1.run.app`
  - MongoDB Atlas M0 (us-central1, cluster `m0.7xx8rpn`)
  - 543 documents migrados con `mongodump`/`mongorestore`
  - Doble-escritura activa en Bluehost (escribe local + replica a Atlas async)
  - Frontend: URLs cambiadas en 6 archivos para apuntar a Cloud Run
- **26/05/2026** APK Cloud Run validado en producción por el usuario:
  - Login con Google funcionando ✅
  - Fix: backend `server.py` ahora hace `.strip()` al `GOOGLE_CLIENT_ID` (defensa contra `\r\n` en Secret Manager)
  - Root cause del error `wrong audience`: el secreto `GOOGLE_CLIENT_ID` en Secret Manager tenía `\r\n` al final. Se creó nueva versión limpia y nueva revisión de Cloud Run (`squash-coach-api-00004-glg`).
- **26/05/2026** Versionado a 3.11.0 (iOS buildNumber 6, Android versionCode 14) — pendiente build EAS y publicación en stores.
- **26/05/2026** Feature **Banners/Anuncios remotos**:
  - Backend: nueva colección `banners` con CRUD admin (email `franciscoduransaa@gmail.com`) + endpoint público `GET /api/banners/active`.
  - Frontend: `BannerModal` aparece al abrir login (cada vez, sin persistencia de dismissal). Soporta imagen, video MP4, YouTube y texto + botón con link externo.
  - Admin: pantalla `app/admin-banners.tsx` (botón visible en Settings solo para email admin). Permite crear/editar/borrar/activar banners.
  - Pendiente: re-deploy backend a Cloud Run para que el feature funcione en producción.

## Despliegue Backend (Bluehost - LEGACY, en migración)
- **Ruta del backend**: `/var/www/squash-coach/server.py` (sin subcarpeta `backend/`)
- **Servicio systemd**: `squash-coach` → `/etc/systemd/system/squash-coach.service`

## Despliegue Backend (Google Cloud Run - NUEVO PRINCIPAL)
- **Service URL**: `https://squash-coach-api-804061220370.us-central1.run.app`
- **Project**: `squash-coach` (Project Number 804061220370)
- **Region**: `us-central1`
- **MongoDB**: Atlas M0 cluster `m0.7xx8rpn.mongodb.net` (provider: Google Cloud, region us-central1)
- **DB name**: `test_database`
- **Secrets en Secret Manager**: `MONGO_URL`, `GOOGLE_CLIENT_ID`
- **Imagen Docker**: `python:3.11-slim` con `requirements-cloudrun.txt`
- **Comando de redeploy**: `gcloud run deploy squash-coach-api --source . --region us-central1 --allow-unauthenticated --memory 512Mi --cpu 1 --min-instances 0 --max-instances 5 --set-secrets="MONGO_URL=MONGO_URL:latest,GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID:latest" --set-env-vars="DB_NAME=test_database"` desde `C:\squash-coach-deploy\`
- **Archivos en el repo de deploy**: `server.py`, `Dockerfile`, `requirements-cloudrun.txt` (los 3 se descargan desde `/api/download-*` del preview de Emergent)

## Google OAuth (cuenta propia del usuario)
- **Proyecto Google Cloud**: `squash-coach` (Project Number: 804061220370)
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
- Frontend: compila ✅ (`shadow-training.tsx` sin errores TS nuevos tras añadir presets).
- Backend: endpoints `/api/shadow-presets` (GET/POST/DELETE) validados en local (200 OK con auth).
- ⚠️ **Cloud Run NO tiene aún los endpoints de Shadow Presets ni de Banners** → requiere redeploy desde `C:\squash-coach-deploy\`.
- Falta: usuario debe (1) re-deployar backend a Cloud Run, (2) sincronizar archivos frontend, (3) compilar APK EAS.

## Implementado adicional (01/06/2026)
- **Shadow Training Presets** (P0 completado en código):
  - Backend: colección `shadow_presets` (user_id, name, zone_mode, zone_ids). Endpoints `GET/POST/DELETE /api/shadow-presets` scoped por usuario → **sincroniza entre dispositivos al iniciar sesión** (Atlas en la nube).
  - Frontend: dropdown desplegable en `shadow-training.tsx` con áreas predefinidas (Toda/Delantera/Trasera/Drive/Revés) + presets personalizados del usuario + modal para guardar la selección actual con nombre + botón papelera para borrar.
  - i18n añadido (es/en): `shadow.saveCurrent`, `shadow.savePresetTitle`, `shadow.presetNamePlaceholder`, `shadow.presetNameRequired`, `shadow.deletePresetConfirm`.
  - Estilos: `dropdownBtn/List/Item/...`, `modalOverlay/Card/Btn/...` añadidos al StyleSheet.

## Backlog
- **P0** Re-deploy backend a Cloud Run (endpoints `/api/shadow-presets` + `/api/banners*` pendientes en producción).
- **P0** Build EAS APK preview y validar UX de presets en dispositivo.
- **P1** Toggle Diestro/Zurdo en Shadow Training (invertir filtros Drive/Revés).
- **P1** Pulir módulo Ritmo (BPM) — pendiente requisitos del usuario.
- **P2** Subida de música/audio personalizado para el Cronómetro HIIT.
- **P2** App web read-only para análisis de partidos.
- **P2** Decomisionar servidor legacy Bluehost (Fase 5).
- **P3** Refactor de `shadow-training.tsx` (≈1500 líneas) y de los 15+ endpoints `/api/download-*` en `server.py`.
