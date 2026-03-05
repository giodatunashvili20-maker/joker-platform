# Ads (Rewarded) Setup

The app already enforces daily limits in backend:
- Points ads: max 10/day (reward = entry fee of your tier)
- Crystals ads: max 5/day (reward = 1 crystal)

## Important
The backend endpoints:
- POST /ads/points/claim
- POST /ads/crystals/claim

must be called **ONLY after** your ad provider confirms the rewarded ad was completed.

Right now, the frontend has demo buttons that call these endpoints directly.

## To activate real rewarded ads
Because this is a web React app, true rewarded ads are limited. Best production options:
1) Wrap web with Capacitor (Android/iOS) and use **Google AdMob Rewarded** SDK.
2) Build a mobile client (React Native/Flutter) and use AdMob Rewarded.

Then, on reward callback, call the backend claim endpoint.

## Security note
Never commit API keys to GitHub. Use environment variables / platform secrets.
