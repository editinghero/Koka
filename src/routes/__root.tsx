import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { AppShell } from "@/components/AppShell";
import { AuthScreen } from "@/components/AuthScreen";
import { PinLock } from "@/components/PinLock";
import { SplashScreen } from "@/components/SplashScreen";
import {
  applyThemeFromSettings,
  boot,
  clearCache,
  useSession,
} from "@/lib/store";
import { clearPin, isLocked } from "@/lib/pin";
import { signOut } from "@/lib/auth.functions";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">
          Page not found
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back
          home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: "Koka — All-in-one Anime Dashboard" },
        {
          name: "description",
          content:
            "A calm, all-in-one anime workspace: AniList & MAL import, seasonal charts, AI news and markdown notes.",
        },
        { name: "author", content: "Koka" },
        { property: "og:title", content: "Koka — Anime Dashboard" },
        {
          property: "og:description",
          content:
            "Track, plan and analyse anime with AI news digests and markdown notes.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [
        {
          rel: "stylesheet",
          href: appCss,
        },
        { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
        {
          rel: "icon",
          type: "image/png",
          sizes: "96x96",
          href: "/favicon96.png",
        },
        { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
        { rel: "manifest", href: "/manifest.webmanifest" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossOrigin: "anonymous",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Manrope:wght@400;500;600&display=swap",
        },
      ],
    }),
    shellComponent: RootShell,
    component: RootComponent,
    notFoundComponent: NotFoundComponent,
    errorComponent: ErrorComponent,
  },
);

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <AppShell>
          <Outlet />
        </AppShell>
      </AuthGate>
      <Toaster position="bottom-right" />
    </QueryClientProvider>
  );
}

function AuthGate({ children }: { children: ReactNode }) {
  const { user, ready, reload } = useSession();
  const [locked, setLocked] = useState(() => isLocked());

  useEffect(() => {
    applyThemeFromSettings();
    void boot();
  }, []);

  useEffect(() => {
    if (user && isLocked()) setLocked(true);
    const onLock = () => setLocked(true);
    window.addEventListener("koka:lock", onLock);
    return () => window.removeEventListener("koka:lock", onLock);
  }, [user]);

  if (!ready && !user) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!user) return <AuthScreen />;

  if (locked) {
    return (
      <>
        <SplashScreen />
        <PinLock
          onUnlocked={() => setLocked(false)}
          onLockout={() => {
            clearPin();
            clearCache();
            void signOut()
              .catch(() => undefined)
              .then(() => {
                setLocked(false);
                void reload();
              });
          }}
        />
      </>
    );
  }

  return <>{children}</>;
}
