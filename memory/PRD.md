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

### v3.7.1 - Analysis, Edit & Share (March 2026)
- **Analysis screen**: Added tournament filter dropdown (with iOS modal picker)
- **Analysis screen**: Added reason statistics table showing per-player breakdown
- **Match summary**: Point editing supports changing BOTH winner and reason
- **Match summary**: Expanded reasons list (19 reasons matching match-play)
- **Match summary**: Share button in header with two options:
  - **Share as Image**: Captures a styled dark-themed card via ViewShot and shares via system share sheet (WhatsApp, Telegram, etc.)
  - **Share via WhatsApp (text)**: Opens WhatsApp directly with formatted match result text
- **Match play**: Fixed duplicate style definitions, added missing headerButtons style
- **Dependencies added**: `react-native-view-shot@4.0.3`, `expo-sharing@14.0.8`
- **Backend**: All 30 API tests passing (100% coverage on key endpoints)

## Prioritized Backlog

### P0 - Deploy & Config
- [PENDING] Deploy updated server.py to Bluehost
- [PENDING] Configure SMTP_PASSWORD env var on Bluehost for email sending
- [PENDING] Create Gmail app password for squashcoach1830@gmail.com
- [PENDING] Build and test v3.7.1 on Android/iOS preview builds
- [PENDING] Submit to stores

### P1 - Remaining Issues
- [PENDING-USER] iOS picker verification (category, gender, country)
- [PENDING-USER] Google Play Store signing key mismatch resolution
- [PENDING-USER] Apple App Store resubmission (delete account discoverability)
- [BLOCKED] Email/Password Recovery (needs Gmail App Password from user)

### P2 - Future
- Read-only web application for match data analysis
- Refactor new-match.tsx (1000+ lines) into smaller components

## Key Files
- `frontend/app/match-summary.tsx` - Point editing (winner + reason) + WhatsApp share
- `frontend/app/analysis.tsx` - Analysis with tournament filter + reason stats
- `frontend/app/match-play.tsx` - Match play with reason toggle
- `frontend/app/new-match.tsx` - Player creation + tournament selector
- `frontend/app/index.tsx` - Main screen with settings icon
- `frontend/src/store/database.native.ts` - SQLite schema with migrations
- `frontend/src/context/AuthContext.tsx` - Auth with forgot/reset
- `frontend/src/utils/playerConstants.ts` - Categories, genders, countries
- `backend/server.py` - Full API with email, auth, sync

## Test Credentials
- App: `googleplayreview@squashcoach.app` / `ReviewSquash2025!`
- Apple Team: `RRWRLE3C2U` | API Key: `56AQ8A85QK`
- Email: `squashcoach1830@gmail.com` (needs app password configured)
- Test: `test_squash@example.com` / `Test123456`

## Test Reports
- `/app/test_reports/iteration_1.json` - Backend API tests: 30/30 PASS (100%)
- `/app/backend/tests/test_squash_coach_api.py` - Full API test suite
- `/app/backend/tests/test_sync_flow.py` - Sync flow test suite
