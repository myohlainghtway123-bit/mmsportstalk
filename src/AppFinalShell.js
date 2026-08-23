import React, { useCallback, useEffect, useRef, useState } from "react";
import * as Notifications from "expo-notifications";
import AppFinalShellV2 from "./AppFinalShellV2";
import OnboardingGate from "./final/OnboardingGate";
import NativeMatchScreenV5 from "./final/NativeMatchScreenV5";

function matchIdFromNotification(response) {
  const data = response?.notification?.request?.content?.data ?? {};
  const raw = data.matchId ?? data.match_id ?? data.fixtureId ?? data.fixture_id;
  const value = String(raw ?? "").trim();
  return /^\d+$/.test(value) ? value : null;
}

export default function AppFinalShell() {
  const [notificationMatchId, setNotificationMatchId] = useState(null);
  const handledResponseRef = useRef(null);

  const handleNotificationResponse = useCallback((response) => {
    const matchId = matchIdFromNotification(response);
    if (!matchId) return;
    const identifier = String(response?.notification?.request?.identifier ?? "notification");
    const key = `${identifier}:${matchId}`;
    if (handledResponseRef.current === key) return;
    handledResponseRef.current = key;
    setNotificationMatchId(matchId);
  }, []);

  useEffect(() => {
    let active = true;
    Notifications.getLastNotificationResponseAsync?.()
      .then((response) => {
        if (active && response) handleNotificationResponse(response);
      })
      .catch(() => {});

    const subscription = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
    return () => {
      active = false;
      subscription.remove();
    };
  }, [handleNotificationResponse]);

  return (
    <OnboardingGate>
      {({ language, setLanguage }) => notificationMatchId ? (
        <NativeMatchScreenV5
          match={{ id: notificationMatchId }}
          goBack={() => setNotificationMatchId(null)}
          language={language}
        />
      ) : (
        <AppFinalShellV2 initialLanguage={language} onLanguageChange={setLanguage} />
      )}
    </OnboardingGate>
  );
}
