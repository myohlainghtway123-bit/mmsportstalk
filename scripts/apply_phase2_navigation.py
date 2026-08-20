from pathlib import Path

path = Path("src/AppFull.js")
s = path.read_text()

anchor = '} from "./services/footballApi";\n'
addition = '''} from "./services/footballApi";\nimport {\n  AccountScreen,\n  FavoritesScreen as AccountFavoritesScreen,\n  PredictionScreen as AccountPredictionScreen,\n} from "./phase2/Phase2Screens";\n'''
if 'from "./phase2/Phase2Screens"' not in s:
    if anchor not in s:
        raise SystemExit("football API import anchor missing")
    s = s.replace(anchor, addition, 1)

old_sig = 'function MoreScreen({ openLeague, openTeam, openPlayer }) {'
new_sig = 'function MoreScreen({ openLeague, openTeam, openPlayer, openAccount }) {'
if old_sig in s:
    s = s.replace(old_sig, new_sig, 1)
elif new_sig not in s:
    raise SystemExit("MoreScreen signature missing")

old_account = '''        <SectionHeader title="ACCOUNT & APP" />\n        <View style={styles.listCard}>{["My Account", "Notifications", "Dark Mode", "Language", "Settings"].map((x, i) => <View key={x} style={[styles.listRow, i !== 4 && styles.rowBorder]}><Text style={styles.rowText}>{x}</Text><Ionicons name="chevron-forward" size={18} color={C.muted} /></View>)}</View>'''
new_account = '''        <SectionHeader title="ACCOUNT & APP" />\n        <View style={styles.listCard}>\n          <Pressable style={[styles.listRow, styles.rowBorder]} onPress={openAccount}>\n            <Text style={styles.rowText}>My Account</Text>\n            <Ionicons name="chevron-forward" size={18} color={C.muted} />\n          </Pressable>\n          {["Notifications", "Dark Mode", "Language", "Settings"].map((x, i) => (\n            <View key={x} style={[styles.listRow, i !== 3 && styles.rowBorder]}>\n              <Text style={styles.rowText}>{x}</Text>\n              <Ionicons name="chevron-forward" size={18} color={C.muted} />\n            </View>\n          ))}\n        </View>'''
if old_account in s:
    s = s.replace(old_account, new_account, 1)
elif 'onPress={openAccount}' not in s:
    raise SystemExit("ACCOUNT & APP block missing")

old_player = '  const openPlayer=(player)=>setRoute({name:"player",params:player?.id?player:{id:1100,name:"Erling Haaland"}});\n'
new_player = old_player + '  const openAccount=()=>setRoute({name:"account",params:null});\n'
if 'const openAccount=' not in s:
    if old_player not in s:
        raise SystemExit("openPlayer anchor missing")
    s = s.replace(old_player, new_player, 1)

old_main = '  const main=bottomTab==="scores"?<ScoresScreen openMatch={openMatch} openLeague={openLeague}/>:bottomTab==="favorites"?<FavoritesScreen openLeague={openLeague} openTeam={openTeam} openPlayer={openPlayer}/>:bottomTab==="prediction"?<PredictionScreen openMatch={openMatch}/>:bottomTab==="more"?<MoreScreen openLeague={openLeague} openTeam={openTeam} openPlayer={openPlayer}/>:<HomeScreen openMatch={openMatch} openLeague={openLeague}/>;'
new_main = '  const main=bottomTab==="scores"?<ScoresScreen openMatch={openMatch} openLeague={openLeague}/>:bottomTab==="favorites"?<AccountFavoritesScreen openLeague={openLeague} openTeam={openTeam} openPlayer={openPlayer} openAccount={openAccount}/>:bottomTab==="prediction"?<AccountPredictionScreen openMatch={openMatch} openAccount={openAccount}/>:bottomTab==="more"?<MoreScreen openLeague={openLeague} openTeam={openTeam} openPlayer={openPlayer} openAccount={openAccount}/>:<HomeScreen openMatch={openMatch} openLeague={openLeague}/>;'
if old_main in s:
    s = s.replace(old_main, new_main, 1)
elif 'AccountFavoritesScreen' not in s or 'AccountPredictionScreen' not in s:
    raise SystemExit("main route expression missing")

old_return_tail = '{route.name==="player"?<PlayerScreen player={route.params} goBack={goBack}/>:null}</View><BottomNav active={bottomTab} onChange={changeBottom}/></SafeAreaView>;'
new_return_tail = '{route.name==="player"?<PlayerScreen player={route.params} goBack={goBack}/>:null}{route.name==="account"?<AccountScreen goBack={goBack}/>:null}</View><BottomNav active={bottomTab} onChange={changeBottom}/></SafeAreaView>;'
if 'route.name==="account"' not in s:
    if old_return_tail not in s:
        raise SystemExit("route return tail missing")
    s = s.replace(old_return_tail, new_return_tail, 1)

required = [
    'AccountFavoritesScreen',
    'AccountPredictionScreen',
    'const openAccount=',
    'route.name==="account"',
    'onPress={openAccount}',
]
for token in required:
    if token not in s:
        raise SystemExit(f"Phase 2 wiring missing: {token}")

path.write_text(s)
print("Phase 2 navigation connected")
