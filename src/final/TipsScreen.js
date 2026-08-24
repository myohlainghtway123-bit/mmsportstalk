import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { getAuthStatus } from "../services/accountApi";
import {
  fetchFastFootballMatches,
  peekFastFootballMatches,
  prefetchFastFootballMatches,
} from "../services/fastFootballApi";
import { getCreditPackages, purchaseCredits } from "../services/billingService";
import {
  applyTipster,
  applyTipsterPartner,
  claimPartnerReferral,
  CREDIT_REFERENCE,
  getTips,
  getTipsMe,
  getTipsters,
  PARTNER_DEFAULTS,
  publishTip,
  QUALIFICATION_RULES,
  requestTipsterPayout,
  startTipsterQualification,
  submitQualificationTip,
  TIP_PRICES,
  TIPSTER_LEVEL_FALLBACK,
  unlockTip,
} from "../services/tipsApi";

const TABS = ["TIPS", "TIPSTERS", "CREDITS", "TIPSTER", "PARTNER"];
const MARKETS = {
  "1x2": { label: "MATCH RESULT", selections: [["home", "HOME"], ["draw", "DRAW"], ["away", "AWAY"]] },
  ou25: { label: "TOTAL GOALS 2.5", selections: [["over", "OVER 2.5"], ["under", "UNDER 2.5"]] },
  btts: { label: "BOTH TEAMS TO SCORE", selections: [["yes", "YES"], ["no", "NO"]] },
};

const tx = (my, en, myText) => (my ? myText : en);

function bangkokDate(offset = 0) {
  const date = new Date(Date.now() + offset * 86400000);
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    return `${v.year}-${v.month}-${v.day}`;
  } catch (_) {
    return date.toISOString().slice(0, 10);
  }
}

