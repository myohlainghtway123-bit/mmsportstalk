import assert from "node:assert/strict";
import { canonicalEntityKey, reconcileGuestFavorites } from "../src/phase4b/favoritesReconciliation.js";

console.log("Starting MST Scores Guest -> OTP Merge P0 Automated Test Suite...\n");

// --- TEST 1: Canonical Entity Key Deduplication ---
console.log("1. Testing canonicalEntityKey normalization & deduplication...");
assert.equal(canonicalEntityKey("team", 33), "team:33");
assert.equal(canonicalEntityKey("team", "33"), "team:33");
assert.equal(canonicalEntityKey("team", "mst:team:33"), "team:33");
assert.equal(canonicalEntityKey("competition", 39), "competition:39");
assert.equal(canonicalEntityKey("competition", "mst:comp:39"), "competition:39");
assert.equal(canonicalEntityKey("player", "mst:player:123"), "player:123");
assert.equal(canonicalEntityKey("match", "mst:match:9999"), "match:9999");
assert.equal(canonicalEntityKey("match", 9999), "match:9999");
console.log("   -> PASS: Canonical entity keys match across numeric and string representations.\n");

// --- TEST 2: Guest Only (All guest favorites pushed to server) ---
console.log("2. Testing Guest Only reconciliation (push missing to server)...");
{
  let serverStore = [];
  let localStore = {
    teams: ["33", "mst:team:50"],
    competitions: ["39"],
    players: [],
    matches: ["mst:match:101"],
    entities: {
      "team:33": { name: "Man United" },
      "team:50": { name: "Man City" },
      "competition:39": { name: "Premier League" },
      "match:101": { name: "MU vs MC" },
    },
    pendingSyncEntities: [],
  };

  const getFavoritesFn = async () => ({ data: serverStore });
  const setFavoriteFn = async (item) => {
    serverStore.push({ id: item.id, name: item.name, kind: item.kind });
    return { ok: true };
  };
  const loadGuestPrefsFn = async () => ({ ...localStore });
  const saveGuestPrefsFn = async (next) => {
    localStore = { ...localStore, ...next };
  };

  const result = await reconcileGuestFavorites({
    getFavoritesFn,
    setFavoriteFn,
    loadGuestPrefsFn,
    saveGuestPrefsFn,
  });

  assert.equal(result.success, true);
  assert.equal(result.mergedCount, 3); // 2 teams + 1 comp pushed
  assert.equal(result.pendingCount, 0);
  assert.equal(result.finalState.teams.length, 2);
  assert.equal(result.finalState.competitions.length, 1);
  assert.equal(result.finalState.matches.length, 1); // match retained in union
  assert.equal(localStore.favoritesSynced, true);
  assert.equal(localStore.pendingSyncEntities.length, 0);
  console.log("   -> PASS: Guest items successfully pushed and unified.\n");
}

// --- TEST 3: Server Only (Server favorites pulled into local authenticated state) ---
console.log("3. Testing Server Only reconciliation...");
{
  const serverStore = [
    { kind: "team", id: "541", name: "Real Madrid" },
    { kind: "competition", id: "140", name: "La Liga" },
  ];
  let localStore = {
    teams: [],
    competitions: [],
    players: [],
    matches: [],
    entities: {},
    pendingSyncEntities: [],
  };

  let pushed = 0;
  const getFavoritesFn = async () => ({ data: serverStore });
  const setFavoriteFn = async () => { pushed++; };
  const loadGuestPrefsFn = async () => ({ ...localStore });
  const saveGuestPrefsFn = async (next) => { localStore = { ...localStore, ...next }; };

  const result = await reconcileGuestFavorites({
    getFavoritesFn,
    setFavoriteFn,
    loadGuestPrefsFn,
    saveGuestPrefsFn,
  });

  assert.equal(result.success, true);
  assert.equal(pushed, 0); // No guest items needed pushing
  assert.equal(result.finalState.teams.length, 1);
  assert.equal(result.finalState.teams[0].name, "Real Madrid");
  assert.equal(result.finalState.competitions.length, 1);
  assert.equal(localStore.teams.includes("541"), true);
  console.log("   -> PASS: Server truth adopted when no guest items exist.\n");
}

// --- TEST 4: Overlap (Server Union Guest without duplication) ---
console.log("4. Testing Overlap (Server Union Guest deduplication)...");
{
  const serverStore = [
    { kind: "team", id: "33", name: "Manchester United" },
    { kind: "team", id: "40", name: "Liverpool" },
  ];
  let localStore = {
    teams: ["33", "mst:team:33", "50"], // 33 duplicates server; 50 is new
    competitions: ["39"],
    players: [],
    matches: [],
    entities: {
      "team:33": { name: "Man United" },
      "team:50": { name: "Manchester City" },
      "competition:39": { name: "Premier League" },
    },
    pendingSyncEntities: [],
  };

  let pushedItems = [];
  const getFavoritesFn = async () => ({ data: serverStore });
  const setFavoriteFn = async (item) => {
    pushedItems.push(item);
    serverStore.push(item);
  };
  const loadGuestPrefsFn = async () => ({ ...localStore });
  const saveGuestPrefsFn = async (next) => { localStore = { ...localStore, ...next }; };

  const result = await reconcileGuestFavorites({
    getFavoritesFn,
    setFavoriteFn,
    loadGuestPrefsFn,
    saveGuestPrefsFn,
  });

  assert.equal(result.success, true);
  // Only team 50 and comp 39 should be pushed (team 33 already exists on server)
  assert.equal(pushedItems.length, 2);
  assert.ok(pushedItems.some((x) => x.id === "50"));
  assert.ok(pushedItems.some((x) => x.id === "39"));

  // Final teams must have 33, 40, 50 (exactly 3 teams, no duplicates)
  assert.equal(result.finalState.teams.length, 3);
  console.log("   -> PASS: Overlapping items deduplicated cleanly (33 + 40 + 50 = 3 teams).\n");
}

