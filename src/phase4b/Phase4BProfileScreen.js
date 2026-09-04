import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import ScreenHeader from "../components/ScreenHeader";
import {
  deleteAvatar,
  getAuthStatus,
  updateProfile,
  uploadAvatar,
} from "../services/accountApi";

const C = {
  bg: "#080A0C",
  surface: "#101417",
  raised: "#171C20",
  border: "#242A2F",
  text: "#FFFFFF",
  secondary: "#D4D8DB",
  muted: "#929AA0",
  red: "#F3262D",
  redSoft: "rgba(243,38,45,0.12)",
  green: "#48C78E",
  amber: "#F4C84D",
};

export default function Phase4BProfileScreen({ onBack, onOpenSignIn }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [auth, setAuth] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [pendingAvatar, setPendingAvatar] = useState(null);
  const [statusMessage, setStatusMessage] = useState({ text: "", type: "info" });

  useEffect(() => {
    const handleHardwareBack = () => {
      if (onBack) {
        onBack();
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", handleHardwareBack);
    return () => sub.remove();
  }, [onBack]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const status = await getAuthStatus();
      setAuth(status);
      if (status?.user?.displayName) {
        setDisplayName(status.user.displayName);
      } else if (status?.user?.name) {
        setDisplayName(status.user.name);
      }
    } catch {
      setAuth({ authenticated: false, user: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePickAndCropImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Photo library permission is needed to choose and crop your profile avatar."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1], // Square 1:1 crop UI for profile avatars
        quality: 0.85,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setPendingAvatar(asset);
        setStatusMessage({
          text: "Avatar cropped. Review the preview below and tap 'Save Avatar'.",
          type: "info",
        });
      }
    } catch (err) {
      Alert.alert("Image Selection Error", err?.message || "Could not select photo.");
    }
  };

  const handleSaveAvatar = async () => {
    if (!pendingAvatar) return;
    setAvatarLoading(true);
    setStatusMessage({ text: "", type: "info" });
    try {
      if (!auth?.authenticated) {
        // Honest disclosure: guest session cannot persist to server
        setStatusMessage({
          text: "Avatar preview active locally. Sign in to your MST account to persist across devices.",
          type: "warning",
        });
        setPendingAvatar(null);
        setAvatarLoading(false);
        return;
      }

      const uploadResult = await uploadAvatar({
        uri: pendingAvatar.uri,
        base64: pendingAvatar.base64,
        contentType: pendingAvatar.mimeType || "image/jpeg",
      });

      if (uploadResult?.ok) {
        setStatusMessage({ text: "Profile picture updated successfully.", type: "success" });
        setPendingAvatar(null);
        await loadData();
      } else {
        setStatusMessage({
          text: "Avatar upload was not confirmed by the server.",
          type: "error",
        });
      }
    } catch (err) {
      setStatusMessage({
        text: err?.message || "Failed to upload avatar to server.",
        type: "error",
      });
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (pendingAvatar) {
      setPendingAvatar(null);
      return;
    }
    if (!auth?.authenticated || !auth?.user?.avatar) return;

    Alert.alert(
      "Remove Avatar",
      "Are you sure you want to remove your current profile picture?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setAvatarLoading(true);
            try {
              await deleteAvatar();
              setStatusMessage({ text: "Avatar removed.", type: "info" });
              await loadData();
            } catch (err) {
              setStatusMessage({ text: err?.message || "Could not remove avatar.", type: "error" });
            } finally {
              setAvatarLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleSaveProfileInfo = async () => {
    if (!displayName.trim()) {
      setStatusMessage({ text: "Display name cannot be empty.", type: "error" });
      return;
    }
    setSaving(true);
    setStatusMessage({ text: "", type: "info" });
    try {
      if (!auth?.authenticated) {
        setStatusMessage({
          text: "Display name updated locally. Sign in to sync with MST server.",
          type: "info",
        });
        setSaving(false);
        return;
      }
      await updateProfile({ displayName: displayName.trim() });
      setStatusMessage({ text: "Profile information saved successfully.", type: "success" });
      await loadData();
    } catch (err) {
      setStatusMessage({ text: err?.message || "Could not save profile changes.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const currentAvatarUri = pendingAvatar?.uri || auth?.user?.avatar || auth?.user?.avatarUrl;

  return (
    <View style={s.container}>
      <ScreenHeader
        title="Profile"
        subtitle="VIEW & EDIT PROFILE"
        onBack={onBack}
      />

      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator color={C.red} />
            <Text style={s.loadingText}>Loading profile…</Text>
          </View>
        ) : (
          <>
            {/* Status / Feedback Banner */}
            {statusMessage.text ? (
              <View
                style={[
                  s.statusBanner,
                  statusMessage.type === "success" && s.statusSuccess,
                  statusMessage.type === "error" && s.statusError,
                  statusMessage.type === "warning" && s.statusWarning,
                ]}
              >
                <Ionicons
                  name={
                    statusMessage.type === "success"
                      ? "checkmark-circle"
                      : statusMessage.type === "error"
                      ? "alert-circle"
                      : "information-circle"
                  }
                  size={18}
                  color={
                    statusMessage.type === "success"
                      ? C.green
                      : statusMessage.type === "error"
                      ? C.red
                      : C.amber
                  }
                />
                <Text style={s.statusText}>{statusMessage.text}</Text>
              </View>
            ) : null}

            {/* Avatar & Photo Section */}
            <View style={s.avatarCard}>
              <View style={s.avatarContainer}>
                {currentAvatarUri ? (
                  <Image
                    source={{ uri: currentAvatarUri }}
                    resizeMode="cover"
                    style={s.avatarImage}
                  />
                ) : (
                  <View style={s.fallbackAvatar}>
                    <Ionicons name="person" size={42} color={C.secondary} />
                  </View>
                )}
                {pendingAvatar ? (
                  <View style={s.previewBadge}>
                    <Text style={s.previewBadgeText}>PREVIEW</Text>
                  </View>
                ) : null}
              </View>

              <View style={s.avatarActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={handlePickAndCropImage}
                  style={s.chooseBtn}
                >
                  <Ionicons name="camera-outline" size={16} color={C.text} />
                  <Text style={s.chooseBtnText}>
                    {currentAvatarUri ? "Change Picture (Crop 1:1)" : "Choose Avatar (Crop 1:1)"}
                  </Text>
                </Pressable>

                {pendingAvatar ? (
                  <View style={s.pendingRow}>
                    <Pressable
                      disabled={avatarLoading}
                      onPress={handleSaveAvatar}
                      style={[s.saveAvatarBtn, avatarLoading && { opacity: 0.6 }]}
                    >
                      {avatarLoading ? (
                        <ActivityIndicator size="small" color={C.text} />
                      ) : (
                        <>
                          <Ionicons name="cloud-upload-outline" size={16} color={C.text} />
                          <Text style={s.saveAvatarText}>Save Avatar</Text>
                        </>
                      )}
                    </Pressable>
                    <Pressable
                      onPress={() => setPendingAvatar(null)}
                      style={s.cancelPendingBtn}
                    >
                      <Text style={s.cancelPendingText}>Cancel</Text>
                    </Pressable>
                  </View>
                ) : currentAvatarUri && auth?.authenticated ? (
                  <Pressable
                    disabled={avatarLoading}
                    onPress={handleRemoveAvatar}
                    style={s.removeAvatarBtn}
                  >
                    <Text style={s.removeAvatarText}>Remove Picture</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            {/* Profile Info Form */}
            <View style={s.formCard}>
              <Text style={s.formHeader}>PROFILE INFORMATION</Text>

              <Text style={s.inputLabel}>Display Name</Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name or nickname"
                placeholderTextColor={C.muted}
                style={s.input}
              />

              <Text style={s.inputLabel}>Account Email</Text>
              <View style={[s.input, s.inputDisabled]}>
                <Text style={s.inputDisabledText}>
                  {auth?.user?.email || "Guest User (Not Signed In)"}
                </Text>
                <Ionicons name="lock-closed-outline" size={14} color={C.muted} />
              </View>

              <Text style={s.inputLabel}>Account Status</Text>
              <View style={s.accountStatusRow}>
                <Ionicons
                  name={auth?.authenticated ? "checkmark-circle" : "person-outline"}
                  size={16}
                  color={auth?.authenticated ? C.green : C.amber}
                />
                <Text style={s.accountStatusText}>
                  {auth?.authenticated
                    ? "Authenticated MST Account"
                    : "Guest Session · Sign in from Settings to link account"}
                </Text>
              </View>

              {/* Save Info CTA */}
              <Pressable
                disabled={saving}
                onPress={handleSaveProfileInfo}
                style={[s.saveChangesBtn, saving && { opacity: 0.6 }]}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={C.text} />
                ) : (
                  <Text style={s.saveChangesText}>SAVE CHANGES</Text>
                )}
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 14, paddingBottom: 40 },
  loadingBox: {
    minHeight: 140,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: { color: C.muted, fontSize: 13 },
  statusBanner: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  statusSuccess: { borderColor: C.green, backgroundColor: "rgba(72,199,142,0.08)" },
  statusError: { borderColor: C.red, backgroundColor: "rgba(243,38,45,0.08)" },
  statusWarning: { borderColor: C.amber, backgroundColor: "rgba(244,200,77,0.08)" },
  statusText: { color: C.secondary, fontSize: 13, lineHeight: 18, flex: 1 },
  avatarCard: {
    borderRadius: 14,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: "hidden",
    backgroundColor: C.raised,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginBottom: 12,
  },
  avatarImage: { width: "100%", height: "100%" },
  fallbackAvatar: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.raised,
  },
  previewBadge: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(243,38,45,0.85)",
    paddingVertical: 2,
    alignItems: "center",
  },
  previewBadgeText: { color: C.text, fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  avatarActions: { width: "100%", alignItems: "center", gap: 8 },
  chooseBtn: {
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: C.raised,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  chooseBtnText: { color: C.text, fontSize: 13.5, fontWeight: "800" },
  pendingRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  saveAvatarBtn: {
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: C.red,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 6,
  },
  saveAvatarText: { color: C.text, fontSize: 13, fontWeight: "900" },
  cancelPendingBtn: {
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  cancelPendingText: { color: C.muted, fontSize: 13, fontWeight: "700" },
  removeAvatarBtn: { paddingVertical: 4 },
  removeAvatarText: { color: C.muted, fontSize: 12.5, textDecorationLine: "underline" },
  formCard: {
    borderRadius: 14,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 14,
  },
  formHeader: { color: C.muted, fontSize: 12, fontWeight: "900", letterSpacing: 0.8, marginBottom: 12 },
  inputLabel: { color: C.secondary, fontSize: 13, fontWeight: "800", marginBottom: 6 },
  input: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: C.raised,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    color: C.text,
    fontSize: 14.5,
    marginBottom: 12,
  },
  inputDisabled: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    opacity: 0.85,
  },
  inputDisabledText: { color: C.muted, fontSize: 13.5 },
  accountStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  accountStatusText: { color: C.muted, fontSize: 12.5, flex: 1 },
  saveChangesBtn: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: C.red,
    alignItems: "center",
    justifyContent: "center",
  },
  saveChangesText: { color: C.text, fontSize: 14, fontWeight: "900", letterSpacing: 0.5 },
});
