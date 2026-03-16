# Squash Coach - PRD

## Original Problem Statement
Build and publish the "Squash Coach" mobile application to the Google Play Store and Apple App Store. The app uses Expo SDK 54 with React Native frontend and a FastAPI backend hosted on Bluehost.

## Current Architecture
- **Frontend**: React Native with Expo SDK 54 (managed workflow)
- **Backend**: FastAPI + MongoDB on Bluehost (`https://lev.jsb.mybluehost.me:8001`)
- **Build System**: EAS Build for generating AAB/IPA files
- **Repository**: `https://github.com/pachoduran/SquashCoach`
- **Package name Android**: `com.sqcoash.app`
- **Bundle ID iOS**: `com.sqcoach.app`

## What's Been Implemented
- Full Squash Coach mobile app with match tracking, analysis, cloud sync
- Delete Account feature (Google Play/App Store requirement)
- Privacy Policy and Data Deletion instructions on GitHub
- Cloud sync bug fixed (6 bugs in restoreFromCloud)
- Settings screen accessible via gear icon in header
- Multi-step, bilingual tutorial modal
- **Phase 1 Features (v3.6.0):**
  - Player expanded data: category, gender, country (selector), city, club, is_mine (my player vs opponent)
  - Player sorting: "my players" shown first, then others alphabetically
  - Tournament registration and management
  - Tournament selector when creating a new match

## Current Version
- Version: 3.6.0, versionCode: 9

## Prioritized Backlog

### P0 - Deploy
- [PENDING] Deploy updated server.py to Bluehost (new player fields)
- [PENDING] Build and test v3.6.0 on Android and iOS
- [PENDING] Submit to Google Play (pending upload key change approval)
- [PENDING] Submit to App Store (fix privacy rejection - 5.1.1)

### P1 - Phase 2 Features (Mejoras en el partido)
- Toggle/check for point reason (instead of "Ninguno")
- Edit point position/reason in match review

### P2 - Phase 3 Features (Cuenta y autenticación)
- Email confirmation on registration
- Password recovery (email with link/code)

### P3 - Phase 4 Features (Análisis avanzado)
- Analysis by time period or tournament (where I win/lose more)

### P4 - Future
- Read-only web application for match data analysis

## Key Files
- `frontend/src/store/syncService.ts` - Cloud sync/restore logic
- `frontend/src/store/database.native.ts` - Local SQLite database (with migrations)
- `frontend/src/utils/playerConstants.ts` - Categories, genders, countries lists
- `frontend/app/new-match.tsx` - Player creation + tournament selector
- `frontend/app/index.tsx` - Main screen with restore logic
- `frontend/app/match-play.tsx` - Match play with auto-sync on finish
- `frontend/app/settings.tsx` - Settings with delete account
- `backend/server.py` - FastAPI backend with sync endpoints

## Test Credentials
- Google Play Reviewer: `googleplayreview@squashcoach.app` / `ReviewSquash2025!`
- Apple Team ID: `RRWRLE3C2U` (Individual)
- App Store API Key ID: `56AQ8A85QK`
