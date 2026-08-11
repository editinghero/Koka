import { useEffect, useRef, useState } from "react";
import { Delete, Lock, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MAX_TRIES,
  checkPin,
  isLocked,
  recordFailedTry,
  triesLeft,
  unlock,
} from "@/lib/pin";

import { applyThemeFromSettings } from "@/lib/store";

/**
 * Dedicated Standalone Security PIN Page.
 * Styled as a sleek, unbypassable full-page interface that follows app theme tokens.
 */
export function PinLock({
  onUnlocked,
  onLockout,
}: {
  onUnlocked: () => void;
  onLockout: () => void;
}) {
  const [pin, setPin] = useState("");
  const [left, setLeft] = useState(MAX_TRIES);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    applyThemeFromSettings();
    if (isLocked()) setLeft(triesLeft());
  }, []);

  const press = (digit: string) => {
    if (pin.length >= 4) return;
    setPin((p) => p + digit);
  };

  useEffect(() => {
    if (pin.length !== 4) return;
    let cancelled = false;
    void checkPin(pin).then((ok) => {
      if (cancelled) return;
      if (ok) {
        unlock();
        onUnlocked();
        return;
      }
      const remaining = recordFailedTry();
      setLeft(remaining);
      setShake(true);
      setTimeout(() => setShake(false), 420);
      setPin("");
      if (remaining <= 0) onLockout();
    });
    return () => {
      cancelled = true;
    };
  }, [pin, onUnlocked, onLockout]);

  const pinRef = useRef(pin);
  pinRef.current = pin;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (/^[0-9]$/.test(e.key) && pinRef.current.length < 4) {
        setPin((p) => p + e.key);
      }
      if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background px-6 select-none">
      {/* Glow background accent */}
      <div className="pointer-events-none absolute h-64 w-64 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative z-10 flex flex-col items-center animate-in fade-in-0 zoom-in-95 duration-300 max-w-sm w-full">
        {/* Brand Badge */}
        <div className="mb-2 flex items-center gap-2 rounded-full border border-border/80 bg-surface/80 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-md">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          <span>Device Security</span>
        </div>

        {/* Lock Icon */}
        <div className="mt-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-lg shadow-primary/5">
          <Lock className="h-6 w-6" />
        </div>

        <h1 className="font-display mt-5 text-2xl font-bold tracking-tight">
          Koka is Locked
        </h1>
        <p className="mt-1.5 text-center text-xs text-muted-foreground">
          Enter your 4-digit PIN to access your anime & manga workspace
        </p>

        {/* PIN Indicators */}
        <div
          className={cn(
            "mt-8 flex gap-4",
            shake && "animate-[pin-shake_0.4s_ease-in-out]",
          )}
        >
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn(
                "h-4 w-4 rounded-full border-2 transition-all duration-200",
                i < pin.length
                  ? "scale-110 border-primary bg-primary shadow-md shadow-primary/30"
                  : "border-border bg-surface/50",
              )}
            />
          ))}
        </div>

        {/* Tries Warning */}
        <p className="mt-4 h-5 text-center text-xs font-medium text-destructive">
          {left < MAX_TRIES
            ? `${left} ${left === 1 ? "attempt" : "attempts"} remaining before account sign-out`
            : ""}
        </p>

        {/* Keypad */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <PinKey key={d} onClick={() => press(d)}>
              {d}
            </PinKey>
          ))}
          <span />
          <PinKey onClick={() => press("0")}>0</PinKey>
          <PinKey
            onClick={() => setPin((p) => p.slice(0, -1))}
            aria-label="Delete digit"
          >
            <Delete className="h-5 w-5 text-muted-foreground hover:text-foreground" />
          </PinKey>
        </div>
      </div>
    </div>
  );
}

function PinKey({
  children,
  onClick,
  ...rest
}: {
  children: React.ReactNode;
  onClick: () => void;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      type="button"
      onClick={onClick}
      className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border/80 bg-surface/90 text-xl font-semibold shadow-sm transition-all duration-150 hover:border-primary/40 hover:bg-secondary active:scale-90"
    >
      {children}
    </button>
  );
}
