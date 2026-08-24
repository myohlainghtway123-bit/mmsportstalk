import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../theme/ThemeContext";
import {
  deleteAvatar,
  extractUser,
  getAccountPredictions,
  getAuthStatus,
  getProfile,
  logout,
  MST_SITE_URL,
  normalizePredictionPayload,
  normalizeAvatarUrl,
  startEmailLogin,
  uploadAvatar,
  verifyEmailLogin,
} from "../services/accountApi";

function predictionPointsFrom(payload) {
  const summaryPoints = payload?.meta?.summary?.points;
  if (summaryPoints !== undefined && summaryPoints !== null && Number.isFinite(Number(summaryPoints))) {
    return Number(summaryPoints);
  }
  if (!payload) return null;
  return normalizePredictionPayload(payload).reduce((total, prediction) => total + (Number(prediction.points) || 0), 0);
}

function profileFrom(payload, user, predictionPoints = null) {
  const parsed = extractUser(payload) || extractUser(user) || {};
  return {
    name: parsed.name || parsed.displayName || "MST User",
    email: parsed.email || "",
    avatar: parsed.avatar || parsed.avatarUrl || null,
    points: predictionPoints ?? parsed.points ?? null,
    joined: parsed.createdAt || parsed.created_at || null,
  };
}

function LoginPanel({ onSignedIn, colors, language = "my" }) {
  const my = language === "my";
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("email");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const send = async () => {
    const clean = email.trim().toLowerCase();
    if (!clean || !clean.includes("@")) {
      setError(my ? "မှန်ကန်သော အီးမေးလ် ထည့်သွင်းပါ" : "Enter a valid email address.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await startEmailLogin(clean);
      setEmail(clean);
      setStep("code");
      setMessage(my ? "အတည်ပြုကုဒ် ပို့ပြီးပါပြီ။ Email စစ်ဆေးပါ။" : "Verification code sent. Check your email.");
    } catch (e) {
      setError(e?.message || (my ? "ကုဒ်ပို့၍ မရပါ" : "Could not send verification code."));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!code.trim()) {
      setError(my ? "အတည်ပြုကုဒ် ထည့်ပါ" : "Enter the verification code.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await verifyEmailLogin(email, code.trim());
      if (!result?.status?.authenticated) {
        throw new Error(my ? "အကောင့်ဝင်ရောက်မှု မအောင်မြင်ပါ။ ပြန်စမ်းပါ။" : "Sign-in session was not created. Try the code again.");
      }
      setMessage(my ? "MST အကောင့်ဝင်ပြီးပါပြီ။" : "Signed in to your MST account.");
      await onSignedIn?.();
    } catch (e) {
      setError(e?.message || (my ? "ကုဒ်မှားယွင်းနေပါသည်" : "Verification failed."));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await startEmailLogin(email, { resend: true });
      setCode("");
      setMessage(my ? "အတည်ပြုကုဒ်အသစ် ပို့ပြီးပါပြီ။ နောက်ဆုံး Email ကို စစ်ဆေးပါ။" : "A new verification code was sent. Use the newest email.");
    } catch (e) {
      setError(e?.message || (my ? "ကုဒ်အသစ်ပို့၍ မရသေးပါ။ ခဏနေ ပြန်စမ်းပါ။" : "Could not send a new code yet. Try again shortly."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[s.loginCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[s.mstBadge, { backgroundColor: colors.redSoft }]}>
        <Text style={[s.mst, { color: colors.red }]}>MST</Text>
      </View>
      <Text style={[s.loginTitle, { color: colors.text }]}>
        {my ? "MST အကောင့်သို့ ဝင်ရောက်ပါ" : "Sign in to Myanmar Sports Talk"}
      </Text>
      <Text style={[s.loginText, { color: colors.muted }]}>
        {my
          ? "myanmarsportstalk.com တွင်သုံးသော Email ဖြင့် အကောင့်တူတူ သုံးနိုင်ပါသည်။ Favorites နှင့် Predictions အားလုံး ချိတ်ဆက်ပါမည်။"
          : "Use the same email as myanmarsportstalk.com. Your Favorites and Predictions stay in one account."}
      </Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        editable={!busy && step === "email"}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder={my ? "အီးမေးလ်လိပ်စာ" : "Email address"}
        placeholderTextColor={colors.muted}
        style={[s.input, { backgroundColor: colors.panel, borderColor: colors.border, color: colors.text }]}
      />
      {step === "code" ? (
        <TextInput
          value={code}
          onChangeText={setCode}
          editable={!busy}
          autoCapitalize="none"
          keyboardType="number-pad"
          placeholder={my ? "အတည်ပြုကုဒ် (၆ လုံး)" : "Verification code"}
          placeholderTextColor={colors.muted}
          style={[s.input, { backgroundColor: colors.panel, borderColor: colors.border, color: colors.text }]}
        />
      ) : null}
      {message ? <Text style={[s.success, { color: colors.green }]}>{message}</Text> : null}
      {error ? <Text style={[s.error, { color: colors.red }]}>{error}</Text> : null}
      <Pressable
        disabled={busy}
        style={[s.primary, { backgroundColor: colors.red }, busy && { opacity: 0.55 }]}
        onPress={step === "email" ? send : verify}
      >
        {busy ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={s.primaryText}>{step === "email" ? (my ? "ကုဒ်ပို့ပါ" : "SEND CODE") : (my ? "အတည်ပြု၍ ဝင်မည်" : "VERIFY & SIGN IN")}</Text>
        )}
      </Pressable>
      {step === "code" ? (
        <>
          <Pressable disabled={busy} onPress={resend}>
            <Text style={[s.textButton, { color: colors.red }]}>
              {my ? "ကုဒ်အသစ် တောင်းမည်" : "REQUEST NEW CODE"}
            </Text>
          </Pressable>
          <Pressable
            disabled={busy}
            onPress={() => {
              setStep("email");
              setCode("");
              setError("");
              setMessage("");
            }}
          >
            <Text style={[s.textButton, { color: colors.text2 }]}>
              {my ? "အခြား Email ဖြင့် စမ်းမည်" : "Use a different email"}
            </Text>
          </Pressable>
        </>
      ) : null}
      <Pressable onPress={() => Linking.openURL(`${MST_SITE_URL}/login`).catch(() => {})}>
        <Text style={[s.webLink, { color: colors.muted }]}>
          {my ? "MST ဝဘ်ဆိုက်မှ ဝင်မည်" : "Open MST website login"}
        </Text>
      </Pressable>
    </View>
  );
}

function MenuRow({ icon, title, subtitle, onPress, tone, colors }) {
  return (
    <Pressable style={[s.menuRow, { borderBottomColor: colors.border2 }]} onPress={onPress}>
      <View style={[s.menuIcon, { backgroundColor: colors.panel }]}>
        <Ionicons name={icon} size={20} color={tone || colors.text2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.menuTitle, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[s.menuSub, { color: colors.muted }]}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

export default function AccountScreenV2({
  goBack,
  openFavorites,
  openPredictions,
  openNotifications,
  openSettings,
  language = "my",
  onProfileUpdated,
}) {
  const { colors } = useTheme();
  const my = language === "my";
  const [loading, setLoading] = useState(true);
  const [auth, setAuth] = useState({ authenticated: false, user: null });
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const status = await getAuthStatus();
      setAuth(status);
      if (status.authenticated) {
        const [payload, predictions] = await Promise.all([
          getProfile().catch(() => null),
          getAccountPredictions().catch(() => null),
        ]);
        const resolved = profileFrom(payload, status.user, predictionPointsFrom(predictions));
        setProfile(resolved);
        onProfileUpdated?.(resolved);
      } else {
        setProfile(null);
        onProfileUpdated?.(null);
      }
    } catch (e) {
      setError(e?.message || "Could not check MST account.");
    } finally {
      setLoading(false);
    }
  }, [onProfileUpdated]);

  useEffect(() => {
    load();
  }, [load]);

  const signOut = async () => {
    setSigningOut(true);
    setError("");
    try {
      await logout();
      const status = await getAuthStatus().catch(() => ({ authenticated: false, user: null }));
      if (status.authenticated) throw new Error("MST session is still active. Please try signing out again.");
      setAuth({ authenticated: false, user: null });
      setProfile(null);
      onProfileUpdated?.(null);
    } catch (e) {
      setError(e?.message || "Could not sign out.");
    } finally {
      setSigningOut(false);
    }
  };

  const handlePickGallery = async () => {
    setShowPhotoModal(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          my ? "ခွင့်ပြုချက် လိုအပ်ပါသည်" : "Permission Required",
          my ? "ပုံတင်ရန် ဓာတ်ပုံ Gallery ခွင့်ပြုချက် လိုအပ်ပါသည်။" : "Photos permission is required to choose a profile photo.",
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
        base64: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setAvatarBusy(true);
        const res = await uploadAvatar({
          uri: asset.uri,
          base64: asset.base64,
          contentType: asset.mimeType || "image/jpeg",
        });
        if (res.avatarUrl) {
          setProfile((prev) => ({ ...prev, avatar: res.avatarUrl }));
          onProfileUpdated?.({ ...(profile || {}), avatar: res.avatarUrl });
          await load();
        }
      }
    } catch (err) {
      Alert.alert(my ? "အမှား" : "Error", err?.message || "Could not upload profile picture.");
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleTakePhoto = async () => {
    setShowPhotoModal(false);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          my ? "ခွင့်ပြုချက် လိုအပ်ပါသည်" : "Permission Required",
          my ? "ဓာတ်ပုံရိုက်ရန် Camera ခွင့်ပြုချက် လိုအပ်ပါသည်။" : "Camera permission is required to capture a profile photo.",
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
        base64: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setAvatarBusy(true);
        const res = await uploadAvatar({
          uri: asset.uri,
          base64: asset.base64,
          contentType: asset.mimeType || "image/jpeg",
        });
        if (res.avatarUrl) {
          setProfile((prev) => ({ ...prev, avatar: res.avatarUrl }));
          onProfileUpdated?.({ ...(profile || {}), avatar: res.avatarUrl });
          await load();
        }
      }
    } catch (err) {
      Alert.alert(my ? "အမှား" : "Error", err?.message || "Could not capture photo.");
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleRemovePhoto = async () => {
    setShowPhotoModal(false);
    setAvatarBusy(true);
    try {
      await deleteAvatar();
      setProfile((prev) => ({ ...prev, avatar: null }));
      onProfileUpdated?.({ ...(profile || {}), avatar: null });
      await load();
    } catch (err) {
      Alert.alert(my ? "အမှား" : "Error", err?.message || "Could not remove profile picture.");
    } finally {
      setAvatarBusy(false);
    }
  };

  const initials = profile?.name ? profile.name.slice(0, 2).toUpperCase() : "M";

  return (
    <View style={[s.screen, { backgroundColor: colors.bg }]}>
      <View style={[s.header, { borderBottomColor: colors.border2 }]}>
        <Pressable hitSlop={10} onPress={goBack}>
          <Ionicons name="chevron-back" size={27} color={colors.text} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.text }]}>{my ? "ကျွန်ုပ်၏အကောင့်" : "My Account"}</Text>
        <View style={{ width: 27 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={s.state}>
            <ActivityIndicator color={colors.red} />
            <Text style={[s.stateText, { color: colors.muted }]}>Checking MST account…</Text>
          </View>
        ) : null}

        {!loading && error ? (
          <View style={[s.notice, { backgroundColor: colors.redSoft, borderColor: colors.red }]}>
            <Ionicons name="alert-circle-outline" size={20} color={colors.red} />
            <Text style={[s.noticeText, { color: colors.text2 }]}>{error}</Text>
          </View>
        ) : null}

        {!loading && !auth.authenticated ? (
          <LoginPanel onSignedIn={load} colors={colors} language={language} />
        ) : null}

        {!loading && auth.authenticated ? (
          <>
            <View style={[s.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Pressable
                style={s.avatarContainer}
                onPress={() => setShowPhotoModal(true)}
                disabled={avatarBusy}
              >
                {avatarBusy ? (
                  <View style={[s.avatarFallback, { backgroundColor: colors.panel }]}>
                    <ActivityIndicator size="small" color={colors.red} />
                  </View>
                ) : profile?.avatar ? (
                  <Image source={{ uri: profile.avatar }} style={s.avatar} />
                ) : (
                  <View style={[s.avatarFallback, { backgroundColor: colors.redSoft }]}>
                    <Text style={[s.avatarInitials, { color: colors.red }]}>{initials}</Text>
                  </View>
                )}
                <View style={[s.cameraBadge, { backgroundColor: colors.red, borderColor: colors.card }]}>
                  <Ionicons name="camera" size={13} color="#FFFFFF" />
                </View>
              </Pressable>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={[s.profileName, { color: colors.text }]}>
                  {profile?.name || "MST User"}
                </Text>
                <Text numberOfLines={1} style={[s.profileEmail, { color: colors.muted }]}>
                  {profile?.email || auth.user?.email || "Signed in"}
                </Text>
                <Pressable
                  onPress={() => setShowPhotoModal(true)}
                  style={{ marginTop: 6 }}
                  hitSlop={6}
                >
                  <Text style={[s.changePhotoText, { color: colors.red }]}>
                    {my ? "ပုံပြောင်းရန်" : "Change Photo"}
                  </Text>
                </Pressable>
              </View>

              {profile?.points != null ? (
                <View style={[s.points, { backgroundColor: colors.redSoft }]}>
                  <Text style={[s.pointsNumber, { color: colors.red }]}>{profile.points}</Text>
                  <Text style={[s.pointsLabel, { color: colors.muted }]}>PTS</Text>
                </View>
              ) : null}
            </View>

            <Text style={[s.section, { color: colors.text2 }]}>{my ? "အကောင့်နှင့် လှုပ်ရှားမှုများ" : "ACCOUNT & ACTIVITY"}</Text>

            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <MenuRow
                icon="star-outline"
                title={my ? "အကြိုက်ဆုံးများ" : "Favorites"}
                subtitle={my ? "အသင်း၊ ပြိုင်ပွဲနှင့် ကစားသမားများ" : "Teams, competitions and players"}
                onPress={openFavorites}
                colors={colors}
              />
              <MenuRow
                icon="trophy-outline"
                title={my ? "ခန့်မှန်းချက်များ" : "Predictions"}
                subtitle={my ? "ရမှတ်များနှင့် ဦးဆောင်သူဇယား" : "Scores, points and leaderboard"}
                onPress={openPredictions}
                colors={colors}
              />
              <MenuRow
                icon="notifications-outline"
                title={my ? "အသိပေးချက်များ" : "Notifications"}
                subtitle={my ? "သတင်းနှင့် ပွဲအသိပေးချက်များ" : "News and match alerts"}
                onPress={openNotifications}
                colors={colors}
              />
              <MenuRow
                icon="settings-outline"
                title={my ? "ဆက်တင်များ" : "Settings"}
                subtitle={my ? "App နှင့် အကောင့်ဆက်တင်များ" : "App and account preferences"}
                onPress={openSettings}
                colors={colors}
              />
              <MenuRow
                icon="globe-outline"
                title={my ? "ဝဘ်ဆိုက်တွင် စီမံမည်" : "Manage on website"}
                subtitle="myanmarsportstalk.com"
                onPress={() => Linking.openURL(`${MST_SITE_URL}/account`).catch(() => {})}
                colors={colors}
              />
            </View>

            <Pressable
              disabled={signingOut}
              style={[
                s.signOut,
                { backgroundColor: colors.redSoft, borderColor: colors.red },
                signingOut && { opacity: 0.55 },
              ]}
              onPress={signOut}
            >
              {signingOut ? (
                <ActivityIndicator color={colors.red} />
              ) : (
                <>
                  <Ionicons name="log-out-outline" size={18} color={colors.red} />
                  <Text style={[s.signOutText, { color: colors.red }]}>{my ? "အကောင့်ထွက်မည်" : "SIGN OUT"}</Text>
                </>
              )}
            </Pressable>
          </>
        ) : null}
      </ScrollView>

      {/* Avatar Actions Native Modal */}
      <Modal
        visible={showPhotoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotoModal(false)}
      >
        <Pressable
          style={s.modalBackdrop}
          onPress={() => setShowPhotoModal(false)}
        >
          <Pressable style={[s.photoModalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.photoModalTitle, { color: colors.text }]}>
              {my ? "ပရိုဖိုင်ဓာတ်ပုံ ပြောင်းလဲရန်" : "Change Profile Photo"}
            </Text>
            <Text style={[s.photoModalSub, { color: colors.muted }]}>
              {my
                ? "ရွေးချယ်ထားသော ဓာတ်ပုံသည် Website နှင့် App နှစ်ခုလုံးတွင် အတူတူ ပြောင်းလဲပါမည်။"
                : "Your photo will synchronize across the MST website and mobile app."}
            </Text>

            <Pressable
              style={[s.modalOption, { borderBottomColor: colors.border2 }]}
              onPress={handleTakePhoto}
            >
              <View style={[s.modalOptionIcon, { backgroundColor: colors.panel }]}>
                <Ionicons name="camera-outline" size={22} color={colors.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.modalOptionText, { color: colors.text }]}>{my ? "Camera ဖြင့် ဓာတ်ပုံရိုက်မည်" : "Take Photo with Camera"}</Text>
                <Text style={[s.modalOptionSub, { color: colors.muted }]}>{my ? "ကင်မရာဖြင့် အသစ်ရိုက်ယူပါ" : "Capture a new picture"}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>

            <Pressable
              style={[s.modalOption, { borderBottomColor: colors.border2 }]}
              onPress={handlePickGallery}
            >
              <View style={[s.modalOptionIcon, { backgroundColor: colors.panel }]}>
                <Ionicons name="images-outline" size={22} color={colors.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.modalOptionText, { color: colors.text }]}>{my ? "Photo Gallery မှ ရွေးမည်" : "Choose from Gallery"}</Text>
                <Text style={[s.modalOptionSub, { color: colors.muted }]}>{my ? "ဖုန်းထဲရှိ ဓာတ်ပုံများမှ ရွေးပါ" : "Select from device photos"}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>

            {profile?.avatar ? (
              <Pressable
                style={[s.modalOption, { borderBottomColor: colors.border2 }]}
                onPress={handleRemovePhoto}
              >
                <View style={[s.modalOptionIcon, { backgroundColor: colors.redSoft }]}>
                  <Ionicons name="trash-outline" size={22} color={colors.red} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.modalOptionText, { color: colors.red }]}>{my ? "လက်ရှိပုံ ဖယ်ရှားမည်" : "Remove Current Photo"}</Text>
                  <Text style={[s.modalOptionSub, { color: colors.muted }]}>{my ? "Default avatar သို့ ပြန်ပြောင်းပါမည်" : "Reset to default avatar"}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            ) : null}

            <Pressable
              style={[s.modalCancelButton, { backgroundColor: colors.panel }]}
              onPress={() => setShowPhotoModal(false)}
            >
              <Text style={[s.modalCancelText, { color: colors.text }]}>{my ? "မလုပ်တော့ပါ" : "Cancel"}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    minHeight: 60,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
  },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 15, fontWeight: "900" },
  content: { padding: 14, paddingBottom: 38 },
  state: { minHeight: 130, alignItems: "center", justifyContent: "center", gap: 9 },
  stateText: { fontSize: 10.5 },
  notice: { borderRadius: 10, borderWidth: 1, padding: 10, flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 10 },
  noticeText: { flex: 1, fontSize: 10, lineHeight: 14 },
  loginCard: { borderWidth: 1, borderRadius: 14, padding: 16, alignItems: "center" },
  mstBadge: { width: 54, height: 54, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  mst: { fontSize: 20, fontWeight: "900", fontStyle: "italic" },
  loginTitle: { fontSize: 16, fontWeight: "900", textAlign: "center", marginTop: 12 },
  loginText: { fontSize: 10.5, lineHeight: 15, textAlign: "center", marginTop: 6, marginBottom: 14, maxWidth: 300 },
  input: { width: "100%", height: 46, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 12, marginBottom: 8 },
  primary: { width: "100%", height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 6 },
  primaryText: { fontSize: 10.5, fontWeight: "900", color: "#FFFFFF" },
  success: { alignSelf: "flex-start", fontSize: 10, marginVertical: 4 },
  error: { alignSelf: "flex-start", fontSize: 10, marginVertical: 4 },
  textButton: { fontSize: 10, marginTop: 14 },
  webLink: { fontSize: 9.8, marginTop: 14, textDecorationLine: "underline" },
  profileCard: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 14 },
  avatarContainer: { position: "relative" },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarFallback: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  avatarInitials: { fontSize: 18, fontWeight: "900" },
  cameraBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  profileName: { fontSize: 16, fontWeight: "900" },
  profileEmail: { fontSize: 11, marginTop: 3 },
  changePhotoText: { fontSize: 11, fontWeight: "800" },
  points: { minWidth: 56, height: 50, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  pointsNumber: { fontSize: 18, fontWeight: "900" },
  pointsLabel: { fontSize: 8, fontWeight: "900", marginTop: 1 },
  section: { fontSize: 11, fontWeight: "900", marginTop: 18, marginBottom: 8 },
  card: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  menuRow: { minHeight: 60, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1 },
  menuIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  menuTitle: { fontSize: 12.5, fontWeight: "800" },
  menuSub: { fontSize: 9.5, marginTop: 2 },
  signOut: { height: 44, borderRadius: 10, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 16 },
  signOutText: { fontSize: 10.5, fontWeight: "900" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  photoModalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    padding: 20,
    paddingBottom: 36,
  },
  photoModalTitle: {
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 4,
  },
  photoModalSub: {
    fontSize: 11,
    textAlign: "center",
    marginBottom: 18,
    lineHeight: 16,
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOptionText: {
    fontSize: 13,
    fontWeight: "800",
  },
  modalOptionSub: {
    fontSize: 10.5,
    marginTop: 2,
  },
  modalCancelButton: {
    marginTop: 16,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: {
    fontSize: 12.5,
    fontWeight: "800",
  },
});
