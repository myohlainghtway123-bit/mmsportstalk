import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const THEME_STORAGE_KEY = "@mst_theme_mode";

export const THEMES = {
  dark: {
    name: "dark",
    isDark: true,
    bg: "#000000",
    bg2: "#0A0A0C",
    panel: "#121214",
    card: "#121214",
    card2: "#18181C",
    border: "#202024",
    border2: "#18181C",
    red: "#E50914",
    redSoft: "rgba(229,9,20,.14)",
    gold: "#F59E0B",
    text: "#FFFFFF",
    text2: "#C4C4CC",
    muted: "#787882",
    muted2: "#52525B",
    surface: "#121214",
    raised: "#18181C",
    secondary: "#C4C4CC",
    green: "#10B981",
    blue: "#38BDF8",
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
    surface: "#FFFFFF",
    raised: "#E6E9EE",
    secondary: "#2A2F35",
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
  const rnColorScheme = useColorScheme();
  const [listenerScheme, setListenerScheme] = useState(Appearance.getColorScheme());
  const [themeMode, setThemeModeState] = useState("dark");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setListenerScheme(colorScheme);
    });
    return () => sub?.remove?.();
  }, []);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((saved) => {
        if (active && (saved === "light" || saved === "dark" || saved === "system")) {
          setThemeModeState(saved);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
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
      const effective = listenerScheme || rnColorScheme || Appearance.getColorScheme();
      const isSysDark = effective !== "light";
      return isSysDark ? THEMES.dark : THEMES.light;
    }
    return themeMode === "light" ? THEMES.light : THEMES.dark;
  }, [themeMode, rnColorScheme, listenerScheme]);

  const value = useMemo(
    () => ({
      themeMode,
      setThemeMode,
      colors: activeTheme,
      isDark: activeTheme.isDark,
      hydrated,
    }),
    [themeMode, activeTheme, hydrated],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
