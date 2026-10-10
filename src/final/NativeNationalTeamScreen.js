import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";

const FALLBACK = {
  bg: "#000000",
  surface: "#121214",
  border: "#242429",
  text: "#FFFFFF",
  secondary: "#D5D5DA",
  muted: "#85858F",
  red: "#E50914",
};

function valueText(value) {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

export default function NativeNationalTeamScreen({ entity = {}, goBack, language = "my" }) {
  let colors = FALLBACK;
  try {
    const theme = useTheme();
    if (theme?.colors) colors = { ...FALLBACK, ...theme.colors };
  } catch {}

  const title = entity?.name || (language === "my" ? "အမျိုးသား လက်ရွေးစင်" : "National Team");
  const flag = entity?.flagUrl || entity?.logo || null;
  const rows = [
    [language === "my" ? "FIFA အဆင့်" : "FIFA Rank", entity?.fifaRank ? `#${entity.fifaRank}` : null],
    [language === "my" ? "FIFA ကုဒ်" : "FIFA Code", entity?.fifaCode],
    [language === "my" ? "ရမှတ်" : "Points", entity?.fifaPoints],
    [language === "my" ? "ကွန်ဖက်ဒရေးရှင်း" : "Confederation", entity?.confederation],
    [language === "my" ? "အဆင့်ထုတ်ပြန်သည့်နေ့" : "Ranking Date", entity?.rankingPublishedAt],
  ];

  return (
    <View style={[s.screen, { backgroundColor: colors.bg }]}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </Pressable>
        <View style={s.headerCopy}>
          <Text style={[s.eyebrow, { color: colors.red }]}>
            {language === "my" ? "FIFA အမျိုးသား အဆင့်သတ်မှတ်ချက်" : "OFFICIAL FIFA MEN'S RANKING"}
          </Text>
          <Text style={[s.headerTitle, { color: colors.text }]}>
            {language === "my" ? "အမျိုးသား လက်ရွေးစင်" : "Men's National Team"}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={[s.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {flag ? (
            <Image source={{ uri: flag }} resizeMode="contain" style={s.flag} />
          ) : (
            <View style={[s.flagFallback, { borderColor: colors.border }]}>
              <Ionicons name="flag-outline" size={36} color={colors.muted} />
            </View>
          )}
          <Text style={[s.title, { color: colors.text }]}>{title}</Text>
          <Text style={[s.subtitle, { color: colors.muted }]}>
            {language === "my" ? "အမျိုးသား စီနီယာ လက်ရွေးစင်အသင်း" : "Senior men's national team"}
          </Text>
        </View>

        <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {rows.map(([label, value], index) => (
            <View
              key={label}
              style={[s.row, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}
            >
              <Text style={[s.label, { color: colors.muted }]}>{label}</Text>
              <Text style={[s.value, { color: colors.secondary }]}>{valueText(value)}</Text>
            </View>
          ))}
        </View>

        <Text style={[s.source, { color: colors.muted }]}>
          {language === "my"
            ? "အလံနှင့် အဆင့်ဒေတာကို FIFA ၏ တရားဝင် အမျိုးသား အဆင့်သတ်မှတ်ချက်မှ ရယူထားသည်။"
            : "Flag and ranking data are sourced from FIFA's official men's world ranking."}
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { minHeight: 82, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", paddingHorizontal: 18, gap: 10 },
  headerCopy: { flex: 1 },
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  headerTitle: { fontSize: 20, fontWeight: "900", marginTop: 2 },
  content: { padding: 16, paddingBottom: 42 },
  hero: { borderWidth: 1, borderRadius: 16, alignItems: "center", padding: 22 },
  flag: { width: 96, height: 64, borderRadius: 6 },
  flagFallback: { width: 96, height: 64, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "900", marginTop: 14, textAlign: "center" },
  subtitle: { fontSize: 12, marginTop: 5, textAlign: "center" },
  card: { borderWidth: 1, borderRadius: 14, marginTop: 14, overflow: "hidden" },
  row: { minHeight: 54, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 },
  label: { flex: 1, fontSize: 12, fontWeight: "700" },
  value: { flexShrink: 1, fontSize: 13, fontWeight: "900", textAlign: "right" },
  source: { fontSize: 11, lineHeight: 17, marginTop: 12, textAlign: "center" },
});
