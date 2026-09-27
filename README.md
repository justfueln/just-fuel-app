# Just Fuel App

New source-controlled frontend for the Just Fuel PWA.

## Current build
- React + Vite
- Existing Supabase backend
- Email OTP authentication
- Existing Strava OAuth / Sync functions
- Simplified Training navigation:
  - Overview
  - My Plan
  - My Race
  - Fuel
  - My Details
- Phase 5 training fuel display
- Phase 6 race fuel display
- Phase 7 stock + 7/14/30-day fuel forecast
- Basic installable PWA support

## Local development
```bash
npm install
npm run dev
```

## Production build
```bash
npm run build
```

The browser uses the Supabase publishable key only. Never add service-role keys, Strava client secrets, or Resend API keys to this repository.

## Migration preview
The `current-pwa-migration` branch is used for safe preview deployments before any production change.
