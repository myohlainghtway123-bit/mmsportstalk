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
    summaryEn: "How MST Score collects, protects, and manages your personal information and device data.",
    summaryMy: "MST Score မှ သင့်ကိုယ်ရေးအချက်အလက်များကို မည်သို့စုဆောင်း၊ ကာကွယ်၊ စီမံခန့်ခွဲပုံ။",
    sections: [
      {
        hEn: "1. Information We Collect",
        hMy: "၁။ ကျွန်ုပ်တို့စုဆောင်းသော အချက်အလက်များ",
        bodyEn: "MST Score collects minimal data necessary to provide live football scores, prediction leaderboards, and verified tipster services. This includes your email address for OTP authentication, favorite teams/leagues, prediction history, device push notification tokens, and support ticket records. We never sell your personal data to third parties.",
        bodyMy: "MST Score သည် တိုက်ရိုက်ဘောလုံးရလဒ်များ၊ ခန့်မှန်းချက် leaderboard များနှင့် tipster ဝန်ဆောင်မှုများကို ကောင်းမွန်စွာ ဆောင်ရွက်ပေးရန် လိုအပ်သော အနည်းဆုံးအချက်အလက်များကိုသာ စုဆောင်းပါသည်။ ၎င်းတို့တွင် Email OTP အတွက် အီးမေးလ်၊ အကြိုက်ဆုံးအသင်းများ၊ ခန့်မှန်းချက်မှတ်တမ်း၊ push notification token နှင့် support ticket များ ပါဝင်သည်။ သင့်ဒေတာကို မည်သည့်ပြင်ပအဖွဲ့အစည်းထံသို့မျှ ရောင်းချခြင်းမပြုပါ။",
      },
      {
        hEn: "2. Data Storage & Security",
        hMy: "၂။ ဒေတာသိမ်းဆည်းမှုနှင့် လုံခြုံရေး",
        bodyEn: "All data is securely encrypted in transit via HTTPS/TLS and stored on Cloudflare D1 distributed edge database infrastructure. Authentication sessions are managed using tamper-proof secure cryptographic tokens.",
        bodyMy: "ဒေတာအားလုံးကို HTTPS/TLS ဖြင့် encrypt ပြုလုပ်ထားပြီး Cloudflare D1 distributed database တွင် လုံခြုံစွာ သိမ်းဆည်းထားပါသည်။ Authentication session များကို လုံခြုံစိတ်ချရသော cryptographic token များဖြင့် ထိန်းချုပ်ထားပါသည်။",
      },
      {
        hEn: "3. Account & Data Deletion (GDPR)",
        hMy: "၃။ အကောင့်နှင့် ဒေတာအပြီးတိုင်ဖျက်သိမ်းခွင့်",
        bodyEn: "You retain full control over your personal data. You can delete your account at any time under Settings → Delete Account. Account deletion permanently purges all authentication tokens, wallet records, favorites, and profile data from our databases.",
        bodyMy: "သင့်ဒေတာကို သင်ကိုယ်တိုင် စီမံခန့်ခွဲခွင့်ရှိသည်။ Settings → Delete Account မှတစ်ဆင့် သင့်အကောင့်နှင့် ပရိုဖိုင်၊ wallet၊ အကြိုက်ဆုံးများနှင့် token များကို စက္ကန့်ပိုင်းအတွင်း အပြီးတိုင် ဖျက်သိမ်းနိုင်ပါသည်။",
      },
    ],
  },
  {
    id: "terms",
    titleEn: "Terms of Service",
    titleMy: "ဝန်ဆောင်မှု စည်းမျဉ်းများ",
    icon: "document-text-outline",
    summaryEn: "General terms and conditions for using the MST Score mobile application and web platform.",
    summaryMy: "MST Score app နှင့် ဝဘ်ဆိုက်ကို အသုံးပြုရာတွင် လိုက်နာရမည့် အခြေခံစည်းမျဉ်းများ။",
    sections: [
      {
        hEn: "1. Acceptance of Terms",
        hMy: "၁။ စည်းမျဉ်းများကို သဘောတူညီခြင်း",
        bodyEn: "By accessing or using MST Score, you agree to be bound by these terms. If you do not agree, please do not use the application.",
        bodyMy: "MST Score ကို အသုံးပြုခြင်းဖြင့် ဤစည်းမျဉ်းများကို လိုက်နာရန် သဘောတူပြီးဖြစ်ပါသည်။ သဘောမတူပါက app ကို အသုံးမပြုရန် မေတ္တာရပ်ခံပါသည်။",
      },
      {
        hEn: "2. Real Football Data Integrity",
        hMy: "၂။ တိကျမှန်ကန်သော ဘောလုံးဒေတာ",
        bodyEn: "MST Score provides live football fixtures, real-time match events, standings, lineups, and statistics sourced from licensed providers. Scores and statistics are strictly factual and never fabricated.",
        bodyMy: "MST Score သည် တရားဝင်လိုင်စင်ရ provider များထံမှ တိုက်ရိုက်ပွဲစဉ်၊ ရလဒ်၊ စာရင်းအင်း၊ လူစာရင်းများကို ဖော်ပြပေးပါသည်။ မည်သည့်ရလဒ်နှင့် အချက်အလက်ကိုမျှ လုပ်ကြံဖန်တီးဖော်ပြခြင်းမရှိပါ။",
      },
    ],
  },
  {
    id: "community",
    titleEn: "Community Rules & Live Chat",
    titleMy: "ကွန်မြူနတီနှင့် Match Chat စည်းမျဉ်းများ",
    icon: "chatbubbles-outline",
    summaryEn: "Guidelines for respectful discussion, anti-spam enforcement, and live match chat moderation.",
    summaryMy: "အားကစားဆွေးနွေးမှု၊ အမုန်းစကား တားမြစ်ချက်နှင့် Match Chat စည်းကမ်းချက်များ။",
    sections: [
      {
        hEn: "1. Live-Only Chat Posting",
        hMy: "၁။ ပွဲကစားနေချိန်သာ Chat ရေးသားခွင့်",
        bodyEn: "Match Chat posting is exclusively active while a match is genuinely LIVE. Before kickoff, chat opens when the referee whistles. After full-time (FT), chat becomes read-only to preserve match discussion history.",
        bodyMy: "Match Chat တွင် comment ရေးသားခြင်းကို ပွဲကစားနေချိန် (LIVE) တွင်သာ ခွင့်ပြုထားပါသည်။ ပွဲမစမီတွင် chat မဖွင့်သေးဘဲ ပွဲပြီးဆုံးပါက (FT) ဖတ်ရှုနိုင်ရုံသာ ဖြစ်ပါသည်။",
      },
      {
        hEn: "2. Zero Tolerance for Hate Speech & Abuse",
        hMy: "၂။ အမုန်းစကားနှင့် ဆဲဆိုမှု လုံးဝတားမြစ်ခြင်း",
        bodyEn: "Racism, religious insults, personal harassment, and spam links are strictly prohibited. Messages receiving 3 community reports are automatically hidden pending admin review. Violating accounts will be permanently banned.",
        bodyMy: "လူမျိုးရေး၊ ဘာသာရေး၊ ပုဂ္ဂိုလ်ရေး ထိခိုက်စော်ကားမှုနှင့် spam link များ လုံးဝခွင့်မပြုပါ။ Report ၃ ကြိမ်ရသော message များကို စနစ်မှ အလိုအလျောက် ဖျောက်ထားပြီး ဖောက်ဖျက်သူအကောင့်များကို အပြီးတိုင် ပိတ်သိမ်းပါမည်။",
      },
    ],
  },
  {
    id: "predictions",
    titleEn: "Prediction Competition Rules",
    titleMy: "ခန့်မှန်းချက်နှင့် အမှတ်ပေးစည်းမျဉ်းများ",
    icon: "trophy-outline",
    summaryEn: "How predictions work: 3 points for exact score, 1 point for outcome, and automatic kickoff locking.",
    summaryMy: "ရလဒ်အတိအကျ ၃ မှတ်၊ အနိုင်/အရှုံး ၁ မှတ်နှင့် ပွဲစချိန် အလိုအလျောက် ပိတ်သိမ်းမှု။",
    sections: [
      {
        hEn: "1. Free Entry & Kickoff Lock",
        hMy: "၁။ အခမဲ့ပါဝင်နိုင်မှုနှင့် Kickoff Lock",
        bodyEn: "MST Prediction competition is 100% free for all registered users. Predictions can be created or updated freely until the exact official kickoff minute. Once the match kicks off, predictions are permanently locked to guarantee fair play.",
        bodyMy: "MST ခန့်မှန်းပြိုင်ပွဲသည် အကောင့်ဖွင့်ထားသူတိုင်းအတွက် ၁၀၀% အခမဲ့ဖြစ်ပါသည်။ ပွဲမစမီအချိန်အထိ ခန့်မှန်းချက်ကို လွတ်လပ်စွာ ပြင်ဆင်နိုင်ပြီး ပွဲစတင်သည်နှင့် အလိုအလျောက် lock ချ၍ တရားမျှတမှုကို ထိန်းသိမ်းပါသည်။",
      },
      {
        hEn: "2. Official Scoring Matrix",
        hMy: "၂။ တရားဝင် အမှတ်ပေးပုံစံ",
        bodyEn: "• Exact Score Hit: 3 Points (e.g. Predicted 2-1, Final score 2-1)\n• Correct Outcome (Win/Draw/Loss): 1 Point (e.g. Predicted 1-0, Final score 3-1)\n• Incorrect Outcome: 0 Points.",
        bodyMy: "• ရလဒ်အတိအကျ မှန်ကန်ပါက: ၃ မှတ် (ဥပမာ ၂-၁ ခန့်မှန်းပြီး ၂-၁ ဖြစ်လျှင်)\n• အနိုင်/အရှုံး/သရေ မှန်ကန်ပါက: ၁ မှတ် (ဥပမာ ၁-၀ ခန့်မှန်းပြီး ၃-၁ ဖြစ်လျှင်)\n• မှားယွင်းပါက: ၀ မှတ် ရရှိပါမည်။",
      },
      {
        hEn: "3. Timeframe Leaderboards",
        hMy: "၃။ Leaderboard ကာလများ",
        bodyEn: "Leaderboards are calculated across four distinct timeframes: All Time, This Week, This Month, and Season. Rankings update automatically after match settlement crons complete.",
        bodyMy: "Leaderboard ကို ကာလ ၄ မျိုးဖြင့် ခွဲခြားတွက်ချက်ပါသည် - အားလုံး (All Time)၊ ယခုအပတ် (Weekly)၊ ယခုလ (Monthly) နှင့် ရာသီ (Season)။ ပွဲပြီးဆုံးပြီးနောက် အမှတ်များကို အလိုအလျောက် ပေါင်းထည့်ပေးပါသည်။",
      },
    ],
  },
  {
    id: "tipster",
    titleEn: "Verified Tipster & 7/10 Qualification",
    titleMy: "Tipster အရည်အချင်းစစ်ဆေးမှု စည်းမျဉ်း",
    icon: "diamond-outline",
    summaryEn: "Rigorous 7-out-of-10 private qualification requirements before publishing paid premium tips.",
    summaryMy: "Premium Tip ရောင်းချခွင့်မရမီ သီးသန့် ၁၀ ပွဲတွင် အနည်းဆုံး ၇ ပွဲ အနိုင်ရရမည့် စည်းကမ်းချက်။",
    sections: [
      {
        hEn: "1. 7/10 Win Gate Qualification",
        hMy: "၁။ ၁၀ ပွဲတွင် ၇ ပွဲနိုင် Qualification Gate",
        bodyEn: "To protect community members, anyone applying to become a Tipster must submit 10 consecutive private qualification predictions. Only creators achieving at least 7 out of 10 wins (70% win rate) are approved by MST admin.",
        bodyMy: "အသုံးပြုသူများကို ကာကွယ်ရန်အတွက် Tipster လျှောက်ထားသူတိုင်းသည် သီးသန့် qualification ပွဲ ၁၀ ပွဲ ကြိုတင်တင်သွင်းရမည်ဖြစ်ပြီး အနည်းဆုံး ၇ ပွဲ နိုင်မှသာ (၇၀% win rate) MST admin မှ အတည်ပြုပေးပါသည်။",
      },
      {
        hEn: "2. Permanent Record & Win/Loss Transparency",
        hMy: "၂။ ပွင့်လင်းမြင်သာသော မှတ်တမ်းအပြည့်အစုံ",
        bodyEn: "Every tip published is permanently recorded. Tipsters cannot delete, edit, or hide lost tips. Win rates and historical ROI are calculated mathematically from settlements.",
        bodyMy: "တင်သွင်းပြီးသော tip မှန်သမျှကို အပြီးတိုင် မှတ်တမ်းတင်ထားပါသည်။ Tipster များသည် ရှုံးနိမ့်သော tip များကို ဖျက်ခြင်း၊ ပြင်ဆင်ခြင်း မပြုလုပ်နိုင်ပါ။",
      },
    ],
  },
  {
    id: "credits",
    titleEn: "MST Credits, Wallet & Unlock Rules",
    titleMy: "MST Credits၊ Wallet နှင့် ငွေပေးချေမှု မူဝါဒ",
    icon: "wallet-outline",
    summaryEn: "How MST Credits work, instant unlocking without page refresh, and transaction safety.",
    summaryMy: "MST Credits အသုံးပြုပုံ၊ Tip ချက်ချင်း unlock ပြုလုပ်ပုံနှင့် ငွေပေးချေမှု လုံခြုံရေး။",
    sections: [
      {
        hEn: "1. Credits for Premium Analysis",
        hMy: "၁။ Premium သုံးသပ်ချက်အတွက် Credits",
        bodyEn: "MST Credits are in-app digital credits used to unlock verified tipster match analysis. Unlocking a tip deducts the stated credit price immediately and permanently grants access on your account across mobile and web.",
        bodyMy: "MST Credits သည် အတည်ပြုပြီး Tipster များ၏ သုံးသပ်ချက်များကို unlock လုပ်ရန် အသုံးပြုသော in-app credit ဖြစ်သည်။ Tip တစ်ခုကို unlock ပြုလုပ်ပါက သတ်မှတ် credit နုတ်ယူပြီး အကောင့်တွင် အမြဲတမ်း ဖတ်ရှုနိုင်မည် ဖြစ်သည်။",
      },
      {
        hEn: "2. Idempotent Transactions & Duplicate Prevention",
        hMy: "၂။ ငွေပေးချေမှု လုံခြုံရေးနှင့် ထပ်ခါတလဲလဲ နုတ်ယူမှု တားဆီးခြင်း",
        bodyEn: "All credit purchases and tip unlocks use server-side cryptographic idempotency tokens. Tapping twice never double-charges your wallet. Once unlocked, the tip is immediately viewable without manual page refresh.",
        bodyMy: "ဝယ်ယူမှုတိုင်းကို server-side idempotency စနစ်ဖြင့် စစ်ဆေးသောကြောင့် နှစ်ခါနှိပ်မိသော်လည်း credit နှစ်ခါ မနုတ်ပါ။ Unlock ဖြစ်သည်နှင့် ချက်ချင်း ဖတ်ရှုနိုင်ပါသည်။",
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
            {my ? "တရားဝင် မူဝါဒနှင့် စည်းမျဉ်းများ" : "Official Policies & Guidelines"}
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
            MST Score · Myanmar Sports Talk · Version 1.5.1
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

