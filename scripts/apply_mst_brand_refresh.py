from pathlib import Path

path = Path("App.js")
s = path.read_text()

old_theme = '''const COLORS = {
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
new_theme = '''const COLORS = {
  // MST website / logo palette
  background: "#05090A",
  backgroundSoft: "#081012",
  card: "#0C1416",
  card2: "#101A1D",
  card3: "#142024",
  border: "#203036",
  borderSoft: "#172329",

  // Primary MST brand accent from the real green logo
  brand: "#78C800",
  brandDark: "#5DA300",
  brandSoft: "rgba(120,200,0,0.14)",

  // Red is reserved for genuinely live / breaking states
  live: "#FF3138",
  liveDark: "#D92128",
  liveSoft: "rgba(255,49,56,0.14)",

  text: "#F7FAF8",
  textSoft: "#D6DEDA",
  muted: "#8B9892",
  muted2: "#5F6B67",

  yellow: "#F5C542",
  blue: "#4496FF",
};

const MST_WEBSITE = "https://myanmarsportstalk.com";
const MST_LOGO = `${MST_WEBSITE}/media/myanmar-sports-talk-logo-v2.webp`;
'''
if old_theme in s:
    s = s.replace(old_theme, new_theme)

old_logo = '''function Logo() {
  return (
    <View>
      <Text style={styles.logoText}>MST</Text>
      <Text style={styles.logoSub}>MYANMAR SPORTS TALK</Text>
    </View>
  );
}
'''
new_logo = '''function Logo() {
  return (
    <View style={styles.logoWrap}>
      <Image
        source={{ uri: MST_LOGO }}
        resizeMode="contain"
        style={styles.logoImage}
        accessibilityLabel="Myanmar Sports Talk"
      />
    </View>
  );
}
'''
if old_logo in s:
    s = s.replace(old_logo, new_logo)

component_replacements = {
    'color={selected ? COLORS.red : COLORS.muted}': 'color={selected ? COLORS.brand : COLORS.muted}',
    'color={COLORS.red}\n            />\n\n            <View style={styles.transferClubBox}>': 'color={COLORS.brand}\n            />\n\n            <View style={styles.transferClubBox}>',
    'favorite ? COLORS.red : COLORS.muted': 'favorite ? COLORS.brand : COLORS.muted',
    '<Ionicons name="star" size={20} color={COLORS.red} />': '<Ionicons name="star" size={20} color={COLORS.brand} />',
    'name="compass-outline"\n            size={25}\n            color={COLORS.red}': 'name="compass-outline"\n            size={25}\n            color={COLORS.brand}',
    'name="information-circle-outline"\n            size={21}\n            color={COLORS.red}': 'name="information-circle-outline"\n            size={21}\n            color={COLORS.brand}',
}
for old, new in component_replacements.items():
    s = s.replace(old, new)

style_replacements = {
    '    backgroundColor: COLORS.red,\n    borderWidth: 1,\n    borderColor: COLORS.background,': '    backgroundColor: COLORS.live,\n    borderWidth: 1,\n    borderColor: COLORS.background,',
    '  headerTabTextActive: {\n    color: COLORS.red,': '  headerTabTextActive: {\n    color: COLORS.brand,',
    '    borderRadius: 2,\n    backgroundColor: COLORS.red,\n  },\n\n  simpleTopHeader:': '    borderRadius: 2,\n    backgroundColor: COLORS.brand,\n  },\n\n  simpleTopHeader:',
    '  redDot: {\n    width: 8,\n    height: 8,\n    borderRadius: 5,\n    backgroundColor: COLORS.red,': '  redDot: {\n    width: 8,\n    height: 8,\n    borderRadius: 5,\n    backgroundColor: COLORS.live,',
    '  liveBadge: {\n    backgroundColor: COLORS.red,': '  liveBadge: {\n    backgroundColor: COLORS.live,',
    '  allScoresText: {\n    color: COLORS.red,': '  allScoresText: {\n    color: COLORS.brand,',
    '  pillActive: {\n    backgroundColor: COLORS.red,': '  pillActive: {\n    backgroundColor: COLORS.brand,',
    '    borderRadius: 3,\n    backgroundColor: COLORS.red,\n    marginBottom: 8,': '    borderRadius: 3,\n    backgroundColor: COLORS.live,\n    marginBottom: 8,',
    '  transferStatus: {\n    color: COLORS.red,': '  transferStatus: {\n    color: COLORS.brand,',
    '  dateTabActive: {\n    backgroundColor: COLORS.redSoft,': '  dateTabActive: {\n    backgroundColor: COLORS.brandSoft,',
    '  dateTabTextActive: {\n    color: COLORS.red,': '  dateTabTextActive: {\n    color: COLORS.brand,',
    '  segmentItemActive: {\n    backgroundColor: COLORS.red,': '  segmentItemActive: {\n    backgroundColor: COLORS.brand,',
    '    backgroundColor: COLORS.redSoft,\n    flexDirection: "row",\n    alignItems: "center",': '    backgroundColor: COLORS.brandSoft,\n    flexDirection: "row",\n    alignItems: "center",',
    '    backgroundColor: COLORS.redSoft,\n    borderRadius: 8,\n    padding: 10,': '    backgroundColor: COLORS.brandSoft,\n    borderRadius: 8,\n    padding: 10,',
    '  predictionButtonActive: {\n    backgroundColor: COLORS.red,\n    borderColor: COLORS.red,': '  predictionButtonActive: {\n    backgroundColor: COLORS.brand,\n    borderColor: COLORS.brand,',
    '  detailLiveTime: {\n    color: COLORS.red,': '  detailLiveTime: {\n    color: COLORS.live,',
    '  matchDetailTabTextActive: {\n    color: COLORS.red,': '  matchDetailTabTextActive: {\n    color: COLORS.brand,',
    '    right: 1,\n    backgroundColor: COLORS.red,\n  },\n\n  timeline:': '    right: 1,\n    backgroundColor: COLORS.brand,\n  },\n\n  timeline:',
    '  leagueTabTextActive: {\n    color: COLORS.red,': '  leagueTabTextActive: {\n    color: COLORS.brand,',
    '    height: 2,\n    backgroundColor: COLORS.red,\n  },\n\n  tableWrap:': '    height: 2,\n    backgroundColor: COLORS.brand,\n  },\n\n  tableWrap:',
    '  playerTabTextActive: {\n    color: COLORS.red,': '  playerTabTextActive: {\n    color: COLORS.brand,',
    '    right: 5,\n    height: 2,\n    backgroundColor: COLORS.red,\n  },\n\n  playerSeasonStats:': '    right: 5,\n    height: 2,\n    backgroundColor: COLORS.brand,\n  },\n\n  playerSeasonStats:',
    '  bottomNavTextActive: {\n    color: COLORS.red,': '  bottomNavTextActive: {\n    color: COLORS.brand,',
    '    backgroundColor: "rgba(243,38,45,0.92)",': '    backgroundColor: "rgba(120,200,0,0.92)",',
}
for old, new in style_replacements.items():
    s = s.replace(old, new)

old_header = '''  mainHeader: {
    minHeight: 82,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 12 : 8,
    paddingBottom: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  logoText: {
    color: COLORS.red,
    fontSize: 34,
    fontWeight: "900",
    fontStyle: "italic",
    letterSpacing: -2,
  },

  logoSub: {
    marginTop: -1,
    color: COLORS.text,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
'''
new_header = '''  mainHeader: {
    minHeight: 76,
    paddingHorizontal: 18,
    paddingTop: Platform.OS === "android" ? 10 : 6,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.backgroundSoft,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },

  logoWrap: {
    width: 128,
    height: 42,
    justifyContent: "center",
  },

  logoImage: {
    width: 122,
    height: 38,
  },

  logoText: {
    color: COLORS.brand,
    fontSize: 34,
    fontWeight: "900",
    fontStyle: "italic",
    letterSpacing: -2,
  },

  logoSub: {
    marginTop: -1,
    color: COLORS.text,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
'''
if old_header in s:
    s = s.replace(old_header, new_header)

s = s.replace('''  headerTabs: {
    flexDirection: "row",
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },''', '''  headerTabs: {
    flexDirection: "row",
    paddingHorizontal: 14,
    backgroundColor: COLORS.backgroundSoft,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },''')

s = s.replace('''  matchCard: {
    backgroundColor: COLORS.card,
    borderRadius: 9,
    padding: 12,
    marginBottom: 7,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },''', '''  matchCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 13,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },''')

s = s.replace('''  bottomNav: {
    height: Platform.OS === "ios" ? 73 : 68,
    backgroundColor: "#0B0D0F",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: "row",
    paddingTop: 6,
    paddingBottom: Platform.OS === "ios" ? 8 : 5,
  },''', '''  bottomNav: {
    height: Platform.OS === "ios" ? 73 : 68,
    backgroundColor: COLORS.backgroundSoft,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: "row",
    paddingTop: 6,
    paddingBottom: Platform.OS === "ios" ? 8 : 5,
  },''')

remaining = [line for line in s.splitlines() if "COLORS.red" in line or "redSoft" in line]
if remaining:
    raise SystemExit("Unmigrated old red tokens: " + repr(remaining))

if "MST_LOGO" not in s or "COLORS.brand" not in s or "COLORS.live" not in s:
    raise SystemExit("Brand refresh did not apply correctly")

path.write_text(s)
print("MST brand refresh applied")
