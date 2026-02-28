# Squash Coach - PRD

## Original Problem Statement
Build and publish the "Squash Coach" mobile application to the Google Play Store. The app uses Expo SDK 54 with React Native 0.81 frontend and a FastAPI backend hosted on Bluehost.

## Current Architecture
- **Frontend**: React Native with Expo SDK 54 (managed workflow)
- **Backend**: FastAPI + MongoDB on Bluehost (`https://lev.jsb.mybluehost.me:8001`)
- **Build System**: EAS Build for generating AAB files
- **Repository**: `https://github.com/pachoduran/SquashCoach`

## What's Been Implemented
- Full Squash Coach mobile app with match tracking, analysis, cloud sync
- Delete Account feature (Google Play requirement)
- Privacy Policy and Data Deletion instructions on GitHub
- Google Play Console setup (store listing, policy questionnaires, test credentials)
- Upgrade from Expo SDK 51 → SDK 54
- `expo-build-properties` plugin for targetSdkVersion 35
- Removed stale `android/` and `ios/` folders (were causing Kotlin version mismatch)
- Updated `eas.json` for clean managed workflow build

## Current Status (Feb 2026)
- **Build blocker resolved**: Removed stale native folders that caused Kotlin incompatibility
- **Awaiting**: User to compile AAB and confirm success

## Prioritized Backlog
### P0 - Critical
- [PENDING] Confirm AAB build succeeds with cleaned configuration
- [PENDING] Upload AAB to Google Play Console

### P1 - High
- Guide user through Google Play Closed Testing (12 testers, 14 days)

### P2 - Future
- Create separate read-only web app for match data analysis

## Test Credentials
- Google Play Reviewer: `googleplayreview@squashcoach.app` / `ReviewSquash2025!`
