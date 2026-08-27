import * as SecureStore from "expo-secure-store";

const DEVICE_PUSH_TOKEN_KEY = "mst.push_token.v1";

export const getStoredDevicePushToken = () => SecureStore.getItemAsync(DEVICE_PUSH_TOKEN_KEY);

export async function setStoredDevicePushToken(token) {
  const clean = String(token || "").trim();
  if (clean) await SecureStore.setItemAsync(DEVICE_PUSH_TOKEN_KEY, clean);
  else await SecureStore.deleteItemAsync(DEVICE_PUSH_TOKEN_KEY);
}