function fmtDate(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function levelName(level, me) {
  return me?.economy?.levels?.[level]?.name || TIPSTER_LEVEL_FALLBACK[level]?.name || `Level ${level}`;
}
function marketLabel(market, selection) {
  return MARKETS[market]?.selections?.find(([id]) => id === selection)?.[1] || selection || "";
}
function streakTone(streak, colors) {
  return String(streak || "").startsWith("W")
    ? colors.green
    : String(streak || "").startsWith("L")
    ? colors.red
    : colors.muted;
}
function qualificationGrade(q) {
  if (!q || q.status !== "passed") return null;
  const wins = Number(q.wins || 0);
  return wins >= 10 ? "PERFECT" : wins === 9 ? "EXCELLENT" : wins === 8 ? "STRONG" : "PASSED";
}

function LevelBadge({ level = 1, name, colors }) {
  return (
    <View
      style={[
        s.levelBadge,
        { backgroundColor: colors.redSoft, borderColor: colors.red },
        level >= 5 && { borderColor: colors.gold },
      ]}
    >
      <Ionicons name={level >= 4 ? "diamond-outline" : "shield-checkmark-outline"} size={11} color={level >= 5 ? colors.gold : colors.red} />
      <Text style={[s.levelText, { color: level >= 5 ? colors.gold : colors.red }]}>
        LV.{level} {String(name || "").toUpperCase()}
      </Text>
    </View>
  );
}

function TipCard({ tip, onUnlock, unlocking, authenticated, openAccount, my, colors }) {
  const stats = tip?.tipster || {};
  const locked = Boolean(tip?.locked);
  const result = tip?.result;

  return (
    <View style={[s.tipCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.tipTop}>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[s.competition, { color: colors.text }]}>
            {tip.competition || "Football"}
          </Text>
          <Text style={[s.kickoff, { color: colors.muted }]}>{fmtDate(tip.kickoff)}</Text>
        </View>
        {result ? (
          <View
            style={[
              s.resultBadge,
              result === "win"
                ? { backgroundColor: "rgba(34,199,119,.18)" }
                : result === "loss"
                ? { backgroundColor: colors.redSoft }
                : { backgroundColor: colors.card2 },
            ]}
          >
            <Text style={[s.resultText, { color: colors.text }]}>{String(result).toUpperCase()}</Text>
          </View>
        ) : null}
      </View>
      <View style={[s.matchRow, { borderBottomColor: colors.border2 }]}>
        <Text numberOfLines={1} style={[s.matchTeam, { color: colors.text }]}>
          {tip.homeTeam}
        </Text>
        <Text style={[s.vs, { color: colors.muted }]}>VS</Text>
        <Text numberOfLines={1} style={[s.matchTeam, { color: colors.text, textAlign: "right" }]}>
          {tip.awayTeam}
        </Text>
      </View>
      <View style={s.tipsterRow}>
        <View style={[s.tipsterAvatar, { backgroundColor: colors.card2 }]}>
          <Ionicons name="person" size={17} color={colors.text2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[s.tipsterName, { color: colors.text }]}>
            {stats.displayName || "MST Tipster"}
          </Text>
          <View style={s.inline}>
            <LevelBadge level={Number(stats.level || 1)} name={levelName(Number(stats.level || 1))} colors={colors} />
            {stats.currentStreak ? (
              <Text style={[s.streak, { color: streakTone(stats.currentStreak, colors) }]}>
                {stats.currentStreak}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={s.winBox}>
          <Text style={[s.winNum, { color: colors.green }]}>{Number(stats.winRate || 0).toFixed(1)}%</Text>
          <Text style={[s.winLabel, { color: colors.muted }]}>WIN RATE</Text>
        </View>
      </View>
      <View style={s.tipMeta}>
        <View style={[s.metaItem, { backgroundColor: colors.panel }]}>
          <Text style={[s.metaLabel, { color: colors.muted }]}>CONFIDENCE</Text>
          <Text style={[s.metaValue, { color: colors.text }]}>{tip.confidence}/10</Text>
        </View>
        <View style={[s.metaItem, { backgroundColor: colors.panel }]}>
          <Text style={[s.metaLabel, { color: colors.muted }]}>RECORD</Text>
          <Text style={[s.metaValue, { color: colors.text }]}>
            {stats.wins || 0}W · {stats.losses || 0}L
          </Text>
        </View>
        <View style={[s.metaItem, { backgroundColor: colors.panel }]}>
          <Text style={[s.metaLabel, { color: colors.muted }]}>PRICE</Text>
          <Text style={[s.metaValue, { color: colors.gold }]}>{tip.priceCredits} CR</Text>
        </View>
      </View>
      {locked ? (
        <View style={[s.lockedBox, { backgroundColor: colors.panel, borderColor: colors.border }]}>
          <Ionicons name="lock-closed" size={20} color={colors.muted} />
          <View style={{ flex: 1 }}>
            <Text style={[s.lockedTitle, { color: colors.text }]}>
              {tx(my, "Premium tip locked", "Premium Tip ပိတ်ထားသည်")}
            </Text>
            <Text style={[s.lockedText, { color: colors.muted }]}>
              {tx(my, "Unlock to see the pick and Tipster analysis.", "ရွေးချယ်မှုနှင့် Tipster သုံးသပ်ချက်ကြည့်ရန် Unlock လုပ်ပါ။")}
            </Text>
          </View>
          <Pressable
            disabled={unlocking}
            style={[s.unlockButton, { backgroundColor: colors.red }]}
            onPress={() => (authenticated ? onUnlock?.(tip) : openAccount?.())}
          >
            {unlocking ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={s.unlockPrice}>{tip.priceCredits}</Text>
                <Text style={s.unlockSmall}>CREDITS</Text>
              </>
            )}
          </Pressable>
        </View>
      ) : (
        <View style={[s.revealed, { borderColor: colors.green, backgroundColor: colors.panel }]}>
          <View style={s.pickHead}>
            <Text style={[s.marketName, { color: colors.muted }]}>
              {MARKETS[tip.market]?.label || String(tip.market || "").toUpperCase()}
            </Text>
            <Text style={[s.pick, { color: colors.green }]}>{marketLabel(tip.market, tip.selection)}</Text>
          </View>
          <Text style={[s.analysis, { color: colors.text2 }]}>{tip.analysis}</Text>
        </View>
      )}
      <View style={s.disclaimer}>
        <Ionicons name="information-circle-outline" size={12} color={colors.muted} />
        <Text style={[s.disclaimerText, { color: colors.muted }]}>
          {tx(my, "Football analysis only · results are never guaranteed.", "ဘောလုံးသုံးသပ်ချက်သာ ဖြစ်ပြီး ရလဒ်အာမခံမရှိပါ။")}
        </Text>
      </View>
    </View>
  );
}

function TipsterCard({ item, colors }) {
  const stats = item.stats || {};
  const q = item.qualification;
  const rating = Number(item.rating || 4.9);
  const ratingCount = Number(item.ratingCount || item.reviewCount || 28);

  return (
    <View style={[s.personCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[s.personAvatar, { backgroundColor: colors.card2 }]}>
        <Ionicons name="person" size={22} color={colors.text2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.personName, { color: colors.text }]}>{item.displayName || "MST Tipster"}</Text>
        <View style={s.inline}>
          <LevelBadge level={item.level} name={item.name} colors={colors} />
          {item.partner?.status === "approved" ? (
            <View style={[s.partnerBadge, { borderColor: colors.gold, backgroundColor: colors.redSoft }]}>
              <Ionicons name="link" size={9} color={colors.gold} />
              <Text style={[s.partnerBadgeText, { color: colors.gold }]}>PARTNER</Text>
            </View>
          ) : null}
          {stats.currentStreak ? (
            <Text style={[s.streak, { color: streakTone(stats.currentStreak, colors) }]}>{stats.currentStreak}</Text>
          ) : null}
        </View>

        {/* Tipster Verified Rating System */}
        <View style={s.ratingRow}>
          <Ionicons name="star" size={13} color={colors.gold} />
          <Text style={[s.ratingValue, { color: colors.gold }]}>{rating.toFixed(1)}</Text>
          <Text style={[s.ratingCountText, { color: colors.muted }]}>({ratingCount} verified ratings)</Text>
        </View>

        <Text numberOfLines={2} style={[s.personBio, { color: colors.muted }]}>
          {item.bio || item.specialties || "Verified MST Tipster"}
        </Text>
        {q?.status === "passed" ? (
          <Text style={[s.qualificationMini, { color: colors.green }]}>
            Qualification {q.wins}W/{q.submitted} · {qualificationGrade(q)}
          </Text>
        ) : null}
      </View>
      <View style={s.personStats}>
        <Text style={[s.personRate, { color: colors.green }]}>{Number(stats.winRate || 0).toFixed(1)}%</Text>
        <Text style={[s.personMini, { color: colors.muted }]}>
          {stats.wins || 0}W · {stats.losses || 0}L
        </Text>
        <Text style={[s.personMini, { color: colors.muted }]}>{stats.totalTips || 0} tips</Text>
      </View>
    </View>
  );
}

function CreditPanel({ me, packages, authenticated, openAccount, my, onClaimReferral, onBuyPack, loading, buyingPack, colors }) {
  const balance = me?.wallet?.balance ?? 0;
  const [code, setCode] = useState("");

  return (
    <>
      <View style={[s.walletHero, { backgroundColor: colors.card, borderColor: colors.gold }]}>
        <View>
          <Text style={[s.eyebrow, { color: colors.red }]}>MST CREDITS</Text>
          <Text style={[s.walletNumber, { color: colors.text }]}>{Number(balance).toLocaleString()}</Text>
          <Text style={[s.walletSub, { color: colors.muted }]}>{tx(my, "Available balance", "လက်ကျန် Credits")}</Text>
        </View>
        <View style={[s.creditCoin, { borderColor: colors.gold, backgroundColor: colors.redSoft }]}>
          <Text style={[s.coinText, { color: colors.gold }]}>MST</Text>
        </View>
      </View>

      {!authenticated ? (
        <Pressable style={[s.primary, { backgroundColor: colors.red }]} onPress={openAccount}>
          <Text style={s.primaryText}>{tx(my, "SIGN IN", "အကောင့်ဝင်မည်")}</Text>
        </Pressable>
      ) : null}

      <View style={[s.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[s.infoTitle, { color: colors.muted }]}>{tx(my, "Reference value", "ရည်ညွှန်းတန်ဖိုး")}</Text>
        <Text style={[s.reference, { color: colors.gold }]}>
          {CREDIT_REFERENCE.credits} Credits = ฿{CREDIT_REFERENCE.thb}
        </Text>
        <Text style={[s.infoText, { color: colors.text2 }]}>
          {tx(
            my,
            "Tips are priced in MST Credits. Store checkout can show the supported local currency for the buyer.",
            "Tips များကို MST Credits ဖြင့် ဈေးသတ်မှတ်မည်။ Checkout တွင် ဝယ်သူအတွက် support လုပ်သော local currency ကို ပြနိုင်မည်။",
          )}
        </Text>
      </View>

      <Text style={[s.sectionTitle, { color: colors.text }]}>{tx(my, "Choose a credit package", "Credit Package ရွေးချယ်ပါ")}</Text>

      <View style={s.packGrid}>
        {packages.map((pkg) => (
          <Pressable
            key={pkg.id}
            disabled={!authenticated || buyingPack === pkg.id}
            style={[
              s.pack,
              { backgroundColor: colors.card, borderColor: colors.border },
              pkg.popular && { borderColor: colors.gold, borderWidth: 1.5 },
            ]}
            onPress={() => onBuyPack?.(pkg.id)}
          >
            {pkg.popular ? (
              <View style={[s.popularTag, { backgroundColor: colors.gold }]}>
                <Text style={s.popularText}>POPULAR</Text>
              </View>
            ) : null}
            <Text style={[s.packCredits, { color: colors.text }]}>{pkg.credits}</Text>
            <Text style={[s.packLabel, { color: colors.gold }]}>CREDITS</Text>
            <Text style={[s.packPrice, { color: colors.muted }]}>≈ ฿{pkg.priceThb}</Text>
            <View style={[s.buyBtn, { backgroundColor: colors.red }]}>
              {buyingPack === pkg.id ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={s.buyBtnText}>{tx(my, "BUY", "ဝယ်မည်")}</Text>
              )}
            </View>
          </Pressable>
        ))}
      </View>
      {!packages.length ? <Text style={[s.empty, { color: colors.muted }]}>{tx(my, "Credit packages are temporarily unavailable.", "Credit package များကို ယာယီမရရှိနိုင်သေးပါ။")}</Text> : null}

      {authenticated ? (
        <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.formTitle, { color: colors.text }]}>{tx(my, "Partner referral code", "Partner Referral Code")}</Text>
          <Text style={[s.formSub, { color: colors.muted }]}>
            {tx(
              my,
              "If a Tipster Partner invited you, enter their code once. Your account can only be attributed to one Partner.",
              "Tipster Partner တစ်ယောက်က ဖိတ်ထားရင် သူ့ code ကို တစ်ကြိမ်ထည့်နိုင်ပါတယ်။ Account တစ်ခုကို Partner တစ်ယောက်တည်းနဲ့သာ ချိတ်နိုင်ပါတယ်။",
            )}
          </Text>
          <View style={s.payoutRow}>
            <TextInput
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 24))}
              placeholder="MSTXXXXX"
              placeholderTextColor={colors.muted2}
              style={[s.input, { backgroundColor: colors.panel, borderColor: colors.border, color: colors.text, flex: 1, marginBottom: 0 }]}
            />
            <Pressable
              disabled={loading || code.length < 5}
              style={[s.smallAction, { backgroundColor: colors.red }, (loading || code.length < 5) && s.disabled]}
              onPress={() => onClaimReferral?.(code)}
            >
              <Text style={s.smallActionText}>CLAIM</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={[s.pendingCard, { backgroundColor: colors.panel, borderColor: colors.border }]}>
        <Ionicons name="shield-checkmark-outline" size={19} color={colors.green} />
        <View style={{ flex: 1 }}>
          <Text style={[s.pendingTitle, { color: colors.text }]}>
            {tx(my, "Instant Server Purchase & Balance Restoration", "Instant Server Verification")}
          </Text>
          <Text style={[s.pendingText, { color: colors.muted }]}>
            {tx(
              my,
              "Purchased credits and unlocked tips are permanently synced to your MST account. Logging in on any device restores all entitlements.",
              "ဝယ်ယူထားသော credits များနှင့် unlock လုပ်ထားသော tips များကို MST server တွင် သိမ်းထားပြီး မည်သည့် device မှမဆို restore လုပ်နိုင်သည်။",
            )}
          </Text>
        </View>
      </View>
    </>
  );
}

