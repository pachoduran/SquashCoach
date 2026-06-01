# 🛡️ Squash Coach — Documento Maestro de Respaldo de Infraestructura

> **Última actualización**: 26/05/2026
> **Propósito**: Documento único con TODA la configuración de producción (Cloud Run, MongoDB Atlas, Google OAuth, Bluehost legacy) y todos los problemas resueltos durante la migración. Si pierdes acceso a este chat, este documento te permite reconstruir o mantener la infraestructura.
>
> ⚠️ **CONFIDENCIAL** — Contiene IDs de proyecto, client IDs y rutas internas. No subir a repositorio público.

---

## 📑 Índice

1. [Resumen de Arquitectura](#1-resumen-de-arquitectura)
2. [Google Cloud — Proyecto](#2-google-cloud--proyecto)
3. [MongoDB Atlas](#3-mongodb-atlas)
4. [Google Cloud Run — Backend](#4-google-cloud-run--backend)
5. [Google Secret Manager](#5-google-secret-manager)
6. [Google OAuth — Login con Google](#6-google-oauth--login-con-google)
7. [Bluehost — Backend Legacy](#7-bluehost--backend-legacy)
8. [Frontend — Mobile App](#8-frontend--mobile-app)
9. [Migración de Datos](#9-migración-de-datos)
10. [Problemas Resueltos (Lecciones Aprendidas)](#10-problemas-resueltos-lecciones-aprendidas)
11. [Procedimientos Operativos](#11-procedimientos-operativos)
12. [Cuentas y Credenciales](#12-cuentas-y-credenciales)

---

## 1. Resumen de Arquitectura

```
                                       ┌──────────────────────────────┐
                                       │  Mobile App (React Native)   │
                                       │  Expo EAS APK · com.sqcoash.app
                                       └──────────────┬───────────────┘
                                                      │ HTTPS
                                                      ▼
                                       ┌──────────────────────────────┐
                                       │  Google Cloud Run            │  ◄── PRINCIPAL
                                       │  squash-coach-api            │
                                       │  us-central1                 │
                                       │  Python 3.11 / FastAPI       │
                                       └──────────────┬───────────────┘
                                                      │ mongodb+srv://
                                                      ▼
                                       ┌──────────────────────────────┐
                                       │  MongoDB Atlas M0            │
                                       │  m0.7xx8rpn.mongodb.net      │
                                       │  DB: test_database           │
                                       └──────────────▲───────────────┘
                                                      │ doble-escritura
                                                      │ async
                                       ┌──────────────┴───────────────┐
                                       │  Bluehost VPS (LEGACY)       │  ◄── solo APK viejos
                                       │  lev.jsb.mybluehost.me:8001  │
                                       │  Python 3.6 / FastAPI        │
                                       │  + MongoDB local             │
                                       └──────────────────────────────┘
```

**Estado**: APK nuevos hablan directo con Cloud Run + Atlas. APK viejos siguen pegándole a Bluehost, que replica cada escritura a Atlas para mantener todo sincronizado.

---

## 2. Google Cloud — Proyecto

| Campo | Valor |
|---|---|
| **Nombre del proyecto** | `Squash Coach` |
| **Project ID** | `squash-coach` |
| **Project Number** | `804061220370` |
| **Cuenta propietaria** | `recosfadesarrollo@gmail.com` |
| **Región principal** | `us-central1` (Iowa, USA) |
| **Facturación** | Activa (necesaria para Cloud Run + Secret Manager) |

### APIs habilitadas (necesarias)
- Cloud Run API
- Cloud Build API
- Secret Manager API
- Artifact Registry API
- Identity Toolkit API (para Google Sign-In)

---

## 3. MongoDB Atlas

### Cluster
| Campo | Valor |
|---|---|
| **Cluster name** | `Cluster0` (o el nombre que pusiste al crearlo) |
| **Tipo** | M0 (Free Tier) |
| **Provider** | Google Cloud |
| **Region** | us-central1 (Iowa) |
| **Hostname** | `m0.7xx8rpn.mongodb.net` |
| **Database name** | `test_database` |
| **MongoDB version** | 7.0+ |

### Connection String (formato)
```
mongodb+srv://<USER>:<PASSWORD>@m0.7xx8rpn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
```

> ⚠️ **El valor real con usuario y password está guardado en Google Secret Manager** como `MONGO_URL`. Ver sección 5.

### Network Access (IP Allowlist)
- `0.0.0.0/0` (acceso desde cualquier IP) — necesario porque Cloud Run usa IPs dinámicas. Esto es seguro porque el acceso real está protegido por usuario/password del connection string.

### Database User
- **Username**: el que creaste al configurar Atlas (típicamente `squash-admin` o similar)
- **Permisos**: `readWriteAnyDatabase` en el database `test_database`
- **Password**: guardado en Secret Manager dentro del connection string

### Colecciones principales (DB `test_database`)
- `users` — cuentas de usuarios (email + password hash + google_id opcional)
- `matches` — partidos guardados
- `shots` — tiros individuales (relación a matches)
- `tournaments` — torneos
- `shadow_routines` — rutinas de entrenamiento de sombras
- `shadow_sessions` — sesiones de sombras ejecutadas
- `referee_matches` — partidos arbitrados (modo árbitro)
- `status_checks` — colección de prueba/health

### Backup
- Atlas M0 **NO** incluye backups automáticos.
- **Recomendación**: ejecutar `mongodump` manual cada cierto tiempo o upgradear a M10+ para snapshots continuos.

---

## 4. Google Cloud Run — Backend

### Servicio
| Campo | Valor |
|---|---|
| **Service name** | `squash-coach-api` |
| **Region** | `us-central1` |
| **URL pública** | `https://squash-coach-api-804061220370.us-central1.run.app` |
| **Container image** | `us-central1-docker.pkg.dev/squash-coach/cloud-run-source-deploy/squash-coach-api` |
| **Port** | `8080` |
| **Memory** | `512 MiB` |
| **CPU** | `1` |
| **Min instances** | `0` |
| **Max instances** | `5` (subir si necesitas más concurrencia) |
| **Concurrency** | `80` (default) |
| **Request timeout** | `300 seconds` |
| **Allow unauthenticated** | ✅ Sí (es API pública) |
| **Última revisión validada** | `squash-coach-api-00004-glg` |

### Variables de entorno (en Cloud Run)
| Nombre | Tipo | Valor / Origen |
|---|---|---|
| `DB_NAME` | Plain env var | `test_database` |
| `MONGO_URL` | Secret reference | `MONGO_URL:latest` (de Secret Manager) |
| `GOOGLE_CLIENT_ID` | Secret reference | `GOOGLE_CLIENT_ID:latest` (de Secret Manager) |

### Archivos en el repo de deploy (local en `C:\squash-coach-deploy\`)
1. `server.py` — el código del backend FastAPI (idéntico al de Bluehost, con `_ReplicatedDB` wrapper que **NO** se usa cuando ya está en Atlas)
2. `Dockerfile` — imagen Python 3.11-slim
3. `requirements-cloudrun.txt` — deps Python (fastapi, motor, google-auth, etc.)

### Dockerfile (referencia)
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements-cloudrun.txt .
RUN pip install --no-cache-dir -r requirements-cloudrun.txt
COPY server.py .
ENV PORT=8080
CMD exec uvicorn server:app --host 0.0.0.0 --port ${PORT}
```

### Comando de redeploy (desde local en Windows) — REAL QUE USA EL USUARIO
```bash
cd C:\squash-coach-deploy
gcloud run deploy squash-coach-api --source . --region us-central1
```
> ✅ Los secrets (`MONGO_URL`, `GOOGLE_CLIENT_ID`) y env vars (`DB_NAME=test_database`) ya están configurados en el servicio Cloud Run, así que **no hace falta pasarlos en cada deploy**. gcloud reutiliza la configuración de la última revisión.

### Comando completo (solo si hay que recrear el servicio desde cero)
```bash
gcloud run deploy squash-coach-api ^
  --source . ^
  --region us-central1 ^
  --allow-unauthenticated ^
  --memory 512Mi ^
  --cpu 1 ^
  --min-instances 0 ^
  --max-instances 5 ^
  --set-secrets="MONGO_URL=MONGO_URL:latest,GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID:latest" ^
  --set-env-vars="DB_NAME=test_database"
```

> ℹ️ En Linux/Mac usa `\` en lugar de `^` para los saltos de línea.

### Cómo descargar la última versión de `server.py` desde Emergent
```bash
curl -fsSL -o server.py https://<PREVIEW_URL>/api/download-server-py
```
El `<PREVIEW_URL>` cambia por sesión de Emergent — pídelo al agente antes de descargarlo.

### Test de salud
```bash
curl https://squash-coach-api-804061220370.us-central1.run.app/api/health
# Debe responder: {"status":"ok"}
```

---

## 5. Google Secret Manager

Ubicación: **Google Cloud Console → Security → Secret Manager** (en el proyecto `squash-coach`)

### Secrets configurados

#### 5.1 `MONGO_URL`
- **Valor**: connection string completo de MongoDB Atlas (`mongodb+srv://user:pass@m0.7xx8rpn.mongodb.net/...`)
- **Versión activa**: `latest`
- **Usado por**: Cloud Run (montado como env var `MONGO_URL`)

#### 5.2 `GOOGLE_CLIENT_ID`
- **Valor**: `804061220370-kv76t65r6nc8c85a2rhhtu5kin7097s8.apps.googleusercontent.com`
- **Versión activa**: `latest` (la última creada — versión limpia, sin `\r\n`)
- **Usado por**: Cloud Run (montado como env var `GOOGLE_CLIENT_ID`)

### ⚠️ Cuidado conocido al crear/actualizar un secret

**NUNCA** copies/pegues el valor desde Notepad, WhatsApp, Word o editores ricos — agregan `\r\n` invisibles al final que rompen la verificación del token de Google.

**SIEMPRE**:
1. Pega el valor en el campo de Secret Manager
2. Haz click al final del texto
3. Presiona `Delete`/`Backspace` 2-3 veces hasta asegurar que no haya nada después del último carácter visible
4. Verifica que NO haya espacios al inicio ni al final

### Cómo crear una nueva versión de un secret
1. Google Cloud Console → Secret Manager
2. Click en el nombre del secret (ej: `GOOGLE_CLIENT_ID`)
3. Botón **"+ NEW VERSION"** arriba
4. Pegar valor limpio → **"ADD NEW VERSION"**
5. ⚠️ Cloud Run **NO** recarga el secret automáticamente. Hay que **forzar nueva revisión**:
   - Cloud Run → `squash-coach-api` → **"EDIT & DEPLOY NEW REVISION"** → sin cambiar nada → **"DEPLOY"**

---

## 6. Google OAuth — Login con Google

Ubicación: **Google Cloud Console → APIs & Services → Credentials** (en el proyecto `squash-coach`)

### 6.1 Web Client ID (este es el que **SÍ** se usa en el código)
| Campo | Valor |
|---|---|
| **Tipo** | OAuth 2.0 Client ID — Web application |
| **Client ID** | `804061220370-kv76t65r6nc8c85a2rhhtu5kin7097s8.apps.googleusercontent.com` |
| **Client Secret** | (NO se usa porque verificamos tokens, no hacemos OAuth flow completo) |
| **Authorized origins** | (no requerido para uso solo desde mobile) |
| **Authorized redirect URIs** | (no requerido para uso solo desde mobile) |

**Por qué un Web Client ID si la app es mobile**: `@react-native-google-signin/google-signin` recomienda usar el **Web Client ID** como `webClientId` para emitir tokens ID que el backend puede verificar. El Android Client ID se registra solo para que el SDK funcione, pero NO se referencia en código.

### 6.2 Android Client ID (registrado pero NO referenciado en código)
| Campo | Valor |
|---|---|
| **Tipo** | OAuth 2.0 Client ID — Android |
| **Client ID** | `804061220370-p94811ladus1ca50qi9hn9ggj2kgaro7.apps.googleusercontent.com` |
| **Package name** | `com.sqcoash.app` |
| **SHA-1 certificate fingerprint** | `BF:31:99:F7:5C:CB:64:8F:F3:5C:B2:7A:52:DC:1B:AC:11:20:B3:75` |

### 6.3 EAS Keystore
- **Build credentials** ID en Expo: `RCQBQ0_fF5`
- **SHA-1**: `BF:31:99:F7:5C:CB:64:8F:F3:5C:B2:7A:52:DC:1B:AC:11:20:B3:75`
- **Cómo obtenerlo nuevamente**: `eas credentials` desde el frontend, opción Android → Production → ver fingerprint.

### 6.4 OAuth Consent Screen
- **User Type**: External
- **Publishing status**: Testing o Published (según hayas configurado)
- **Scopes**: `email`, `profile`, `openid`
- ⚠️ Si está en "Testing", solo usuarios listados como test users pueden iniciar sesión. Para producción debe pasar a "In production".

### 6.5 Cómo funciona el flujo
1. App mobile usa el **Web Client ID** (`...kv76t65...`) como `webClientId` en `GoogleSignin.configure()`
2. Usuario hace login con Google → SDK retorna un `idToken`
3. App envía `idToken` al backend en `POST /api/auth/google`
4. Backend usa `google.oauth2.id_token.verify_oauth2_token(idToken, ..., GOOGLE_CLIENT_ID)` con el mismo Web Client ID
5. Si verifica, crea/encuentra usuario en MongoDB → emite JWT propio de Squash Coach

### 6.6 Errores típicos del login con Google
| Error | Causa | Solución |
|---|---|---|
| `DEVELOPER_ERROR (10)` en el cliente | SHA-1 no registrado en Google Cloud, o package name distinto | Verificar `eas credentials`, agregar SHA-1 al Android Client ID |
| `Token has wrong audience` en el backend | `GOOGLE_CLIENT_ID` del backend tiene espacios o `\r\n` | Crear nueva versión limpia del secret + nueva revisión Cloud Run |
| `Email de Google no verificado` | La cuenta de Google del usuario no tiene email verificado | Usuario debe verificar su email en Google |

---

## 7. Bluehost — Backend Legacy

> Esta sección queda como referencia para mantener el servidor viejo activo hasta que TODOS los usuarios actualicen el APK.

| Campo | Valor |
|---|---|
| **Hostname** | `lev.jsb.mybluehost.me` |
| **Backend URL** | `https://lev.jsb.mybluehost.me:8001` |
| **Backend path** | `/var/www/squash-coach/server.py` |
| **Python** | 3.6 (limitación de Bluehost) |
| **MongoDB** | local en el mismo VPS |
| **Servicio systemd** | `squash-coach` → `/etc/systemd/system/squash-coach.service` |
| **SSH** | vía PuTTY con credenciales de Bluehost cPanel |

### Doble-escritura (Bluehost → Atlas)
El `server.py` de Bluehost tiene una clase `_ReplicatedDB` que envuelve cada operación de escritura (insert/update/delete) y la replica de forma asíncrona al cluster de Atlas. Esto asegura que cualquier usuario con APK viejo siga generando datos en Atlas.

### Actualizar `server.py` en Bluehost
```bash
# Por SSH:
cd /var/www/squash-coach
sudo cp server.py server.py.bak-$(date +%Y%m%d-%H%M%S)
sudo curl -fsSL -o server.py.new https://<PREVIEW_EMERGENT>/api/download-server-py
grep -c "referee-matches" server.py.new   # debe coincidir con la versión nueva
sudo mv server.py.new server.py
sudo systemctl restart squash-coach
sudo systemctl status squash-coach        # debe estar "active (running)"
```

### Cuándo decomisionar Bluehost
Cuando el 100% de los usuarios hayan actualizado al APK que apunta a Cloud Run. Indicadores:
- Atlas muestra escrituras desde IPs de Cloud Run (no de Bluehost)
- Logs de Bluehost no muestran requests recientes en `/api/matches`, `/api/auth/*`

---

## 8. Frontend — Mobile App

### Stack
- **Framework**: React Native + Expo (Expo Router)
- **Build**: EAS Build (perfil `preview` para APK de prueba, `production` para Play Store)
- **Package name**: `com.sqcoash.app`
- **Local DB**: SQLite (vía `expo-sqlite`)

### Configuración de URLs (hardcoded en código)
Los siguientes archivos contienen `const BACKEND_URL = 'https://squash-coach-api-804061220370.us-central1.run.app'`:
1. `frontend/app/analysis.tsx`
2. `frontend/app/history.tsx`
3. `frontend/app/new-match.tsx`
4. `frontend/app/match-summary.tsx`
5. `frontend/src/context/AuthContext.tsx`
6. `frontend/src/store/syncService.ts`

> 💡 En una futura iteración, sería bueno mover esta URL a `app.json` `extra` o a una variable EAS para no tener que tocar 6 archivos cada vez.

### Compilar APK
```bash
cd frontend
eas build --platform android --profile preview
```
EAS imprime la URL del APK al terminar (~10-15 min).

### Variables de entorno frontend
- `EXPO_PUBLIC_BACKEND_URL` (en `frontend/.env`) — solo usada en desarrollo. En APK compilado se usa la URL hardcoded.

---

## 9. Migración de Datos (Bluehost → Atlas)

> Ya ejecutada el 26/02/2026. 543 documentos migrados.

### Pasos seguidos
```bash
# En Bluehost (SSH):
mongodump --db test_database --out /tmp/backup_squash_$(date +%Y%m%d)
tar czf /tmp/backup_squash.tar.gz /tmp/backup_squash_*
# Bajar el .tar.gz a tu máquina local

# En tu máquina local:
tar xzf backup_squash.tar.gz
mongorestore --uri "mongodb+srv://<USER>:<PASS>@m0.7xx8rpn.mongodb.net/" \
  --nsInclude="test_database.*" \
  ./tmp/backup_squash_20260226/
```

### Verificación post-migración
```bash
# Conectar a Atlas con mongosh o Compass y validar:
use test_database
db.users.countDocuments()
db.matches.countDocuments()
db.shots.countDocuments()
db.shadow_routines.countDocuments()
```

---

## 10. Problemas Resueltos (Lecciones Aprendidas)

### 10.1 ❌ `Token has wrong audience ...com\r\n`
- **Síntoma**: Login con Google fallaba en el APK con `InvalidValue: Token has wrong audience` y el client ID aparecía con `\r\n` al final.
- **Causa raíz**: Al crear el secret `GOOGLE_CLIENT_ID` en Secret Manager, el valor se pegó desde un editor que agregó salto de línea invisible.
- **Solución aplicada**:
  1. Crear nueva versión del secret `GOOGLE_CLIENT_ID` en Secret Manager con el valor limpio.
  2. Forzar nueva revisión de Cloud Run (`squash-coach-api-00004-glg`).
- **Defensa adicional**: `backend/server.py` ahora hace `.strip()` al `GOOGLE_CLIENT_ID` al leerlo del entorno (pendiente re-deploy a Cloud Run; ya está en el código fuente).
- **Lección**: Nunca pegar secrets desde Notepad/Word/WhatsApp. Siempre verificar con `Backspace` al final.

### 10.2 ❌ `DEVELOPER_ERROR (10)` al apretar "Continuar con Google"
- **Síntoma**: SDK de Google Sign-In rechaza el login con código 10.
- **Causa**: El SHA-1 del APK no coincide con el registrado en el Android Client ID de Google Cloud.
- **Solución**: Obtener SHA-1 con `eas credentials` y registrarlo en Google Cloud Console → Credentials → Android Client ID.

### 10.3 ❌ Partidos duplicados al sincronizar
- **Síntoma**: Después de sincronizar, los matches aparecían dos veces en el historial.
- **Causa**: El proceso de sync re-insertaba matches que ya tenían `server_id`.
- **Solución**: Agregar columna `server_id` a la tabla local SQLite `matches` y filtrar en `syncService.ts` con `WHERE server_id IS NULL` antes de subir, y por `server_id` al bajar.

### 10.4 ❌ `status = 'playing'` quedaba colgado
- **Síntoma**: Partidos terminados aparecían como "en curso" en el historial.
- **Causa**: El estado no se actualizaba al cerrar el partido.
- **Solución**: Forzar `UPDATE matches SET status = 'completed'` en el cierre del flow de match.

### 10.5 ❌ Crash de SQLite en Expo Go
- **Síntoma**: La app crasheaba al abrir varias pantallas que escribían en SQLite concurrentemente.
- **Causa**: Limitación de `expo-sqlite` en Expo Go (modo desarrollo).
- **Workaround**: Usuario compila siempre EAS Preview APK para pruebas, nunca Expo Go.

### 10.6 ❌ `C:\SC\package.json` no existe (npm install falla)
- **Síntoma**: `npm install` fallaba con ENOENT.
- **Causa**: El usuario ejecutaba el comando en la raíz del proyecto, no en `frontend/`.
- **Solución**: `cd frontend` antes de `npm install --legacy-peer-deps`.

---

## 11. Procedimientos Operativos

### 11.1 Cómo actualizar el backend en Cloud Run
1. Pedir al agente de Emergent la URL actual de descarga: `<PREVIEW>/api/download-server-py`
2. En tu carpeta local `C:\squash-coach-deploy\`:
   ```bash
   curl -fsSL -o server.py https://<PREVIEW>/api/download-server-py
   ```
3. Deploy:
   ```bash
   gcloud run deploy squash-coach-api --source . --region us-central1
   ```
4. Probar:
   ```bash
   curl https://squash-coach-api-804061220370.us-central1.run.app/api/health
   ```

### 11.2 Cómo actualizar el frontend (APK)
1. Pull cambios del repo
2. `cd frontend && eas build --platform android --profile preview`
3. Esperar 10-15 min → descargar APK desde el link que da EAS
4. Instalar en el celular (desinstalar el anterior primero si hay conflicto)

### 11.3 Cómo agregar/modificar un secret
1. Secret Manager → click en el secret → **+ NEW VERSION**
2. Pegar valor, presionar `Backspace` 2-3 veces al final
3. **ADD NEW VERSION**
4. Cloud Run → servicio → **EDIT & DEPLOY NEW REVISION** → **DEPLOY** (sin cambiar nada)

### 11.4 Cómo ver logs del backend Cloud Run
- Console: Cloud Run → `squash-coach-api` → **LOGS**
- CLI:
  ```bash
  gcloud run services logs read squash-coach-api --region us-central1 --limit 50
  ```

### 11.5 Cómo hacer backup manual de Atlas
```bash
mongodump --uri "mongodb+srv://<USER>:<PASS>@m0.7xx8rpn.mongodb.net/test_database" \
  --out ./atlas_backup_$(date +%Y%m%d)
```

### 11.6 Cómo conectar a Atlas con MongoDB Compass
- Descarga Compass: https://www.mongodb.com/products/compass
- Connection string: el mismo que está en Secret Manager (`MONGO_URL`)
- Database: `test_database`

---

## 12. Cuentas y Credenciales

> 🔐 **Lista de cuentas necesarias** para mantener el sistema. No incluye passwords (debes guardarlos tú en un manager).

| Servicio | Cuenta / Usuario | Dónde se obtiene la credencial |
|---|---|---|
| Google Cloud Console | `recosfadesarrollo@gmail.com` | Tu password de Google |
| MongoDB Atlas | Tu cuenta de Atlas | Tu password de Atlas |
| Atlas DB User | (el que creaste, ej. `squash-admin`) | Lo guardaste al crearlo. Está en `MONGO_URL` secret. |
| Expo / EAS | Tu cuenta de Expo | Tu password de Expo |
| Google Play Console | Tu cuenta de Google Play | Cuenta de developer ($25 USD único pago) |
| Bluehost cPanel | Tu cuenta de Bluehost | Tu password de Bluehost |
| Bluehost SSH | (usuario SSH de cPanel) | Tu password de SSH |
| GitHub (si usas Save to GitHub) | Tu cuenta de GitHub | Tu password / token |

### Cuenta de test manual (creada para QA en dev)
- Email: `shadowtest@test.com`
- Password: `test12345`
- (Se borra automáticamente con `DELETE /api/user-data` cuando termina el test)

---

## 📋 Resumen rápido de URLs e IDs importantes

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Cloud Run URL                                                            │
│   https://squash-coach-api-804061220370.us-central1.run.app              │
├──────────────────────────────────────────────────────────────────────────┤
│ MongoDB Atlas Host                                                       │
│   m0.7xx8rpn.mongodb.net                                                 │
│   DB: test_database                                                      │
├──────────────────────────────────────────────────────────────────────────┤
│ Google Cloud Project                                                     │
│   ID: squash-coach                                                       │
│   Number: 804061220370                                                   │
├──────────────────────────────────────────────────────────────────────────┤
│ Google OAuth Web Client ID                                               │
│   804061220370-kv76t65r6nc8c85a2rhhtu5kin7097s8.apps.googleusercontent.com│
├──────────────────────────────────────────────────────────────────────────┤
│ Google OAuth Android Client ID                                           │
│   804061220370-p94811ladus1ca50qi9hn9ggj2kgaro7.apps.googleusercontent.com│
├──────────────────────────────────────────────────────────────────────────┤
│ Android Package                                                          │
│   com.sqcoash.app                                                        │
│   SHA-1: BF:31:99:F7:5C:CB:64:8F:F3:5C:B2:7A:52:DC:1B:AC:11:20:B3:75     │
├──────────────────────────────────────────────────────────────────────────┤
│ Bluehost Legacy                                                          │
│   https://lev.jsb.mybluehost.me:8001                                     │
└──────────────────────────────────────────────────────────────────────────┘
```

---

**📌 Nota final**: Este documento debe actualizarse cada vez que cambies algo de infraestructura (nuevo secret, cambio de URL, nuevo SHA-1, etc.). Mantenlo cerca cuando trabajes con el agente de Emergent — es la "memoria" de tu stack.
