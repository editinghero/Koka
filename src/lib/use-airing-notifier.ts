import { useEffect } from "react";
import { useLibrary } from "./store";
import { scanAired, syncPending, warmUpNotifications } from "./airing-notify";

/** Mount once (AppShell): announces episodes the moment they air. */
export function useAiringNotifier(): void {
  const { library } = useLibrary();

  useEffect(() => {
    warmUpNotifications();
  }, []);

  useEffect(() => {
    syncPending(library);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      if (timer) clearTimeout(timer);
      const nextAt = scanAired();
      if (nextAt !== null) {
        const wait = nextAt * 1000 - Date.now() + 1500;
        timer = setTimeout(run, Math.min(Math.max(wait, 1000), 6 * 3600 * 1000));
      }
    };
    run();

    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", run);
    window.addEventListener("online", run);
    const interval = setInterval(run, 60_000);
    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", run);
      window.removeEventListener("online", run);
    };
  }, [library]);
}
