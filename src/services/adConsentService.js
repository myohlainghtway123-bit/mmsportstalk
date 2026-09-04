// Google Mobile Ads UMP (User Messaging Platform) consent and privacy choices service.
// Safely checks native binary registration before requiring react-native-google-mobile-ads,
// preventing uncatchable TurboModuleRegistry.getEnforcing() fatal invariant crashes.

import { NativeModules, TurboModuleRegistry } from "react-native";

/**
 * Checks whether the native Google Mobile Ads module is actually registered in the binary.
 * Uses non-enforcing lookup so it never throws an Invariant Violation.
 */
export function isConsentAvailable() {
  try {
    return Boolean(
      (TurboModuleRegistry?.get && TurboModuleRegistry.get("RNGoogleMobileAdsModule")) ||
      NativeModules?.RNGoogleMobileAdsModule
    );
  } catch {
    return false;
  }
}

/**
 * Shows the official Google UMP Privacy Options form if available for the user's jurisdiction.
 * Returns an object indicating whether the form was shown or if it's not applicable.
 * Never fabricates consent states or crashes if native modules are unlinked.
 */
export async function showPrivacyOptionsForm() {
  if (!isConsentAvailable()) {
    return {
      available: false,
      shown: false,
      message: "Advertising privacy options are unavailable in this build. No ad request should be made until privacy readiness can be checked.",
    };
  }

  try {
    const ads = require("react-native-google-mobile-ads");
    if (!ads?.AdsConsent) {
      return {
        available: false,
        shown: false,
        message: "Advertising privacy options are unavailable in this build. No ad request should be made until privacy readiness can be checked.",
      };
    }

    const result = await ads.AdsConsent.showPrivacyOptionsForm();
    return {
      available: true,
      shown: true,
      result,
    };
  } catch (error) {
    return {
      available: false,
      shown: false,
      message: error?.message || "Privacy options form is not required for your jurisdiction.",
      error,
    };
  }
}

async function currentConsentInfo(AdsConsent) {
  const info = await AdsConsent?.getConsentInfo?.();
  return {
    available: Boolean(info),
    ...(info || {}),
    canRequestAds: Boolean(info?.canRequestAds),
  };
}

/**
 * Refreshes UMP consent information and presents a required form when applicable.
 * The caller must inspect canRequestAds before initializing Mobile Ads or requesting an ad.
 */
export async function gatherConsentIfRequired() {
  if (!isConsentAvailable()) {
    return { available: false, canRequestAds: false };
  }

  let AdsConsent;
  try {
    const ads = require("react-native-google-mobile-ads");
    AdsConsent = ads?.AdsConsent;
    if (!AdsConsent) return { available: false, canRequestAds: false };

    // The library's documented flow is: gather consent, then query the latest
    // AdsConsentInfo and read canRequestAds from that state.
    await AdsConsent.gatherConsent();
    return await currentConsentInfo(AdsConsent);
  } catch (error) {
    // UMP guidance allows a valid previous-session consent state to remain usable
    // after a refresh error. Query it explicitly; never assume ad readiness.
    try {
      const previous = AdsConsent ? await currentConsentInfo(AdsConsent) : null;
      return {
        ...(previous || { available: false, canRequestAds: false }),
        error,
      };
    } catch {
      return { available: false, canRequestAds: false, error };
    }
  }
}
