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
    const hasNative = Boolean(
      (TurboModuleRegistry?.get && TurboModuleRegistry.get("RNGoogleMobileAdsModule")) ||
      NativeModules?.RNGoogleMobileAdsModule
    );
    return hasNative;
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

/**
 * Refreshes UMP consent information and presents a required form when applicable.
 * The caller must inspect canRequestAds before initializing Mobile Ads or requesting an ad.
 */
export async function gatherConsentIfRequired() {
  if (!isConsentAvailable()) {
    return { available: false, canRequestAds: false };
  }

  try {
    const ads = require("react-native-google-mobile-ads");
    if (!ads?.AdsConsent) return { available: false, canRequestAds: false };
    const consentInfo = await ads.AdsConsent.gatherConsent();
    return {
      available: true,
      ...consentInfo,
      canRequestAds: Boolean(consentInfo?.canRequestAds),
    };
  } catch (error) {
    // UMP guidance permits using valid consent from a previous session after an
    // update error. Query that state explicitly; never assume ad readiness.
    try {
      const ads = require("react-native-google-mobile-ads");
      const previous = await ads?.AdsConsent?.getConsentInfo?.();
      return {
        available: true,
        ...(previous || {}),
        canRequestAds: Boolean(previous?.canRequestAds),
        error,
      };
    } catch {
      return { available: false, canRequestAds: false, error };
    }
  }
}
