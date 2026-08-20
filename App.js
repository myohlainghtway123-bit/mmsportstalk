// App.js
// Myanmar Sports Talk — MST Mobile App Prototype
// React Native / Expo
//
// Navigation structure:
//
// HEADER
// LIVE SCORES · NEWS · VIDEOS · TRANSFERS
//
// FOOTER
// Home · Scores · Favorites · Prediction · More

import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  ImageBackground,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Platform,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

// -------------------------------------------------------
// THEME
// -------------------------------------------------------

const COLORS = {
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

// -------------------------------------------------------
// IMAGE HELPERS
// -------------------------------------------------------

const teamLogo = (id) =>
  `https://media.api-sports.io/football/teams/${id}.png`;

const PLAYER_IMAGE =
  "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1000&q=85";

const NEWS_HERO =
  "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1200&q=85";

// -------------------------------------------------------
// DATA
// -------------------------------------------------------

const LIVE_MATCHES = [
  {
    id: 1,
    competition: "UEFA CHAMPIONS LEAGUE",
    status: "LIVE",
    minute: "78'",
    home: {
      name: "Real Madrid",
      short: "RMA",
      logo: teamLogo(541),
    },
    away: {
      name: "Bayern Munich",
      short: "BAY",
      logo: teamLogo(157),
    },
    homeScore: 2,
    awayScore: 1,
    aggregate: "Agg 2 - 2",
  },
  {
    id: 2,
    competition: "PREMIER LEAGUE",
    status: "LIVE",
    minute: "63'",
    home: {
      name: "Liverpool",
      short: "LIV",
      logo: teamLogo(40),
    },
    away: {
      name: "Arsenal",
      short: "ARS",
      logo: teamLogo(42),
    },
    homeScore: 1,
    awayScore: 0,
  },
  {
    id: 3,
    competition: "SERIE A",
    status: "LIVE",
    minute: "55'",
    home: {
      name: "AC Milan",
      short: "MIL",
      logo: teamLogo(489),
    },
    away: {
      name: "Inter Milan",
      short: "INT",
      logo: teamLogo(505),
    },
    homeScore: 1,
    awayScore: 1,
  },
  {
    id: 4,
    competition: "LALIGA",
    status: "LIVE",
    minute: "HT",
    home: {
      name: "Barcelona",
      short: "BAR",
      logo: teamLogo(529),
    },
    away: {
      name: "Real Sociedad",
      short: "RSO",
      logo: teamLogo(548),
    },
    homeScore: 0,
    awayScore: 0,
  },
];

const UPCOMING_MATCHES = [
  {
    id: 101,
    competition: "PREMIER LEAGUE",
    date: "Today",
    time: "20:00",
    home: {
      name: "Manchester City",
      logo: teamLogo(50),
    },
    away: {
      name: "Chelsea",
      logo: teamLogo(49),
    },
  },
  {
    id: 102,
    competition: "PREMIER LEAGUE",
    date: "Today",
    time: "22:30",
    home: {
      name: "Manchester United",
      logo: teamLogo(33),
    },
    away: {
      name: "Liverpool",
      logo: teamLogo(40),
    },
  },
  {
    id: 103,
    competition: "LALIGA",
    date: "Tomorrow",
    time: "02:00",
    home: {
      name: "Real Madrid",
      logo: teamLogo(541),
    },
    away: {
      name: "Barcelona",
      logo: teamLogo(529),
    },
  },
  {
    id: 104,
    competition: "SERIE A",
    date: "Tomorrow",
    time: "23:30",
    home: {
      name: "Inter Milan",
      logo: teamLogo(505),
    },
    away: {
      name: "Juventus",
      logo: teamLogo(496),
    },
  },
  {
    id: 105,
    competition: "UEFA CHAMPIONS LEAGUE",
    date: "Aug 23",
    time: "02:00",
    home: {
      name: "Bayern Munich",
      logo: teamLogo(157),
    },
    away: {
      name: "Arsenal",
      logo: teamLogo(42),
    },
  },
];

const COMPETITIONS = [
  {
    id: "ucl",
    name: "Champions League",
    icon: "soccer",
    country: "Europe",
  },
  {
    id: "pl",
    name: "Premier League",
    icon: "crown-outline",
    country: "England",
  },
  {
    id: "laliga",
    name: "LaLiga",
    icon: "soccer-field",
    country: "Spain",
  },
  {
    id: "seriea",
    name: "Serie A",
    icon: "shield-outline",
    country: "Italy",
  },
  {
    id: "bundesliga",
    name: "Bundesliga",
    icon: "run-fast",
    country: "Germany",
  },
];

const LEAGUES = [
  {
    id: "ucl",
    name: "UEFA Champions League",
    country: "🇪🇺",
  },
  {
    id: "pl",
    name: "Premier League",
    country: "🏴",
  },
  {
    id: "laliga",
    name: "LaLiga",
    country: "🇪🇸",
  },
  {
    id: "seriea",
    name: "Serie A",
    country: "🇮🇹",
  },
  {
    id: "bundesliga",
    name: "Bundesliga",
    country: "🇩🇪",
  },
  {
    id: "ligue1",
    name: "Ligue 1",
    country: "🇫🇷",
  },
];

const TEAMS = [
  {
    id: "realmadrid",
    name: "Real Madrid",
    logo: teamLogo(541),
  },
  {
    id: "mancity",
    name: "Manchester City",
    logo: teamLogo(50),
  },
  {
    id: "barcelona",
    name: "Barcelona",
    logo: teamLogo(529),
  },
  {
    id: "liverpool",
    name: "Liverpool",
    logo: teamLogo(40),
  },
  {
    id: "arsenal",
    name: "Arsenal",
    logo: teamLogo(42),
  },
];

const TABLE = [
  {
    rank: 1,
    team: "Manchester City",
    logo: teamLogo(50),
    p: 37,
    w: 27,
    d: 7,
    l: 3,
    gd: "+61",
    pts: 88,
  },
  {
    rank: 2,
    team: "Arsenal",
    logo: teamLogo(42),
    p: 37,
    w: 26,
    d: 6,
    l: 5,
    gd: "+62",
    pts: 84,
  },
  {
    rank: 3,
    team: "Liverpool",
    logo: teamLogo(40),
    p: 37,
    w: 23,
    d: 9,
    l: 5,
    gd: "+43",
    pts: 78,
  },
  {
    rank: 4,
    team: "Aston Villa",
    logo: teamLogo(66),
    p: 37,
    w: 20,
    d: 8,
    l: 9,
    gd: "+20",
    pts: 68,
  },
  {
    rank: 5,
    team: "Tottenham",
    logo: teamLogo(47),
    p: 37,
    w: 19,
    d: 6,
    l: 12,
    gd: "+12",
    pts: 63,
  },
  {
    rank: 6,
    team: "Chelsea",
    logo: teamLogo(49),
    p: 37,
    w: 17,
    d: 9,
    l: 11,
    gd: "+14",
    pts: 60,
  },
  {
    rank: 7,
    team: "Newcastle United",
    logo: teamLogo(34),
    p: 37,
    w: 17,
    d: 6,
    l: 14,
    gd: "+8",
    pts: 57,
  },
  {
    rank: 8,
    team: "Manchester United",
    logo: teamLogo(33),
    p: 37,
    w: 17,
    d: 6,
    l: 14,
    gd: "-1",
    pts: 57,
  },
  {
    rank: 9,
    team: "West Ham United",
    logo: teamLogo(48),
    p: 37,
    w: 14,
    d: 10,
    l: 13,
    gd: "-10",
    pts: 52,
  },
  {
    rank: 10,
    team: "Crystal Palace",
    logo: teamLogo(52),
    p: 37,
    w: 13,
    d: 10,
    l: 14,
    gd: "-1",
    pts: 49,
  },
];

const NEWS = [
  {
    id: 1,
    type: "BREAKING",
    title: "Haaland Strikes Again as Man City Beat Spurs 3-1",
    date: "May 17, 2024",
    read: "2 min read",
    image:
      "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1200&q=85",
  },
  {
    id: 2,
    title: "Mbappé to Real Madrid Confirmed: Deal Signed Until 2029",
    date: "May 17, 2024",
    image:
      "https://images.unsplash.com/photo-1600679472829-3044539ce8ed?auto=format&fit=crop&w=700&q=80",
  },
  {
    id: 3,
    title: "Liverpool Close to Signing New Midfielder in €60M Deal",
    date: "May 16, 2024",
    image:
      "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=700&q=80",
  },
  {
    id: 4,
    title: "Champions League Round of 16 Draw: Key Fixtures Revealed",
    date: "May 16, 2024",
    image:
      "https://images.unsplash.com/photo-1518091043644-c1d4457512c6?auto=format&fit=crop&w=700&q=80",
  },
  {
    id: 5,
    title: "Top 10 Players in the World Right Now",
    date: "May 15, 2024",
    image:
      "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=700&q=80",
  },
];

const VIDEOS = [
  {
    id: 1,
    title: "Why Manchester City Are Still Europe's Most Dangerous Team",
    duration: "08:42",
    image:
      "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 2,
    title: "Champions League Tactical Breakdown",
    duration: "12:18",
    image:
      "https://images.unsplash.com/photo-1518604666860-9ed391f76460?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 3,
    title: "Premier League Title Race Explained",
    duration: "06:57",
    image:
      "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=900&q=80",
  },
];

const TRANSFERS = [
  {
    id: 1,
    player: "Victor Osimhen",
    from: "Napoli",
    to: "Chelsea",
    status: "Negotiating",
    value: "€90M",
  },
  {
    id: 2,
    player: "Florian Wirtz",
    from: "Leverkusen",
    to: "Liverpool",
    status: "Rumour",
    value: "€110M",
  },
  {
    id: 3,
    player: "Rodrygo",
    from: "Real Madrid",
    to: "Arsenal",
    status: "Interest",
    value: "€100M",
  },
  {
    id: 4,
    player: "Nico Williams",
    from: "Athletic Club",
    to: "Barcelona",
    status: "Rumour",
    value: "€60M",
  },
];

// -------------------------------------------------------
// GENERAL COMPONENTS
// -------------------------------------------------------

function Logo() {
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

function IconButton({ icon, onPress, badge = false }) {
  return (
    <Pressable onPress={onPress} style={styles.iconButton}>
      <Ionicons name={icon} size={22} color={COLORS.text} />

      {badge && <View style={styles.notificationDot} />}
    </Pressable>
  );
}

function MainHeader() {
  return (
    <View style={styles.mainHeader}>
      <Logo />

      <View style={styles.headerIcons}>
        <IconButton icon="notifications-outline" badge />
        <IconButton icon="search-outline" />
      </View>
    </View>
  );
}

const HEADER_TABS = ["LIVE SCORES", "NEWS", "VIDEOS", "TRANSFERS"];

function HeaderTabs({ active, onChange }) {
  return (
    <View style={styles.headerTabs}>
      {HEADER_TABS.map((tab) => {
        const selected = active === tab;

        return (
          <Pressable
            key={tab}
            style={styles.headerTab}
            onPress={() => onChange(tab)}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.headerTabText,
                selected && styles.headerTabTextActive,
              ]}
            >
              {tab}
            </Text>

            {selected && <View style={styles.headerTabIndicator} />}
          </Pressable>
        );
      })}
    </View>
  );
}

