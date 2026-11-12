import { useEffect, useRef } from "react";
import { useSession, useSettings } from "./store";
import { claimLaunchShuffle, getAutoShuffle, shuffleTheme } from "./theme-prefs";

/** Mount once (AppShell): with Auto shuffle on, pick a new theme at launch. */
export function useLaunchShuffle(): void {
  const { ready } = useSession();
  const { settings, update } = useSettings();
  const done = useRef(false);

  useEffect(() => {
    // Wait until saved settings have loaded, otherwise they'd overwrite the pick.
    if (!ready || done.current) return;
    done.current = true;
    if (getAutoShuffle() && claimLaunchShuffle()) shuffleTheme(settings, update);
  }, [ready, settings, update]);
}
