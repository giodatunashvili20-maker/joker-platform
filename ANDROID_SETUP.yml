# Android (Capacitor) + AdMob Rewarded Setup

This repo contains a Vite React web app in `web/` and Node backend in `backend/`.

## 1) Install dependencies
From `web/`:
- npm i

## 2) Build web
- npm run build

## 3) Initialize Capacitor (first time only)
If `capacitor.config.ts` already exists (it does), you can skip init.

## 4) Add Android platform
- npx cap add android

This creates `web/android/`.

## 5) Sync and open Android Studio
- npx cap sync android
- npx cap open android

## 6) AdMob
App ID (Android):
- ca-app-pub-3629181180662356~6945234876

Rewarded Ad Unit ID:
- ca-app-pub-3629181180662356/6638113117

The app shows rewarded ads via `web/src/services/admob.js`.

## 7) IMPORTANT: Testing
During development, use AdMob test IDs or register your device as a test device.
Never click your own live ads on a real device.

## 8) Reward flow
When the user earns a reward:
- frontend calls backend:
  - POST /ads/points/claim
  - POST /ads/crystals/claim

Backend enforces daily limits.
