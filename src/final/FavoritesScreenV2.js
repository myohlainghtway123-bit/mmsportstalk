import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { getAuthStatus, getFavorites, normalizeFavoritePayload, setFavorite } from "../services/accountApi";
import {
  loadOnboardingPreferences,
  saveOnboardingPreferences,
  syncStoredOnboardingFavorites,
} from "../services/onboardingStore";
import {
  CURATED_FAVORITE_COMPETITIONS,
  CURATED_FAVORITE_PLAYERS,
  CURATED_FAVORITE_TEAMS,
  favoriteMetadata,
} from "../services/favoriteCatalog";

const TABS = ["Leagues", "Teams", "Players"];

function kindForTab(tab) {
  return tab === "Leagues" ? "competition" : tab === "Players" ? "player" : "team";
}
function keyForKind(kind) {
  return kind === "competition" ? "competitions" : kind === "player" ? "players" : "teams";
}
function catalogForKind(kind) {
  return kind === "competition"
    ? CURATED_FAVORITE_COMPETITIONS
    : kind === "player"
    ? CURATED_FAVORITE_PLAYERS
    : CURATED_FAVORITE_TEAMS;
}
function entityFromFavorite(item, kind) {
  const nested =
    item?.[kind] ||
    item?.team ||
    item?.player ||
    item?.competition ||
    item?.league ||
    item?.entity ||
    item ||
    {};
  const id =
    nested?.id ??
    item?.entityId ??
    item?.teamId ??
    item?.playerId ??
    item?.competitionId ??
    item?.id;
  const curated = favoriteMetadata(kind, id);
  return {
    id,
    name: nested?.name || nested?.title || item?.name || item?.displayName || curated?.name || "Favorite",
    logo:
      nested?.logo ||
      nested?.photo ||
      nested?.image ||
      item?.imageUrl ||
      item?.logo ||
      item?.photo ||
      curated?.imageUrl ||
      curated?.logo ||
      curated?.photo ||
      null,
    country: item?.country || nested?.country || curated?.country || null,
    raw: item,
  };
}

function Logo({ uri, kind, colors }) {
  return uri ? (
    <Image source={{ uri }} resizeMode="contain" style={s.logo} />
  ) : (
    <View style={[s.logoFallback, { backgroundColor: colors.card2 }]}>
      <Ionicons
        name={kind === "competition" ? "trophy-outline" : kind === "player" ? "person-outline" : "shield-outline"}
        size={20}
        color={colors.muted}
      />
    </View>
  );
}

