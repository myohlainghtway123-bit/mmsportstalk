import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const C = {
  bg: "#080A0C",
  border: "#293036",
  text: "#FFFFFF",
  secondary: "#D4D8DB",
  muted: "#929AA0",
  red: "#F3262D",
};

/**
 * Standardized, release-consistent secondary and root screen header.
 * Eliminates oversized headers, enforces predictable spacing, and provides
 * uniform Back navigation touch targets.
 */
export default function ScreenHeader({
  title,
  subtitle,
  onBack,
  rightElement,
  showMstBrand = false,
  accessibilityLabel,
}) {
  return (
    <View style={s.header} accessibilityRole="header">
      <View style={s.leftSlot}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel || "Go back"}
            hitSlop={12}
            onPress={onBack}
            style={s.backButton}
          >
            <Ionicons name="chevron-back" size={24} color={C.text} />
          </Pressable>
        ) : showMstBrand ? (
          <View style={s.brandBadge}>
            <Text style={s.brandMst}>MST</Text>
          </View>
        ) : null}
      </View>

      <View style={s.titleSlot}>
        {subtitle ? (
          <Text numberOfLines={1} style={s.subtitle}>
            {subtitle}
          </Text>
        ) : null}
        <Text numberOfLines={1} style={s.title}>
          {title}
        </Text>
      </View>

      <View style={s.rightSlot}>
        {rightElement || null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    height: 54,
    backgroundColor: C.bg,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  leftSlot: {
    width: 40,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  backButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  brandBadge: {
    backgroundColor: "rgba(243,38,45,0.16)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.red,
  },
  brandMst: {
    color: C.red,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  titleSlot: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  title: {
    color: C.text,
    fontSize: 15.5,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  subtitle: {
    color: C.red,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 1,
  },
  rightSlot: {
    minWidth: 40,
    alignItems: "flex-end",
    justifyContent: "center",
  },
});
