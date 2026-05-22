# Squash Coach – Product Requirements

## Original Problem Statement
The user is building **Squash Coach**, a mobile app (React Native / Expo) plus a
FastAPI + MongoDB backend, that lets squash players:

1. **Track matches** point-by-point with heat-maps and analysis.
2. **Train Shadows** (Entrenamiento de sombras) — interval-based footwork drills
   that cycle the player through 6 or 12 court zones (clock-style) with
   configurable timing, audio cues, large UI text visible from 5 m, and
   bilingual (ES/EN) translations.
3. **Sync everything to the cloud** so progress is not lost between devices.

The home screen exposes two large entry points: **Partidos** and **Sombras**.

## Personas
- **Player / Coach** — wants quick access to start a match or a shadows session,
  review history, share results.

## Core Requirements (current state)
| Area | Status |
|---|---|
| Dual-path home screen (Partidos / Sombras) | ✅ Done |
| Match Hub (`partidos.tsx`) | ✅ Done |
| Shadow Training screen (`shadow-training.tsx`) | ✅ Done |
| 6 / 12 zone clock-style positions | ✅ Done |
| Configurable intervals from 0.5 s | ✅ Done |
| Distinct audio cues (start / end / zone change) | ✅ Done |
| Bilingual EN/ES translations | ✅ Done (incl. new screens) |
| Local persistence of shadow routines (SQLite) | ✅ Done |
| **Shadow Hub `sombras.tsx`** (New Shadow / History) | ✅ Done — 2026-02 |
| **Shadow History screen** (list + bar chart + repeat) | ✅ Done — 2026-02 |
| **Cloud sync of shadow routines** (`/api/shadow-routines`) | ✅ Done — 2026-02 |
| Match cloud sync | ✅ Done |
| Shared match viewing | ✅ Done |
| Auth (email/password + JWT-like session token) | ✅ Done |
| EAS Preview APK build for testing | 🟡 User running it |

## Changelog (2026-02 session)
- **Fixed**: stray `{` syntax error in `shadow-training.tsx` (stopTraining alert).
- **Added**: backend models `ShadowRoutine`, `ShadowRoutineCreate`.
- **Added**: endpoints `POST/GET/DELETE /api/shadow-routines`.
- **Updated**: `DELETE /api/user-data` to wipe `shadow_routines` collection.
- **Updated**: `database.native.ts` — added `synced`, `server_id`, `name`
  columns to `shadow_routines` via idempotent migrations.
- **Added**: `syncService.syncShadowRoutines`, `restoreShadowRoutinesFromCloud`,
  `deleteShadowRoutineCloud`.
- **New screen**: `sombras.tsx` — hub with "Nueva Sombra" + "Historial".
- **New screen**: `shadow-history.tsx` — summary (sessions / zones / time),
  bar chart of sessions per week (gifted-charts), per-routine card with
  Repetir & Eliminar buttons. Cloud sync icon per row.
- **Updated**: `shadow-training.tsx` — reads route params for prefilled config
  (Repetir rutina), added "Historial" header button, save now marks
  `synced=0` then fires `syncShadowRoutines()` and routes back to `/sombras`.
- **Updated**: `_layout.tsx` — registered `sombras` and `shadow-history` routes.
- **Updated**: `index.tsx` — "Sombras" button now routes to `/sombras` hub.
- **Translations**: added `sombras.*` and `shadowHistory.*` keys in ES & EN.
- **Tests**: `/app/backend/tests/test_shadow_routines.py` — 15/15 passing.

## Architecture
```
/app/
├── backend/
│   ├── server.py          # FastAPI + Motor MongoDB
│   └── tests/
│       └── test_shadow_routines.py
└── frontend/
    ├── app/
    │   ├── index.tsx            # Home (Partidos/Sombras buttons)
    │   ├── partidos.tsx         # Match hub
    │   ├── sombras.tsx          # NEW – Shadows hub
    │   ├── shadow-training.tsx  # Drill engine + config
    │   ├── shadow-history.tsx   # NEW – history list + chart + repeat
    │   ├── ...                  # match-play, history, analysis, share…
    │   └── _layout.tsx
    └── src/
        ├── store/
        │   ├── database.native.ts  # SQLite + migrations (shadow_routines)
        │   └── syncService.ts      # cloud sync incl. shadows
        └── i18n/{es,en}.json       # bilingual strings
```

## Key API Endpoints (added)
- `POST   /api/shadow-routines`        → create routine (auth)
- `GET    /api/shadow-routines`        → list routines (auth, newest first)
- `DELETE /api/shadow-routines/{id}`   → delete owned routine (auth)
- `DELETE /api/user-data`              → wipes all user data incl. shadow_routines

## Backlog
- **P1** Verify DB sync works in EAS preview APK (user testing).
- **P1** Add a name input on the "Save routine" dialog so users can label
  routines (db column already exists).
- **P2** Read-only web app for analyzing match data.
- **P3** Refactor `new-match.tsx` (still large).
- **P3** Extract `shadow-training.tsx` timers into a custom hook.
- **P3** Pydantic `Field(ge=0)` validation on ShadowRoutineCreate (testing
  agent code-review note).
- **P3** Sort `/api/shadow-routines` by `created_at` rather than the string
  `date` field for safer ordering across timezones.

## Test Status
- Backend: **17 / 17 tests passing** (15 new shadow + 2 sync regression).
- Frontend (RN): self-tested via babel parse + curl integration; user verifies
  end-to-end via EAS preview APK.
