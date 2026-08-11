import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Library,
  Compass,
  Newspaper,
  Sparkles,
  NotebookPen,
  Settings as SettingsIcon,
  Moon,
  Sun,
  Import,
  Search as SearchIcon,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { useMediaMode, useSettings } from "@/lib/store";
import { GlobalSearch, SearchTrigger } from "@/components/GlobalSearch";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";
import { SplashScreen } from "@/components/SplashScreen";
import type { MediaType } from "@/lib/types";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/library", label: "Library", icon: Library },
  { to: "/seasons", label: "Discover", icon: Compass },
  { to: "/news", label: "News", icon: Newspaper },
  { to: "/insights", label: "Insights", icon: Sparkles },
  { to: "/notes", label: "Notes", icon: NotebookPen },
  { to: "/import", label: "Import", icon: Import },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

const BOTTOM_NAV = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/library", label: "Library", icon: Library },
  { to: "/seasons", label: "Discover", icon: Compass },
  { to: "/insights", label: "Insights", icon: Sparkles },
] as const;

/** Pages that already live in the floating bar are dropped from the sheet. */
const SECONDARY_NAV = NAV.filter(
  (item) => !BOTTOM_NAV.some((b) => b.to === item.to),
);

function ThemeToggle() {
  const { settings, update } = useSettings();
  const dark = settings.theme === "dark";
  return (
    <button
      onClick={() => update({ theme: dark ? "light" : "dark" })}
      aria-label="Toggle theme"
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-all duration-200 hover:bg-secondary hover:text-foreground active:scale-95"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

function ModeSwitch({ className }: { className?: string }) {
  const { mode, setMode } = useMediaMode();
  const options: { value: MediaType; label: string }[] = [
    { value: "ANIME", label: "Anime" },
    { value: "MANGA", label: "Manga" },
  ];
  return (
    <div
      role="tablist"
      aria-label="Media type"
      className={cn(
        "relative flex items-center rounded-full border border-border bg-surface p-0.5",
        className,
      )}
    >
      {options.map((o) => {
        const active = mode === o.value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => setMode(o.value)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-all duration-300 active:scale-95",
              active
                ? "bg-primary text-primary-foreground shadow-[var(--shadow-soft)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Keeps children mounted through the closing animation. */
function useAnimatedPresence(open: boolean, ms = 220) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const t = setTimeout(() => setMounted(false), ms);
    return () => clearTimeout(t);
  }, [open, ms]);
  return mounted;
}

function NavGrid({
  items,
  pathname,
  onNavigate,
}: {
  items: readonly {
    to: string;
    label: string;
    icon: ComponentType<{ className?: string }>;
  }[];
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1">
      {items.map((item) => {
        const active =
          item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm transition-all duration-200 active:scale-[0.97]",
              active
                ? "bg-secondary font-medium text-foreground"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [searchOpen, setSearchOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const sheetMounted = useAnimatedPresence(sheetOpen, 260);

  const dark = settings.theme === "dark";
  const preset = dark ? settings.darkTheme : settings.lightTheme;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.dataset["theme"] = preset;
  }, [dark, preset]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
      if (e.key === "Escape") setSheetOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar px-3 py-5 transition-all duration-300 md:flex",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <Link
          to="/"
          className={cn(
            "mb-6 flex items-center gap-2",
            collapsed ? "justify-center px-0" : "px-2",
          )}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-display text-sm font-semibold text-primary-foreground">
            K
          </span>
          {!collapsed ? (
            <div className="leading-tight">
              <p className="font-display text-sm font-semibold">Koka</p>
              <p className="text-[11px] text-muted-foreground">
                Anime & manga workspace
              </p>
            </div>
          ) : null}
        </Link>

        {!collapsed ? (
          <div className="mb-3">
            <SearchTrigger onClick={() => setSearchOpen(true)} />
          </div>
        ) : null}

        <nav className="flex flex-1 flex-col gap-0.5">
          {NAV.map((item) => {
            const active =
              item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg py-2 text-sm transition-all duration-200",
                  collapsed ? "justify-center px-0" : "px-2.5",
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed ? item.label : null}
              </Link>
            );
          })}
        </nav>

        <div
          className={cn(
            "flex items-center pt-3",
            collapsed ? "justify-center" : "justify-between px-1",
          )}
        >
          {!collapsed ? (
            <span className="text-[11px] text-muted-foreground">
              Synced to your account
            </span>
          ) : null}
          <button
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-all duration-200 hover:bg-secondary hover:text-foreground active:scale-95"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>
      </aside>

      <div className={cn(collapsed ? "md:pl-16" : "md:pl-60")}>
        {/* desktop top header */}
        <header className="sticky top-0 z-20 hidden border-b border-border bg-background/85 px-8 py-3 backdrop-blur md:block">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
            <ModeSwitch />
            <div className="flex items-center gap-2">
              <div className="w-56">
                <SearchTrigger onClick={() => setSearchOpen(true)} />
              </div>
              <NotificationsDropdown />
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* mobile header */}
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex items-center justify-between gap-2">
            <ModeSwitch />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSearchOpen(true)}
                aria-label="Search"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-all duration-200 hover:text-foreground active:scale-95"
              >
                <SearchIcon className="h-4 w-4" />
              </button>
              <NotificationsDropdown />
              <Link
                to="/settings"
                aria-label="Settings"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-all duration-200 hover:text-foreground active:scale-95"
              >
                <SettingsIcon className="h-4 w-4" />
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-28 md:px-8 md:pt-8 md:pb-12">
          <div
            key={pathname}
            className="animate-in duration-200 fade-in-0 slide-in-from-bottom-1 ease-out"
          >
            {children}
          </div>
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
        <div className="flex w-full max-w-sm items-center justify-between gap-1 rounded-full border border-border bg-background/90 px-2 py-1.5 shadow-[var(--shadow-soft)] backdrop-blur-md">
          {BOTTOM_NAV.map((item) => {
            const active =
              item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-label={item.label}
                onClick={() => setSheetOpen(false)}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 rounded-full px-2 py-1.5 text-[10px] transition-all duration-200 active:scale-95",
                  active
                    ? "bg-secondary font-medium text-foreground"
                    : "text-muted-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          <button
            onClick={() => setSheetOpen((o) => !o)}
            aria-label={sheetOpen ? "Close menu" : "More"}
            aria-expanded={sheetOpen}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 rounded-full px-2 py-1.5 text-[10px] transition-all duration-200 active:scale-95",
              sheetOpen
                ? "bg-secondary font-medium text-foreground"
                : "text-muted-foreground",
            )}
          >
            <span className="relative flex h-4 w-4 items-center justify-center">
              <MoreHorizontal
                className={cn(
                  "absolute h-4 w-4 transition-all duration-200",
                  sheetOpen ? "scale-75 opacity-0" : "scale-100 opacity-100",
                )}
              />
              <X
                className={cn(
                  "absolute h-4 w-4 transition-all duration-200",
                  sheetOpen ? "scale-100 opacity-100" : "scale-75 opacity-0",
                )}
              />
            </span>
            {sheetOpen ? "Close" : "More"}
          </button>
        </div>
      </nav>

      {sheetMounted ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            aria-label="Close menu"
            onClick={() => setSheetOpen(false)}
            className={cn(
              "absolute inset-0 bg-background/60 backdrop-blur-sm duration-200",
              sheetOpen
                ? "animate-in fade-in-0"
                : "animate-out fade-out-0 fill-mode-forwards",
            )}
          />
          <div
            className={cn(
              "absolute inset-x-0 bottom-0 px-3 pb-[max(4.75rem,calc(env(safe-area-inset-bottom)+4rem))] duration-300",
              sheetOpen
                ? "animate-in fade-in-0 slide-in-from-bottom-8"
                : "animate-out fade-out-0 slide-out-to-bottom-8 fill-mode-forwards",
            )}
          >
            <div className="rounded-3xl border border-border bg-background/95 p-3 shadow-[var(--shadow-soft)] backdrop-blur-md">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
              <NavGrid
                items={SECONDARY_NAV}
                pathname={pathname}
                onNavigate={() => setSheetOpen(false)}
              />
            </div>
          </div>
        </div>
      ) : null}

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <SplashScreen />
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold md:text-3xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
