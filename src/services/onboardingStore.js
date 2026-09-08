import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@mst-score/onboarding-v1";
const DEFAULT = {
  completed: false,
  language: null,
  teams: [],
  competitions: [],
  favoritesSynced: false,
};

function cleanIds(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((x) => String(x)).filter(Boolean))];
}

const storage = AsyncStorage?.setItem ? AsyncStorage : (AsyncStorage?.default || AsyncStorage);

export async function loadOnboardingPreferences() {
  try {
    const raw = await storage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT,
      ...parsed,
      language: parsed?.language === "en" ? "en" : parsed?.language === "my" ? "my" : null,
      teams: cleanIds(parsed?.teams),
      competitions: cleanIds(parsed?.competitions),
      completed: parsed?.completed === true,
      favoritesSynced: parsed?.favoritesSynced === true,
    };
  } catch (_) {
    return { ...DEFAULT };
  }
}

export async function saveOnboardingPreferences(next) {
  const current = await loadOnboardingPreferences();
  const merged = {
    ...current,
    ...next,
    teams: cleanIds(next?.teams ?? current.teams),
    competitions: cleanIds(next?.competitions ?? current.competitions),
  };
  await storage.setItem(KEY, JSON.stringify(merged));
  return merged;
}

const languageListeners = new Set();

export function subscribeAppLanguage(listener) {
  if (typeof listener === "function") {
    languageListeners.add(listener);
    return () => languageListeners.delete(listener);
  }
  return () => {};
}

export async function persistAppLanguage(language) {
  const clean = language === "en" ? "en" : "my";
  const result = await saveOnboardingPreferences({ language: clean });
  for (const fn of languageListeners) {
    try { fn(clean); } catch (_) {}
  }
  return result;
}

export async function syncStoredOnboardingFavorites(setFavorite) {
  if (typeof setFavorite !== "function") return false;
  const prefs = await loadOnboardingPreferences();
  if (!prefs.completed || prefs.favoritesSynced) return true;

  const jobs = [
    ...prefs.teams.map((id) => ({ kind: "team", id })),
    ...prefs.competitions.map((id) => ({ kind: "competition", id })),
  ];

  if (!jobs.length) {
    await saveOnboardingPreferences({ favoritesSynced: true });
    return true;
  }

  const settled = await Promise.allSettled(jobs.map((item) => setFavorite({ ...item, active: true })));
  const ok = settled.every((x) => x.status === "fulfilled");
  if (ok) await saveOnboardingPreferences({ favoritesSynced: true });
  return ok;
}
