import React, { useEffect } from "react";
import { BackHandler, ScrollView, StyleSheet, View } from "react-native";
import ScreenHeader from "../components/ScreenHeader";
import Phase4BSearchPanel from "./Phase4BSearchPanel";

const C = {
  bg: "#080A0C",
};

export default function Phase4BSearchScreen({ onBack }) {
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
    <View style={s.container}>
      <ScreenHeader
        title="Search"
        subtitle="TEAMS & PLAYERS"
        onBack={onBack}
      />
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Phase4BSearchPanel />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 14, paddingBottom: 40 },
});
