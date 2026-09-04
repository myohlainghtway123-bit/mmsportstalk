// Centralized official Myanmar Sports Talk social and legal destinations.
// Only official, non-fabricated URLs are defined here. Missing external
// channel URLs (Instagram, Threads) are preserved as configurable keys
// rather than guessed.

export const MST_OFFICIAL_SOCIALS = Object.freeze([
  {
    id: "facebook",
    name: "Facebook",
    subtitle: "Official Facebook Page",
    icon: "logo-facebook",
    color: "#1877F2",
    url: process.env.EXPO_PUBLIC_MST_FACEBOOK_URL || "https://www.facebook.com/profile.php?id=61585572826885",
  },
  {
    id: "youtube",
    name: "YouTube",
    subtitle: "Myanmar Sports Talk channel",
    icon: "logo-youtube",
    color: "#FF0000",
    url: process.env.EXPO_PUBLIC_MST_YOUTUBE_URL || "https://youtube.com/@myanmarsportstalk",
  },
  {
    id: "instagram",
    name: "Instagram",
    subtitle: "Official Instagram profile",
    icon: "logo-instagram",
    color: "#E1306C",
    // Configurable placeholder pending official MST account URL
    url: process.env.EXPO_PUBLIC_MST_INSTAGRAM_URL || "",
  },
  {
    id: "tiktok",
    name: "TikTok",
    subtitle: "@myanmar.sports.talk",
    icon: "logo-tiktok",
    color: "#FFFFFF",
    url: process.env.EXPO_PUBLIC_MST_TIKTOK_URL || "https://www.tiktok.com/@myanmar.sports.talk",
  },
  {
    id: "threads",
    name: "Threads",
    subtitle: "Official Threads profile",
    icon: "logo-threads",
    color: "#FFFFFF",
    // Configurable placeholder pending official MST account URL
    url: process.env.EXPO_PUBLIC_MST_THREADS_URL || "",
  },
  {
    id: "website",
    name: "Website",
    subtitle: "myanmarsportstalk.com",
    icon: "globe-outline",
    color: "#D4D8DB",
    url: process.env.EXPO_PUBLIC_MST_WEBSITE_URL || "https://myanmarsportstalk.com",
  },
]);

export const MST_LEGAL_URLS = Object.freeze({
  privacyPolicy: process.env.EXPO_PUBLIC_MST_PRIVACY_URL || "https://myanmarsportstalk.com/privacy",
  termsOfUse: process.env.EXPO_PUBLIC_MST_TERMS_URL || "https://myanmarsportstalk.com/terms",
  dataDeletion: process.env.EXPO_PUBLIC_MST_DATA_DELETION_URL || "https://myanmarsportstalk.com/account-deletion",
  website: process.env.EXPO_PUBLIC_MST_WEBSITE_URL || "https://myanmarsportstalk.com",
});
