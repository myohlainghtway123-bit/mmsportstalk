import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as Device from "expo-device";
import {
  clearAppCache,
  deleteAccount,
  getAuthStatus,
  logout,
  submitSupportReport,
} from "../services/accountApi";
import { useTheme } from "../theme/ThemeContext";
import PolicyScreen from "./PolicyScreens";
import { MST_LEGAL_URLS, MST_OFFICIAL_SOCIALS } from "../config/mstSocialAndLegalConfig";
import { showPrivacyOptionsForm } from "../services/adConsentService";
import ScreenHeader from "../components/ScreenHeader";

const SUPPORT_CATEGORIES = [
  ["score_incorrect", "Live score incorrect", "တိုက်ရိုက်ရလဒ်မှားယွင်းနေသည်"],
  ["match_data", "Match data incorrect", "ပွဲအချက်အလက်မှားယွင်းနေသည်"],
  ["account_auth", "Login / Account", "အကောင့်ဝင်ခြင်း / အကောင့်ပြဿနာ"],
  ["tips", "Tips / Marketplace", "Tips / ဝယ်ယူမှု"],
  ["payment", "Payment / Credits", "ငွေပေးချေမှု / Credits"],
  ["notification", "Notification", "အသိပေးချက်"],
  ["abuse_chat", "Abuse / Chat report", "မသင့်လျော်သောအပြုအမူ / Chat တိုင်ကြားရန်"],
  ["other", "Other issue", "အခြားပြဿနာ"],
];

const FALLBACK_COLORS = {
  bg: "#080A0C",
  card: "#101417",
  card2: "#171C20",
  border: "#293036",
  border2: "#1D2226",
  text: "#FFFFFF",
  text2: "#D4D8DB",
  muted: "#929AA0",
  red: "#F3262D",
  redSoft: "rgba(243,38,45,0.14)",
  green: "#48C78E",
  amber: "#F4C84D",
};

function SectionTitle({ title, colors }) {
  return <Text style={[s.section, { color: colors.red }]}>{title}</Text>;
}

