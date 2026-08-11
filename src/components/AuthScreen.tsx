import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getAuthConfig, signIn, signUp } from "@/lib/auth.functions";
import { boot } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/** Sign-in / sign-up screen shown whenever there is no session. */
export function AuthScreen() {
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: config } = useQuery({
    queryKey: ["auth-config"],
    queryFn: () => getAuthConfig(),
    staleTime: 60_000,
  });
  const signupsOpen = config?.signupsAllowed ?? true;
  const mode = signupsOpen ? tab : "signin";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        await signUp({ data: { email, name, password } });
      } else {
        await signIn({ data: { email, password } });
      }
      await boot(true);
      toast.success(mode === "signup" ? "Account created" : "Welcome back");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex w-full flex-col items-center justify-center bg-background px-4 py-8">
      <div className="animate-in fade-in-0 slide-in-from-bottom-3 duration-300 my-auto w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-lg font-semibold text-primary-foreground">
            K
          </span>
          <h1 className="font-display mt-3 text-2xl font-semibold">Koka</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your anime & manga workspace — synced to your account.
          </p>
        </div>

        {signupsOpen ? (
          <div className="mb-4 flex rounded-full border border-border bg-surface p-0.5">
            {(["signin", "signup"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200",
                  tab === t
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>
        ) : null}

        <form onSubmit={submit} className="panel space-y-4 p-5">
          {mode === "signup" ? (
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {mode === "signup" ? "Create account" : "Sign in"}
          </Button>

          {!signupsOpen ? (
            <p className="text-center text-xs text-muted-foreground">
              Sign-ups are closed on this instance.
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
