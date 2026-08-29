// Phase 4B uses the existing MST Score application with a deliberately narrow,
// staging-only entrypoint. The full product shell remains in the repository but
// is not imported into this internal-alpha bundle.
export { default } from "./src/phase4b/Phase4BScoresInternalAlpha";
