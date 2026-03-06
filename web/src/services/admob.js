import { Capacitor } from "@capacitor/core";
import { AdMob, RewardAdPluginEvents } from "@capacitor-community/admob";

/**
 * AdMob Rewarded integration (Android).
 * Uses your Ad Unit ID:
 * ca-app-pub-3629181180662356/6638113117
 *
 * IMPORTANT:
 * - Call claim endpoints only after reward event.
 * - On web, this falls back to a simulated flow (no real rewarded).
 */

export const ADMOB_REWARDED_AD_UNIT_ID =
  import.meta.env.VITE_ADMOB_REWARDED_AD_UNIT_ID ||
  "ca-app-pub-3629181180662356/6638113117";

export const ADMOB_APP_ID_ANDROID =
  import.meta.env.VITE_ADMOB_APP_ID_ANDROID ||
  "ca-app-pub-3629181180662356~6945234876";

export function isNative() {
  return Capacitor.isNativePlatform?.() ?? false;
}

let initialized = false;

export async function initAdMobOnce() {
  if (!isNative() || initialized) return;
  await AdMob.initialize({
    requestTrackingAuthorization: false,
    initializeForTesting: false,
  });
  initialized = true;
}

/**
 * Shows a rewarded ad and resolves true ONLY if user earned a reward.
 */
export async function showRewardedAd() {
  if (!isNative()) {
    // Web fallback – no real rewarded ad
    return { ok: false, reason: "WEB_NO_REWARDED" };
  }

  await initAdMobOnce();

  // Ensure clean listeners
  await AdMob.removeAllListeners();

  let rewarded = false;

  AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
    rewarded = true;
  });

  AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
    // dismissed (might be rewarded or not)
  });

  AdMob.addListener(RewardAdPluginEvents.FailedToShow, (e) => {
    console.warn("FailedToShow", e);
  });

  // Load & show
  await AdMob.prepareRewardVideoAd({ adId: ADMOB_REWARDED_AD_UNIT_ID });
  await AdMob.showRewardVideoAd();

  // Wait a tiny bit for reward callback to fire
  await new Promise((r) => setTimeout(r, 250));

  return { ok: rewarded };
}
