import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const THEME_STORAGE_KEY = "@mst_theme_mode";

export const THEMES = {
  dark: {
    name: "dark",
    isDark: true,
    bg: "#080A0C",
    bg2: "#0F1215",
    card: "#13171A",
    card2: "#181D21",
    border: "#24292D",
    border2: "#1D2226",
    red: "#F3262D",
    redSoft: "rgba(243,38,45,.14)",
    gold: "#F4C84D",
    text: "#FFFFFF",
    text2: "#D0D2D4",
    muted: "#92979B",
    green: "#31C674",
    barStyle: "light-content",
  },
  light: {
    name: "light",
    isDark: false,
    bg: "#F5F6F8",
    bg2: "#EAECEF",
    card: "#FFFFFF",
    card2: "#F1F3F6",
    border: "#DDE1E6",
    border2: "#E6E9ED",
    red: "#E51D24",
    redSoft: "rgba(229,29,36,.12)",
    gold: "#D89F12",
    text: "#101316",
    text2: "#2E3338",
    muted: "#6A7177",
    green: "#219653",
    barStyle: "dark-content",
  },
};

const ThemeContext = createContext({
  themeMode: "dark",
  setThemeMode: () => {},
  colors: THEMES.dark,
  isDark: true,
});

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState("dark");

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((saved) => {
        if (saved === "light" || saved === "dark" || saved === "system") {
          setThemeModeState(saved);
        }
      })
      .catch(() => {});
  }, []);

  const setThemeMode = async (mode) => {
    const clean = mode === "light" || mode === "system" ? mode : "dark";
    setThemeModeState(clean);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, clean);
    } catch {
      // Non-blocking storage fallback
    }
  };

  const activeTheme = useMemo(() => {
    if (themeMode === "system") {
      const isSysDark = systemScheme !== "light";
      return isSysDark ? THEMES.dark : THEMES.light;
    }
    return themeMode === "light" ? THEMES.light : THEMES.dark;
  }, [themeMode, systemScheme]);

  const value = useMemo(
    () => ({
      themeMode,
      setThemeMode,
      colors: activeTheme,
      isDark: activeTheme.isDark,
    }),
    [themeMode, activeTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
