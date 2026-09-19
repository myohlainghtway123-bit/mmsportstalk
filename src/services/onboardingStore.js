import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@mst-score/onboarding-v1";
const DEFAULT = {
  completed: false,
  onboardingComplete: false,
  language: null,
  teams: [],
  competitions: [],
  players: [],
  matches: [],
  entities: {},
  favoritesSynced: false,
  pendingSyncEntities: [],
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
    const hasLanguage = parsed?.language === "en" || parsed?.language === "my";
    const isCompleted = parsed?.completed === true || parsed?.onboardingComplete === true || hasLanguage;
    return {
      ...DEFAULT,
      ...parsed,
      language: parsed?.language === "en" ? "en" : parsed?.language === "my" ? "my" : null,
      teams: cleanIds(parsed?.teams),
      competitions: cleanIds(parsed?.competitions),
      players: cleanIds(parsed?.players),
      matches: cleanIds(parsed?.matches),
      entities: parsed?.entities && typeof parsed.entities === "object" ? parsed.entities : {},
      completed: isCompleted,
      onboardingComplete: isCompleted,
      favoritesSynced: parsed?.favoritesSynced === true,
      pendingSyncEntities: Array.isArray(parsed?.pendingSyncEntities) ? parsed.pendingSyncEntities : [],
    };
  } catch (_) {
    return { ...DEFAULT };
  }
}

export async function saveOnboardingPreferences(next) {
  const current = await loadOnboardingPreferences();
  const nextComplete = next?.onboardingComplete ?? next?.completed;
  const isCompleted = nextComplete !== undefined ? Boolean(nextComplete) : current.completed;
  const merged = {
    ...current,
    ...next,
    completed: isCompleted,
    onboardingComplete: isCompleted,
    teams: cleanIds(next?.teams ?? current.teams),
    competitions: cleanIds(next?.competitions ?? current.competitions),
    players: cleanIds(next?.players ?? current.players),
    matches: cleanIds(next?.matches ?? current.matches),
    entities: { ...(current.entities || {}), ...(next?.entities || {}) },
    pendingSyncEntities: Array.isArray(next?.pendingSyncEntities) ? next.pendingSyncEntities : current.pendingSyncEntities,
  };
  await storage.setItem(KEY, JSON.stringify(merged));
  return merged;
}

export async function saveGuestFavorite({ kind, id, name, logo, photo, country, active }) {
  const entityId = String(id || "").trim();
  const cleanKind = String(kind || "").toLowerCase();
  if (!entityId || !cleanKind) return false;

  const current = await loadOnboardingPreferences();
  const field = cleanKind === "competition" || cleanKind.startsWith("comp") || cleanKind.startsWith("league")
    ? "competitions"
    : cleanKind === "player"
    ? "players"
    : cleanKind === "match"
    ? "matches"
    : "teams";

  const list = current[field] || [];
  const nextList = active
    ? [...new Set([...list, entityId])]
    : list.filter((x) => x !== entityId);

  const entityKey = `${cleanKind}:${entityId}`;
  const entities = { ...(current.entities || {}) };
  if (active) {
    entities[entityKey] = {
      id: entityId,
      kind: cleanKind,
      name: String(name || entities[entityKey]?.name || entityId).trim(),
      logo: logo || photo || entities[entityKey]?.logo || null,
      country: country || entities[entityKey]?.country || null,
      savedAt: Date.now(),
    };
  } else {
    delete entities[entityKey];
  }

  await saveOnboardingPreferences({
    [field]: nextList,
    entities,
    favoritesSynced: false,
  });
  return true;
}

export async function loadGuestFavorites() {
  const prefs = await loadOnboardingPreferences();
  const mapEntities = (ids, kind) =>
    (ids || []).map((id) => {
      const entity = prefs.entities?.[`${kind}:${id}`] || {};
      return {
        id,
        kind,
        name: entity.name || id,
        logo: entity.logo || null,
        country: entity.country || null,
      };
    });

  return {
    teams: mapEntities(prefs.teams, "team"),
    competitions: mapEntities(prefs.competitions, "competition"),
    players: mapEntities(prefs.players, "player"),
    matches: mapEntities(prefs.matches, "match"),
  };
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
  const result = await saveOnboardingPreferences({
    language: clean,
    completed: true,
    onboardingComplete: true,
  });
  for (const fn of languageListeners) {
    try { fn(clean); } catch (_) {}
  }
  return result;
}

export async function syncStoredOnboardingFavorites(setFavorite) {
  if (typeof setFavorite !== "function") return false;
  const prefs = await loadOnboardingPreferences();
  if (prefs.favoritesSynced) return true;

  const jobs = [
    ...prefs.teams.map((id) => {
      const e = prefs.entities?.[`team:${id}`] || {};
      return { kind: "team", id, name: e.name || id, logo: e.logo || null, country: e.country || null };
    }),
    ...prefs.competitions.map((id) => {
      const e = prefs.entities?.[`competition:${id}`] || {};
      return { kind: "competition", id, name: e.name || id, logo: e.logo || null, country: e.country || null };
    }),
    ...prefs.players.map((id) => {
      const e = prefs.entities?.[`player:${id}`] || {};
      return { kind: "player", id, name: e.name || id, photo: e.logo || null, country: e.country || null };
    }),
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
