# Test Credentials

## Backend Test Users
The backend test suite (`/app/backend/tests/test_shadow_routines.py`) self-registers
ephemeral users with the prefix `TEST_ua_`, `TEST_ub_`, `TEST_reg_` + uuid and tears
them down in the fixture (via `DELETE /api/user-data` + `DELETE /api/auth/account`).
No persistent test accounts are required.

## Manual Smoke-Test Account (created during dev)
- Email: `shadowtest@test.com`
- Password: `test12345`
- Note: This account was created via curl during the shadow-routines feature
  smoke test and immediately wiped via `DELETE /api/user-data`. It can be
  re-registered if needed for manual UI testing.

## App / Mobile Testing
- The frontend is React Native (Expo) — tested by the user via an EAS preview
  APK on their Android device.
- Production backend lives at `https://lev.jsb.mybluehost.me:8001` (Bluehost),
  configured in `frontend/.env` as `EXPO_PUBLIC_BACKEND_URL`.

## Mongo
- Local dev MongoDB is configured via `backend/.env` (`MONGO_URL`, `DB_NAME`).
- Production MongoDB is on the Bluehost server.
