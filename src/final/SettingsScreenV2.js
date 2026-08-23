import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  MST_SITE_URL,
  submitSupportReport,
} from "../services/accountApi";
import { useTheme } from "../theme/ThemeContext";
import PolicyScreen from "./PolicyScreens";
import { handleRateNow } from "../services/appRatingService";

const SUPPORT_CATEGORIES = [
  ["score_incorrect", "Live score incorrect", "တိုက်ရိုက်ရလဒ်မှားယွင်းနေသည်"],
  ["match_data", "Match data incorrect", "ပွဲအချက်အလက်မှားယွင်းနေသည်"],
  ["account_auth", "Login / Account", "အကောင့်ဝင်ခြင်း / အကောင့်ပြဿနာ"],
  ["prediction", "Prediction", "ခန့်မှန်းချက်"],
  ["tips", "Tips / Marketplace", "Tips / ဝယ်ယူမှု"],
  ["payment", "Payment / Credits", "ငွေပေးချေမှု / Credits"],
  ["notification", "Notification", "အသိပေးချက်"],
  ["abuse_chat", "Abuse / Chat report", "မသင့်လျော်သောအပြုအမူ / Chat တိုင်ကြားရန်"],
  ["other", "Other issue", "အခြားပြဿနာ"],
];

function Header({ goBack, colors }) {
  return (
    <View style={[s.header, { borderBottomColor: colors.border2, backgroundColor: colors.bg }]}>
      <Pressable hitSlop={10} onPress={goBack}>
        <Ionicons name="chevron-back" size={27} color={colors.text} />
      </Pressable>
      <View style={s.headerCopy}>
        <Text style={[s.title, { color: colors.text }]}>Settings</Text>
        <Text style={[s.subtitle, { color: colors.muted }]}>MST Score Preferences & Support</Text>
      </View>
      <View style={{ width: 27 }} />
    </View>
  );
}

function SectionTitle({ title, colors }) {
  return <Text style={[s.section, { color: colors.text2 }]}>{title}</Text>;
}

