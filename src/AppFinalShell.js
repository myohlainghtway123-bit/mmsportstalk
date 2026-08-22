import React from "react";
import AppFinalShellV2 from "./AppFinalShellV2";
import OnboardingGate from "./final/OnboardingGate";

export default function AppFinalShell() {
  return (
    <OnboardingGate>
      {({ language, setLanguage }) => (
        <AppFinalShellV2 initialLanguage={language} onLanguageChange={setLanguage} />
      )}
    </OnboardingGate>
  );
}
