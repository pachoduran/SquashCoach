# Squash Coach - PRD

## Original Problem Statement
Build and publish the "Squash Coach" mobile application to the Google Play Store and Apple App Store.

## Current Architecture
- **Frontend**: React Native with Expo SDK 54
- **Backend**: FastAPI + MongoDB on Bluehost (`https://lev.jsb.mybluehost.me:8001`)
- **Build System**: EAS Build
- **Package Android**: `com.sqcoash.app` | **Bundle iOS**: `com.sqcoach.app`
- **Current Version**: 3.7.0 (versionCode 10)

## What's Been Implemented
### Core App
- Real-time match scoring with position tracking
- Player management with cloud sync
- Statistics analysis, multi-language (EN/ES), tutorial modal

### v3.6.0 - Player & Tournament Features
- Player expanded data: category, gender, country (selector), city, club, is_mine
- Player sorting: mine first, then opponents alphabetically
- Tournament registration and selector

### v3.7.0 - Auth, Match & iOS Fixes
- iOS picker fix: category, gender, country use modal pickers on iOS
- Toggle for point reason: switch on/off during match, persists
- Password recovery: forgot password flow with 6-digit email code
- Welcome email on registration
- Settings gear icon in header for delete account access

## Prioritized Backlog

### P0 - Deploy & Config
- [PENDING] Deploy updated server.py to Bluehost
- [PENDING] Configure SMTP_PASSWORD env var on Bluehost for email sending
- [PENDING] Create Gmail app password for squashcoach1830@gmail.com
- [PENDING] Build and test v3.7.0 on Android/iOS
- [PENDING] Submit to stores

### P1 - Remaining Features
- [PENDING] Edit point position/reason in match review (Feature 6)
- [PENDING] Analysis by time period or tournament (Feature 9)

### P2 - Future
- Read-only web application for match data analysis

## Key Files
- `frontend/app/login.tsx` - Login + forgot/reset password
- `frontend/app/new-match.tsx` - Player creation + tournament selector
- `frontend/app/match-play.tsx` - Match play with reason toggle
- `frontend/src/context/AuthContext.tsx` - Auth with forgot/reset
- `frontend/src/utils/playerConstants.ts` - Categories, genders, countries
- `frontend/src/store/syncService.ts` - Cloud sync/restore
- `backend/server.py` - Full API with email, auth, sync

## Test Credentials
- App: `googleplayreview@squashcoach.app` / `ReviewSquash2025!`
- Apple Team: `RRWRLE3C2U` | API Key: `56AQ8A85QK`
- Email: `squashcoach1830@gmail.com` (needs app password configured)