function Empty({ icon, title, text, action, onAction, colors }) {
  return (
    <View style={[s.empty, { backgroundColor: colors.card, borderColor: colors.border2 }]}>
      <Ionicons name={icon} size={30} color={colors.muted} />
      <Text style={[s.emptyTitle, { color: colors.text }]}>{title}</Text>
      {text ? <Text style={[s.emptyText, { color: colors.muted }]}>{text}</Text> : null}
      {action && onAction ? (
        <Pressable style={[s.primary, { backgroundColor: colors.red }]} onPress={onAction}>
          <Text style={s.primaryText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function FavoriteRow({ entity, kind, onOpen, onRemove, busy, colors }) {
  return (
    <Pressable disabled={busy} style={s.row} onPress={() => onOpen?.(entity)}>
      <Logo uri={entity.logo} kind={kind} colors={colors} />
      <View style={s.rowCopy}>
        <Text numberOfLines={1} style={[s.rowTitle, { color: colors.text }]}>
          {entity.name}
        </Text>
        <Text numberOfLines={1} style={[s.rowSub, { color: colors.muted }]}>
          {entity.country || (kind === "competition" ? "Competition" : kind === "player" ? "Player" : "Team")}
        </Text>
      </View>
      {busy ? (
        <ActivityIndicator size="small" color={colors.red} />
      ) : (
        <Pressable hitSlop={10} onPress={() => onRemove(entity)}>
          <Ionicons name="star" size={21} color={colors.red} />
        </Pressable>
      )}
    </Pressable>
  );
}

function SuggestionRow({ entity, kind, onAdd, busy, colors }) {
  return (
    <View style={s.row}>
      <Logo uri={entity.imageUrl || entity.logo || entity.photo} kind={kind} colors={colors} />
      <View style={s.rowCopy}>
        <Text numberOfLines={1} style={[s.rowTitle, { color: colors.text }]}>
          {entity.name}
        </Text>
        <Text numberOfLines={1} style={[s.rowSub, { color: colors.muted }]}>
          {entity.country || (kind === "competition" ? "Competition" : kind === "player" ? "Player" : "Team")}
        </Text>
      </View>
      {busy ? (
        <ActivityIndicator size="small" color={colors.red} />
      ) : (
        <Pressable style={[s.add, { backgroundColor: colors.red }]} onPress={() => onAdd(entity)}>
          <Ionicons name="add" size={16} color="#FFFFFF" />
          <Text style={s.addText}>ADD</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function FavoritesScreenV2({ openLeague, openTeam, openPlayer, openAccount, language = "my" }) {
  const { colors } = useTheme();
  const my = language !== "en";
  const [tab, setTab] = useState("Teams");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [auth, setAuth] = useState(false);
  const [favorites, setFavorites] = useState({ competitions: [], teams: [], players: [] });
  const [localPrefs, setLocalPrefs] = useState({ teams: [], competitions: [], favoritesSynced: false });
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const localPayload = useCallback(
    (prefs) => ({
      teams: (prefs?.teams || []).map((id) => favoriteMetadata("team", id)).filter(Boolean),
      competitions: (prefs?.competitions || []).map((id) => favoriteMetadata("competition", id)).filter(Boolean),
      players: [],
    }),
    [],
  );

  const load = useCallback(
    async (refresh = false) => {
      refresh ? setRefreshing(true) : setLoading(true);
      setError("");
      try {
        const prefs = await loadOnboardingPreferences();
        setLocalPrefs(prefs);
        const status = await getAuthStatus().catch(() => ({ authenticated: false }));
        setAuth(Boolean(status.authenticated));
        if (status.authenticated) {
          await syncStoredOnboardingFavorites(setFavorite).catch(() => false);
          const payload = await getFavorites();
          setFavorites(normalizeFavoritePayload(payload));
        } else {
          setFavorites(localPayload(prefs));
        }
      } catch (e) {
        setError(e?.message || "Could not load favorites.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [localPayload],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const kind = kindForTab(tab);
  const key = keyForKind(kind);
  const rows = useMemo(
    () => (favorites[key] || []).map((item) => entityFromFavorite(item, kind)).filter((item) => item.id),
    [favorites, key, kind],
  );
  const favoriteIds = useMemo(() => new Set(rows.map((item) => String(item.id))), [rows]);
  const suggestions = useMemo(
    () => catalogForKind(kind).filter((item) => !favoriteIds.has(String(item.id))).slice(0, 10),
    [favoriteIds, kind],
  );
  const open = kind === "competition" ? openLeague : kind === "player" ? openPlayer : openTeam;

  const saveLocal = async (entity, active) => {
    if (kind === "player") {
      openAccount?.();
      return;
    }
    const prefs = await loadOnboardingPreferences();
    const field = kind === "competition" ? "competitions" : "teams";
    const id = String(entity.id);
    const current = (prefs[field] || []).map(String);
    const next = active ? [...new Set([...current, id])] : current.filter((value) => value !== id);
    const saved = await saveOnboardingPreferences({ [field]: next, favoritesSynced: false });
    setLocalPrefs(saved);
    setFavorites(localPayload(saved));
  };

  const mutate = async (entity, active) => {
    setBusyId(`${kind}:${entity.id}`);
    setError("");
    try {
      if (!auth) {
        await saveLocal(entity, active);
        return;
      }
      const payload = await setFavorite({
        kind,
        id: entity.id,
        name: entity.name,
        imageUrl: entity.logo || entity.imageUrl || entity.photo,
        country: entity.country,
        active,
      });
      const normalized = normalizeFavoritePayload(payload);
      if (normalized.teams.length + normalized.competitions.length + normalized.players.length > 0 || !active) {
        setFavorites(normalized);
      } else {
        await load(true);
      }
    } catch (e) {
      setError(e?.message || "Could not update favorite.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <View style={[s.screen, { backgroundColor: colors.bg }]}>
      <View style={[s.header, { borderBottomColor: colors.border2 }]}>
        <View>
          <Text style={[s.title, { color: colors.text }]}>{my ? "အကြိုက်ဆုံး" : "Favorites"}</Text>
          <Text style={[s.subtitle, { color: colors.muted }]}>
            {auth
              ? my
                ? "MST account နှင့် sync လုပ်ထားသည်"
                : "Synced with your MST account"
              : my
              ? "ဒီဖုန်းတွင် သိမ်းထားသည် · Sign in လုပ်လျှင် sync မည်"
              : "Saved on this device · sign in to sync"}
          </Text>
        </View>
        <Ionicons name="star" size={27} color={colors.red} />
      </View>

      <View style={[s.tabs, { borderBottomColor: colors.border2 }]}>
        {TABS.map((item) => (
          <Pressable
            key={item}
            style={[s.tab, tab === item && { backgroundColor: colors.redSoft }]}
            onPress={() => setTab(item)}
          >
            <Text style={[s.tabText, { color: colors.muted }, tab === item && { color: colors.red }]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.red]} tintColor={colors.red} />
        }
        showsVerticalScrollIndicator={false}
      >
        {!auth ? (
          <Pressable
            style={[s.syncCard, { backgroundColor: colors.redSoft, borderColor: colors.red }]}
            onPress={openAccount}
          >
            <Ionicons name="cloud-upload-outline" size={21} color={colors.red} />
            <View style={{ flex: 1 }}>
              <Text style={[s.syncTitle, { color: colors.text }]}>
                {my ? "Favorites ကို account နှင့် sync လုပ်ရန်" : "Sync Favorites with your account"}
              </Text>
              <Text style={[s.syncText, { color: colors.muted }]}>
                {my ? "Sign in လုပ်ပြီး website နဲ့ app နှစ်ခုလုံးမှာ တူတူသုံးပါ။" : "Sign in once to keep website and app favorites together."}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        ) : null}

        {error ? <Text style={[s.error, { color: colors.red }]}>{error}</Text> : null}

        {loading ? (
          <View style={s.loading}>
            <ActivityIndicator color={colors.red} />
            <Text style={[s.loadingText, { color: colors.muted }]}>Loading favorites…</Text>
          </View>
        ) : (
          <>
            <View style={s.sectionHead}>
              <Text style={[s.sectionTitle, { color: colors.text }]}>{my ? "ရွေးထားသည်" : "MY FAVORITES"}</Text>
              <Text style={[s.count, { color: colors.red }]}>{rows.length}</Text>
            </View>
            {rows.length ? (
              <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border2 }]}>
                {rows.map((entity, index) => (
                  <View key={String(entity.id)} style={index !== rows.length - 1 ? [s.divider, { borderBottomColor: colors.border2 }] : null}>
                    <FavoriteRow
                      entity={entity}
                      kind={kind}
                      onOpen={open}
                      onRemove={(item) => mutate(item, false)}
                      busy={busyId === `${kind}:${entity.id}`}
                      colors={colors}
                    />
                  </View>
                ))}
              </View>
            ) : (
              <Empty
                icon="star-outline"
                title={my ? "မရွေးရသေးပါ" : "No favorites yet"}
                text={
                  kind === "player" && !auth
                    ? my
                      ? "Player favorites ကို account ဝင်ပြီး သိမ်းနိုင်သည်။"
                      : "Sign in to save player favorites across devices."
                    : my
                    ? "အောက်က Suggested ထဲကနေရွေးပါ။"
                    : "Add some from Suggested below."
                }
                action={kind === "player" && !auth ? "SIGN IN" : null}
                onAction={openAccount}
                colors={colors}
              />
            )}

            <View style={s.sectionHead}>
              <Text style={[s.sectionTitle, { color: colors.text }]}>{my ? "အကြံပြုထားသည်" : "SUGGESTED"}</Text>
            </View>
            {suggestions.length ? (
              <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border2 }]}>
                {suggestions.map((entity, index) => (
                  <View key={String(entity.id)} style={index !== suggestions.length - 1 ? [s.divider, { borderBottomColor: colors.border2 }] : null}>
                    <SuggestionRow
                      entity={entity}
                      kind={kind}
                      onAdd={(item) => mutate(item, true)}
                      busy={busyId === `${kind}:${entity.id}`}
                      colors={colors}
                    />
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    minHeight: 60,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  title: { fontSize: 20, fontWeight: "900" },
  subtitle: { fontSize: 9.8, marginTop: 2, maxWidth: 280 },
  tabs: { height: 48, flexDirection: "row", padding: 5, gap: 5, borderBottomWidth: 1 },
  tab: { flex: 1, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  tabText: { fontSize: 11, fontWeight: "800" },
  content: { padding: 14, paddingBottom: 40 },
  syncCard: { minHeight: 64, borderRadius: 12, borderWidth: 1, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  syncTitle: { fontSize: 12, fontWeight: "900" },
  syncText: { fontSize: 9.5, marginTop: 2, lineHeight: 14 },
  error: { fontSize: 10, textAlign: "center", paddingVertical: 8 },
  loading: { minHeight: 130, alignItems: "center", justifyContent: "center", gap: 9 },
  loadingText: { fontSize: 10.5 },
  sectionHead: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 2, marginTop: 4 },
  sectionTitle: { fontSize: 11, fontWeight: "900", letterSpacing: 0.6 },
  count: { fontSize: 11, fontWeight: "900" },
  card: { borderWidth: 1, borderRadius: 12, overflow: "hidden", marginBottom: 12 },
  divider: { borderBottomWidth: 1 },
  row: { minHeight: 58, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 34, height: 34 },
  logoFallback: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 12.5, fontWeight: "800" },
  rowSub: { fontSize: 9.5, marginTop: 2 },
  add: { height: 32, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10 },
  addText: { fontSize: 9.5, fontWeight: "900", color: "#FFFFFF" },
  empty: { minHeight: 130, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center", padding: 18, gap: 8, marginBottom: 12 },
  emptyTitle: { fontSize: 13.5, fontWeight: "900" },
  emptyText: { fontSize: 10.5, lineHeight: 15, textAlign: "center", maxWidth: 260 },
  primary: { minHeight: 36, borderRadius: 8, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", marginTop: 4 },
  primaryText: { fontSize: 10, fontWeight: "900", color: "#FFFFFF" },
});