function Row({ icon, title, subtitle, onPress, tone, rightElement, colors, border = true }) {
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
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      ) : null}
    </>
  );

  const style = [s.row, border && { borderBottomWidth: 1, borderBottomColor: colors.border2 }];
  return onPress ? (
    <Pressable style={style} onPress={onPress} android_ripple={{ color: "rgba(255,255,255,0.05)" }}>
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
        <View style={[s.modalCard, { backgroundColor: colors.card, borderColor: colors.border2 }]}>
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
                      { backgroundColor: colors.card2, borderColor: colors.border2 },
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
  const { colors, themeMode, setThemeMode } = useTheme();
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

  const version = Constants?.expoConfig?.version || "1.5.1";
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

  const handleDeleteAccount = () => {
    Alert.alert(
      my ? "အကောင့်အပြီးတိုင် ဖျက်မည်လား?" : "Delete MST Account?",
      my
        ? "အကောင့်ဖျက်လိုက်ပါက သင်၏ Favorites၊ Predictions၊ Tips ဒေတာများအားလုံး အပြီးတိုင် ဖျက်သိမ်းသွားမည်ဖြစ်သည်။"
        : "This will permanently erase your profile, favorites, prediction history, and notification data. This action cannot be undone.",
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
                my ? "သင့်အကောင့်ကို အောင်မြင်စွာ ဖျက်သိမ်းလိုက်ပါပြီ။" : "Your account data has been removed.",
              );
            } catch (e) {
              Alert.alert(my ? "အမှား" : "Error", e?.message || "Failed to delete account.");
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[s.screen, { backgroundColor: colors.bg }]}>
      <Header goBack={goBack} colors={colors} />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* ACCOUNT */}
        <SectionTitle title={my ? "အကောင့် (ACCOUNT)" : "ACCOUNT & PROFILE"} colors={colors} />
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border2 }]}>
          <Row
            icon="person-circle-outline"
            title={auth?.authenticated ? (auth.user?.displayName || auth.user?.email || "MST User") : (my ? "MST အကောင့်ဝင်ရန်" : "Sign in to MST")}
            subtitle={auth?.authenticated ? (my ? "အကောင့်ဝင်ထားသည် · စက်ပစ္စည်းအားလုံးတွင် ချိတ်ဆက်ထားသည်" : "Signed in · synced across web & mobile") : (my ? "Favorites နှင့် Predictions ဒေတာများ သိမ်းဆည်းရန်" : "Sync favorites, predictions and alerts")}
            onPress={openAccount}
            tone={colors.red}
            colors={colors}
          />
          {auth?.authenticated ? (
            <Row
              icon="log-out-outline"
              title={my ? "အကောင့်မှ ထွက်မည်" : "Sign Out"}
              subtitle={my ? "လက်ရှိစက်ပစ္စည်းမှ အကောင့်ထွက်ရန်" : "Sign out of this device"}
              onPress={async () => {
                await logout();
                await loadAuth();
              }}
              tone={colors.muted}
              colors={colors}
              border={false}
            />
          ) : null}
        </View>

        {/* APPEARANCE */}
        <SectionTitle title={my ? "အသွင်အပြင် (APPEARANCE)" : "APPEARANCE & THEME"} colors={colors} />
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border2 }]}>
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
                    { backgroundColor: colors.card2, borderColor: colors.border2 },
                    selected && { backgroundColor: colors.redSoft, borderColor: colors.red },
                  ]}
                  onPress={() => setThemeMode(mode)}
                >
                  <Ionicons
                    name={icon}
                    size={17}
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
        </View>

        {/* LANGUAGE */}
        {setLanguage ? (
          <>
            <SectionTitle title={my ? "ဘာသာစကား (LANGUAGE)" : "APP LANGUAGE"} colors={colors} />
            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border2 }]}>
              <View style={s.langRow}>
                <Pressable
                  style={[
                    s.langOption,
                    { backgroundColor: colors.card2, borderColor: colors.border2 },
                    my && { backgroundColor: colors.redSoft, borderColor: colors.red },
                  ]}
                  onPress={() => setLanguage("my")}
                >
                  <Text style={[s.langOptionText, { color: colors.muted }, my && { color: colors.red, fontWeight: "900" }]}>
                    မြန်မာ (Burmese)
                  </Text>
                  {my ? <Ionicons name="checkmark-circle" size={17} color={colors.red} /> : null}
                </Pressable>
                <Pressable
                  style={[
                    s.langOption,
                    { backgroundColor: colors.card2, borderColor: colors.border2 },
                    !my && { backgroundColor: colors.redSoft, borderColor: colors.red },
                  ]}
                  onPress={() => setLanguage("en")}
                >
                  <Text style={[s.langOptionText, { color: colors.muted }, !my && { color: colors.red, fontWeight: "900" }]}>
                    English (EN)
                  </Text>
                  {!my ? <Ionicons name="checkmark-circle" size={17} color={colors.red} /> : null}
                </Pressable>
              </View>
            </View>
          </>
        ) : null}

        {/* NOTIFICATIONS & PREFERENCES */}
        <SectionTitle title={my ? "အသိပေးချက်များနှင့် ဒေတာ (NOTIFICATIONS)" : "NOTIFICATIONS & DATA"} colors={colors} />
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border2 }]}>
          <Row
            icon="notifications-outline"
            title={my ? "အသိပေးချက် ဆက်တင်များ" : "Notification Inbox & Alerts"}
            subtitle={my ? "ပွဲစဉ်၊ သတင်းနှင့် အကြိုက်ဆုံး အသိပေးချက်များ" : "Match kickoff, goals, articles and favorites"}
            onPress={openNotifications}
            tone={colors.text2}
            colors={colors}
          />
          <Row
            icon="refresh-outline"
            title={my ? "ယာယီ Cache ဖျက်ရန်" : "Clear App Cache"}
            subtitle={cacheStatus || (my ? "သိမ်းဆည်းထားသော အမြန်ဒေတာများကို ရှင်းလင်းမည်" : "Purge temporary cached football fixtures and news")}
            onPress={handleClearCache}
            tone={colors.text2}
            colors={colors}
            border={false}
          />
        </View>

        {/* SUPPORT & REPORT */}
        <SectionTitle title={my ? "အကူအညီနှင့် တိုင်ကြားချက် (SUPPORT)" : "SUPPORT & FEEDBACK"} colors={colors} />
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border2 }]}>
          <Row
            icon="chatbubble-ellipses-outline"
            title={my ? "ပြဿနာတိုင်ကြားရန် / အကြံပြုချက်" : "Report a Problem / Support"}
            subtitle={my ? "ရလဒ်မှားယွင်းမှု၊ အကောင့်၊ tips ပြဿနာများ တင်ပြရန်" : "Incorrect scores, login, payment, or abuse report"}
            onPress={() => setSupportVisible(true)}
            tone={colors.red}
            colors={colors}
          />
          <Row
            icon="globe-outline"
            title="myanmarsportstalk.com"
            subtitle={my ? "တရားဝင် ဝဘ်ဆိုက်သို့ သွားရန်" : "Visit the official MST website"}
            onPress={() => Linking.openURL(MST_SITE_URL).catch(() => {})}
            tone={colors.text2}
            colors={colors}
            border={false}
          />
        </View>

        {/* LEGAL & POLICIES (NATIVE IN-APP) */}
        <SectionTitle title={my ? "မူဝါဒနှင့် စည်းမျဉ်းများ (POLICIES & RULES)" : "POLICIES & GUIDELINES"} colors={colors} />
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border2 }]}>
          <Row
            icon="shield-checkmark-outline"
            title={my ? "ကိုယ်ရေးအချက်အလက် မူဝါဒ" : "Privacy Policy"}
            subtitle={my ? "ဒေတာလုံခြုံရေးနှင့် သိမ်းဆည်းမှု စည်းမျဉ်း" : "Data collection, privacy & deletion rights"}
            onPress={() => setSelectedPolicy("privacy")}
            colors={colors}
          />
          <Row
            icon="document-text-outline"
            title={my ? "ဝန်ဆောင်မှု စည်းမျဉ်းများ" : "Terms of Service"}
            subtitle={my ? "MST Score အသုံးပြုမှု အခြေခံစည်းမျဉ်းများ" : "Official terms & user agreements"}
            onPress={() => setSelectedPolicy("terms")}
            colors={colors}
          />
          <Row
            icon="chatbubbles-outline"
            title={my ? "ကွန်မြူနတီနှင့် Live Chat စည်းမျဉ်း" : "Community & Chat Rules"}
            subtitle={my ? "Live chat ဆွေးနွေးမှုနှင့် report စည်းကမ်းချက်" : "Chat guidelines & anti-abuse moderation"}
            onPress={() => setSelectedPolicy("community")}
            colors={colors}
          />
          <Row
            icon="trophy-outline"
            title={my ? "ခန့်မှန်းချက်နှင့် အမှတ်ပေးစည်းမျဉ်း" : "Prediction Competition Rules"}
            subtitle={my ? "၃ မှတ် / ၁ မှတ် အမှတ်ပေးပုံစံနှင့် Kickoff lock" : "Scoring matrix & leaderboard settlement rules"}
            onPress={() => setSelectedPolicy("predictions")}
            colors={colors}
          />
          <Row
            icon="diamond-outline"
            title={my ? "Tipster 7/10 Qualification စည်းမျဉ်း" : "Tipster Qualification & Marketplace"}
            subtitle={my ? "၁၀ ပွဲ ၇ ပွဲနိုင် gate နှင့် transparency မူဝါဒ" : "Private qualification gate & tipster standards"}
            onPress={() => setSelectedPolicy("tipster")}
            colors={colors}
          />
          <Row
            icon="wallet-outline"
            title={my ? "MST Credits & Wallet မူဝါဒ" : "Credits, Unlocks & Wallet Policy"}
            subtitle={my ? "Credits အသုံးပြုပုံနှင့် ငွေပေးချေမှု လုံခြုံရေး" : "Instant tip unlocking & refund policies"}
            onPress={() => setSelectedPolicy("credits")}
            colors={colors}
          />
          <Row
            icon="star-outline"
            title={my ? "MST Score ကို Rate ပေးရန်" : "Rate MST Score"}
            subtitle={my ? "ကြယ် ၅ ပွင့် အဆင့်သတ်မှတ်ချက် ပေးရန်" : "Leave a 5-star review on Google Play"}
            onPress={() => handleRateNow()}
            colors={colors}
          />
          {auth?.authenticated ? (
            <Row
              icon="trash-outline"
              title={my ? "အကောင့်အပြီးတိုင် ဖျက်သိမ်းရန်" : "Delete MST Account"}
              subtitle={my ? "သင်၏ အကောင့်ဒေတာအားလုံးကို အပြီးတိုင် ဖျက်မည်" : "Permanently erase account profile and all user data"}
              onPress={handleDeleteAccount}
              tone={colors.red}
              colors={colors}
              border={false}
            />
          ) : null}
        </View>

        {/* APP INFO */}
        <SectionTitle title={my ? "အက်ပ် အချက်အလက် (APP INFO)" : "APP INFO"} colors={colors} />
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border2 }]}>
          <Row
            icon="phone-portrait-outline"
            title="MST Score"
            subtitle={`Version ${version} (Build ${build}) · Android & iOS`}
            colors={colors}
          />
          <Row
            icon="server-outline"
            title={my ? "ဒေတာလုံခြုံရေး" : "Production Architecture"}
            subtitle="Cloudflare edge → cached football/news/account services"
            colors={colors}
            border={false}
          />
        </View>

        <Text style={[s.footer, { color: colors.muted }]}>
          Myanmar Sports Talk · MST Score v{version}
        </Text>
      </ScrollView>

      <SupportModal
        visible={supportVisible}
        onClose={() => setSupportVisible(false)}
        colors={colors}
        language={language}
      />

      <Modal visible={Boolean(selectedPolicy)} animationType="slide" onRequestClose={() => setSelectedPolicy(null)}>
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
  header: {
    minHeight: 64,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
  },
  headerCopy: { flex: 1, paddingHorizontal: 11 },
  title: { fontSize: 16, fontWeight: "900" },
  subtitle: { fontSize: 9.2, marginTop: 2 },
  content: { padding: 14, paddingBottom: 45 },
  section: { fontSize: 10.5, fontWeight: "900", marginTop: 15, marginBottom: 8 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 6,
  },
  row: {
    minHeight: 64,
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
  rowSub: { fontSize: 9.3, marginTop: 3, lineHeight: 13 },
  themeRow: {
    flexDirection: "row",
    gap: 8,
    padding: 10,
  },
  themeButton: {
    flex: 1,
    height: 44,
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  themeButtonText: { fontSize: 10.5, fontWeight: "700" },
  langRow: {
    flexDirection: "row",
    gap: 8,
    padding: 10,
  },
  langOption: {
    flex: 1,
    height: 44,
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  langOptionText: { fontSize: 10.5, fontWeight: "700" },
  footer: { fontSize: 9, textAlign: "center", marginTop: 18 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
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
