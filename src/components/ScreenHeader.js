import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";

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
  let themeColors = C;
  try {
    const themeContext = useTheme();
    if (themeContext?.colors) themeColors = themeContext.colors;
  } catch {}

  return (
    <View
      style={[
        s.header,
        {
          backgroundColor: themeColors.bg,
          borderBottomColor: themeColors.border,
        },
      ]}
      accessibilityRole="header"
    >
      <View style={s.leftSlot}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel || "Go back"}
            hitSlop={12}
            onPress={onBack}
            style={s.backButton}
          >
            <Ionicons name="chevron-back" size={24} color={themeColors.text} />
          </Pressable>
        ) : showMstBrand ? (
          <View style={[s.brandBadge, { borderColor: themeColors.red, backgroundColor: themeColors.redSoft || "rgba(243,38,45,0.16)" }]}>
            <Text style={[s.brandMst, { color: themeColors.red }]}>MST</Text>
          </View>
        ) : null}
      </View>

      <View style={s.titleSlot}>
        {subtitle ? (
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            style={[s.subtitle, { color: themeColors.red }]}
          >
            {subtitle}
          </Text>
        ) : null}
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
          style={[s.title, { color: themeColors.text }]}
        >
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
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderBottomWidth: 1,
  },
  leftSlot: {
    minWidth: 36,
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
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  brandMst: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  titleSlot: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 10.5,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 1,
  },
  rightSlot: {
    minWidth: 36,
    alignItems: "flex-end",
    justifyContent: "center",
  },
});
