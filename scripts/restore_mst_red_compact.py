from pathlib import Path
import re

path = Path("App.js")
s = path.read_text()

# Restore the exact original MST red / black / white palette.
start = s.index("const COLORS = {")
end = s.index("// -------------------------------------------------------\n// IMAGE HELPERS", start)
original_theme = '''const COLORS = {
  background: "#080A0C",
  backgroundSoft: "#0B0E10",
  card: "#111416",
  card2: "#15191C",
  card3: "#191D20",
  border: "#24292D",
  borderSoft: "#1D2226",

  red: "#F3262D",
  redDark: "#C91C23",
  redSoft: "rgba(243,38,45,0.14)",

  text: "#FFFFFF",
  textSoft: "#D0D2D4",
  muted: "#92979B",
  muted2: "#666D72",

  green: "#31C674",
  yellow: "#F5C542",
  blue: "#4496FF",
};

'''
s = s[:start] + original_theme + s[end:]

# Return all migrated primary/live UI tokens to the original red token.
for old, new in [
    ("COLORS.brandSoft", "COLORS.redSoft"),
    ("COLORS.brandDark", "COLORS.redDark"),
    ("COLORS.brand", "COLORS.red"),
    ("COLORS.liveSoft", "COLORS.redSoft"),
    ("COLORS.liveDark", "COLORS.redDark"),
    ("COLORS.live", "COLORS.red"),
]:
    s = s.replace(old, new)

# Restore the simple text MST mark (no website image logo).
logo_pattern = re.compile(r'''function Logo\(\) \{\n  return \(\n    <View style=\{styles\.logoWrap\}>\n      <Image\n        source=\{\{ uri: MST_LOGO \}\}\n        resizeMode="contain"\n        style=\{styles\.logoImage\}\n        accessibilityLabel="Myanmar Sports Talk"\n      />\n    </View>\n  \);\n\}''')
logo_replacement = '''function Logo() {
  return (
    <View style={styles.logoWrap}>
      <Text style={styles.logoText}>MST</Text>
      <Text style={styles.logoSub}>MYANMAR SPORTS TALK</Text>
    </View>
  );
}'''
s, n = logo_pattern.subn(logo_replacement, s)
if n != 1:
    raise SystemExit(f"Expected to replace one Logo component, replaced {n}")

# Add a fifth live match: one major league per card across the first five cards.
needle = '''    homeScore: 0,
    awayScore: 0,
  },
];

const UPCOMING_MATCHES = ['''
replacement = '''    homeScore: 0,
    awayScore: 0,
  },
  {
    id: 5,
    competition: "BUNDESLIGA",
    status: "LIVE",
    minute: "71'",
    home: {
      name: "Borussia Dortmund",
      short: "BVB",
      logo: teamLogo(165),
    },
    away: {
      name: "Bayer Leverkusen",
      short: "B04",
      logo: teamLogo(168),
    },
    homeScore: 1,
    awayScore: 2,
  },
];

const UPCOMING_MATCHES = ['''
if needle not in s:
    raise SystemExit("Could not find LIVE_MATCHES end")
s = s.replace(needle, replacement, 1)

# Make the live cards more compact so five cards do not feel huge.
s = s.replace('''          <TeamLogo uri={match.home.logo} size={44} />''', '''          <TeamLogo uri={match.home.logo} size={38} />''')
s = s.replace('''          <TeamLogo uri={match.away.logo} size={44} />''', '''          <TeamLogo uri={match.away.logo} size={38} />''')

# Fix Android logo/header placement by explicitly clearing the status bar.
header_start = s.index("  mainHeader: {")
header_end = s.index("  headerIcons: {", header_start)
header_styles = '''  mainHeader: {
    minHeight: Platform.OS === "android" ? 96 : 82,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 7 : 8,
    paddingBottom: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  logoWrap: {
    width: 132,
    minHeight: 46,
    justifyContent: "center",
  },

  logoText: {
    color: COLORS.red,
    fontSize: 34,
    lineHeight: 35,
    fontWeight: "900",
    fontStyle: "italic",
    letterSpacing: -2,
  },

  logoSub: {
    color: COLORS.text,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
  },

'''
s = s[:header_start] + header_styles + s[header_end:]

# Restore first-version header tab surface (same base background, no green-tinted header surface).
s = s.replace('''  headerTabs: {
    flexDirection: "row",
    paddingHorizontal: 14,
    backgroundColor: COLORS.backgroundSoft,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },''', '''  headerTabs: {
    flexDirection: "row",
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },''')

# Compact live match cards while retaining the exact first-version color system.
s = s.replace('''  matchCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 13,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },''', '''  matchCard: {
    backgroundColor: COLORS.card,
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 9,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },''')

s = s.replace('''  competitionLabel: {
    color: COLORS.textSoft,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.2,
  },''', '''  competitionLabel: {
    color: COLORS.textSoft,
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 0.2,
  },''')

s = s.replace('''  matchTeams: {
    marginTop: 11,
    flexDirection: "row",
    alignItems: "center",
  },''', '''  matchTeams: {
    marginTop: 7,
    flexDirection: "row",
    alignItems: "center",
  },''')

s = s.replace('''  matchTeamName: {
    color: COLORS.text,
    fontSize: 11,
    marginTop: 5,
    textAlign: "center",
  },''', '''  matchTeamName: {
    color: COLORS.text,
    fontSize: 10.5,
    marginTop: 3,
    textAlign: "center",
  },''')

s = s.replace('''  scoreCenter: {
    width: 100,
    alignItems: "center",
  },''', '''  scoreCenter: {
    width: 88,
    alignItems: "center",
  },''')

s = s.replace('''  bigScore: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 1,
  },''', '''  bigScore: {
    color: COLORS.text,
    fontSize: 27,
    fontWeight: "800",
    letterSpacing: 0.8,
  },''')

s = s.replace('''  aggregateText: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 6,
  },''', '''  aggregateText: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 3,
  },''')

# Validation: website logo/green primary migration must be gone.
for forbidden in ["MST_LOGO", "MST_WEBSITE", "COLORS.brand", "COLORS.live", "logoImage"]:
    if forbidden in s:
        raise SystemExit(f"Unexpected leftover token: {forbidden}")
if 'id: 5' not in s or 'Borussia Dortmund' not in s:
    raise SystemExit("Fifth live match not added")
if '(StatusBar.currentHeight || 24) + 7' not in s:
    raise SystemExit("Android safe status-bar header fix missing")

path.write_text(s)
print("Restored MST red theme, fixed header alignment, and added compact fifth live match")
