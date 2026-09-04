import React, { useState } from "react";
import { Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";

export const POLICY_CATALOG = [
  {
    id: "privacy",
    titleEn: "Privacy Policy",
    titleMy: "ကိုယ်ရေးအချက်အလက် မူဝါဒ",
    icon: "shield-checkmark-outline",
    summaryEn: "How MST Scores handles account, device and app-use information needed to provide its football features.",
    summaryMy: "MST Scores ရဲ့ ဘောလုံးဆိုင်ရာ feature များပေးနိုင်ရန် လိုအပ်သော account၊ device နှင့် app အသုံးပြုမှုဆိုင်ရာ အချက်အလက်များကို မည်သို့ကိုင်တွယ်သည်ကို ရှင်းပြထားပါသည်။",
    sections: [
      {
        hEn: "1. Information We Use",
        hMy: "၁။ အသုံးပြုသော အချက်အလက်များ",
        bodyEn: "MST Scores uses information needed to operate account and football features. Depending on the features you use, this can include your email address, display name and profile image, favorites, notification preferences, push token and device information, support reports, Match Vote or other match-engagement records, and existing Tip entitlement information. MST does not sell your personal information.",
        bodyMy: "MST Scores သည် account နှင့် ဘောလုံးဆိုင်ရာ feature များလည်ပတ်ရန် လိုအပ်သော အချက်အလက်များကို အသုံးပြုပါသည်။ သင်အသုံးပြုသည့် feature အလိုက် email address၊ display name နှင့် profile image၊ favorites၊ notification preferences၊ push token နှင့် device information၊ support report၊ Match Vote သို့မဟုတ် match engagement record များနှင့် ရှိပြီးသား Tip entitlement အချက်အလက်များ ပါဝင်နိုင်ပါသည်။ MST သည် သင့်ကိုယ်ရေးအချက်အလက်များကို ရောင်းချခြင်းမပြုပါ။",
      },
      {
        hEn: "2. Storage & Security",
        hMy: "၂။ သိမ်းဆည်းမှုနှင့် လုံခြုံရေး",
        bodyEn: "MST Scores uses HTTPS/TLS for network requests to supported MST services and stores the signed-in session using secure device storage. We use reasonable technical and organizational safeguards, but no internet service or storage system can guarantee absolute security.",
        bodyMy: "MST Scores သည် supported MST service များနှင့် ဆက်သွယ်ရာတွင် HTTPS/TLS ကို အသုံးပြုပြီး signed-in session ကို secure device storage ဖြင့် သိမ်းဆည်းပါသည်။ သင့်အချက်အလက်များကို ကာကွယ်ရန် သင့်လျော်သော နည်းပညာနှင့် စီမံခန့်ခွဲမှုဆိုင်ရာ လုံခြုံရေးနည်းလမ်းများ အသုံးပြုသော်လည်း မည်သည့် internet service သို့မဟုတ် storage system မျှ လုံးဝအာမခံချက်မပေးနိုင်ပါ။",
      },
      {
        hEn: "3. Account & Data Deletion",
        hMy: "၃။ အကောင့်နှင့် ဒေတာဖျက်သိမ်းခြင်း",
        bodyEn: "You can initiate account deletion from Settings → Account → Delete Account. The deletion service removes the canonical MST account and supported associated account records. A public deletion resource is also available at myanmarsportstalk.com/account-deletion. Some information may be retained only where required for legitimate legal, security, fraud-prevention or regulatory reasons.",
        bodyMy: "Settings → Account → Delete Account မှတစ်ဆင့် account deletion ကို စတင်နိုင်ပါသည်။ Deletion service သည် canonical MST account နှင့် ဖျက်ရန်သတ်မှတ်ထားသော ဆက်စပ် account record များကို ဖျက်ပစ်ပါသည်။ myanmarsportstalk.com/account-deletion တွင်လည်း public deletion resource ရှိပါသည်။ ဥပဒေ၊ လုံခြုံရေး၊ fraud prevention သို့မဟုတ် regulatory အကြောင်းကြောင့် မဖြစ်မနေ ထိန်းသိမ်းရမည့် အချက်အလက်ရှိပါက လိုအပ်သလောက်သာ ထိန်းသိမ်းနိုင်ပါသည်။",
      },
      {
        hEn: "4. Advertising & Privacy Choices",
        hMy: "၄။ ကြော်ငြာနှင့် Privacy ရွေးချယ်မှု",
        bodyEn: "MST Scores may show Google Mobile Ads on eligible surfaces. The app uses Google's consent/privacy flow where applicable and the launch banner requests non-personalized ads. Advertising availability and privacy options can vary by region and final production configuration.",
        bodyMy: "MST Scores သည် သတ်မှတ်ထားသောနေရာများတွင် Google Mobile Ads ကို ပြသနိုင်ပါသည်။ သက်ဆိုင်သောဒေသများတွင် Google consent/privacy flow ကို အသုံးပြုပြီး launch banner သည် non-personalized ads ကို request လုပ်ပါသည်။ ကြော်ငြာရရှိနိုင်မှုနှင့် privacy ရွေးချယ်မှုများသည် ဒေသနှင့် final production configuration အလိုက် ကွာခြားနိုင်ပါသည်။",
      },
    ],
  },
  {
    id: "terms",
    titleEn: "Terms of Use",
    titleMy: "အသုံးပြုမှု စည်းမျဉ်းများ",
    icon: "document-text-outline",
    summaryEn: "Core terms for using MST Scores, a football scores and information product by Myanmar Sports Talk.",
    summaryMy: "Myanmar Sports Talk ၏ ဘောလုံးရလဒ်နှင့် အချက်အလက် product ဖြစ်သော MST Scores ကို အသုံးပြုရာတွင် သက်ဆိုင်သည့် အခြေခံစည်းမျဉ်းများ။",
    sections: [
      {
        hEn: "1. MST Scores Product Boundary",
        hMy: "၁။ MST Scores Product Boundary",
        bodyEn: "MST Scores is built to help users follow football matches, fixtures, results, match information, news, favorites, notifications, search, read-only Tips and leaderboards, and HOME / DRAW / AWAY Match Vote. Exact-score Prediction creation, editing and submission are not MST Scores features.",
        bodyMy: "MST Scores သည် ဘောလုံးပွဲများ၊ fixtures၊ results၊ match information၊ news၊ favorites၊ notifications၊ search၊ read-only Tips နှင့် leaderboards များကို ကြည့်ရှုရန်နှင့် HOME / DRAW / AWAY Match Vote ပြုလုပ်ရန် ရည်ရွယ်ထားသော product ဖြစ်ပါသည်။ Exact-score Prediction ဖန်တီးခြင်း၊ ပြင်ဆင်ခြင်းနှင့် တင်သွင်းခြင်းသည် MST Scores feature မဟုတ်ပါ။",
      },
      {
        hEn: "2. Football Data & Availability",
        hMy: "၂။ ဘောလုံးဒေတာနှင့် ရရှိနိုင်မှု",
        bodyEn: "MST Scores displays football information received through configured MST services and third-party data sources. We do not intentionally fabricate scores or match facts. Live feeds and supporting data can be delayed, corrected, incomplete or temporarily unavailable, and the app should show an unavailable state rather than invent missing information.",
        bodyMy: "MST Scores သည် configured MST service များနှင့် third-party data source များမှ ရရှိသော ဘောလုံးအချက်အလက်များကို ပြသပါသည်။ ရလဒ် သို့မဟုတ် match fact များကို ရည်ရွယ်ချက်ရှိရှိ ဖန်တီးဖော်ပြခြင်းမပြုပါ။ Live feed နှင့် ဆက်စပ်ဒေတာများသည် နောက်ကျခြင်း၊ ပြင်ဆင်ခြင်း၊ မပြည့်စုံခြင်း သို့မဟုတ် ယာယီမရရှိခြင်း ဖြစ်နိုင်ပြီး မရှိသောအချက်အလက်ကို ဖန်တီးမည့်အစား unavailable state ကို ပြသရပါမည်။",
      },
      {
        hEn: "3. Tips & Store Release",
        hMy: "၃။ Tips နှင့် Store Release",
        bodyEn: "MST Scores may display free Tips, Tipsters, leaderboards and previously granted Tip entitlements. Paid Tip purchase actions are not offered in the production store build unless a future release implements and verifies a store-compliant billing flow.",
        bodyMy: "MST Scores တွင် free Tips၊ Tipsters၊ leaderboards နှင့် ယခင်က ခွင့်ပြုထားပြီးသား Tip entitlement များကို ပြသနိုင်ပါသည်။ Store policy နှင့်ကိုက်ညီသော billing flow ကို အတည်ပြုပြီး မထည့်သွင်းသေးသရွေ့ production store build တွင် paid Tip purchase action မပေးပါ။",
      },
    ],
  },
];

export default function PolicyScreen({ policyId, onBack, language = "my" }) {
  const { colors } = useTheme();
  const my = language === "my";
  const [selectedId, setSelectedId] = useState(policyId || "privacy");

  const activePolicy = POLICY_CATALOG.find((p) => p.id === selectedId) || POLICY_CATALOG[0];

  return (
    <View style={[s.container, { backgroundColor: colors.bg }]}>
      <View style={[s.header, { borderBottomColor: colors.border2 }]}>
        <Pressable hitSlop={8} style={s.backBtn} onPress={onBack}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[s.headerTitle, { color: colors.text }]}>
            {my ? activePolicy.titleMy : activePolicy.titleEn}
          </Text>
          <Text style={[s.headerSub, { color: colors.muted }]}>
            {my ? "MST Scores မူဝါဒနှင့် စည်းမျဉ်းများ" : "MST Scores Policies & Terms"}
          </Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.navScrollView}
        contentContainerStyle={s.navStrip}
      >
        {POLICY_CATALOG.map((p) => {
          const on = p.id === selectedId;
          return (
            <Pressable
              key={p.id}
              style={[
                s.navTab,
                { backgroundColor: on ? colors.redSoft : colors.card, borderColor: on ? colors.red : colors.border },
              ]}
              onPress={() => setSelectedId(p.id)}
            >
              <Ionicons name={p.icon} size={15} color={on ? colors.red : colors.text2} />
              <Text style={[s.navTabText, { color: on ? colors.red : colors.text2 }]}>
                {my ? p.titleMy : p.titleEn}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView style={s.body} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={[s.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[s.iconCircle, { backgroundColor: colors.redSoft }]}>
            <Ionicons name={activePolicy.icon} size={28} color={colors.red} />
          </View>
          <Text style={[s.policyTitle, { color: colors.text }]}>
            {my ? activePolicy.titleMy : activePolicy.titleEn}
          </Text>
          <Text style={[s.policySummary, { color: colors.muted }]}>
            {my ? activePolicy.summaryMy : activePolicy.summaryEn}
          </Text>
        </View>

        {activePolicy.sections.map((sec, idx) => (
          <View key={idx} style={[s.secCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.secHead, { color: colors.text }]}>{my ? sec.hMy : sec.hEn}</Text>
            <Text style={[s.secBody, { color: colors.text2 }]}>{my ? sec.bodyMy : sec.bodyEn}</Text>
          </View>
        ))}

        <View style={s.footer}>
          <Text style={[s.footerText, { color: colors.muted2 }]}>
            MST Scores · Myanmar Sports Talk
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 28) : 44,
  },
  header: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "800" },
  headerSub: { fontSize: 12, fontWeight: "600", marginTop: 1 },
  navScrollView: { flexGrow: 0, height: 48 },
  navStrip: { paddingHorizontal: 12, paddingVertical: 6, gap: 6 },
  navTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  navTabText: { fontSize: 13, fontWeight: "700" },
  body: { flex: 1 },
  content: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 36, gap: 10 },
  heroCard: { padding: 16, borderRadius: 14, borderWidth: 1, alignItems: "center", gap: 8 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  policyTitle: { fontSize: 17, fontWeight: "800", textAlign: "center" },
  policySummary: { fontSize: 13.5, lineHeight: 20, textAlign: "center" },
  secCard: { padding: 14, borderRadius: 12, borderWidth: 1, gap: 6 },
  secHead: { fontSize: 14.5, fontWeight: "800" },
  secBody: { fontSize: 13.5, lineHeight: 21 },
  footer: { marginTop: 8, alignItems: "center", paddingBottom: 8 },
  footerText: { fontSize: 12, fontWeight: "600" },
});
