# Squash Coach - PRD

## Original Problem Statement
Build and publish a "Squash Coach" mobile application for Google Play and App Store. Fix all outstanding bugs and implement final features for app store submission.

## Architecture
- **Frontend**: React Native (Expo) - `/app/frontend/`
- **Backend**: FastAPI + MongoDB - `/app/backend/server.py`
- **Production Backend**: Hosted on Bluehost (`https://lev.jsb.mybluehost.me:8001`)
- **Build System**: EAS (Expo Application Services)

## Current Version: 3.9.0

## Key Changes
1. **Session Duration**: Extended from 7 days to 90 days with auto-refresh (when <30 days remaining)
2. **Tournament Sync Rewrite**: Cloud-first approach using `sessionToken` from auth context (not AsyncStorage)
3. **Android Backup Disabled**: `allowBackup: false` in app.json to prevent stale data restoration
4. **iOS Picker Improvements**: Inline scrollable lists for better iPad compatibility
5. **SSL Auto-Renewal**: Crontab on Bluehost for Let's Encrypt certificate auto-renewal
6. **Game Review Modal (NEW)**: After each set ends, shows a full review screen (court, stats, reasons) before continuing to next game

## Root Cause Analysis (Tournament Sync - RESOLVED)
- Sessions expired after 7 days (too short for mobile app usage)
- Frontend silently swallowed 401 errors when fetching tournaments
- Android auto-backup restored stale SQLite databases on reinstall
- All fixed in v3.9.0

## What's Implemented
- Player management (category, gender, country, city, club, is_mine)
- Tournament management with cloud sync
- Match recording with point-by-point tracking
- **Game Review between sets** (court visualization, stats, top reasons)
- Analysis screen with filtering by tournament/player
- History screen with search and filters
- Cloud backup/restore
- Email registration with welcome email
- Password reset via email
- Share match summary via WhatsApp
- Multi-language support (Spanish/English)

## Status
- App v3.9.0 submitted to Google Play and App Store
- Currently in beta testing phase with user group
- All critical bugs resolved (tournament sync, iOS pickers, SSL)

## Upcoming Tasks
- P0: Address feedback from beta testers
- P2: Read-only web analysis application
- P3: Refactor new-match.tsx into smaller modules

## Files of Reference
- `frontend/app/match-play.tsx` - Match gameplay + Game Review Modal
- `frontend/app/new-match.tsx` - Tournament sync + iOS pickers
- `frontend/app/analysis.tsx` - Analysis with tournament filtering
- `frontend/app/match-summary.tsx` - Post-match summary with share
- `frontend/app/index.tsx` - Home screen
- `backend/server.py` - All API endpoints with 90-day sessions
- `frontend/src/context/AuthContext.tsx` - Auth context with sessionToken
- `frontend/src/store/syncService.ts` - Data synchronization service

## Key DB Schema
- `players`: id, user_id, nickname, category, gender, country, city, club, is_mine
- `tournaments`: id, user_id, name, created_at
- `matches`, `points`, `game_results`
