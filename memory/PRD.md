# Squash Coach - PRD

## Original Problem Statement
Build and publish a "Squash Coach" mobile application for Google Play and App Store. Fix all outstanding bugs and implement final features for app store submission.

## Architecture
- **Frontend**: React Native (Expo) - `/app/frontend/`
- **Backend**: FastAPI + MongoDB - `/app/backend/server.py`
- **Production Backend**: Hosted on Bluehost (`https://lev.jsb.mybluehost.me:8001`)
- **Build System**: EAS (Expo Application Services)

## Current Version: 3.8.0-b1

## Key Changes in v3.8.0
1. **Session Duration**: Extended from 7 days to 90 days with auto-refresh (when <30 days remaining)
2. **Tournament Sync Rewrite**: Cloud-first approach using `sessionToken` from auth context (not AsyncStorage)
3. **Version Indicator**: Visible `v3.8.0-b1` on home screen for build verification
4. **Tournament Status Messages**: Visible feedback during sync ("Sincronizando torneos...", "3 torneos sincronizados", "Sin conexion - usando datos locales")
5. **iOS Picker Improvements**: Better styled inline lists with 48px touch targets and proper selected state

## Root Cause Analysis (Tournament Sync)
- Sessions expired after 7 days (too short for mobile app usage)
- Frontend silently swallowed 401 errors when fetching tournaments
- Used `AsyncStorage.getItem('@squash_coach_auth')` instead of `sessionToken` from auth context
- All fixed in v3.8.0

## What's Implemented
- Player management (category, gender, country, city, club, is_mine)
- Tournament management with cloud sync
- Match recording with point-by-point tracking
- Analysis screen with filtering by tournament/player
- History screen with search and filters
- Cloud backup/restore
- Email registration with welcome email
- Password reset via email
- Share match summary via WhatsApp
- Multi-language support (Spanish/English)

## Pending Verification (by user)
- [ ] Tournament sync between devices
- [ ] iOS/iPad pickers for player creation
- [ ] Password reset flow
- [ ] Analysis screen stability

## Upcoming Tasks
- P0: User testing of v3.8.0 build
- P1: App Store / Google Play submission
- P2: Read-only web analysis application
- P3: Refactor new-match.tsx into smaller modules

## Files of Reference
- `frontend/app/new-match.tsx` - Tournament sync + iOS pickers
- `frontend/app/analysis.tsx` - Analysis with tournament filtering
- `frontend/app/index.tsx` - Home screen with version display
- `backend/server.py` - All API endpoints with 90-day sessions
- `frontend/src/context/AuthContext.tsx` - Auth context with sessionToken