function SectionHeader({ title, action, onAction }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>

      {action ? (
        <Pressable onPress={onAction}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function TeamLogo({ uri, size = 40 }) {
  return (
    <Image
      source={{ uri }}
      resizeMode="contain"
      style={{
        width: size,
        height: size,
      }}
    />
  );
}

function Pill({ children, active = false }) {
  return (
    <View style={[styles.pill, active && styles.pillActive]}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>
        {children}
      </Text>
    </View>
  );
}

// -------------------------------------------------------
// BOTTOM NAVIGATION
// -------------------------------------------------------

const BOTTOM_TABS = [
  {
    id: "home",
    label: "Home",
    icon: "home-outline",
    activeIcon: "home",
  },
  {
    id: "scores",
    label: "Scores",
    icon: "calendar-outline",
    activeIcon: "calendar",
  },
  {
    id: "favorites",
    label: "Favorites",
    icon: "star-outline",
    activeIcon: "star",
  },
  {
    id: "prediction",
    label: "Prediction",
    icon: "football-outline",
    activeIcon: "football",
  },
  {
    id: "more",
    label: "More",
    icon: "ellipsis-horizontal",
    activeIcon: "ellipsis-horizontal",
  },
];

function BottomNav({ active, onChange }) {
  return (
    <View style={styles.bottomNav}>
      {BOTTOM_TABS.map((tab) => {
        const selected = active === tab.id;

        return (
          <Pressable
            key={tab.id}
            style={styles.bottomNavItem}
            onPress={() => onChange(tab.id)}
          >
            <Ionicons
              name={selected ? tab.activeIcon : tab.icon}
              size={22}
              color={selected ? COLORS.brand : COLORS.muted}
            />

            <Text
              numberOfLines={1}
              style={[
                styles.bottomNavText,
                selected && styles.bottomNavTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// -------------------------------------------------------
// LIVE SCORE COMPONENTS
// -------------------------------------------------------

function MatchCard({ match, onPress }) {
  return (
    <Pressable style={styles.matchCard} onPress={() => onPress(match)}>
      <View style={styles.matchCardTop}>
        <Text style={styles.competitionLabel}>{match.competition}</Text>

        <View style={styles.liveRow}>
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>{match.status}</Text>
          </View>

          <Text style={styles.minuteText}>{match.minute}</Text>
        </View>
      </View>

      <View style={styles.matchTeams}>
        <View style={styles.matchTeam}>
          <TeamLogo uri={match.home.logo} size={44} />

          <Text numberOfLines={1} style={styles.matchTeamName}>
            {match.home.name}
          </Text>
        </View>

        <View style={styles.scoreCenter}>
          <Text style={styles.bigScore}>
            {match.homeScore} - {match.awayScore}
          </Text>

          {match.aggregate ? (
            <Text style={styles.aggregateText}>{match.aggregate}</Text>
          ) : null}
        </View>

        <View style={styles.matchTeam}>
          <TeamLogo uri={match.away.logo} size={44} />

          <Text numberOfLines={1} style={styles.matchTeamName}>
            {match.away.name}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function CompetitionStrip({ onLeaguePress }) {
  return (
    <View>
      <SectionHeader title="TOP COMPETITIONS" action="See All" />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.competitionStrip}
      >
        {COMPETITIONS.map((item) => (
          <Pressable
            key={item.id}
            style={styles.competitionItem}
            onPress={() => onLeaguePress(item)}
          >
            <View style={styles.competitionIcon}>
              <MaterialCommunityIcons
                name={item.icon}
                size={25}
                color={COLORS.text}
              />
            </View>

            <Text numberOfLines={2} style={styles.competitionName}>
              {item.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// -------------------------------------------------------
// HOME HEADER CONTENT
// -------------------------------------------------------

function HomeLiveScores({ openMatch, openLeague }) {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.pageContent}
    >
      <View style={styles.liveNowRow}>
        <View style={styles.liveNowLeft}>
          <View style={styles.redDot} />
          <Text style={styles.liveNowText}>LIVE NOW</Text>
        </View>

        <Text style={styles.matchCount}>12 Matches</Text>
      </View>

      {LIVE_MATCHES.map((match) => (
        <MatchCard key={match.id} match={match} onPress={openMatch} />
      ))}

      <Pressable style={styles.allScoresButton}>
        <Text style={styles.allScoresText}>ALL LIVE SCORES</Text>

        <Ionicons
          name="chevron-forward"
          size={18}
          color={COLORS.text}
        />
      </Pressable>

      <CompetitionStrip onLeaguePress={openLeague} />

      <View style={styles.spacerLarge} />
    </ScrollView>
  );
}

// -------------------------------------------------------
// NEWS
// -------------------------------------------------------

function NewsScreenContent() {
  const [category, setCategory] = useState("All");

  const categories = ["All", "Top News", "Football", "Transfers", "Opinion"];

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.pageContent}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryRow}
      >
        {categories.map((item) => (
          <Pressable key={item} onPress={() => setCategory(item)}>
            <Pill active={category === item}>{item}</Pill>
          </Pressable>
        ))}
      </ScrollView>

      <ImageBackground
        source={{ uri: NEWS[0].image }}
        style={styles.heroNews}
        imageStyle={styles.heroNewsImage}
      >
        <View style={styles.heroOverlay} />

        <View style={styles.heroNewsContent}>
          <View style={styles.breakingBadge}>
            <Text style={styles.breakingText}>BREAKING</Text>
          </View>

          <Text style={styles.heroNewsTitle}>{NEWS[0].title}</Text>

          <Text style={styles.newsMeta}>
            {NEWS[0].date} · {NEWS[0].read}
          </Text>
        </View>
      </ImageBackground>

      <View style={styles.newsList}>
        {NEWS.slice(1).map((article) => (
          <Pressable key={article.id} style={styles.newsRow}>
            <Image source={{ uri: article.image }} style={styles.newsThumb} />

            <View style={styles.newsRowContent}>
              <Text numberOfLines={3} style={styles.newsRowTitle}>
                {article.title}
              </Text>

              <Text style={styles.newsRowDate}>{article.date}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      <View style={styles.spacerLarge} />
    </ScrollView>
  );
}

// -------------------------------------------------------
// VIDEOS
// -------------------------------------------------------

function VideosScreenContent() {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.pageContent}
    >
      <SectionHeader title="LATEST VIDEOS" />

      {VIDEOS.map((video, index) => (
        <Pressable key={video.id} style={styles.videoCard}>
          <ImageBackground
            source={{ uri: video.image }}
            style={[
              styles.videoImage,
              index === 0 && styles.videoImageFeatured,
            ]}
            imageStyle={styles.videoImageRadius}
          >
            <View style={styles.videoOverlay} />

            <View style={styles.playButton}>
              <Ionicons name="play" size={25} color={COLORS.text} />
            </View>

            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{video.duration}</Text>
            </View>
          </ImageBackground>

          <Text style={styles.videoTitle}>{video.title}</Text>

          <Text style={styles.videoMeta}>
            Myanmar Sports Talk · 18K views
          </Text>
        </Pressable>
      ))}

      <View style={styles.spacerLarge} />
    </ScrollView>
  );
}

// -------------------------------------------------------
// TRANSFERS
// -------------------------------------------------------

function TransfersScreenContent() {
  const [filter, setFilter] = useState("Latest");

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.pageContent}
    >
      <View style={styles.transferFilters}>
        {["Latest", "Confirmed", "Rumours"].map((item) => (
          <Pressable key={item} onPress={() => setFilter(item)}>
            <Pill active={filter === item}>{item}</Pill>
          </Pressable>
        ))}
      </View>

      <SectionHeader title="TRANSFER CENTRE" />

      {TRANSFERS.map((transfer) => (
        <View key={transfer.id} style={styles.transferCard}>
          <View style={styles.transferTop}>
            <View>
              <Text style={styles.transferPlayer}>{transfer.player}</Text>

              <Text style={styles.transferStatus}>{transfer.status}</Text>
            </View>

            <Text style={styles.transferValue}>{transfer.value}</Text>
          </View>

          <View style={styles.transferRoute}>
            <View style={styles.transferClubBox}>
              <Text style={styles.transferClubLabel}>FROM</Text>
              <Text style={styles.transferClub}>{transfer.from}</Text>
            </View>

            <Ionicons
              name="arrow-forward"
              size={22}
              color={COLORS.brand}
            />

            <View style={styles.transferClubBox}>
              <Text style={styles.transferClubLabel}>TO</Text>
              <Text style={styles.transferClub}>{transfer.to}</Text>
            </View>
          </View>
        </View>
      ))}

      <View style={styles.spacerLarge} />
    </ScrollView>
  );
}

// -------------------------------------------------------
// HOME
// -------------------------------------------------------

function HomeScreen({ openMatch, openLeague }) {
  const [headerTab, setHeaderTab] = useState("LIVE SCORES");

  return (
    <View style={styles.screen}>
      <MainHeader />

      <HeaderTabs active={headerTab} onChange={setHeaderTab} />

      <View style={styles.flex}>
        {headerTab === "LIVE SCORES" && (
          <HomeLiveScores
            openMatch={openMatch}
            openLeague={openLeague}
          />
        )}

        {headerTab === "NEWS" && <NewsScreenContent />}

        {headerTab === "VIDEOS" && <VideosScreenContent />}

        {headerTab === "TRANSFERS" && <TransfersScreenContent />}
      </View>
    </View>
  );
}

// -------------------------------------------------------
// DEDICATED SCORES SCREEN
// -------------------------------------------------------

function ScoresScreen({ openMatch, openLeague }) {
  const [date, setDate] = useState("TODAY");

  return (
    <View style={styles.screen}>
      <View style={styles.simpleTopHeader}>
        <Text style={styles.pageTitle}>Scores</Text>

        <View style={styles.headerIcons}>
          <IconButton icon="calendar-outline" />
          <IconButton icon="search-outline" />
        </View>
      </View>

      <View style={styles.dateTabs}>
        {["YESTERDAY", "TODAY", "TOMORROW"].map((item) => (
          <Pressable
            key={item}
            style={[
              styles.dateTab,
              date === item && styles.dateTabActive,
            ]}
            onPress={() => setDate(item)}
          >
            <Text
              style={[
                styles.dateTabText,
                date === item && styles.dateTabTextActive,
              ]}
            >
              {item}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.pageContent}
      >
        <View style={styles.liveNowRow}>
          <View style={styles.liveNowLeft}>
            <View style={styles.redDot} />
            <Text style={styles.liveNowText}>LIVE</Text>
          </View>

          <Text style={styles.matchCount}>12 matches</Text>
        </View>

        {LIVE_MATCHES.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            onPress={openMatch}
          />
        ))}

        <CompetitionStrip onLeaguePress={openLeague} />

        <View style={styles.spacerLarge} />
      </ScrollView>
    </View>
  );
}

// -------------------------------------------------------
// FAVORITES
// -------------------------------------------------------

function FavoritesScreen({ openLeague, openPlayer }) {
  const [selectedSection, setSelectedSection] = useState("Leagues");

  const [favoriteLeagues, setFavoriteLeagues] = useState([
    "ucl",
    "pl",
    "laliga",
  ]);

  const [favoriteTeams, setFavoriteTeams] = useState([
    "realmadrid",
    "mancity",
    "liverpool",
  ]);

  const toggleLeague = (id) => {
    setFavoriteLeagues((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  };

  const toggleTeam = (id) => {
    setFavoriteTeams((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.simpleTopHeader}>
        <Text style={styles.pageTitle}>Favorites</Text>

        <IconButton icon="search-outline" />
      </View>

      <View style={styles.segmentControl}>
        {["Leagues", "Teams", "Players"].map((section) => (
          <Pressable
            key={section}
            style={[
              styles.segmentItem,
              selectedSection === section &&
                styles.segmentItemActive,
            ]}
            onPress={() => setSelectedSection(section)}
          >
            <Text
              style={[
                styles.segmentText,
                selectedSection === section &&
                  styles.segmentTextActive,
              ]}
            >
              {section}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.pageContent}
      >
        {selectedSection === "Leagues" && (
          <>
            <SectionHeader title="POPULAR LEAGUES" />

            <View style={styles.listCard}>
              {LEAGUES.map((league, index) => {
                const favorite = favoriteLeagues.includes(league.id);

                return (
                  <Pressable
                    key={league.id}
                    style={[
                      styles.listRow,
                      index !== LEAGUES.length - 1 &&
                        styles.listRowBorder,
                    ]}
                    onPress={() => openLeague(league)}
                  >
                    <View style={styles.listRowLeft}>
                      <Text style={styles.flagText}>{league.country}</Text>

                      <Text style={styles.listRowText}>
                        {league.name}
                      </Text>
                    </View>

                    <Pressable
                      hitSlop={10}
                      onPress={() => toggleLeague(league.id)}
                    >
                      <Ionicons
                        name={favorite ? "star" : "star-outline"}
                        size={20}
                        color={
                          favorite ? COLORS.brand : COLORS.muted
                        }
                      />
                    </Pressable>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {selectedSection === "Teams" && (
          <>
            <SectionHeader title="POPULAR TEAMS" />

            <View style={styles.listCard}>
              {TEAMS.map((team, index) => {
                const favorite = favoriteTeams.includes(team.id);

                return (
                  <View
                    key={team.id}
                    style={[
                      styles.listRow,
                      index !== TEAMS.length - 1 &&
                        styles.listRowBorder,
                    ]}
                  >
                    <View style={styles.listRowLeft}>
                      <TeamLogo uri={team.logo} size={27} />

                      <Text style={styles.listRowText}>
                        {team.name}
                      </Text>
                    </View>

                    <Pressable onPress={() => toggleTeam(team.id)}>
                      <Ionicons
                        name={favorite ? "star" : "star-outline"}
                        size={20}
                        color={
                          favorite ? COLORS.brand : COLORS.muted
                        }
                      />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {selectedSection === "Players" && (
          <>
            <SectionHeader title="FAVORITE PLAYERS" />

            <Pressable
              style={styles.favoritePlayerCard}
              onPress={openPlayer}
            >
              <Image
                source={{ uri: PLAYER_IMAGE }}
                style={styles.favoritePlayerImage}
              />

              <View style={styles.favoritePlayerInfo}>
                <Text style={styles.favoritePlayerName}>
                  Erling Haaland
                </Text>

                <Text style={styles.favoritePlayerClub}>
                  Manchester City · Norway
                </Text>
              </View>

              <Ionicons name="star" size={20} color={COLORS.brand} />
            </Pressable>
          </>
        )}

        <View style={styles.discoverMore}>
          <Ionicons
            name="compass-outline"
            size={25}
            color={COLORS.brand}
          />

          <View style={styles.discoverMoreTextWrap}>
            <Text style={styles.discoverMoreTitle}>
              Discover more football
            </Text>

            <Text style={styles.discoverMoreText}>
              Follow competitions, clubs and players you care about.
            </Text>
          </View>
        </View>

        <View style={styles.spacerLarge} />
      </ScrollView>
    </View>
  );
}

// -------------------------------------------------------
// PREDICTION
// -------------------------------------------------------

function PredictionScreen() {
  const [predictions, setPredictions] = useState({});

  const predictionCount = Object.keys(predictions).length;

  const choose = (matchId, choice) => {
    setPredictions((prev) => ({
      ...prev,
      [matchId]: choice,
    }));
  };

  return (
    <View style={styles.screen}>
      <View style={styles.simpleTopHeader}>
        <View>
          <Text style={styles.pageTitle}>Prediction</Text>

          <Text style={styles.pageSubtitle}>
            Predict. Earn points. Climb the ranking.
          </Text>
        </View>

        <IconButton icon="trophy-outline" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.pageContent}
      >
        <View style={styles.predictionStats}>
          <View style={styles.predictionStat}>
            <Text style={styles.predictionStatNumber}>240</Text>
            <Text style={styles.predictionStatLabel}>Points</Text>
          </View>

          <View style={styles.predictionStatDivider} />

          <View style={styles.predictionStat}>
            <Text style={styles.predictionStatNumber}>18</Text>
            <Text style={styles.predictionStatLabel}>Correct</Text>
          </View>

          <View style={styles.predictionStatDivider} />

          <View style={styles.predictionStat}>
            <Text style={styles.predictionStatNumber}>#126</Text>
            <Text style={styles.predictionStatLabel}>Rank</Text>
          </View>
        </View>

        <View style={styles.predictionNotice}>
          <Ionicons
            name="information-circle-outline"
            size={21}
            color={COLORS.brand}
          />

          <Text style={styles.predictionNoticeText}>
            Predictions lock when the match starts.
          </Text>
        </View>

        <SectionHeader
          title="PREDICT MATCHES"
          action={`${predictionCount}/${UPCOMING_MATCHES.length}`}
        />

        {UPCOMING_MATCHES.map((match) => {
          const selected = predictions[match.id];

          return (
            <View key={match.id} style={styles.predictionCard}>
              <View style={styles.predictionMatchTop}>
                <Text style={styles.competitionLabel}>
                  {match.competition}
                </Text>

                <Text style={styles.predictionTime}>
                  {match.date} · {match.time}
                </Text>
              </View>

              <View style={styles.predictionTeams}>
                <View style={styles.predictionTeam}>
                  <TeamLogo uri={match.home.logo} size={41} />

                  <Text
                    numberOfLines={2}
                    style={styles.predictionTeamName}
                  >
                    {match.home.name}
                  </Text>
                </View>

                <Text style={styles.vsText}>VS</Text>

                <View style={styles.predictionTeam}>
                  <TeamLogo uri={match.away.logo} size={41} />

                  <Text
                    numberOfLines={2}
                    style={styles.predictionTeamName}
                  >
                    {match.away.name}
                  </Text>
                </View>
              </View>

              <View style={styles.predictionButtons}>
                <Pressable
                  style={[
                    styles.predictionButton,
                    selected === "home" &&
                      styles.predictionButtonActive,
                  ]}
                  onPress={() => choose(match.id, "home")}
                >
                  <Text
                    style={[
                      styles.predictionButtonText,
                      selected === "home" &&
                        styles.predictionButtonTextActive,
                    ]}
                  >
                    Home
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.predictionButton,
                    selected === "draw" &&
                      styles.predictionButtonActive,
                  ]}
                  onPress={() => choose(match.id, "draw")}
                >
                  <Text
                    style={[
                      styles.predictionButtonText,
                      selected === "draw" &&
                        styles.predictionButtonTextActive,
                    ]}
                  >
                    Draw
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.predictionButton,
                    selected === "away" &&
                      styles.predictionButtonActive,
                  ]}
                  onPress={() => choose(match.id, "away")}
                >
                  <Text
                    style={[
                      styles.predictionButtonText,
                      selected === "away" &&
                        styles.predictionButtonTextActive,
                    ]}
                  >
                    Away
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        <View style={styles.spacerLarge} />
      </ScrollView>
    </View>
  );
}

// -------------------------------------------------------
// MORE / DISCOVER
// -------------------------------------------------------

function MoreScreen({ openLeague, openPlayer }) {
  return (
    <View style={styles.screen}>
      <View style={styles.simpleTopHeader}>
        <Text style={styles.pageTitle}>Discover</Text>

        <IconButton icon="search-outline" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.pageContent}
      >
        <View style={styles.segmentControl}>
          <View style={[styles.segmentItem, styles.segmentItemActive]}>
            <Text style={[styles.segmentText, styles.segmentTextActive]}>
              Leagues
            </Text>
          </View>

          <View style={styles.segmentItem}>
            <Text style={styles.segmentText}>Teams</Text>
          </View>

          <Pressable style={styles.segmentItem} onPress={openPlayer}>
            <Text style={styles.segmentText}>Players</Text>
          </Pressable>
        </View>

        <SectionHeader title="POPULAR LEAGUES" />

        <View style={styles.listCard}>
          {LEAGUES.map((league, index) => (
            <Pressable
              key={league.id}
              style={[
                styles.listRow,
                index !== LEAGUES.length - 1 &&
                  styles.listRowBorder,
              ]}
              onPress={() => openLeague(league)}
            >
              <View style={styles.listRowLeft}>
                <Text style={styles.flagText}>{league.country}</Text>

                <Text style={styles.listRowText}>{league.name}</Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={18}
                color={COLORS.muted}
              />
            </Pressable>
          ))}
        </View>

        <SectionHeader title="POPULAR TEAMS" />

        <View style={styles.listCard}>
          {TEAMS.map((team, index) => (
            <View
              key={team.id}
              style={[
                styles.listRow,
                index !== TEAMS.length - 1 &&
                  styles.listRowBorder,
              ]}
            >
              <View style={styles.listRowLeft}>
                <TeamLogo uri={team.logo} size={26} />

                <Text style={styles.listRowText}>{team.name}</Text>
              </View>

              <Ionicons
                name="star-outline"
                size={18}
                color={COLORS.muted}
              />
            </View>
          ))}
        </View>

        <SectionHeader title="ACCOUNT & APP" />

        <View style={styles.listCard}>
          <MoreRow icon="person-outline" title="My Account" />
          <MoreRow icon="notifications-outline" title="Notifications" />
          <MoreRow icon="moon-outline" title="Dark Mode" right="On" />
          <MoreRow icon="language-outline" title="Language" right="English" />
          <MoreRow icon="settings-outline" title="Settings" last />
        </View>

        <View style={styles.spacerLarge} />
      </ScrollView>
    </View>
  );
}

function MoreRow({ icon, title, right, last }) {
  return (
    <Pressable
      style={[styles.moreRow, !last && styles.listRowBorder]}
    >
      <View style={styles.listRowLeft}>
        <Ionicons name={icon} size={21} color={COLORS.textSoft} />

        <Text style={styles.listRowText}>{title}</Text>
      </View>

      <View style={styles.moreRight}>
        {right ? <Text style={styles.moreRightText}>{right}</Text> : null}

        <Ionicons
          name="chevron-forward"
          size={18}
          color={COLORS.muted}
        />
      </View>
    </Pressable>
  );
}

// -------------------------------------------------------
// MATCH DETAIL
// -------------------------------------------------------

function MatchDetailScreen({ match, goBack }) {
  const [tab, setTab] = useState("MATCH FACTS");

  const current = match || LIVE_MATCHES[0];

  return (
    <View style={styles.screen}>
      <View style={styles.detailHeader}>
        <Pressable onPress={goBack} style={styles.detailHeaderButton}>
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </Pressable>

        <Text numberOfLines={1} style={styles.detailHeaderTitle}>
          UEFA Champions League
        </Text>

        <View style={styles.detailHeaderActions}>
          <Ionicons
            name="share-outline"
            size={22}
            color={COLORS.text}
          />

          <Ionicons
            name="star-outline"
            size={22}
            color={COLORS.text}
          />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.detailContent}
      >
        <Text style={styles.roundText}>Round of 16 · Leg 2 of 2</Text>

        <View style={styles.detailScoreArea}>
          <View style={styles.detailTeam}>
            <TeamLogo uri={current.home.logo} size={61} />

            <Text style={styles.detailTeamName}>{current.home.name}</Text>
          </View>

          <View style={styles.detailScoreCenter}>
            <Text style={styles.detailScore}>
              {current.homeScore} - {current.awayScore}
            </Text>

            <Text style={styles.detailLiveTime}>78:32</Text>

            <Text style={styles.aggregateText}>Agg 2 - 2</Text>
          </View>

          <View style={styles.detailTeam}>
            <TeamLogo uri={current.away.logo} size={61} />

            <Text style={styles.detailTeamName}>{current.away.name}</Text>
          </View>
        </View>

        <View style={styles.scorersRow}>
          <View style={styles.scorersColumn}>
            <Text style={styles.scorerText}>Vinícius Jr. 24'</Text>
            <Text style={styles.scorerText}>J. Bellingham 68'</Text>
          </View>

          <View style={styles.scorersColumnRight}>
            <Text style={styles.scorerText}>H. Kane 15'</Text>
          </View>
        </View>

        <View style={styles.matchDetailTabs}>
          {["MATCH FACTS", "LINEUPS", "STATISTICS", "H2H"].map(
            (item) => (
              <Pressable
                key={item}
                style={styles.matchDetailTab}
                onPress={() => setTab(item)}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.matchDetailTabText,
                    tab === item && styles.matchDetailTabTextActive,
                  ]}
                >
                  {item}
                </Text>

                {tab === item && (
                  <View style={styles.matchDetailTabIndicator} />
                )}
              </Pressable>
            )
          )}
        </View>

        {tab === "MATCH FACTS" && <MatchFacts />}

        {tab === "LINEUPS" && <Lineups />}

        {tab === "STATISTICS" && <Statistics />}

        {tab === "H2H" && <HeadToHead />}

        <View style={styles.spacerLarge} />
      </ScrollView>
    </View>
  );
}

function MatchFacts() {
  const events = [
    {
      minute: "15'",
      side: "away",
      icon: "football",
      text: "H. Kane",
    },
    {
      minute: "24'",
      side: "home",
      icon: "football",
      text: "Vinícius Jr.",
    },
    {
      minute: "45'",
      side: "away",
      icon: "card",
      text: "A. Davies",
    },
    {
      minute: "HT",
      side: "center",
      text: "HALF TIME",
    },
    {
      minute: "68'",
      side: "home",
      icon: "football",
      text: "J. Bellingham",
    },
    {
      minute: "69'",
      side: "away",
      icon: "card",
      text: "L. Goretzka",
    },
    {
      minute: "78'",
      side: "home",
      icon: "live",
      text: "Dangerous attack by Real Madrid",
    },
  ];

  return (
    <View style={styles.timeline}>
      {events.map((event, index) => {
        if (event.side === "center") {
          return (
            <View key={index} style={styles.halfTimeRow}>
              <View style={styles.timelineLine} />

              <Text style={styles.halfTimeText}>HT</Text>

              <View style={styles.timelineLine} />
            </View>
          );
        }

        return (
          <View key={index} style={styles.timelineRow}>
            <View style={styles.timelineHome}>
              {event.side === "home" ? (
                <>
                  <Text style={styles.eventMinute}>{event.minute}</Text>

                  {event.icon === "football" && (
                    <Ionicons
                      name="football"
                      size={17}
                      color={COLORS.text}
                    />
                  )}

                  {event.icon === "live" && (
                    <View style={styles.liveBadge}>
                      <Text style={styles.liveBadgeText}>LIVE</Text>
                    </View>
                  )}

                  <Text style={styles.eventText}>{event.text}</Text>
                </>
              ) : null}
            </View>

            <View style={styles.timelineCenterDot} />

            <View style={styles.timelineAway}>
              {event.side === "away" ? (
                <>
                  <Text style={styles.eventMinute}>{event.minute}</Text>

                  {event.icon === "football" && (
                    <Ionicons
                      name="football"
                      size={17}
                      color={COLORS.text}
                    />
                  )}

                  {event.icon === "card" && (
                    <View style={styles.yellowCard} />
                  )}

                  <Text style={styles.eventText}>{event.text}</Text>
                </>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Lineups() {
  return (
    <View style={styles.tabPlaceholder}>
      <View style={styles.lineupHeader}>
        <Text style={styles.lineupTeam}>Real Madrid</Text>
        <Text style={styles.lineupFormation}>4-3-1-2</Text>
      </View>

      {[
        "Lunin",
        "Carvajal",
        "Rüdiger",
        "Nacho",
        "Mendy",
        "Valverde",
        "Kroos",
        "Camavinga",
        "Bellingham",
        "Rodrygo",
        "Vinícius Jr.",
      ].map((player, i) => (
        <View key={player} style={styles.lineupPlayer}>
          <Text style={styles.lineupNumber}>{i + 1}</Text>
          <Text style={styles.lineupPlayerName}>{player}</Text>
        </View>
      ))}
    </View>
  );
}

function Statistics() {
  const stats = [
    ["Possession", "57%", "43%"],
    ["Shots", "16", "11"],
    ["Shots on target", "7", "4"],
    ["Corners", "6", "3"],
    ["Fouls", "8", "11"],
    ["Pass accuracy", "91%", "86%"],
  ];

  return (
    <View style={styles.statsWrap}>
      {stats.map(([label, home, away]) => (
        <View key={label} style={styles.statRow}>
          <Text style={styles.statNumber}>{home}</Text>

          <Text style={styles.statName}>{label}</Text>

          <Text style={styles.statNumber}>{away}</Text>
        </View>
      ))}
    </View>
  );
}

function HeadToHead() {
  return (
    <View>
      <SectionHeader title="LAST 5 MEETINGS" />

      {[
        ["Real Madrid", "2 - 1", "Bayern Munich"],
        ["Bayern Munich", "2 - 2", "Real Madrid"],
        ["Real Madrid", "2 - 2", "Bayern Munich"],
        ["Bayern Munich", "1 - 2", "Real Madrid"],
        ["Real Madrid", "4 - 2", "Bayern Munich"],
      ].map((row, index) => (
        <View key={index} style={styles.h2hRow}>
          <Text style={styles.h2hTeam}>{row[0]}</Text>

          <Text style={styles.h2hScore}>{row[1]}</Text>

          <Text style={[styles.h2hTeam, styles.h2hTeamRight]}>
            {row[2]}
          </Text>
        </View>
      ))}
    </View>
  );
}

// -------------------------------------------------------
// LEAGUE SCREEN
// -------------------------------------------------------

function LeagueScreen({ goBack }) {
  const [tab, setTab] = useState("TABLE");

  return (
    <View style={styles.screen}>
      <View style={styles.leagueHeader}>
        <Pressable onPress={goBack}>
          <Ionicons name="chevron-back" size={27} color={COLORS.text} />
        </Pressable>

        <View style={styles.leagueTitleWrap}>
          <MaterialCommunityIcons
            name="crown-outline"
            size={29}
            color={COLORS.text}
          />

          <Text style={styles.leagueTitle}>Premier League</Text>
        </View>

        <Ionicons name="star-outline" size={23} color={COLORS.text} />
      </View>

      <View style={styles.leagueTabs}>
        {["TABLE", "FIXTURES", "NEWS", "STATS"].map((item) => (
          <Pressable
            key={item}
            style={styles.leagueTab}
            onPress={() => setTab(item)}
          >
            <Text
              style={[
                styles.leagueTabText,
                tab === item && styles.leagueTabTextActive,
              ]}
            >
              {item}
            </Text>

            {tab === item && <View style={styles.leagueTabIndicator} />}
          </Pressable>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {tab === "TABLE" && <LeagueTable />}

        {tab === "FIXTURES" && (
          <View style={styles.pageContent}>
            {UPCOMING_MATCHES.slice(0, 3).map((match) => (
              <View key={match.id} style={styles.fixtureCard}>
                <Text style={styles.fixtureTime}>
                  {match.date} · {match.time}
                </Text>

                <View style={styles.fixtureTeamRow}>
                  <Text style={styles.fixtureTeam}>
                    {match.home.name}
                  </Text>

                  <Text style={styles.vsText}>VS</Text>

                  <Text
                    style={[
                      styles.fixtureTeam,
                      styles.fixtureTeamRight,
                    ]}
                  >
                    {match.away.name}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {tab === "NEWS" && <NewsScreenContent />}

        {tab === "STATS" && (
          <View style={styles.pageContent}>
            <SectionHeader title="TOP SCORERS" />

            {["Erling Haaland", "Mohamed Salah", "Cole Palmer"].map(
              (name, index) => (
                <View key={name} style={styles.topScorerRow}>
                  <Text style={styles.scorerRank}>{index + 1}</Text>

                  <Text style={styles.topScorerName}>{name}</Text>

                  <Text style={styles.topScorerGoals}>
                    {27 - index * 3}
                  </Text>
                </View>
              )
            )}
          </View>
        )}

        <View style={styles.spacerLarge} />
      </ScrollView>
    </View>
  );
}

function LeagueTable() {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.tableWrap}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { width: 32 }]}>#</Text>

          <Text style={[styles.tableHeaderCell, { width: 185 }]}>
            TEAM
          </Text>

          <Text style={styles.tableHeaderCell}>P</Text>
          <Text style={styles.tableHeaderCell}>W</Text>
          <Text style={styles.tableHeaderCell}>D</Text>
          <Text style={styles.tableHeaderCell}>L</Text>

          <Text style={[styles.tableHeaderCell, { width: 50 }]}>
            GD
          </Text>

          <Text style={styles.tableHeaderCell}>PTS</Text>
        </View>

        {TABLE.map((row) => (
          <View key={row.rank} style={styles.tableRow}>
            <Text style={[styles.tableCell, { width: 32 }]}>
              {row.rank}
            </Text>

            <View style={[styles.tableTeamCell, { width: 185 }]}>
              <TeamLogo uri={row.logo} size={27} />

              <Text numberOfLines={1} style={styles.tableTeamName}>
                {row.team}
              </Text>
            </View>

            <Text style={styles.tableCell}>{row.p}</Text>
            <Text style={styles.tableCell}>{row.w}</Text>
            <Text style={styles.tableCell}>{row.d}</Text>
            <Text style={styles.tableCell}>{row.l}</Text>

            <Text style={[styles.tableCell, { width: 50 }]}>
              {row.gd}
            </Text>

            <Text style={[styles.tableCell, styles.tablePoints]}>
              {row.pts}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// -------------------------------------------------------
// PLAYER PROFILE
// -------------------------------------------------------

function PlayerScreen({ goBack }) {
  const [tab, setTab] = useState("OVERVIEW");

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ImageBackground
          source={{ uri: PLAYER_IMAGE }}
          style={styles.playerHero}
          imageStyle={styles.playerHeroImage}
        >
          <View style={styles.playerHeroOverlay} />

          <View style={styles.playerHeroTop}>
            <Pressable onPress={goBack}>
              <Ionicons
                name="chevron-back"
                size={28}
                color={COLORS.text}
              />
            </Pressable>

            <Ionicons
              name="share-social-outline"
              size={23}
              color={COLORS.text}
            />
          </View>
        </ImageBackground>

        <View style={styles.playerContent}>
          <View style={styles.playerAvatarWrap}>
            <Image
              source={{ uri: PLAYER_IMAGE }}
              style={styles.playerAvatar}
            />
          </View>

          <Text style={styles.playerName}>Erling Haaland 🇳🇴</Text>

          <View style={styles.playerClubRow}>
            <TeamLogo uri={teamLogo(50)} size={23} />
            <Text style={styles.playerClub}>Manchester City</Text>
          </View>

          <View style={styles.playerQuickStats}>
            <PlayerQuickStat value="23" label="Age" />
            <PlayerQuickStat value="9" label="Jersey" />
            <PlayerQuickStat value="FW" label="Position" />
            <PlayerQuickStat value="Norway" label="Country" />
          </View>

          <View style={styles.playerTabs}>
            {["OVERVIEW", "STATS", "NEWS", "CAREER"].map((item) => (
              <Pressable
                key={item}
                style={styles.playerTab}
                onPress={() => setTab(item)}
              >
                <Text
                  style={[
                    styles.playerTabText,
                    tab === item && styles.playerTabTextActive,
                  ]}
                >
                  {item}
                </Text>

                {tab === item && (
                  <View style={styles.playerTabIndicator} />
                )}
              </Pressable>
            ))}
          </View>

          {tab === "OVERVIEW" && <PlayerOverview />}

          {tab === "STATS" && <PlayerStats />}

          {tab === "NEWS" && (
            <View style={styles.playerTabContent}>
              <Text style={styles.placeholderTitle}>
                Latest Haaland News
              </Text>

              <Text style={styles.placeholderText}>
                Player-related MST news articles will appear here.
              </Text>
            </View>
          )}

          {tab === "CAREER" && (
            <View style={styles.playerTabContent}>
              <Text style={styles.placeholderTitle}>Career</Text>

              <Text style={styles.placeholderText}>
                Manchester City · Borussia Dortmund · RB Salzburg
              </Text>
            </View>
          )}

          <View style={styles.spacerLarge} />
        </View>
      </ScrollView>
    </View>
  );
}

function PlayerQuickStat({ value, label }) {
  return (
    <View style={styles.playerQuickStat}>
      <Text numberOfLines={1} style={styles.playerQuickValue}>
        {value}
      </Text>

      <Text style={styles.playerQuickLabel}>{label}</Text>
    </View>
  );
}

function PlayerOverview() {
  return (
    <>
      <View style={styles.playerSeasonStats}>
        <PlayerStatBox label="Matches" value="36" />
        <PlayerStatBox label="Goals" value="27" />
        <PlayerStatBox label="Assists" value="6" />
        <PlayerStatBox label="Yellow Cards" value="2" />
      </View>

      <View style={styles.playerInfoCard}>
        <PlayerInfoRow label="Height" value="194 cm" />
        <PlayerInfoRow label="Weight" value="88 kg" />
        <PlayerInfoRow label="Date of Birth" value="Jul 21, 2000" />
        <PlayerInfoRow label="Preferred Foot" value="Left" last />
      </View>
    </>
  );
}

function PlayerStats() {
  return (
    <View style={styles.playerInfoCard}>
      <PlayerInfoRow label="Appearances" value="36" />
      <PlayerInfoRow label="Goals" value="27" />
      <PlayerInfoRow label="Assists" value="6" />
      <PlayerInfoRow label="Shots per Match" value="3.8" />
      <PlayerInfoRow label="Pass Accuracy" value="81%" last />
    </View>
  );
}

function PlayerStatBox({ label, value }) {
  return (
    <View style={styles.playerStatBox}>
      <Text style={styles.playerStatLabel}>{label}</Text>
      <Text style={styles.playerStatValue}>{value}</Text>
    </View>
  );
}

function PlayerInfoRow({ label, value, last }) {
  return (
    <View
      style={[
        styles.playerInfoRow,
        !last && styles.playerInfoRowBorder,
      ]}
    >
      <Text style={styles.playerInfoLabel}>{label}</Text>
      <Text style={styles.playerInfoValue}>{value}</Text>
    </View>
  );
}

// -------------------------------------------------------
// APP
// -------------------------------------------------------

export default function App() {
  const [bottomTab, setBottomTab] = useState("home");

  const [route, setRoute] = useState({
    name: "main",
    params: null,
  });

  const openMatch = (match) => {
    setRoute({
      name: "match",
      params: match,
    });
  };

  const openLeague = (league) => {
    setRoute({
      name: "league",
      params: league,
    });
  };

  const openPlayer = () => {
    setRoute({
      name: "player",
      params: null,
    });
  };

  const goBack = () => {
    setRoute({
      name: "main",
      params: null,
    });
  };

  const changeBottomTab = (tab) => {
    setBottomTab(tab);

    setRoute({
      name: "main",
      params: null,
    });
  };

  const mainScreen = useMemo(() => {
    switch (bottomTab) {
      case "scores":
        return (
          <ScoresScreen
            openMatch={openMatch}
            openLeague={openLeague}
          />
        );

      case "favorites":
        return (
          <FavoritesScreen
            openLeague={openLeague}
            openPlayer={openPlayer}
          />
        );

      case "prediction":
        return <PredictionScreen />;

      case "more":
        return (
          <MoreScreen
            openLeague={openLeague}
            openPlayer={openPlayer}
          />
        );

      case "home":
      default:
        return (
          <HomeScreen
            openMatch={openMatch}
            openLeague={openLeague}
          />
        );
    }
  }, [bottomTab]);

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.background}
      />

      <View style={styles.appBody}>
        {route.name === "main" && mainScreen}

        {route.name === "match" && (
          <MatchDetailScreen
            match={route.params}
            goBack={goBack}
          />
        )}

        {route.name === "league" && (
          <LeagueScreen
            league={route.params}
            goBack={goBack}
          />
        )}

        {route.name === "player" && (
          <PlayerScreen goBack={goBack} />
        )}
      </View>

      <BottomNav
        active={bottomTab}
        onChange={changeBottomTab}
      />
    </SafeAreaView>
  );
}

// -------------------------------------------------------
// STYLES
// -------------------------------------------------------

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  appBody: {
    flex: 1,
  },

  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  flex: {
    flex: 1,
  },

  pageContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  spacerLarge: {
    height: 40,
  },

  // HEADER ------------------------------------------------

  mainHeader: {
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

  headerIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  iconButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  notificationDot: {
    position: "absolute",
    right: 7,
    top: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.live,
    borderWidth: 1,
    borderColor: COLORS.background,
  },

  headerTabs: {
    flexDirection: "row",
    paddingHorizontal: 14,
    backgroundColor: COLORS.backgroundSoft,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },

  headerTab: {
    flex: 1,
    height: 45,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  headerTabText: {
    color: COLORS.textSoft,
    fontSize: width < 370 ? 9.5 : 10.5,
    fontWeight: "700",
  },

  headerTabTextActive: {
    color: COLORS.brand,
  },

  headerTabIndicator: {
    position: "absolute",
    bottom: 0,
    height: 2,
    left: 4,
    right: 4,
    borderRadius: 2,
    backgroundColor: COLORS.brand,
  },

  simpleTopHeader: {
    paddingHorizontal: 18,
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },

  pageTitle: {
    color: COLORS.text,
    fontSize: 23,
    fontWeight: "800",
  },

  pageSubtitle: {
    marginTop: 3,
    color: COLORS.muted,
    fontSize: 12,
  },

  // SECTION ------------------------------------------------

  sectionHeader: {
    marginTop: 17,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sectionTitle: {
    color: COLORS.textSoft,
    fontSize: 12,
    fontWeight: "800",
  },

  sectionAction: {
    color: COLORS.muted,
    fontSize: 11,
  },

  // LIVE ------------------------------------------------

  liveNowRow: {
    marginBottom: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  liveNowLeft: {
    flexDirection: "row",
    alignItems: "center",
  },

  redDot: {
    width: 8,
    height: 8,
    borderRadius: 5,
    backgroundColor: COLORS.live,
    marginRight: 7,
  },

  liveNowText: {
    color: COLORS.textSoft,
    fontSize: 12,
    fontWeight: "800",
  },

  matchCount: {
    color: COLORS.muted,
    fontSize: 11,
  },

  matchCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 13,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },

  matchCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  competitionLabel: {
    color: COLORS.textSoft,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  liveRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  liveBadge: {
    backgroundColor: COLORS.live,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
  },

  liveBadgeText: {
    color: COLORS.text,
    fontSize: 9,
    fontWeight: "800",
  },

  minuteText: {
    color: COLORS.textSoft,
    fontSize: 10,
    marginLeft: 5,
  },

  matchTeams: {
    marginTop: 11,
    flexDirection: "row",
    alignItems: "center",
  },

  matchTeam: {
    flex: 1,
    alignItems: "center",
  },

  matchTeamName: {
    color: COLORS.text,
    fontSize: 11,
    marginTop: 5,
    textAlign: "center",
  },

  scoreCenter: {
    width: 100,
    alignItems: "center",
  },

  bigScore: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 1,
  },

  aggregateText: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 6,
  },

  allScoresButton: {
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },

  allScoresText: {
    color: COLORS.brand,
    fontSize: 11,
    fontWeight: "800",
  },

  competitionStrip: {
    paddingBottom: 6,
  },

  competitionItem: {
    width: 73,
    marginRight: 9,
    alignItems: "center",
  },

  competitionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },

  competitionName: {
    minHeight: 30,
    color: COLORS.textSoft,
    fontSize: 9,
    textAlign: "center",
  },

  // PILL ------------------------------------------------

  pill: {
    backgroundColor: COLORS.card2,
    borderRadius: 7,
    paddingHorizontal: 13,
    paddingVertical: 8,
    marginRight: 6,
  },

  pillActive: {
    backgroundColor: COLORS.brand,
  },

  pillText: {
    color: COLORS.textSoft,
    fontSize: 11,
    fontWeight: "600",
  },

  pillTextActive: {
    color: COLORS.text,
  },

  // NEWS ------------------------------------------------

  categoryRow: {
    paddingBottom: 11,
  },

  heroNews: {
    height: 310,
    justifyContent: "flex-end",
    overflow: "hidden",
  },

  heroNewsImage: {
    borderRadius: 10,
  },

  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.38)",
  },

  heroNewsContent: {
    padding: 15,
  },

  breakingBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 3,
    backgroundColor: COLORS.live,
    marginBottom: 8,
  },

  breakingText: {
    color: COLORS.text,
    fontSize: 9,
    fontWeight: "900",
  },

  heroNewsTitle: {
    color: COLORS.text,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: "800",
    maxWidth: "96%",
  },

  newsMeta: {
    color: COLORS.textSoft,
    fontSize: 11,
    marginTop: 8,
  },

  newsList: {
    marginTop: 10,
  },

  newsRow: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },

  newsThumb: {
    width: 108,
    height: 72,
    borderRadius: 6,
    backgroundColor: COLORS.card2,
  },

  newsRowContent: {
    flex: 1,
    marginLeft: 12,
  },

  newsRowTitle: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 18,
  },

  newsRowDate: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 5,
  },

  // VIDEO ------------------------------------------------

  videoCard: {
    marginBottom: 20,
  },

  videoImage: {
    height: 190,
    justifyContent: "center",
    alignItems: "center",
  },

  videoImageFeatured: {
    height: 225,
  },

  videoImageRadius: {
    borderRadius: 10,
  },

  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.20)",
    borderRadius: 10,
  },

  playButton: {
    width: 54,
    height: 54,
    borderRadius: 29,
    backgroundColor: "rgba(120,200,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },

  durationBadge: {
    position: "absolute",
    right: 9,
    bottom: 9,
    backgroundColor: "rgba(0,0,0,0.84)",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 4,
  },

  durationText: {
    color: COLORS.text,
    fontSize: 9,
    fontWeight: "700",
  },

  videoTitle: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    marginTop: 9,
  },

  videoMeta: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 5,
  },

  // TRANSFER ------------------------------------------------

  transferFilters: {
    flexDirection: "row",
    marginBottom: 4,
  },

  transferCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    borderRadius: 9,
    padding: 14,
    marginBottom: 9,
  },

  transferTop: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  transferPlayer: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
  },

  transferStatus: {
    color: COLORS.brand,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 4,
  },

  transferValue: {
    color: COLORS.textSoft,
    fontSize: 15,
    fontWeight: "700",
  },

  transferRoute: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
  },

  transferClubBox: {
    flex: 1,
  },

  transferClubLabel: {
    color: COLORS.muted,
    fontSize: 8,
  },

  transferClub: {
    color: COLORS.text,
    fontSize: 12,
    marginTop: 3,
  },

  // SCORES DATE ------------------------------------------------

  dateTabs: {
    flexDirection: "row",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },

  dateTab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    borderRadius: 6,
  },

  dateTabActive: {
    backgroundColor: COLORS.brandSoft,
  },

  dateTabText: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: "700",
  },

  dateTabTextActive: {
    color: COLORS.brand,
  },

  // FAVORITES ------------------------------------------------

  segmentControl: {
    flexDirection: "row",
    backgroundColor: COLORS.card,
    borderRadius: 7,
    marginHorizontal: 16,
    marginTop: 10,
    overflow: "hidden",
  },

  segmentItem: {
    flex: 1,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
  },

  segmentItemActive: {
    backgroundColor: COLORS.brand,
  },

  segmentText: {
    color: COLORS.textSoft,
    fontSize: 11,
  },

  segmentTextActive: {
    color: COLORS.text,
    fontWeight: "700",
  },

  listCard: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    overflow: "hidden",
  },

  listRow: {
    minHeight: 51,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  listRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },

  listRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  flagText: {
    fontSize: 18,
    width: 25,
  },

  listRowText: {
    color: COLORS.textSoft,
    fontSize: 13,
  },

  favoritePlayerCard: {
    minHeight: 84,
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  favoritePlayerImage: {
    width: 62,
    height: 62,
    borderRadius: 32,
  },

  favoritePlayerInfo: {
    flex: 1,
    marginLeft: 12,
  },

  favoritePlayerName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
  },

  favoritePlayerClub: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 4,
  },

  discoverMore: {
    marginTop: 18,
    padding: 14,
    borderRadius: 9,
    backgroundColor: COLORS.brandSoft,
    flexDirection: "row",
    alignItems: "center",
  },

  discoverMoreTextWrap: {
    flex: 1,
    marginLeft: 11,
  },

  discoverMoreTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },

  discoverMoreText: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 3,
  },

  // PREDICTION ------------------------------------------------

  predictionStats: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    flexDirection: "row",
    paddingVertical: 17,
  },

  predictionStat: {
    flex: 1,
    alignItems: "center",
  },

  predictionStatDivider: {
    width: 1,
    backgroundColor: COLORS.border,
  },

  predictionStatNumber: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
  },

  predictionStatLabel: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 3,
  },

  predictionNotice: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.brandSoft,
    borderRadius: 8,
    padding: 10,
  },

  predictionNoticeText: {
    color: COLORS.textSoft,
    fontSize: 11,
    marginLeft: 7,
  },

  predictionCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    borderRadius: 10,
    padding: 13,
    marginBottom: 9,
  },

  predictionMatchTop: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  predictionTime: {
    color: COLORS.muted,
    fontSize: 9,
  },

  predictionTeams: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
  },

  predictionTeam: {
    flex: 1,
    alignItems: "center",
  },

  predictionTeamName: {
    minHeight: 32,
    color: COLORS.text,
    textAlign: "center",
    fontSize: 11,
    marginTop: 5,
  },

  vsText: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: "800",
    paddingHorizontal: 8,
  },

  predictionButtons: {
    flexDirection: "row",
    gap: 6,
    marginTop: 12,
  },

  predictionButton: {
    flex: 1,
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },

  predictionButtonActive: {
    backgroundColor: COLORS.brand,
    borderColor: COLORS.brand,
  },

  predictionButtonText: {
    color: COLORS.textSoft,
    fontSize: 11,
    fontWeight: "700",
  },

  predictionButtonTextActive: {
    color: COLORS.text,
  },

  // MORE ------------------------------------------------

  moreRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },

  moreRight: {
    flexDirection: "row",
    alignItems: "center",
  },

  moreRightText: {
    color: COLORS.muted,
    fontSize: 11,
    marginRight: 6,
  },

  // MATCH DETAIL ------------------------------------------------

  detailHeader: {
    height: 66,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },

  detailHeaderButton: {
    width: 38,
  },

  detailHeaderTitle: {
    flex: 1,
    color: COLORS.text,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
  },

  detailHeaderActions: {
    width: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  detailContent: {
    paddingHorizontal: 17,
    paddingTop: 16,
  },

  roundText: {
    color: COLORS.muted,
    fontSize: 12,
    textAlign: "center",
  },

  detailScoreArea: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
  },

  detailTeam: {
    flex: 1,
    alignItems: "center",
  },

  detailTeamName: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 8,
  },

  detailScoreCenter: {
    width: 120,
    alignItems: "center",
  },

  detailScore: {
    color: COLORS.text,
    fontSize: 38,
    fontWeight: "900",
  },

  detailLiveTime: {
    color: COLORS.live,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
  },

  scorersRow: {
    marginTop: 20,
    paddingVertical: 13,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.borderSoft,
    flexDirection: "row",
  },

  scorersColumn: {
    flex: 1,
  },

  scorersColumnRight: {
    flex: 1,
    alignItems: "flex-end",
  },

  scorerText: {
    color: COLORS.textSoft,
    fontSize: 11,
    marginVertical: 3,
  },

  matchDetailTabs: {
    flexDirection: "row",
    marginTop: 18,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },

  matchDetailTab: {
    flex: 1,
    height: 43,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },

  matchDetailTabText: {
    color: COLORS.textSoft,
    fontSize: 9,
  },

  matchDetailTabTextActive: {
    color: COLORS.brand,
    fontWeight: "800",
  },

  matchDetailTabIndicator: {
    position: "absolute",
    bottom: 0,
    height: 2,
    left: 1,
    right: 1,
    backgroundColor: COLORS.brand,
  },

  timeline: {
    paddingTop: 13,
  },

  timelineRow: {
    minHeight: 77,
    flexDirection: "row",
  },

  timelineHome: {
    flex: 1,
    paddingRight: 12,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "flex-start",
    gap: 5,
  },

  timelineAway: {
    flex: 1,
    paddingLeft: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 5,
  },

  timelineCenterDot: {
    width: 1,
    backgroundColor: COLORS.border,
  },

  eventMinute: {
    color: COLORS.textSoft,
    fontSize: 11,
    fontWeight: "700",
  },

  eventText: {
    color: COLORS.textSoft,
    fontSize: 11,
    maxWidth: 115,
  },

  yellowCard: {
    width: 9,
    height: 13,
    borderRadius: 1,
    backgroundColor: COLORS.yellow,
  },

  halfTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 3,
    marginBottom: 22,
  },

  timelineLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.borderSoft,
  },

  halfTimeText: {
    color: COLORS.muted,
    fontSize: 10,
    marginHorizontal: 12,
  },

  tabPlaceholder: {
    marginTop: 15,
  },

  lineupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  lineupTeam: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },

  lineupFormation: {
    color: COLORS.muted,
    fontSize: 11,
  },

  lineupPlayer: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },

  lineupNumber: {
    color: COLORS.muted,
    width: 31,
    fontSize: 11,
  },

  lineupPlayerName: {
    color: COLORS.textSoft,
    fontSize: 12,
  },

  statsWrap: {
    marginTop: 12,
  },

  statRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },

  statNumber: {
    width: 58,
    color: COLORS.text,
    fontWeight: "800",
    textAlign: "center",
  },

  statName: {
    flex: 1,
    color: COLORS.muted,
    fontSize: 11,
    textAlign: "center",
  },

  h2hRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },

  h2hTeam: {
    flex: 1,
    color: COLORS.textSoft,
    fontSize: 11,
  },

  h2hTeamRight: {
    textAlign: "right",
  },

  h2hScore: {
    width: 70,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },

  // LEAGUE ------------------------------------------------

  leagueHeader: {
    height: 70,
    paddingHorizontal: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  leagueTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  leagueTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "700",
  },

  leagueTabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },

  leagueTab: {
    flex: 1,
    height: 45,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  leagueTabText: {
    color: COLORS.textSoft,
    fontSize: 10,
    fontWeight: "700",
  },

  leagueTabTextActive: {
    color: COLORS.brand,
  },

  leagueTabIndicator: {
    position: "absolute",
    bottom: 0,
    left: 12,
    right: 12,
    height: 2,
    backgroundColor: COLORS.brand,
  },

  tableWrap: {
    minWidth: 570,
  },

  tableHeader: {
    height: 39,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
  },

  tableHeaderCell: {
    width: 45,
    color: COLORS.muted,
    fontSize: 9,
    textAlign: "center",
  },

  tableRow: {
    height: 51,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },

  tableCell: {
    width: 45,
    color: COLORS.textSoft,
    fontSize: 11,
    textAlign: "center",
  },

  tableTeamCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  tableTeamName: {
    color: COLORS.textSoft,
    fontSize: 11,
    flex: 1,
  },

  tablePoints: {
    color: COLORS.text,
    fontWeight: "800",
  },

  fixtureCard: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },

  fixtureTime: {
    color: COLORS.muted,
    fontSize: 10,
    textAlign: "center",
  },

  fixtureTeamRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },

  fixtureTeam: {
    flex: 1,
    color: COLORS.text,
    fontSize: 12,
  },

  fixtureTeamRight: {
    textAlign: "right",
  },

  topScorerRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },

  scorerRank: {
    width: 35,
    color: COLORS.muted,
    fontSize: 12,
  },

  topScorerName: {
    flex: 1,
    color: COLORS.textSoft,
    fontSize: 13,
  },

  topScorerGoals: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
  },

  // PLAYER ------------------------------------------------

  playerHero: {
    height: 270,
  },

  playerHeroImage: {
    resizeMode: "cover",
  },

  playerHeroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },

  playerHeroTop: {
    marginTop: 14,
    paddingHorizontal: 17,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  playerContent: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
    paddingTop: 48,
    marginTop: -1,
  },

  playerAvatarWrap: {
    position: "absolute",
    top: -47,
    left: 18,
    width: 94,
    height: 94,
    borderRadius: 49,
    borderWidth: 3,
    borderColor: COLORS.text,
    overflow: "hidden",
    backgroundColor: COLORS.card,
  },

  playerAvatar: {
    width: "100%",
    height: "100%",
  },

  playerName: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "800",
  },

  playerClubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 7,
  },

  playerClub: {
    color: COLORS.textSoft,
    fontSize: 12,
  },

  playerQuickStats: {
    flexDirection: "row",
    marginTop: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },

  playerQuickStat: {
    flex: 1,
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: COLORS.borderSoft,
  },

  playerQuickValue: {
    color: COLORS.text,
    fontSize: 14,
  },

  playerQuickLabel: {
    color: COLORS.muted,
    fontSize: 9,
    marginTop: 4,
  },

  playerTabs: {
    flexDirection: "row",
    marginTop: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },

  playerTab: {
    flex: 1,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  playerTabText: {
    color: COLORS.textSoft,
    fontSize: 9,
  },

  playerTabTextActive: {
    color: COLORS.brand,
    fontWeight: "800",
  },

  playerTabIndicator: {
    position: "absolute",
    bottom: 0,
    left: 5,
    right: 5,
    height: 2,
    backgroundColor: COLORS.brand,
  },

  playerSeasonStats: {
    flexDirection: "row",
    gap: 5,
    marginTop: 13,
  },

  playerStatBox: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 7,
    paddingVertical: 13,
    alignItems: "center",
  },

  playerStatLabel: {
    color: COLORS.muted,
    fontSize: 8,
    textAlign: "center",
  },

  playerStatValue: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "800",
    marginTop: 5,
  },

  playerInfoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    marginTop: 11,
    paddingHorizontal: 12,
  },

  playerInfoRow: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  playerInfoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },

  playerInfoLabel: {
    color: COLORS.muted,
    fontSize: 11,
  },

  playerInfoValue: {
    color: COLORS.textSoft,
    fontSize: 11,
  },

  playerTabContent: {
    paddingVertical: 25,
  },

  placeholderTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "700",
  },

  placeholderText: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 7,
    lineHeight: 19,
  },

  // BOTTOM NAV ------------------------------------------------

  bottomNav: {
    height: Platform.OS === "ios" ? 73 : 68,
    backgroundColor: COLORS.backgroundSoft,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: "row",
    paddingTop: 6,
    paddingBottom: Platform.OS === "ios" ? 8 : 5,
  },

  bottomNavItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  bottomNavText: {
    color: COLORS.muted,
    fontSize: width < 370 ? 8 : 9,
    marginTop: 3,
  },

  bottomNavTextActive: {
    color: COLORS.brand,
  },
});