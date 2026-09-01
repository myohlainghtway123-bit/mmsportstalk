import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const AUTH_TOKEN_KEY = "mst.session.v1";
const LEGACY_AUTH_TOKEN_KEY = "@mst_session_token";
const AUTH_TOKEN_MIGRATION_KEY = "@mst_session_secure_store_migrated_v1";

let memoryToken = null;
let tokenLoad = null;

async function loadSessionToken() {
  const stored = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  if (stored) return stored;

  const migrated = await AsyncStorage.getItem(AUTH_TOKEN_MIGRATION_KEY);
  if (migrated === "1") return null;

  const legacy = String(await AsyncStorage.getItem(LEGACY_AUTH_TOKEN_KEY) || "").trim();
  if (legacy) await SecureStore.setItemAsync(AUTH_TOKEN_KEY, legacy);
  await AsyncStorage.multiRemove([LEGACY_AUTH_TOKEN_KEY]);
  await AsyncStorage.setItem(AUTH_TOKEN_MIGRATION_KEY, "1");
  return legacy || null;
}

export async function getSessionToken() {
  if (memoryToken) return memoryToken;
  try {
    tokenLoad ||= loadSessionToken().finally(() => { tokenLoad = null; });
    const stored = await tokenLoad;
    if (stored) memoryToken = stored;
    return stored;
  } catch {
    return null;
  }
}

export async function setSessionToken(token) {
  const clean = token ? String(token).trim() : null;
  memoryToken = clean;
  tokenLoad = null;
  if (clean) await SecureStore.setItemAsync(AUTH_TOKEN_KEY, clean);
  else await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
  await AsyncStorage.multiRemove([LEGACY_AUTH_TOKEN_KEY]);
  await AsyncStorage.setItem(AUTH_TOKEN_MIGRATION_KEY, "1");
}
