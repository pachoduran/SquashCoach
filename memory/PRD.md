# Squash Coach - PRD

## Original Problem Statement
Build and publish the "Squash Coach" mobile application to the Google Play Store and Apple App Store. The app uses Expo SDK 54 with React Native frontend and a FastAPI backend hosted on Bluehost.

## Current Architecture
- **Frontend**: React Native with Expo SDK 54 (managed workflow)
- **Backend**: FastAPI + MongoDB on Bluehost (`https://lev.jsb.mybluehost.me:8001`)
- **Build System**: EAS Build for generating AAB/IPA files
- **Repository**: `https://github.com/pachoduran/SquashCoach`

## User Personas
- Squash players/coaches who want to track match statistics
- Users who need cloud backup of their match data across devices

## Core Requirements
1. Real-time match scoring with position tracking
2. Player management
3. Cloud synchronization (backup & restore)
4. Statistics analysis
5. Multi-language support (EN/ES)
6. App Store & Play Store publication

## What's Been Implemented
- Full Squash Coach mobile app with match tracking, analysis, cloud sync
- Delete Account feature (Google Play requirement)
- Privacy Policy and Data Deletion instructions on GitHub
- Google Play Console setup (store listing, policy questionnaires, test credentials)
- Upgrade from Expo SDK 51 → SDK 54
- Multi-step, bilingual tutorial modal
- Fixed iOS-specific UI bugs (pickers, text)
- Sharing feature between users

## Prioritized Backlog
### P0 - Critical
- [FIXED - 2026-03-09] Cloud sync bugs in `restoreFromCloud()` and `restoreFromCloudIfNeeded()`
  - Fixed 6 bugs: wrong match_id field, wrong response structure parsing, missing created_at, wrong player/winner field names
  - Upload path verified working via comprehensive E2E tests
- [PENDING] User needs to deploy updated `server.py` to Bluehost
- [PENDING] User needs to build new APK and test on Android/iPhone

### P1 - High
- [IN PROGRESS] iOS build authentication failures (eas build)
- [PENDING] Generate final AAB/IPA for store submission

### P2 - Medium
- [USER VERIFICATION] Android app icon sizing

### P3 - Future
- Create separate read-only web app for match data analysis

## Test Credentials
- Google Play Reviewer: `googleplayreview@squashcoach.app` / `ReviewSquash2025!`
- Apple Team ID: `RRWRLE3C2U` (Individual)
- App Store API Key ID: `56AQ8A85QK`

## Key Files
- `frontend/src/store/syncService.ts` - Cloud sync/restore logic (FIXED)
- `frontend/src/store/database.native.ts` - Local SQLite database
- `frontend/app/index.tsx` - Main screen with restore logic (FIXED)
- `frontend/app/new-match.tsx` - Player creation with auto-sync (FIXED)
- `frontend/app/match-play.tsx` - Match play with auto-sync on finish (FIXED)
- `backend/server.py` - FastAPI backend with sync endpoints (ENHANCED)
