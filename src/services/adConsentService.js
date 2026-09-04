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
      message: "Privacy options form is active for applicable jurisdictions. Non-personalized ads are served by default.",
    };
  }

  try {
    const ads = require("react-native-google-mobile-ads");
    if (!ads?.AdsConsent) {
      return {
        available: false,
        shown: false,
        message: "Privacy options form is active for applicable jurisdictions. Non-personalized ads are served by default.",
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
 * Requests consent information update and presents the consent form if required by law.
 */
export async function gatherConsentIfRequired() {
  if (!isConsentAvailable()) return null;

  try {
    const ads = require("react-native-google-mobile-ads");
    if (!ads?.AdsConsent) return null;
    const consentInfo = await ads.AdsConsent.gatherConsent();
    return consentInfo;
  } catch {
    return null;
  }
}
