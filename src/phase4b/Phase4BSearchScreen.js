import React, { useEffect } from "react";
import { BackHandler, ScrollView, StyleSheet, View } from "react-native";
import ScreenHeader from "../components/ScreenHeader";
import Phase4BSearchPanel from "./Phase4BSearchPanel";
import { useTheme } from "../theme/ThemeContext";

const C = {
  bg: "#080A0C",
};

export default function Phase4BSearchScreen({ onBack, onOpenEntity, onOpenMatch, matches = [], language = "my" }) {
  let colors = C;
  try {
    const theme = useTheme();
    if (theme?.colors) colors = theme.colors;
  } catch {}

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

  return (
    <View style={[s.container, { backgroundColor: colors.bg }]}>
      <ScreenHeader
        title={language === "my" ? "ရှာဖွေရန်" : "Search"}
        subtitle={language === "my" ? "ပွဲစဉ်များ၊ ပြိုင်ပွဲများနှင့် အသင်းများ" : "MATCHES, LEAGUES & CLUBS"}
        onBack={onBack}
      />
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Phase4BSearchPanel
          onOpenEntity={onOpenEntity}
          onOpenMatch={onOpenMatch}
          matches={matches}
          language={language}
        />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 14, paddingBottom: 40 },
});