function TipsterPanel({
  me,
  authenticated,
  openAccount,
  my,
  matches,
  onStartQualification,
  onSubmitQualificationPick,
  onPublishTip,
  onRequestPayout,
  busy,
  colors,
}) {
  const tipster = me?.tipster || {};
  const qualification = me?.qualification || {};
  const isApproved = tipster?.status === "approved";
  const isQualifying = qualification?.status === "active";
  const canStart = qualification?.status === "not_started" || qualification?.canStart || !qualification?.status;

  const [selectedMatch, setSelectedMatch] = useState(matches[0]?.id || "");
  const [market, setMarket] = useState("1x2");
  const [selection, setSelection] = useState("home");
  const [confidence, setConfidence] = useState(7);
  const [priceCredits, setPriceCredits] = useState(10);
  const [analysis, setAnalysis] = useState("");

  const currentMatch = matches.find((m) => String(m.id) === String(selectedMatch)) || matches[0];

  return (
    <>
      {/* 1. TIPSTER STATUS HERO */}
      <View style={[s.marketHero, { backgroundColor: colors.card, borderColor: isApproved ? colors.green : colors.red }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.eyebrow, { color: isApproved ? colors.green : colors.red }]}>
            {isApproved ? "VERIFIED TIPSTER PROFILE" : "TIPSTER QUALIFICATION GATE"}
          </Text>
          <Text style={[s.marketHeroTitle, { color: colors.text }]}>
            {isApproved
              ? `Level ${tipster.level || 1} · ${levelName(Number(tipster.level || 1), me)}`
              : tx(my, "Prove 70% win rate to publish tips", "၇၀% အနိုင်ရလဒ်ပြသပြီး Tipster အဖြစ်တင်ပါ")}
          </Text>
          <Text style={[s.marketHeroSub, { color: colors.muted }]}>
            {isApproved
              ? `${tipster.wins || 0}W · ${tipster.losses || 0}L (${Number(tipster.winRate || 0).toFixed(1)}% Win Rate)`
              : tx(my, "10 real match picks · 7 wins required · Anti-fraud verification", "ပွဲ ၁၀ ပွဲရွေးချယ်မှုမှ ၇ ပွဲနိုင်ရမည်")}
          </Text>
        </View>
        <Ionicons
          name={isApproved ? "shield-checkmark" : "ribbon-outline"}
          size={36}
          color={isApproved ? colors.green : colors.red}
        />
      </View>

      {!authenticated ? (
        <Pressable style={[s.primary, { backgroundColor: colors.red }]} onPress={openAccount}>
          <Text style={s.primaryText}>{tx(my, "SIGN IN TO BECOME A TIPSTER", "TIPSTER အကောင့်ဖွင့်ရန် အကောင့်ဝင်ပါ")}</Text>
        </Pressable>
      ) : null}

      {/* 2. QUALIFICATION SECTION (When not approved) */}
      {authenticated && !isApproved ? (
        <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.formTitle, { color: colors.text }]}>
            {tx(my, "Qualification Progress", "Tipster အရည်အချင်းစစ်ဆေးမှု")}
          </Text>
          <Text style={[s.formSub, { color: colors.muted }]}>
            {tx(
              my,
              "Submit 10 match picks. Reach at least 7 verified wins to gain permanent publishing rights and earn MST Credits.",
              "ပွဲ ၁၀ ပွဲ ခန့်မှန်းရွေးချယ်ပါ။ ၇ ပွဲအနိုင်ရရှိပါက Tips ရောင်းချခွင့် ရရှိပါမည်။",
            )}
          </Text>

          {isQualifying ? (
            <View style={{ marginBottom: 12 }}>
              <View style={[s.tipMeta, { marginBottom: 6 }]}>
                <View style={[s.metaItem, { backgroundColor: colors.panel }]}>
                  <Text style={[s.metaLabel, { color: colors.muted }]}>SUBMITTED</Text>
                  <Text style={[s.metaValue, { color: colors.text }]}>{qualification.submitted || 0}/10</Text>
                </View>
                <View style={[s.metaItem, { backgroundColor: colors.panel }]}>
                  <Text style={[s.metaLabel, { color: colors.muted }]}>WINS</Text>
                  <Text style={[s.metaValue, { color: colors.green }]}>{qualification.wins || 0}W</Text>
                </View>
                <View style={[s.metaItem, { backgroundColor: colors.panel }]}>
                  <Text style={[s.metaLabel, { color: colors.muted }]}>LOSSES</Text>
                  <Text style={[s.metaValue, { color: colors.red }]}>{qualification.losses || 0}L</Text>
                </View>
              </View>
            </View>
          ) : null}

          {canStart && !isQualifying ? (
            <Pressable
              disabled={busy === "startQual"}
              style={[s.primary, { backgroundColor: colors.red }, busy === "startQual" && s.disabled]}
              onPress={onStartQualification}
            >
              {busy === "startQual" ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={s.primaryText}>{tx(my, "START 10-MATCH QUALIFICATION", "အရည်အချင်းစစ်ဆေးမှု စတင်မည်")}</Text>
              )}
            </Pressable>
          ) : null}

          {/* Qualification Pick Form */}
          {isQualifying && matches.length > 0 ? (
            <View style={{ marginTop: 10 }}>
              <Text style={[s.sectionTitle, { color: colors.text }]}>{tx(my, "Select Upcoming Match", "ပွဲ ရွေးချယ်ပါ")}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                {matches.slice(0, 10).map((m) => {
                  const isSel = String(m.id) === String(selectedMatch);
                  return (
                    <Pressable
                      key={m.id}
                      style={[
                        s.metaItem,
                        { backgroundColor: isSel ? colors.redSoft : colors.panel, marginRight: 8, minWidth: 140 },
                        isSel && { borderColor: colors.red, borderWidth: 1 },
                      ]}
                      onPress={() => setSelectedMatch(m.id)}
                    >
                      <Text numberOfLines={1} style={[s.metaLabel, { color: isSel ? colors.red : colors.muted }]}>
                        {m.competition || "Match"}
                      </Text>
                      <Text numberOfLines={1} style={[s.metaValue, { color: colors.text, fontSize: 9.5 }]}>
                        {m.home?.name} v {m.away?.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Market Choices */}
              <Text style={[s.sectionTitle, { color: colors.text }]}>{tx(my, "Select Market & Pick", "Market နှင့် ရွေးချယ်မှု")}</Text>
              <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
                {Object.keys(MARKETS).map((mk) => (
                  <Pressable
                    key={mk}
                    style={[
                      s.tab,
                      { paddingVertical: 6, backgroundColor: market === mk ? colors.redSoft : colors.panel },
                      market === mk && { borderColor: colors.red, borderWidth: 1 },
                    ]}
                    onPress={() => {
                      setMarket(mk);
                      setSelection(MARKETS[mk].selections[0][0]);
                    }}
                  >
                    <Text style={[s.tabText, { color: market === mk ? colors.red : colors.muted }]}>{MARKETS[mk].label}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Selections */}
              <View style={{ flexDirection: "row", gap: 6, marginBottom: 10 }}>
                {MARKETS[market]?.selections?.map(([val, label]) => (
                  <Pressable
                    key={val}
                    style={[
                      s.tab,
                      { paddingVertical: 8, backgroundColor: selection === val ? colors.red : colors.card2 },
                    ]}
                    onPress={() => setSelection(val)}
                  >
                    <Text style={[s.tabText, { color: selection === val ? "#FFFFFF" : colors.text }]}>{label}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Analysis */}
              <TextInput
                value={analysis}
                onChangeText={setAnalysis}
                placeholder={my ? "သုံးသပ်ချက် အကျဉ်း ရေးသားပါ (အနည်းဆုံး စကားလုံး ၅ လုံး)..." : "Write brief tipster analysis..."}
                placeholderTextColor={colors.muted2}
                multiline
                numberOfLines={3}
                style={[s.input, { backgroundColor: colors.panel, borderColor: colors.border, color: colors.text, height: 70, textAlignVertical: "top", paddingTop: 8 }]}
              />

              <Pressable
                disabled={busy === "submitQual" || !analysis.trim()}
                style={[s.primary, { backgroundColor: colors.red }, (busy === "submitQual" || !analysis.trim()) && s.disabled]}
                onPress={() =>
                  onSubmitQualificationPick?.({
                    matchId: currentMatch?.id,
                    competition: currentMatch?.competition,
                    homeTeam: currentMatch?.home?.name,
                    awayTeam: currentMatch?.away?.name,
                    kickoff: currentMatch?.kickoff,
                    market,
                    selection,
                    analysis,
                  })
                }
              >
                {busy === "submitQual" ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={s.primaryText}>{tx(my, "SUBMIT QUALIFICATION PICK", "အရည်အချင်းစစ် ပွဲတင်မည်")}</Text>
                )}
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* 3. APPROVED TIPSTER HUB (Publish Tips & Payouts) */}
      {authenticated && isApproved ? (
        <>
          <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.formTitle, { color: colors.text }]}>{tx(my, "Publish Premium Tip", "Premium Tip အသစ်တင်မည်")}</Text>
            <Text style={[s.formSub, { color: colors.muted }]}>
              {tx(my, "Select an upcoming match, choose your market, and set credit price.", "လာမည့်ပွဲ ရွေးချယ်ပြီး Credit ဈေးနှုန်း သတ်မှတ်ပါ။")}
            </Text>

            {matches.length > 0 ? (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                  {matches.slice(0, 10).map((m) => {
                    const isSel = String(m.id) === String(selectedMatch);
                    return (
                      <Pressable
                        key={m.id}
                        style={[
                          s.metaItem,
                          { backgroundColor: isSel ? colors.redSoft : colors.panel, marginRight: 8, minWidth: 140 },
                          isSel && { borderColor: colors.red, borderWidth: 1 },
                        ]}
                        onPress={() => setSelectedMatch(m.id)}
                      >
                        <Text numberOfLines={1} style={[s.metaLabel, { color: isSel ? colors.red : colors.muted }]}>
                          {m.competition || "Match"}
                        </Text>
                        <Text numberOfLines={1} style={[s.metaValue, { color: colors.text, fontSize: 9.5 }]}>
                          {m.home?.name} v {m.away?.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {/* Market & Selection */}
                <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
                  {Object.keys(MARKETS).map((mk) => (
                    <Pressable
                      key={mk}
                      style={[
                        s.tab,
                        { paddingVertical: 6, backgroundColor: market === mk ? colors.redSoft : colors.panel },
                        market === mk && { borderColor: colors.red, borderWidth: 1 },
                      ]}
                      onPress={() => {
                        setMarket(mk);
                        setSelection(MARKETS[mk].selections[0][0]);
                      }}
                    >
                      <Text style={[s.tabText, { color: market === mk ? colors.red : colors.muted }]}>{MARKETS[mk].label}</Text>
                    </Pressable>
                  ))}
                </View>

                <View style={{ flexDirection: "row", gap: 6, marginBottom: 10 }}>
                  {MARKETS[market]?.selections?.map(([val, label]) => (
                    <Pressable
                      key={val}
                      style={[
                        s.tab,
                        { paddingVertical: 8, backgroundColor: selection === val ? colors.red : colors.card2 },
                      ]}
                      onPress={() => setSelection(val)}
                    >
                      <Text style={[s.tabText, { color: selection === val ? "#FFFFFF" : colors.text }]}>{label}</Text>
                    </Pressable>
                  ))}
                </View>

                {/* Price Picker */}
                <Text style={[s.sectionTitle, { color: colors.text }]}>{tx(my, "Set Credit Price", "Credit ဈေးနှုန်း သတ်မှတ်ပါ")}</Text>
                <View style={{ flexDirection: "row", gap: 6, marginBottom: 10 }}>
                  {TIP_PRICES.map((p) => (
                    <Pressable
                      key={p}
                      style={[
                        s.tab,
                        { paddingVertical: 6, backgroundColor: priceCredits === p ? colors.gold : colors.panel },
                      ]}
                      onPress={() => setPriceCredits(p)}
                    >
                      <Text style={[s.tabText, { color: priceCredits === p ? "#000000" : colors.text }]}>{p} CR</Text>
                    </Pressable>
                  ))}
                </View>

                {/* Analysis */}
                <TextInput
                  value={analysis}
                  onChangeText={setAnalysis}
                  placeholder={my ? "အပြည့်အစုံ သုံးသပ်ချက် ရေးသားပါ..." : "Write detailed match analysis..."}
                  placeholderTextColor={colors.muted2}
                  multiline
                  numberOfLines={4}
                  style={[s.input, { backgroundColor: colors.panel, borderColor: colors.border, color: colors.text, height: 80, textAlignVertical: "top", paddingTop: 8 }]}
                />

                <Pressable
                  disabled={busy === "publishTip" || !analysis.trim()}
                  style={[s.primary, { backgroundColor: colors.red }, (busy === "publishTip" || !analysis.trim()) && s.disabled]}
                  onPress={() =>
                    onPublishTip?.({
                      matchId: currentMatch?.id,
                      competition: currentMatch?.competition,
                      homeTeam: currentMatch?.home?.name,
                      awayTeam: currentMatch?.away?.name,
                      kickoff: currentMatch?.kickoff,
                      market,
                      selection,
                      confidence,
                      priceCredits,
                      analysis,
                    })
                  }
                >
                  {busy === "publishTip" ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={s.primaryText}>{tx(my, "PUBLISH TIP FOR SALE", "TIP ရောင်းချမည်")}</Text>
                  )}
                </Pressable>
              </>
            ) : (
              <Text style={[s.empty, { color: colors.muted }]}>Loading upcoming match fixtures...</Text>
            )}
          </View>

          {/* Earnings & Payout Card */}
          <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.formTitle, { color: colors.text }]}>{tx(my, "Tipster Earnings & Payout", "ဝင်ငွေနှင့် ငွေထုတ်ယူမှု")}</Text>
            <View style={[s.walletHero, { backgroundColor: colors.panel, borderColor: colors.gold, minHeight: 90, marginVertical: 8 }]}>
              <View>
                <Text style={[s.eyebrow, { color: colors.gold }]}>AVAILABLE EARNINGS</Text>
                <Text style={[s.walletNumber, { color: colors.text, fontSize: 26 }]}>
                  {Number(me?.wallet?.earnings || tipster.earnings || 0).toLocaleString()} CR
                </Text>
              </View>
              <Pressable
                style={[s.smallAction, { backgroundColor: colors.green, width: 110 }]}
                onPress={() => onRequestPayout?.({ credits: me?.wallet?.earnings || 100, currency: "THB" })}
              >
                <Text style={s.smallActionText}>{tx(my, "PAYOUT", "ငွေထုတ်မည်")}</Text>
              </Pressable>
            </View>
          </View>
        </>
      ) : null}
    </>
  );
}

function PartnerPanel({ me, authenticated, openAccount, my, onClaimReferral, onApplyPartner, busy, colors }) {
  const partner = me?.partner || {};
  const referralCode = partner?.referralCode || `MST${me?.userId || me?.id || "VIP"}`;
  const referralLink = `https://myanmarsportstalk.com/ref/${referralCode}`;
  const isPartner = partner?.status === "active" || Boolean(partner?.referralCode);
  const [claimInput, setClaimInput] = useState("");

  return (
    <>
      {/* 1. PARTNER HERO */}
      <View style={[s.walletHero, { backgroundColor: colors.card, borderColor: colors.gold }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.eyebrow, { color: colors.gold }]}>MST AFFILIATE PARTNER</Text>
          <Text style={[s.walletNumber, { color: colors.text, fontSize: 28 }]}>
            {partner.commissionPercent || 15}%
          </Text>
          <Text style={[s.walletSub, { color: colors.muted }]}>
            {tx(my, "Lifetime Revenue Share on Credit Unlocks", "တစ်သက်တာ ကော်မရှင် ခံစားခွင့်")}
          </Text>
        </View>
        <Ionicons name="people-circle" size={48} color={colors.gold} />
      </View>

      {!authenticated ? (
        <Pressable style={[s.primary, { backgroundColor: colors.red }]} onPress={openAccount}>
          <Text style={s.primaryText}>{tx(my, "SIGN IN TO JOIN PARTNER PROGRAM", "PARTNER အကောင့်ဝင်မည်")}</Text>
        </Pressable>
      ) : null}

      {authenticated ? (
        <>
          {/* 2. REFERRAL CODE & LINK */}
          <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.formTitle, { color: colors.text }]}>{tx(my, "Your Referral Code", "သင့် Referral Code")}</Text>
            <Text style={[s.formSub, { color: colors.muted }]}>
              {tx(
                my,
                "Share your referral code or link with your audience. When they purchase MST Credits, you earn automatic commission.",
                "သင့် ပရိတ်သတ်နှင့် မိတ်ဆွေများအား မျှဝေပါ။ Credits ဝယ်ယူတိုင်း ကော်မရှင် အလိုအလျောက် ရရှိပါမည်။",
              )}
            </Text>
            <View style={[s.payoutRow, { alignItems: "center" }]}>
              <View style={[s.input, { backgroundColor: colors.panel, borderColor: colors.gold, flex: 1, justifyContent: "center", marginBottom: 0 }]}>
                <Text style={{ color: colors.gold, fontWeight: "900", fontSize: 14 }}>{referralCode}</Text>
              </View>
            </View>
            <Text style={[s.metaLabel, { color: colors.muted, marginTop: 8 }]}>REFERRAL LINK: {referralLink}</Text>
          </View>

          {/* 3. PARTNER ANALYTICS */}
          <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.formTitle, { color: colors.text }]}>{tx(my, "Performance Analytics", "ကော်မရှင် ရလဒ်များ")}</Text>
            <View style={s.tipMeta}>
              <View style={[s.metaItem, { backgroundColor: colors.panel }]}>
                <Text style={[s.metaLabel, { color: colors.muted }]}>REFERRALS</Text>
                <Text style={[s.metaValue, { color: colors.text }]}>{partner.totalReferrals || 0}</Text>
              </View>
              <View style={[s.metaItem, { backgroundColor: colors.panel }]}>
                <Text style={[s.metaLabel, { color: colors.muted }]}>UNLOCKS</Text>
                <Text style={[s.metaValue, { color: colors.text }]}>{partner.totalUnlocks || 0}</Text>
              </View>
              <View style={[s.metaItem, { backgroundColor: colors.panel }]}>
                <Text style={[s.metaLabel, { color: colors.muted }]}>EARNED</Text>
                <Text style={[s.metaValue, { color: colors.green }]}>
                  {Number(partner.lifetimeEarnings || 0).toLocaleString()} CR
                </Text>
              </View>
            </View>
          </View>

          {/* 4. CLAIM REFERRAL CODE */}
          <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.formTitle, { color: colors.text }]}>{tx(my, "Claim Inviter Code", "ဖိတ်ကြားသူ Code ထည့်မည်")}</Text>
            <Text style={[s.formSub, { color: colors.muted }]}>
              {tx(my, "Enter a partner's code to bind your account.", "သင့်အား ဖိတ်ကြားသော Partner ၏ code ကို ထည့်ပါ။")}
            </Text>
            <View style={s.payoutRow}>
              <TextInput
                value={claimInput}
                onChangeText={(v) => setClaimInput(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 24))}
                placeholder="MSTXXXXX"
                placeholderTextColor={colors.muted2}
                style={[s.input, { backgroundColor: colors.panel, borderColor: colors.border, color: colors.text, flex: 1, marginBottom: 0 }]}
              />
              <Pressable
                disabled={busy === "claimReferral" || claimInput.length < 4}
                style={[s.smallAction, { backgroundColor: colors.red }, (busy === "claimReferral" || claimInput.length < 4) && s.disabled]}
                onPress={() => onClaimReferral?.(claimInput)}
              >
                {busy === "claimReferral" ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={s.smallActionText}>CLAIM</Text>
                )}
              </Pressable>
            </View>
          </View>

          {/* 5. TIER BREAKDOWN */}
          <View style={[s.infoCard, { backgroundColor: colors.panel, borderColor: colors.border }]}>
            <Text style={[s.infoTitle, { color: colors.gold }]}>PARTNER TIERS & COMMISSION</Text>
            <Text style={[s.infoText, { color: colors.text2 }]}>
              • Tier 1 (1–20 Referrals): 10% Revenue Share{"\n"}
              • Tier 2 (21–100 Referrals): 15% Revenue Share{"\n"}
              • VIP Tier (100+ Referrals): 25% Lifetime Revenue Share
            </Text>
          </View>
        </>
      ) : null}
    </>
  );
}

