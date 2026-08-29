const App = process.env.EXPO_PUBLIC_MST_INTERNAL === "true"
  ? require("./src/phase4b/Phase4BScoresInternalAlpha").default
  : require("./src/AppFinalShell").default;

export default App;