// --- TEST 5: Partial Server Failure (Queues failed items without data loss) ---
console.log("5. Testing Partial Server Failure (preserves pending items for retry)...");
{
  const serverStore = [];
  let localStore = {
    teams: ["33", "42"],
    competitions: [],
    players: [],
    matches: [],
    entities: {
      "team:33": { name: "Man United" },
      "team:42": { name: "Arsenal" },
    },
    pendingSyncEntities: [],
  };

  const getFavoritesFn = async () => ({ data: serverStore });
  const setFavoriteFn = async (item) => {
    if (item.id === "42") {
      throw new Error("HTTP 500 Network timeout");
    }
    serverStore.push(item);
  };
  const loadGuestPrefsFn = async () => ({ ...localStore });
  const saveGuestPrefsFn = async (next) => { localStore = { ...localStore, ...next }; };

  const result = await reconcileGuestFavorites({
    getFavoritesFn,
    setFavoriteFn,
    loadGuestPrefsFn,
    saveGuestPrefsFn,
  });

  assert.equal(result.success, false);
  assert.equal(result.mergedCount, 1); // 33 succeeded
  assert.equal(result.pendingCount, 1); // 42 failed
  // Local store MUST retain team 42 in pendingSyncEntities so it's not lost
  assert.equal(localStore.pendingSyncEntities.length, 1);
  assert.equal(localStore.pendingSyncEntities[0].id, "42");
  // Final state in UI still contains BOTH teams (never hides user data)
  assert.equal(result.finalState.teams.length, 2);
  console.log("   -> PASS: Failed entity retained in pending queue without dropping user data.\n");
}

// --- TEST 6: Offline after OTP (Zero Data Loss Fallback) ---
console.log("6. Testing Offline after OTP (server totally unreachable)...");
{
  let localStore = {
    teams: ["33", "541"],
    competitions: ["39"],
    players: [],
    matches: [],
    entities: {
      "team:33": { name: "Man United" },
      "team:541": { name: "Real Madrid" },
      "competition:39": { name: "Premier League" },
    },
    pendingSyncEntities: [],
  };

  const getFavoritesFn = async () => { throw new Error("TypeError: Network request failed"); };
  const setFavoriteFn = async () => {};
  const loadGuestPrefsFn = async () => ({ ...localStore });
  const saveGuestPrefsFn = async () => {};

  const result = await reconcileGuestFavorites({
    getFavoritesFn,
    setFavoriteFn,
    loadGuestPrefsFn,
    saveGuestPrefsFn,
  });

  assert.equal(result.success, false);
  assert.equal(result.reason, "server_unavailable");
  // Final state preserves all local guest favorites so screen is never blank
  assert.equal(result.finalState.teams.length, 2);
  assert.equal(result.finalState.competitions.length, 1);
  console.log("   -> PASS: Offline state preserves guest favorites without wiping.\n");
}

// --- TEST 7: Stale & Invalid Entity Handling ---
console.log("7. Testing Stale & Invalid Entity handling...");
{
  let localStore = {
    teams: ["", null, undefined, "   ", "33"],
    competitions: [null, "39"],
    players: [],
    matches: [],
    entities: {},
    pendingSyncEntities: [null, undefined, { kind: "team", id: "" }],
  };

  const serverStore = [];
  const getFavoritesFn = async () => ({ data: serverStore });
  const setFavoriteFn = async (item) => { serverStore.push(item); };
  const loadGuestPrefsFn = async () => ({ ...localStore });
  const saveGuestPrefsFn = async (next) => { localStore = { ...localStore, ...next }; };

  const result = await reconcileGuestFavorites({
    getFavoritesFn,
    setFavoriteFn,
    loadGuestPrefsFn,
    saveGuestPrefsFn,
  });

  assert.equal(result.success, true);
  assert.equal(result.finalState.teams.length, 1);
  assert.equal(result.finalState.teams[0].id, "33");
  assert.equal(result.finalState.competitions.length, 1);
  assert.equal(result.finalState.competitions[0].id, "39");
  console.log("   -> PASS: Null, empty, and invalid entities ignored safely.\n");
}

console.log("ALL MST SCORES GUEST -> OTP MERGE P0 AUTOMATED TESTS PASS!\n");