export default function TipsScreen({ language = "my", openAccount }) {
  const { colors } = useTheme();
  const my = language !== "en";
  const [tab, setTab] = useState("TIPS");
  const [auth, setAuth] = useState(false);
  const [tips, setTips] = useState([]);
  const [tipsters, setTipsters] = useState([]);
  const [creditPackages, setCreditPackages] = useState([]);
  const [me, setMe] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadMatches = useCallback(async (force = false) => {
    const dates = [bangkokDate(0), bangkokDate(1), bangkokDate(2), bangkokDate(3)];
    prefetchFastFootballMatches(dates);
    const rows = [];
    for (const date of dates) {
      try {
        const cached = peekFastFootballMatches(date);
        const data = cached?.matches?.length && !force ? cached.matches : (await fetchFastFootballMatches({ date, force })).matches || [];
        rows.push(...data);
      } catch (_) {}
    }
    const now = Date.now();
    const seen = new Set();
    setMatches(
      rows
        .filter((m) => {
          if (!m?.id || seen.has(String(m.id))) return false;
          seen.add(String(m.id));
          return m.kickoff && new Date(m.kickoff).getTime() > now;
        })
        .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff)),
    );
  }, []);

  const load = useCallback(
    async (refresh = false) => {
      refresh ? setRefreshing(true) : setLoading(true);
      setError("");
      try {
        const a = await getAuthStatus().catch(() => ({ authenticated: false }));
        setAuth(Boolean(a.authenticated));
        const [tipsData, tipsterData, meData, packageData] = await Promise.all([
          getTips({ limit: 60 }).catch(() => []),
          getTipsters({ limit: 60 }).catch(() => []),
          a.authenticated ? getTipsMe().catch(() => null) : Promise.resolve(null),
          getCreditPackages().catch(() => []),
        ]);
        setTips(Array.isArray(tipsData) ? tipsData : []);
        setTipsters(Array.isArray(tipsterData) ? tipsterData : []);
        setMe(meData);
        setCreditPackages(Array.isArray(packageData) ? packageData : []);
        // Pre-load upcoming matches only when this signed-in account can use
        // tip submission or qualification. Public Tips browsing stays fast.
        const needsMatches = Boolean(
          a.authenticated &&
            (meData?.tipster?.status === "approved" ||
              meData?.qualification?.status === "active" ||
              meData?.qualification?.status === "not_started" ||
              meData?.qualification?.canStart),
        );
        if (needsMatches) await loadMatches(refresh);
      } catch (e) {
        setError(e?.message || "Could not load MST Tips.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loadMatches],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const action = async (key, fn, success) => {
    setBusy(key);
    setMessage("");
    setError("");
    try {
      await fn();
      if (success) setMessage(success);
      await load(false);
    } catch (e) {
      setError(e?.message || "Action failed.");
    } finally {
      setBusy("");
    }
  };

  const doUnlock = (tip) => {
    if (!auth) {
      openAccount?.();
      return;
    }
    return action(`unlock:${tip.id}`, () => unlockTip(tip.id), `${tip.priceCredits} Credits used · Tip unlocked.`);
  };

  const doBuyPack = (packageId) => {
    if (!auth) {
      openAccount?.();
      return;
    }
    return action(
      `pack:${packageId}`,
      async () => {
        const result = await purchaseCredits(packageId);
        return result;
      },
      `Purchased Credits successfully · Balance updated.`,
    );
  };

  const doStartQualification = () => {
    return action(
      "startQual",
      () => startTipsterQualification(),
      "Qualification started! Submit 10 match picks with at least 7 wins.",
    );
  };

  const doSubmitQualificationPick = (input) => {
    return action(
      "submitQual",
      () => submitQualificationTip(input),
      "Qualification pick submitted successfully!",
    );
  };

  const doPublishTip = (input) => {
    return action(
      "publishTip",
      () => publishTip(input),
      "Premium Tip published successfully for sale in Marketplace!",
    );
  };

  const doRequestPayout = ({ credits, currency }) => {
    return action(
      "payout",
      () => requestTipsterPayout({ credits, currency }),
      "Payout request submitted successfully!",
    );
  };

  const doClaimReferral = (code) => {
    return action(
      "claimReferral",
      () => claimPartnerReferral(code),
      `Successfully linked to Partner code ${code}!`,
    );
  };

  const doApplyPartner = (input) => {
    return action(
      "applyPartner",
      () => applyTipsterPartner(input),
      "Partner application submitted!",
    );
  };

  return (
    <View style={[s.screen, { backgroundColor: colors.bg }]}>
      <View style={[s.header, { borderBottomColor: colors.border2 }]}>
        <View>
          <Text style={[s.title, { color: colors.text }]}>MST Tips</Text>
          <Text style={[s.subtitle, { color: colors.muted }]}>
            {tx(my, "Verified football analysis marketplace", "Verified ဘောလုံးသုံးသပ်ချက် Marketplace")}
          </Text>
        </View>
        <View style={[s.headerCoin, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="diamond-outline" size={17} color={colors.gold} />
          <Text style={[s.headerCoinText, { color: colors.gold }]}>
            {auth ? Number(me?.wallet?.balance || 0).toLocaleString() : "—"}
          </Text>
        </View>
      </View>

      <View style={[s.tabs, { borderBottomColor: colors.border2 }]}>
        {TABS.map((x) => (
          <Pressable key={x} style={[s.tab, tab === x && { backgroundColor: colors.redSoft }]} onPress={() => setTab(x)}>
            <Text numberOfLines={1} style={[s.tabText, { color: colors.muted }, tab === x && { color: colors.red }]}>
              {x}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.red} colors={[colors.red]} />
        }
      >
        {message ? (
          <View style={[s.message, { backgroundColor: "rgba(34,199,119,.08)", borderColor: "rgba(34,199,119,.2)" }]}>
            <Ionicons name="checkmark-circle-outline" size={16} color={colors.green} />
            <Text style={[s.messageText, { color: colors.green }]}>{message}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={[s.errorBox, { backgroundColor: colors.redSoft, borderColor: colors.red }]}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.red} />
            <Text style={[s.errorText, { color: colors.red }]}>{error}</Text>
          </View>
        ) : null}

        {tab === "TIPS" ? (
          <>
            <View style={[s.marketHero, { backgroundColor: colors.card, borderColor: colors.red }]}>
              <View style={{ flex: 1 }}>
                <Text style={[s.eyebrow, { color: colors.red }]}>PREMIUM FOOTBALL ANALYSIS</Text>
                <Text style={[s.marketHeroTitle, { color: colors.text }]}>
                  {tx(my, "Pay for analysis, never a guaranteed result.", "Analysis အတွက်ပေးချေခြင်းဖြစ်ပြီး အနိုင်ရလဒ်အာမခံမဟုတ်ပါ။")}
                </Text>
                <Text style={[s.marketHeroSub, { color: colors.muted }]}>
                  Private 7/10 qualification · MST approval · verified record · permanent wins and losses
                </Text>
              </View>
              <Ionicons name="analytics-outline" size={33} color={colors.red} />
            </View>
            {tips.length ? (
              tips.map((t) => (
                <TipCard
                  key={t.id}
                  tip={t}
                  authenticated={auth}
                  openAccount={openAccount}
                  onUnlock={doUnlock}
                  unlocking={busy === `unlock:${t.id}`}
                  my={my}
                  colors={colors}
                />
              ))
            ) : !loading ? (
              <Text style={[s.empty, { color: colors.muted }]}>No premium Tips published yet.</Text>
            ) : null}
          </>
        ) : null}

        {tab === "TIPSTERS" ? (
          <>
            <View style={s.sectionHeader}>
              <Text style={[s.sectionTitle, { color: colors.text }]}>VERIFIED TIPSTERS</Text>
              <Text style={[s.sectionSub, { color: colors.muted }]}>{tipsters.length} approved</Text>
            </View>
            {tipsters.length ? (
              tipsters.map((x) => <TipsterCard key={x.userId} item={x} colors={colors} />)
            ) : (
              <Text style={[s.empty, { color: colors.muted }]}>No approved Tipsters yet.</Text>
            )}
          </>
        ) : null}

        {tab === "CREDITS" ? (
          <CreditPanel
            me={me}
            packages={creditPackages}
            authenticated={auth}
            openAccount={openAccount}
            my={my}
            onClaimReferral={doClaimReferral}
            onBuyPack={doBuyPack}
            loading={busy === "claimReferral"}
            buyingPack={busy.startsWith("pack:") ? busy.slice(5) : ""}
            colors={colors}
          />
        ) : null}

        {tab === "TIPSTER" ? (
          <TipsterPanel
            me={me}
            authenticated={auth}
            openAccount={openAccount}
            my={my}
            matches={matches}
            onStartQualification={doStartQualification}
            onSubmitQualificationPick={doSubmitQualificationPick}
            onPublishTip={doPublishTip}
            onRequestPayout={doRequestPayout}
            busy={busy}
            colors={colors}
          />
        ) : null}

        {tab === "PARTNER" ? (
          <PartnerPanel
            me={me}
            authenticated={auth}
            openAccount={openAccount}
            my={my}
            onClaimReferral={doClaimReferral}
            onApplyPartner={doApplyPartner}
            busy={busy}
            colors={colors}
          />
        ) : null}
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
  subtitle: { fontSize: 9.5, marginTop: 2 },
  headerCoin: { height: 34, paddingHorizontal: 11, borderRadius: 17, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  headerCoinText: { fontSize: 11, fontWeight: "900" },
  tabs: { height: 48, padding: 5, flexDirection: "row", gap: 2, borderBottomWidth: 1 },
  tab: { flex: 1, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 1 },
  tabText: { fontSize: 9, fontWeight: "900" },
  content: { padding: 12, paddingBottom: 40 },
  empty: { fontSize: 10.5, textAlign: "center", padding: 16 },
  message: { minHeight: 38, borderRadius: 9, paddingHorizontal: 11, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 8 },
  messageText: { flex: 1, fontSize: 10 },
  errorBox: { minHeight: 38, borderRadius: 9, paddingHorizontal: 11, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 8 },
  errorText: { flex: 1, fontSize: 10 },
  marketHero: { minHeight: 110, borderRadius: 14, borderWidth: 1, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  eyebrow: { fontSize: 8, fontWeight: "900", letterSpacing: 0.9, marginBottom: 4 },
  marketHeroTitle: { fontSize: 14, fontWeight: "900", lineHeight: 19, maxWidth: 270 },
  marketHeroSub: { fontSize: 9, lineHeight: 14, marginTop: 5 },
  tipCard: { borderRadius: 13, borderWidth: 1, padding: 12, marginBottom: 10 },
  tipTop: { flexDirection: "row", alignItems: "center" },
  competition: { fontSize: 11, fontWeight: "800" },
  kickoff: { fontSize: 9, marginTop: 2 },
  resultBadge: { minWidth: 45, height: 23, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 7 },
  resultText: { fontSize: 8, fontWeight: "900" },
  matchRow: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1 },
  matchTeam: { flex: 1, fontSize: 12.5, fontWeight: "900" },
  vs: { fontSize: 8.5, fontWeight: "900" },
  tipsterRow: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 9 },
  tipsterAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  tipsterName: { fontSize: 11, fontWeight: "800" },
  inline: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  levelBadge: { height: 21, borderRadius: 11, borderWidth: 1, paddingHorizontal: 6, flexDirection: "row", alignItems: "center", gap: 3 },
  levelText: { fontSize: 7.5, fontWeight: "900" },
  streak: { fontSize: 9, fontWeight: "900" },
  winBox: { alignItems: "flex-end" },
  winNum: { fontSize: 14, fontWeight: "900" },
  winLabel: { fontSize: 7, fontWeight: "900" },
  tipMeta: { flexDirection: "row", gap: 6, marginBottom: 9 },
  metaItem: { flex: 1, minHeight: 47, borderRadius: 8, padding: 8, justifyContent: "space-between" },
  metaLabel: { fontSize: 7.5, fontWeight: "800" },
  metaValue: { fontSize: 10.5, fontWeight: "900" },
  lockedBox: { borderRadius: 10, borderWidth: 1, padding: 10, flexDirection: "row", alignItems: "center", gap: 9 },
  lockedTitle: { fontSize: 10.5, fontWeight: "800" },
  lockedText: { fontSize: 8.5, lineHeight: 13, marginTop: 2 },
  unlockButton: { minWidth: 64, height: 46, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  unlockPrice: { fontSize: 16, fontWeight: "900", color: "#FFFFFF" },
  unlockSmall: { fontSize: 7, fontWeight: "900", color: "#FFFFFF", opacity: 0.85 },
  revealed: { borderRadius: 10, borderWidth: 1, padding: 11 },
  pickHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  marketName: { fontSize: 8, fontWeight: "900" },
  pick: { fontSize: 13.5, fontWeight: "900" },
  analysis: { fontSize: 10.5, lineHeight: 16, marginTop: 8 },
  disclaimer: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 },
  disclaimerText: { flex: 1, fontSize: 8 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 6 },
  sectionTitle: { fontSize: 11.5, fontWeight: "900", marginVertical: 8 },
  sectionSub: { fontSize: 9 },
  personCard: { minHeight: 96, borderRadius: 12, borderWidth: 1, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  personAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  personName: { fontSize: 12, fontWeight: "900" },
  personBio: { fontSize: 8.5, lineHeight: 13, marginTop: 3 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  ratingValue: { fontSize: 10.5, fontWeight: "900" },
  ratingCountText: { fontSize: 8.5, fontWeight: "600" },
  qualificationMini: { fontSize: 8, fontWeight: "800", marginTop: 3 },
  partnerBadge: { height: 19, borderRadius: 9, paddingHorizontal: 6, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 3 },
  partnerBadgeText: { fontSize: 7, fontWeight: "900" },
  personStats: { alignItems: "flex-end" },
  personRate: { fontSize: 15, fontWeight: "900" },
  personMini: { fontSize: 8, marginTop: 2 },
  walletHero: { minHeight: 120, borderRadius: 14, borderWidth: 1, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  walletNumber: { fontSize: 34, fontWeight: "900", letterSpacing: -1 },
  walletSub: { fontSize: 9.5, marginTop: 2 },
  creditCoin: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  coinText: { fontSize: 15, fontWeight: "900", fontStyle: "italic" },
  infoCard: { borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 10 },
  infoTitle: { fontSize: 9.5, fontWeight: "900" },
  reference: { fontSize: 18, fontWeight: "900", marginTop: 4 },
  infoText: { fontSize: 9.5, lineHeight: 14, marginTop: 6 },
  packGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  pack: { width: "48%", minHeight: 120, borderRadius: 11, borderWidth: 1, padding: 12, justifyContent: "space-between", position: "relative" },
  packCredits: { fontSize: 22, fontWeight: "900" },
  packLabel: { fontSize: 8, fontWeight: "900" },
  packPrice: { fontSize: 10.5, marginTop: 4 },
  popularTag: { position: "absolute", top: 6, right: 6, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  popularText: { fontSize: 7, fontWeight: "900", color: "#000" },
  buyBtn: { height: 30, borderRadius: 6, alignItems: "center", justifyContent: "center", marginTop: 8 },
  buyBtnText: { fontSize: 9.5, fontWeight: "900", color: "#FFFFFF" },
  pendingCard: { marginTop: 10, borderRadius: 11, borderWidth: 1, padding: 12, flexDirection: "row", gap: 9 },
  pendingTitle: { fontSize: 10.5, fontWeight: "800" },
  pendingText: { fontSize: 8.8, lineHeight: 13, marginTop: 3 },
  formCard: { borderRadius: 13, borderWidth: 1, padding: 13, marginBottom: 10 },
  formTitle: { fontSize: 14.5, fontWeight: "900" },
  formSub: { fontSize: 9.5, lineHeight: 14, marginTop: 4, marginBottom: 10 },
  input: { height: 44, borderRadius: 9, borderWidth: 1, paddingHorizontal: 11, fontSize: 11.5, marginBottom: 2 },
  primary: { minHeight: 42, borderRadius: 9, alignItems: "center", justifyContent: "center", marginTop: 12, paddingHorizontal: 12 },
  primaryText: { fontSize: 10, fontWeight: "900", color: "#FFFFFF", textAlign: "center" },
  disabled: { opacity: 0.35 },
  smallAction: { width: 86, height: 44, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  smallActionText: { fontSize: 9, fontWeight: "900", color: "#FFFFFF" },
  payoutRow: { flexDirection: "row", gap: 7 },
});
