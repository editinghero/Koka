import { useEffect, useState } from "react";
import { Shuffle, Type } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/lib/store";
import {
  claimLaunchShuffle,
  getAutoShuffle,
  getFontForce,
  setAutoShuffle,
  setFontForce,
  shuffleTheme,
} from "@/lib/theme-prefs";
import { cn } from "@/lib/utils";

function Toggle({
  on,
  onClick,
  icon,
  title,
  caption,
}: {
  on: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  caption: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "rounded-xl border p-3 text-left transition-all duration-150 active:scale-95",
        on
          ? "border-primary bg-primary/5"
          : "border-border hover:border-muted-foreground/40",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg bg-secondary",
            on ? "text-primary" : "text-muted-foreground",
          )}
        >
          {icon}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            on ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
          )}
        >
          {on ? "On" : "Off"}
        </span>
      </span>
      <span className="mt-2 block text-xs font-medium">{title}</span>
      <span className="block text-[11px] text-muted-foreground">{caption}</span>
    </button>
  );
}

export function ThemeShuffleControls() {
  const { settings, update } = useSettings();
  const [auto, setAuto] = useState(false);
  const [force, setForce] = useState(false);

  useEffect(() => {
    setAuto(getAutoShuffle());
    setForce(getFontForce());
  }, []);

  const mode = settings.theme === "dark" ? "dark" : "light";

  function shuffleNow(): boolean {
    const next = shuffleTheme(settings, update);
    if (next) toast.success(`Theme: ${next.label}`);
    return next !== null;
  }

  function toggleAuto() {
    const next = !auto;
    setAuto(next);
    setAutoShuffle(next);
    if (next) {
      claimLaunchShuffle(); // the shuffle below counts as this session's
      shuffleNow();
    } else {
      toast("Auto shuffle off");
    }
  }

  function toggleForce() {
    const next = !force;
    setForce(next);
    setFontForce(next);
    toast(next ? "Your font now applies to every theme" : "Themes can use their own fonts");
  }

  return (
    <div className="mt-4">
      <div className="grid grid-cols-2 gap-2">
        <Toggle
          on={auto}
          onClick={toggleAuto}
          icon={<Shuffle className="h-4 w-4" />}
          title="Auto shuffle"
          caption={`New ${mode} theme each launch`}
        />
        <Toggle
          on={force}
          onClick={toggleForce}
          icon={<Type className="h-4 w-4" />}
          title="Force font"
          caption="Your font on every theme"
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          Shuffle only picks {mode} themes, following the Light / Dark mode below.
        </p>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          onClick={() => void shuffleNow()}
        >
          <Shuffle className="h-3.5 w-3.5" /> Shuffle now
        </Button>
      </div>
    </div>
  );
}
