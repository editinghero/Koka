import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  Eye,
  EyeOff,
  Lock,
  LogOut,
  Tag,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import {
  clearCache,
  useLibrary,
  useNotes,
  useSession,
  useSettings,
} from "@/lib/store";
import { clearAllChatHistory } from "@/lib/chat-storage";
import {
  changePassword,
  signOut,
  updateProfileName,
} from "@/lib/auth.functions";
import { clearPin, hasPin, lockNow, setPin } from "@/lib/pin";
import { GEMINI_MODELS, normalizeTags } from "@/lib/types";
import { DARK_THEMES, LIGHT_THEMES, type ThemePreset } from "@/lib/themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Koka Anime Dashboard" },
      {
        name: "description",
        content:
          "Add your Gemini API key, choose a model, set spoiler-free defaults, pick a theme and manage your locally stored anime data.",
      },
      { property: "og:title", content: "Settings — Koka Anime Dashboard" },
      {
        property: "og:description",
        content: "Gemini API key, model choice, theme and local data controls.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { settings, update } = useSettings();
  const { setLibrary } = useLibrary();
  const { setNotes } = useNotes();
  const [show, setShow] = useState(false);

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Account, keys, appearance and data — synced to your account."
      />

      <div className="grid gap-4">
        <section className="panel p-5">
          <h2 className="font-display text-sm font-semibold">Gemini AI</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            AI features call Google Gemini directly from your browser with your
            own key. It is stored encrypted in your account and never shared.
          </p>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key">API key</Label>
              <div className="flex gap-2">
                <Input
                  id="key"
                  type={show ? "text" : "password"}
                  value={settings.geminiKey}
                  onChange={(e) => update({ geminiKey: e.target.value })}
                  placeholder="AIza…"
                  autoComplete="off"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShow((s) => !s)}
                  aria-label="Toggle key visibility"
                >
                  {show ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Get a key from Google AI Studio{" "}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <select
                id="model"
                value={
                  GEMINI_MODELS.includes(settings.model)
                    ? settings.model
                    : "__custom"
                }
                onChange={(e) =>
                  update({
                    model: e.target.value === "__custom" ? "" : e.target.value,
                  })
                }
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              >
                {GEMINI_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
                <option value="__custom">Custom model ID…</option>
              </select>
              {!GEMINI_MODELS.includes(settings.model) ? (
                <Input
                  value={settings.model}
                  onChange={(e) => update({ model: e.target.value })}
                  placeholder="e.g. gemini-3-pro-preview"
                />
              ) : null}
              <p className="text-xs text-muted-foreground">
                Free-tier models are listed. Google Search grounding is used
                automatically for news and web-backed answers.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Spoiler-free by default</p>
                <p className="text-xs text-muted-foreground">
                  Summaries skip plot twists and character details.
                </p>
              </div>
              <Switch
                checked={settings.spoilerFree}
                onCheckedChange={(v) => update({ spoilerFree: v })}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">AI Chat History</p>
                <p className="text-xs text-muted-foreground">
                  Clear all saved AI conversations across all anime titles and
                  global assistant.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => {
                  if (
                    confirm(
                      "Are you sure you want to clear all AI chat histories from all places?",
                    )
                  ) {
                    clearAllChatHistory();
                    toast.success("All AI chat histories have been cleared.");
                  }
                }}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Clear All Chat
              </Button>
            </div>
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="font-display text-sm font-semibold">Appearance</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Pick a mode, then a palette. Light palettes follow the seasons; dark
            palettes stay deep and calm.
          </p>

          <div className="mt-3 flex gap-2">
            {(["light", "dark"] as const).map((t) => (
              <button
                key={t}
                onClick={() => update({ theme: t })}
                className={`flex-1 rounded-lg border p-3 text-sm capitalize transition-colors ${
                  settings.theme === t
                    ? "border-primary text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <ThemeGrid
            title="Light palettes — seasonal"
            themes={LIGHT_THEMES}
            active={settings.lightTheme}
            onPick={(id) => update({ lightTheme: id, theme: "light" })}
          />
          <ThemeGrid
            title="Dark palettes"
            themes={DARK_THEMES}
            active={settings.darkTheme}
            onPick={(id) => update({ darkTheme: id, theme: "dark" })}
          />
        </section>

        <AccountSection />
        <TagManagerSection />
        <PinSection />

        <section className="panel p-5">
          <h2 className="font-display text-sm font-semibold">Data</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Your library, notes, scores, dates and settings are stored securely
            in your account, and your Gemini key is encrypted at rest. Export a
            backup from the Import page before clearing.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 text-destructive"
            onClick={() => {
              if (!confirm("Delete your library and all notes?")) return;
              setLibrary([]);
              setNotes([]);
              toast.success("Library and notes cleared");
            }}
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear library and notes
          </Button>
        </section>
      </div>
    </>
  );
}

function ThemeGrid({
  title,
  themes,
  active,
  onPick,
}: {
  title: string;
  themes: ThemePreset[];
  active: string;
  onPick: (id: string) => void;
}) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{title}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {themes.map((t) => (
          <button
            key={t.id}
            onClick={() => onPick(t.id)}
            className={`rounded-lg border p-2.5 text-left transition-colors ${
              active === t.id
                ? "border-primary"
                : "border-border hover:border-muted-foreground/40"
            }`}
          >
            <span className="flex gap-1">
              {t.swatch.map((c) => (
                <span
                  key={c}
                  className="h-4 w-4 rounded-full border border-black/10"
                  style={{ backgroundColor: c }}
                />
              ))}
            </span>
            <span className="mt-2 block text-xs font-medium">{t.label}</span>
            <span className="block text-[11px] text-muted-foreground">
              {t.hint}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AccountSection() {
  const { user, reload } = useSession();
  const [name, setName] = useState(user?.name ?? "");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  return (
    <section className="panel p-5">
      <h2 className="font-display text-sm font-semibold">Account</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Signed in as{" "}
        <span className="text-foreground">{user?.email ?? "—"}</span>. Email
        addresses can't be changed.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="profile-name">Display name</Label>
          <div className="flex gap-2">
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button
              variant="outline"
              disabled={busy || name.trim() === (user?.name ?? "")}
              onClick={async () => {
                setBusy(true);
                try {
                  await updateProfileName({ data: { name } });
                  await reload();
                  toast.success("Name updated");
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "Could not save",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pw-current">Reset password</Label>
          <Input
            id="pw-current"
            type="password"
            placeholder="Current password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
          <Input
            type="password"
            placeholder="New password (8+ characters)"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
          />
          <Input
            type="password"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
          {confirm && confirm !== next ? (
            <p className="text-xs text-destructive">Passwords don't match.</p>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            disabled={busy || !current || next.length < 8 || next !== confirm}
            onClick={async () => {
              setBusy(true);
              try {
                await changePassword({ data: { current, next } });
                setCurrent("");
                setNext("");
                setConfirm("");
                toast.success("Password updated");
              } catch (e) {
                toast.error(
                  e instanceof Error ? e.message : "Could not update",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Update password
          </Button>
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={async () => {
          clearPin();
          await signOut().catch(() => undefined);
          clearCache();
          await reload();
        }}
      >
        <LogOut className="h-3.5 w-3.5" /> Sign out
      </Button>
    </section>
  );
}

function PinSection() {
  const [enabled, setEnabled] = useState(false);
  const [pin, setPinValue] = useState("");

  useEffect(() => setEnabled(hasPin()), []);

  return (
    <section className="panel p-5">
      <h2 className="font-display text-sm font-semibold">App lock</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Lock Koka on this device with a 4-digit PIN. The PIN stays on this
        device only — it is never synced or backed up. Six wrong tries signs you
        out and resets it.
      </p>

      {enabled ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => lockNow()}>
            <Lock className="h-3.5 w-3.5" /> Lock now
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              clearPin();
              setEnabled(false);
              toast.success("PIN removed");
            }}
          >
            Remove PIN
          </Button>
        </div>
      ) : (
        <div className="mt-4 flex gap-2">
          <Input
            value={pin}
            inputMode="numeric"
            maxLength={4}
            placeholder="4-digit PIN"
            onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ""))}
            className="max-w-[9rem]"
          />
          <Button
            variant="outline"
            disabled={pin.length !== 4}
            onClick={async () => {
              await setPin(pin);
              setPinValue("");
              setEnabled(true);
              toast.success("PIN set");
            }}
          >
            Set PIN
          </Button>
        </div>
      )}
    </section>
  );
}

function TagManagerSection() {
  const { library, patch } = useLibrary();
  const { notes, saveNote } = useNotes();
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const tagCounts = useMemo(() => {
    const map = new Map<string, { libraryCount: number; notesCount: number }>();

    library.forEach((entry) => {
      entry.tags?.forEach((t) => {
        const clean = t.trim().toLowerCase();
        if (!clean) return;
        const current = map.get(clean) ?? { libraryCount: 0, notesCount: 0 };
        current.libraryCount++;
        map.set(clean, current);
      });
    });

    notes.forEach((note) => {
      note.tags?.forEach((t) => {
        const clean = t.trim().toLowerCase();
        if (!clean) return;
        const current = map.get(clean) ?? { libraryCount: 0, notesCount: 0 };
        current.notesCount++;
        map.set(clean, current);
      });
    });

    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [library, notes]);

  const deleteTagGlobally = (targetTag: string) => {
    const cleanTarget = targetTag.trim().toLowerCase();
    library.forEach((entry) => {
      if (entry.tags?.some((t) => t.trim().toLowerCase() === cleanTarget)) {
        const nextTags = entry.tags.filter(
          (t) => t.trim().toLowerCase() !== cleanTarget,
        );
        patch(entry.media.id, { tags: nextTags });
      }
    });

    notes.forEach((note) => {
      if (note.tags?.some((t) => t.trim().toLowerCase() === cleanTarget)) {
        const nextTags = note.tags.filter(
          (t) => t.trim().toLowerCase() !== cleanTarget,
        );
        saveNote({ ...note, tags: nextTags });
      }
    });
    toast.success(`Tag "#${cleanTarget}" deleted globally`);
  };

  const renameTagGlobally = (oldTag: string, newTag: string) => {
    const cleanOld = oldTag.trim().toLowerCase();
    const cleanNew = newTag.trim().toLowerCase();
    if (!cleanNew || cleanOld === cleanNew) {
      setEditingTag(null);
      return;
    }

    library.forEach((entry) => {
      if (entry.tags?.some((t) => t.trim().toLowerCase() === cleanOld)) {
        const nextTags = normalizeTags([
          ...entry.tags.filter((t) => t.trim().toLowerCase() !== cleanOld),
          cleanNew,
        ]);
        patch(entry.media.id, { tags: nextTags });
      }
    });

    notes.forEach((note) => {
      if (note.tags?.some((t) => t.trim().toLowerCase() === cleanOld)) {
        const nextTags = normalizeTags([
          ...note.tags.filter((t) => t.trim().toLowerCase() !== cleanOld),
          cleanNew,
        ]);
        saveNote({ ...note, tags: nextTags });
      }
    });

    toast.success(`Tag "#${cleanOld}" renamed to "#${cleanNew}"`);
    setEditingTag(null);
    setRenameValue("");
  };

  return (
    <section className="panel p-5">
      <h2 className="font-display text-sm font-semibold">Tag Manager</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Manage all custom tags across your library and notes. Renaming or
        deleting a tag updates all matching titles and notes globally.
      </p>

      {tagCounts.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {tagCounts.map(([tagName, counts]) => {
            const isEditing = editingTag === tagName;
            const total = counts.libraryCount + counts.notesCount;

            if (isEditing) {
              return (
                <div key={tagName} className="flex items-center gap-1">
                  <Input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="h-7 w-28 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        renameTagGlobally(tagName, renameValue);
                      if (e.key === "Escape") setEditingTag(null);
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => renameTagGlobally(tagName, renameValue)}
                  >
                    Save
                  </Button>
                </div>
              );
            }

            return (
              <div
                key={tagName}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs"
              >
                <span className="font-medium text-foreground">#{tagName}</span>
                <span className="rounded-full bg-secondary px-1.5 py-0.2 text-[10px] text-muted-foreground">
                  {total}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingTag(tagName);
                    setRenameValue(tagName);
                  }}
                  className="text-muted-foreground hover:text-primary transition-colors text-[11px]"
                  title="Rename tag"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteTagGlobally(tagName)}
                  className="text-muted-foreground hover:text-destructive transition-colors text-[11px]"
                  title="Delete tag globally"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          No custom tags created yet. Add custom tags on any anime detail page
          or inside your notes.
        </p>
      )}
    </section>
  );
}
