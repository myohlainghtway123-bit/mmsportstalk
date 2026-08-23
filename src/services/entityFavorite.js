import { getAuthStatus, getFavorites, normalizeFavoritePayload, setFavorite } from "./accountApi";
import { loadOnboardingPreferences, saveOnboardingPreferences } from "./onboardingStore";
import { favoriteMetadata } from "./favoriteCatalog";

function canonicalKind(type) {
  const value = String(type || "").toLowerCase();
  if (value === "competition" || value === "league") return "competition";
  if (value === "team") return "team";
  if (value === "player") return "player";
  return null;
}

function keyForKind(kind) {
  return kind === "competition" ? "competitions" : kind === "player" ? "players" : "teams";
}

export async function readEntityFavorite(type, id) {
  const kind = canonicalKind(type), entityId = String(id ?? "");
  if (!kind || !entityId) return { authenticated: false, favorite: false, kind };
  const status = await getAuthStatus().catch(() => ({ authenticated: false }));
  if (status.authenticated) {
    const normalized = normalizeFavoritePayload(await getFavorites().catch(() => null));
    const rows = normalized[keyForKind(kind)] || [];
    return {
      authenticated: true,
      kind,
      favorite: rows.some((item) => String(item?.id ?? item?.entityId ?? item?.[kind]?.id ?? "") === entityId),
    };
  }
  if (kind === "player") return { authenticated: false, favorite: false, kind };
  const prefs = await loadOnboardingPreferences();
  const field = keyForKind(kind);
  return { authenticated: false, kind, favorite: (prefs[field] || []).map(String).includes(entityId) };
}

export async function toggleEntityFavorite({ type, entity, active, name, imageUrl, country, teamId, teamName, competitionId, competitionName }) {
  const kind = canonicalKind(type), id = String(entity?.id ?? "");
  if (!kind || !id) throw new Error("Favorite data is unavailable.");
  const status = await getAuthStatus().catch(() => ({ authenticated: false }));
  if (status.authenticated) {
    await setFavorite({
      kind,
      id,
      name: name || entity?.name || entity?.title,
      imageUrl: imageUrl || entity?.logo || entity?.photo || entity?.image,
      country: country || entity?.country,
      teamId: teamId || null,
      teamName: teamName || null,
      competitionId: competitionId || null,
      competitionName: competitionName || null,
      active,
    });
    return { authenticated: true, favorite: active, requiresAuth: false };
  }

  if (kind === "player" || !favoriteMetadata(kind, id)) {
    return { authenticated: false, favorite: false, requiresAuth: true };
  }

  const prefs = await loadOnboardingPreferences();
  const field = keyForKind(kind), current = (prefs[field] || []).map(String);
  const next = active ? [...new Set([...current, id])] : current.filter((value) => value !== id);
  await saveOnboardingPreferences({ [field]: next, favoritesSynced: false });
  return { authenticated: false, favorite: active, requiresAuth: false };
}
