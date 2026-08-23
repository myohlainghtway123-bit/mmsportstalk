import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const THEME_STORAGE_KEY = "@mst_theme_mode";

export const THEMES = {
  dark: {
    name: "dark",
    isDark: true,
    bg: "#080A0C",
    bg2: "#0B0E10",
    panel: "#0D1013",
    card: "#111519",
    card2: "#151A1F",
    border: "#20262C",
    border2: "#181D22",
    red: "#F3262D",
    redSoft: "rgba(243,38,45,.14)",
    gold: "#F4C84D",
    text: "#FFFFFF",
    text2: "#D0D2D4",
    muted: "#8E9499",
    muted2: "#5E646A",
    green: "#31C674",
    blue: "#43A9E8",
    pitch: "#0B2D1E",
    pitchBorder: "#1F5B42",
    barStyle: "light-content",
  },
  light: {
    name: "light",
    isDark: false,
    bg: "#F2F4F7",
    bg2: "#E6E9EE",
    panel: "#EAEDF2",
    card: "#FFFFFF",
    card2: "#F3F5F8",
    border: "#D5DAE0",
    border2: "#E2E6EC",
    red: "#E51D24",
    redSoft: "rgba(229,29,36,.12)",
    gold: "#D89F12",
    text: "#101316",
    text2: "#2A2F35",
    muted: "#666E76",
    muted2: "#8E96A0",
    green: "#219653",
    blue: "#1F78D1",
    pitch: "#0F3D28",
    pitchBorder: "#2A7B58",
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