function Row({
  icon,
  title,
  subtitle,
  onPress,
  tone,
  rightElement,
  colors,
  border = true,
  external = false,
  accessibilityLabel,
}) {
  const content = (
    <>
      <View style={[s.icon, { backgroundColor: colors.card2 }]}>
        <Ionicons name={icon} size={20} color={tone || colors.text2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={[s.rowTitle, { color: colors.text }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={2} style={[s.rowSub, { color: colors.muted }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {rightElement ? (
        rightElement
      ) : external ? (
        <Ionicons name="open-outline" size={17} color={colors.muted} />
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      ) : null}
    </>
  );

  const style = [
    s.row,
    border && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  ];

  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      style={style}
      onPress={onPress}
      android_ripple={{ color: "rgba(255,255,255,0.05)" }}
    >
      {content}
    </Pressable>
  ) : (
    <View style={style}>{content}</View>
  );
}

function SupportModal({ visible, onClose, colors, language }) {
  const my = language === "my";
  const [category, setCategory] = useState("score_incorrect");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState("");

  const submit = async () => {
    if (!message.trim()) {
      setResultMessage(my ? "ပြဿနာအကြောင်းအရာ ရေးသားပေးပါ" : "Please describe the issue.");
      return;
    }
    setSubmitting(true);
    setResultMessage("");
    try {
      const deviceInfo = `${Device.brand || ""} ${Device.modelName || ""} (${Platform.OS} ${Platform.Version})`;
      await submitSupportReport({
        category,
        message,
        email: email.trim() || null,
        deviceInfo,
      });
      setResultMessage(
        my
          ? "တိုင်ကြားချက်ပေးပို့ပြီးပါပြီ။ ကျေးဇူးတင်ပါသည်။"
          : "Thank you. Your report has been submitted.",
      );
      setTimeout(() => {
        setMessage("");
        setResultMessage("");
        onClose();
      }, 1400);
    } catch (e) {
      setResultMessage(e?.message || (my ? "ပေးပို့မှုမအောင်မြင်ပါ" : "Could not submit report."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={[s.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.modalHeader}>
            <Text style={[s.modalTitle, { color: colors.text }]}>
              {my ? "ပြဿနာတိုင်ကြားရန်" : "Report a Problem / Support"}
            </Text>
            <Pressable hitSlop={8} onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            <Text style={[s.modalLabel, { color: colors.text2 }]}>
              {my ? "အမျိုးအစား ရွေးချယ်ပါ" : "Category"}
            </Text>
            <View style={s.categoryGrid}>
              {SUPPORT_CATEGORIES.map(([key, en, burmese]) => {
                const selected = category === key;
                return (
                  <Pressable
                    key={key}
                    style={[
                      s.categoryChip,
                      { backgroundColor: colors.card2, borderColor: colors.border },
                      selected && { backgroundColor: colors.redSoft, borderColor: colors.red },
                    ]}
                    onPress={() => setCategory(key)}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        s.categoryText,
                        { color: colors.muted },
                        selected && { color: colors.red, fontWeight: "800" },
                      ]}
                    >
                      {my ? burmese : en}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[s.modalLabel, { color: colors.text2 }]}>
              {my ? "အီးမေးလ် (ရွေးချယ်နိုင်သည်)" : "Contact Email (optional)"}
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="name@example.com"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              keyboardType="email-address"
              style={[
                s.modalInput,
                { backgroundColor: colors.card2, borderColor: colors.border, color: colors.text },
              ]}
            />
            <Text style={[s.modalLabel, { color: colors.text2 }]}>
              {my ? "ပြဿနာအသေးစိတ်" : "Description"}
            </Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder={my ? "ဖြစ်ပွားသော ပြဿနာကို ဖော်ပြပေးပါ..." : "Describe what happened..."}
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={4}
              style={[
                s.modalTextArea,
                { backgroundColor: colors.card2, borderColor: colors.border, color: colors.text },
              ]}
            />
            {resultMessage ? (
              <Text
                style={[
                  s.modalResult,
                  { color: resultMessage.includes("ကျေးဇူးတင်") || resultMessage.includes("Thank") ? colors.green : colors.red },
                ]}
              >
                {resultMessage}
              </Text>
            ) : null}
            <Pressable
              disabled={submitting}
              style={[s.modalSubmit, { backgroundColor: colors.red }, submitting && { opacity: 0.6 }]}
              onPress={submit}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={s.modalSubmitText}>
                  {my ? "တိုင်ကြားချက်ပေးပို့မည်" : "SUBMIT REPORT"}
                </Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function SettingsScreenV2({
  goBack,
  openNotifications,
  openAccount,
  language = "my",
  setLanguage,
}) {
  let themeContext = null;
  try {
    themeContext = useTheme();
  } catch {
    // Render cleanly if ThemeProvider is not in tree
  }

  const colors = themeContext?.colors || FALLBACK_COLORS;
  const themeMode = themeContext?.themeMode || "dark";
  const setThemeMode = themeContext?.setThemeMode || (() => {});

  const my = language === "my";
  const [auth, setAuth] = useState(null);
  const [cacheStatus, setCacheStatus] = useState("");
  const [supportVisible, setSupportVisible] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadAuth = useCallback(async () => {
    try {
      const value = await getAuthStatus();
      setAuth(value);
    } catch {
      setAuth({ authenticated: false });
    }
  }, []);

  useEffect(() => {
    loadAuth();
  }, [loadAuth]);

  const version = Constants?.expoConfig?.version || "1.5.2";
  const build =
    Constants?.expoConfig?.android?.versionCode ??
    Constants?.expoConfig?.ios?.buildNumber ??
    "11";

  const handleClearCache = async () => {
    const result = await clearAppCache();
    setCacheStatus(
      my
        ? `ယာယီ cache ဖျက်ပြီးပါပြီ (${result.cleared} items)`
        : `Temporary cache cleared (${result.cleared} items)`,
    );
    setTimeout(() => setCacheStatus(""), 2500);
  };

  const handleOpenLink = async (url, label) => {
    if (!url) {
      Alert.alert(
        label || "Myanmar Sports Talk",
        my
          ? `တရားဝင် ${label} link သည် launch အချိန်တွင် ရရှိပါမည်။`
          : `Official ${label} channel will be configured upon production release.`
      );
      return;
    }
    const supported = await Linking.canOpenURL(url).catch(() => false);
    if (supported) {
      await Linking.openURL(url).catch(() => {});
    } else {
      Alert.alert("Link unavailable", `Could not open ${url}`);
    }
  };

  const handlePrivacyAdChoices = async () => {
    const consentResult = await showPrivacyOptionsForm();
    if (consentResult.shown) {
      // User reviewed or changed their consent choices
      return;
    }

    Alert.alert(
      my ? "ကြော်ငြာနှင့် ကိုယ်ရေးကိုယ်တာ ရွေးချယ်မှု" : "Privacy & Ad Choices",
      my
        ? "MST Scores သည် ဒေသန္တရဥပဒေများနှင့်အညီ တရားဝင် Google Mobile Ads UMP စနစ်ကို အသုံးပြုထားသည်။ သင့်ဒေသအတွက် ရွေးချယ်ခွင့်ဖောင် မလိုအပ်ပါက non-personalized ကြော်ငြာများကိုသာ ပြသပါသည်။"
        : consentResult.message || "Google UMP privacy choices form is active for applicable jurisdictions. Non-personalized ads are shown by default where consent is not required."
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      my ? "အကောင့်အပြီးတိုင် ဖျက်မည်လား?" : "Delete MST Account?",
      my
        ? "အကောင့်ဖျက်လိုက်ပါက သင်၏ Favorites၊ ပရိုဖိုင်၊ Tips နှင့် အသိပေးချက်ဒေတာများအားလုံး အပြီးတိုင် ဖျက်သိမ်းသွားမည်ဖြစ်သည်။ ဤလုပ်ဆောင်ချက်ကို ပြန်လည်ပြင်ဆင်၍ မရပါ။"
        : "This will permanently erase your profile, favorites, tip history, and notification data. This action cannot be undone.",
      [
        { text: my ? "မလုပ်တော့ပါ" : "Cancel", style: "cancel" },
        {
          text: my ? "အကောင့်ဖျက်မည်" : "Delete Permanently",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await deleteAccount();
              await loadAuth();
              Alert.alert(
                my ? "အကောင့်ဖျက်ပြီးပါပြီ" : "Account Deleted",
                my
                  ? "သင့်အကောင့်ကို အောင်မြင်စွာ ဖျက်သိမ်းလိုက်ပါပြီ။"
                  : "Your account data has been permanently removed."
              );
            } catch (e) {
              Alert.alert(my ? "အမှား" : "Error", e?.message || "Failed to delete account.");
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[s.screen, { backgroundColor: colors.bg }]}>
      <ScreenHeader
        title={my ? "ဆက်တင်များ" : "Settings"}
        subtitle="PREFERENCES & LEGAL"
        onBack={goBack}
      />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* SECTION 1: ACCOUNT */}
        <SectionTitle title={my ? "အကောင့် (ACCOUNT)" : "ACCOUNT"} colors={colors} />
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Row
            icon="person-circle-outline"
            title={
              auth?.authenticated
                ? auth.user?.displayName || auth.user?.email || "MST User"
                : my
                  ? "MST အကောင့်ဝင်ရန်"
                  : "Sign in to MST"
            }
            subtitle={
              auth?.authenticated
                ? my
                  ? "အကောင့်ဝင်ထားသည် · စက်ပစ္စည်းအားလုံးတွင် ချိတ်ဆက်ထားသည်"
                  : "Signed in · synced across web & mobile"
                : my
                  ? "Favorites နှင့် Tips ဒေတာများ သိမ်းဆည်းရန်"
                  : "Sync favorites and tip entitlements across devices"
            }
            onPress={openAccount}
            tone={colors.red}
            colors={colors}
          />
          {auth?.authenticated ? (
            <>
              <Row
                icon="log-out-outline"
                title={my ? "အကောင့်မှ ထွက်မည်" : "Log out"}
                subtitle={my ? "လက်ရှိစက်ပစ္စည်းမှ အကောင့်ထွက်ရန်" : "Sign out of this device"}
                onPress={async () => {
                  await logout();
                  await loadAuth();
                }}
                tone={colors.muted}
                colors={colors}
              />
              <Row
                icon="trash-outline"
                title={my ? "အကောင့်အပြီးတိုင် ဖျက်သိမ်းရန်" : "Delete Account"}
                subtitle={
                  my
                    ? "သင်၏ အကောင့်ဒေတာအားလုံးကို အပြီးတိုင် ဖျက်မည်"
                    : "Permanently erase account profile and all user data"
                }
                onPress={handleDeleteAccount}
                tone={colors.red}
                colors={colors}
                border={false}
              />
            </>
          ) : null}
        </View>

        {/* SECTION 2: PREFERENCES */}
        <SectionTitle title={my ? "ရွေးချယ်မှုများ (PREFERENCES)" : "PREFERENCES"} colors={colors} />
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {openNotifications ? (
            <Row
              icon="notifications-outline"
              title={my ? "အသိပေးချက် ဆက်တင်များ" : "Notifications"}
              subtitle={
                my
                  ? "ပွဲစဉ်၊ သတင်းနှင့် အကြိုက်ဆုံး အသိပေးချက်များ"
                  : "Match kickoff, goals, articles and favorites"
              }
              onPress={openNotifications}
              colors={colors}
            />
          ) : null}

          {/* Theme Switcher */}
          <View style={s.themeRow}>
            {[
              ["dark", my ? "Dark မုဒ်" : "Dark", "moon"],
              ["light", my ? "Light မုဒ်" : "Light", "sunny"],
              ["system", my ? "System မုဒ်" : "System", "phone-portrait"],
            ].map(([mode, label, icon]) => {
              const selected = themeMode === mode;
              return (
                <Pressable
                  key={mode}
                  style={[
                    s.themeButton,
                    { backgroundColor: colors.card2, borderColor: colors.border },
                    selected && { backgroundColor: colors.redSoft, borderColor: colors.red },
                  ]}
                  onPress={() => setThemeMode(mode)}
                >
                  <Ionicons
                    name={icon}
                    size={16}
                    color={selected ? colors.red : colors.muted}
                  />
                  <Text
                    style={[
                      s.themeButtonText,
                      { color: colors.muted },
                      selected && { color: colors.red, fontWeight: "900" },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Language Toggle */}
          {setLanguage ? (
            <View style={[s.langRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
              <Pressable
                style={[
                  s.langOption,
                  { backgroundColor: colors.card2, borderColor: colors.border },
                  my && { backgroundColor: colors.redSoft, borderColor: colors.red },
                ]}
                onPress={() => setLanguage("my")}
              >
                <Text
                  style={[
                    s.langOptionText,
                    { color: colors.muted },
                    my && { color: colors.red, fontWeight: "900" },
                  ]}
                >
                  မြန်မာ (Burmese)
                </Text>
                {my ? <Ionicons name="checkmark-circle" size={17} color={colors.red} /> : null}
              </Pressable>
              <Pressable
                style={[
                  s.langOption,
                  { backgroundColor: colors.card2, borderColor: colors.border },
                  !my && { backgroundColor: colors.redSoft, borderColor: colors.red },
                ]}
                onPress={() => setLanguage("en")}
              >
                <Text
                  style={[
                    s.langOptionText,
                    { color: colors.muted },
                    !my && { color: colors.red, fontWeight: "900" },
                  ]}
                >
                  English (EN)
                </Text>
                {!my ? <Ionicons name="checkmark-circle" size={17} color={colors.red} /> : null}
              </Pressable>
            </View>
          ) : null}

          <Row
            icon="refresh-outline"
            title={my ? "ယာယီ Cache ဖျက်ရန်" : "Clear App Cache"}
            subtitle={
              cacheStatus ||
              (my
                ? "သိမ်းဆည်းထားသော အမြန်ဒေတာများကို ရှင်းလင်းမည်"
                : "Purge temporary cached football fixtures and news")
            }
            onPress={handleClearCache}
            colors={colors}
            border={false}
          />
        </View>

        {/* SECTION 3: FOLLOW MYANMAR SPORTS TALK */}
        <SectionTitle
          title={my ? "MST ကို FOLLOW လုပ်ရန် (FOLLOW MST)" : "FOLLOW MYANMAR SPORTS TALK"}
          colors={colors}
        />
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {MST_OFFICIAL_SOCIALS.map((platform, index) => (
            <Row
              key={platform.id}
              icon={platform.icon}
              title={platform.name}
              subtitle={platform.subtitle}
              tone={platform.color}
              external
              onPress={() => handleOpenLink(platform.url, platform.name)}
              colors={colors}
              border={index < MST_OFFICIAL_SOCIALS.length - 1}
            />
          ))}
        </View>

        {/* SECTION 4: PRIVACY & LEGAL */}
        <SectionTitle
          title={my ? "မူဝါဒနှင့် ဥပဒေရေးရာ (PRIVACY & LEGAL)" : "PRIVACY & LEGAL"}
          colors={colors}
        />
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Row
            icon="shield-checkmark-outline"
            title={my ? "ကိုယ်ရေးအချက်အလက် မူဝါဒ" : "Privacy Policy"}
            subtitle={
              my
                ? "ဒေတာလုံခြုံရေးနှင့် သိမ်းဆည်းမှု စည်းမျဉ်း"
                : "Data collection, privacy & user rights"
            }
            onPress={() => setSelectedPolicy("privacy")}
            colors={colors}
          />
          <Row
            icon="document-text-outline"
            title={my ? "ဝန်ဆောင်မှု စည်းမျဉ်းများ" : "Terms of Use"}
            subtitle={
              my
                ? "MST Scores အသုံးပြုမှု အခြေခံစည်းမျဉ်းများ"
                : "Terms of service and acceptable use"
            }
            onPress={() => setSelectedPolicy("terms")}
            colors={colors}
          />
          <Row
            icon="options-outline"
            title={my ? "ကြော်ငြာနှင့် ရွေးချယ်ခွင့်" : "Privacy / Ad Choices"}
            subtitle={
              my
                ? "Google Mobile Ads UMP consent ရွေးချယ်ခွင့်"
                : "Manage advertising consent and data preferences"
            }
            onPress={handlePrivacyAdChoices}
            colors={colors}
          />
          <Row
            icon="trash-bin-outline"
            title={my ? "အကောင့်နှင့် ဒေတာဖျက်သိမ်းမှု အချက်အလက်" : "Account / Data Deletion information"}
            subtitle={
              my
                ? "GDPR ဒေတာဖျက်ပိုင်ခွင့်နှင့် အပြီးတိုင်ဖျက်သိမ်းပုံ"
                : "How to request permanent user data erasure"
            }
            onPress={() => setSelectedPolicy("privacy")}
            colors={colors}
            border={false}
          />
        </View>

        {/* SECTION 5: ABOUT */}
        <SectionTitle title={my ? "အက်ပ် အချက်အလက် (ABOUT)" : "ABOUT"} colors={colors} />
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Row
            icon="football-outline"
            title="Myanmar Sports Talk / MST Scores"
            subtitle={`Version ${version} (Build ${build}) · Android & iOS`}
            colors={colors}
          />
          <Row
            icon="chatbubble-ellipses-outline"
            title={my ? "ပြဿနာတိုင်ကြားရန် / အကြံပြုချက်" : "Support / Contact Us"}
            subtitle={
              my
                ? "ရလဒ်မှားယွင်းမှု၊ အကောင့်၊ tips ပြဿနာများ တင်ပြရန်"
                : "Report scores, login, or general feedback"
            }
            onPress={() => setSupportVisible(true)}
            tone={colors.red}
            colors={colors}
          />
          <Row
            icon="globe-outline"
            title="myanmarsportstalk.com"
            subtitle={my ? "တရားဝင် ဝဘ်ဆိုက်သို့ သွားရန်" : "Visit the official MST website"}
            external
            onPress={() => handleOpenLink(MST_LEGAL_URLS.website, "Website")}
            colors={colors}
            border={false}
          />
        </View>

        <Text style={[s.footer, { color: colors.muted }]}>
          Myanmar Sports Talk · MST Scores v{version}
        </Text>
      </ScrollView>

      <SupportModal
        visible={supportVisible}
        onClose={() => setSupportVisible(false)}
        colors={colors}
        language={language}
      />

      <Modal
        visible={Boolean(selectedPolicy)}
        animationType="slide"
        onRequestClose={() => setSelectedPolicy(null)}
      >
        <PolicyScreen
          policyId={selectedPolicy}
          onBack={() => setSelectedPolicy(null)}
          language={language}
        />
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 14, paddingBottom: 60 },
  section: {
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  card: {
    borderWidth: 1,
    borderRadius: 13,
    overflow: "hidden",
    marginBottom: 6,
  },
  row: {
    minHeight: 58,
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontSize: 12.5, fontWeight: "800" },
  rowSub: { fontSize: 9.3, marginTop: 2, lineHeight: 13 },
  themeRow: {
    flexDirection: "row",
    gap: 8,
    padding: 10,
  },
  themeButton: {
    flex: 1,
    height: 40,
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  themeButtonText: { fontSize: 10, fontWeight: "700" },
  langRow: {
    flexDirection: "row",
    gap: 8,
    padding: 10,
  },
  langOption: {
    flex: 1,
    height: 40,
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  langOptionText: { fontSize: 10, fontWeight: "700" },
  footer: { fontSize: 9, textAlign: "center", marginTop: 20, marginBottom: 12 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 15,
    padding: 16,
    maxHeight: "88%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    paddingBottom: 8,
  },
  modalTitle: { fontSize: 14.5, fontWeight: "900" },
  modalLabel: { fontSize: 10.5, fontWeight: "800", marginTop: 10, marginBottom: 6 },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
  },
  categoryChip: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
  },
  categoryText: { fontSize: 9.2 },
  modalInput: {
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 11,
    fontSize: 11.5,
  },
  modalTextArea: {
    minHeight: 80,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
    fontSize: 11.5,
    textAlignVertical: "top",
  },
  modalResult: { fontSize: 10, marginTop: 8, textAlign: "center" },
  modalSubmit: {
    height: 43,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  modalSubmitText: { color: "#FFFFFF", fontSize: 10.5, fontWeight: "900" },
});
