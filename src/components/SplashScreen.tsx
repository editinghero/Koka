import { useEffect, useState } from "react";

/**
 * First-paint boot screen. Shown while the app hydrates (and on PWA cold
 * start), then fades out. Uses fixed brand colours on purpose — it renders
 * before the theme preset is applied.
 */
export function SplashScreen() {
  const [done, setDone] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem("koka:booted") === "1";
    } catch {
      /* ignore */
    }
    if (seen) {
      setDone(true);
      setGone(true);
      return;
    }
    const a = setTimeout(() => setDone(true), 550);
    const b = setTimeout(() => {
      setGone(true);
      try {
        sessionStorage.setItem("koka:booted", "1");
      } catch {
        /* ignore */
      }
    }, 850);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);

  if (gone) return null;

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-500"
      style={{
        background: "#141414",
        opacity: done ? 0 : 1,
        pointerEvents: "none",
      }}
    >
      <div className="flex flex-col items-center gap-4">
        <span className="splash-shine font-display text-5xl font-semibold tracking-[0.2em]">
          KOKA
        </span>
        <span className="h-px w-24 origin-left animate-pulse bg-white/15" />
      </div>
    </div>
  );
}
