import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSettings } from "@/lib/store";
import {
  RADIUS_CHOICES,
  autoFixTheme,
  blankTheme,
  deleteCustomTheme,
  deriveTheme,
  exportCustomTheme,
  isHex,
  parseCustomTheme,
  readCurrentThemeColors,
  saveCustomTheme,
  setActiveCustomTheme,
  useCustomThemes,
  type CustomTheme,
  type Derived,
  type ThemeMode,
} from "@/lib/custom-theme";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------ small bits */

function ColorField({
  label,
  hint,
  value,
  onChange,
  onReset,
}: {
  label: string;
  hint?: string | undefined;
  value: string;
  onChange: (v: string) => void;
  onReset?: (() => void) | undefined;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <div className="flex items-center gap-2.5">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value.toLowerCase())}
        aria-label={`${label} colour`}
        className="h-9 w-11 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
      />
      <div className="min-w-0 flex-1">
        <Label className="text-xs">{label}</Label>
        {hint ? (
          <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
        ) : null}
      </div>
      {onReset ? (
        <button
          type="button"
          onClick={onReset}
          className="text-[11px] text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
        >
          Auto
        </button>
      ) : null}
      <Input
        value={text}
        maxLength={7}
        spellCheck={false}
        aria-label={`${label} hex value`}
        onChange={(e) => {
          setText(e.target.value);
          const v = e.target.value.startsWith("#")
            ? e.target.value
            : `#${e.target.value}`;
          if (isHex(v)) onChange(v.toLowerCase());
        }}
        className="h-9 w-24 font-mono text-xs"
      />
    </div>
  );
}

function ThemePreview({ derived }: { derived: Derived }) {
  const style = Object.fromEntries(
    Object.entries(derived.vars).map(([k, v]) => [`--${k}`, v]),
  ) as CSSProperties;
  return (
    <div
      style={{
        ...style,
        background: "var(--background)",
        color: "var(--foreground)",
        borderRadius: "calc(var(--radius) + 6px)",
      }}
      className="border border-border p-3"
      aria-label="Live preview"
    >
      <div
        className="space-y-3 border border-border bg-card p-3"
        style={{ borderRadius: "calc(var(--radius) + 2px)" }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 items-center justify-center bg-secondary text-primary"
            style={{ borderRadius: "var(--radius)" }}
          >
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">Frieren</p>
            <p className="text-xs text-muted-foreground">
              28 episodes · Fantasy
            </p>
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full w-2/3 rounded-full bg-primary" />
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            className="bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
            style={{ borderRadius: "var(--radius)" }}
          >
            Continue
          </span>
          <span
            className="border border-input px-3 py-1.5 text-xs"
            style={{ borderRadius: "var(--radius)" }}
          >
            Details
          </span>
          <span
            className="bg-secondary px-3 py-1.5 text-xs text-secondary-foreground"
            style={{ borderRadius: "var(--radius)" }}
          >
            Fantasy
          </span>
          <span
            className="px-3 py-1.5 text-xs text-primary"
            style={{ borderRadius: "var(--radius)" }}
          >
            Show more
          </span>
        </div>
      </div>
    </div>
  );
}

function ContrastList({ derived }: { derived: Derived }) {
  return (
    <ul className="space-y-1.5" aria-label="Contrast checks">
      {derived.checks.map((c) => (
        <li
          key={c.id}
          className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5"
        >
          {c.pass ? (
            <Check className="h-4 w-4 shrink-0 text-emerald-500" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{c.label}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {c.hint}
            </p>
          </div>
          <div className="text-right">
            <p
              className={cn(
                "text-xs font-semibold tabular-nums",
                c.pass ? "" : "text-amber-500",
              )}
            >
              {c.ratio.toFixed(2)}:1
            </p>
            <p className="text-[10px] text-muted-foreground">
              needs {c.min}:1
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------------------------------------------- editor */

function ThemeEditor({
  initial,
  onClose,
  onSave,
}: {
  initial: CustomTheme;
  onClose: () => void;
  onSave: (t: CustomTheme) => void;
}) {
  const [draft, setDraft] = useState<CustomTheme>(initial);
  const [advanced, setAdvanced] = useState(
    !!(initial.chip || initial.muted || initial.border),
  );
  const derived = useMemo(() => deriveTheme(draft), [draft]);
  const failing = derived.checks.filter((c) => !c.pass).length;
  const patch = (changes: Partial<CustomTheme>) =>
    setDraft((d) => ({ ...d, ...changes }));

  return (
    <Dialog open onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Theme editor</DialogTitle>
          <DialogDescription>
            Pick four colours. Chips, borders, muted text and the rest are
            derived to stay readable.
          </DialogDescription>
        </DialogHeader>

        <ThemePreview derived={derived} />

        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={draft.name}
              maxLength={40}
              onChange={(e) => patch({ name: e.target.value })}
              aria-label="Theme name"
              placeholder="Theme name"
              className="h-9"
            />
            <div className="flex shrink-0 gap-1" role="group" aria-label="Mode">
              {(["dark", "light"] as ThemeMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={draft.mode === m}
                  onClick={() => patch({ mode: m })}
                  className={cn(
                    "rounded-lg border px-3 text-xs capitalize transition-all active:scale-95",
                    draft.mode === m
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <ColorField
            label="Background"
            hint="The page"
            value={draft.bg}
            onChange={(v) => patch({ bg: v })}
          />
          <ColorField
            label="Cards"
            hint="Panels, menus, sidebar"
            value={draft.surface}
            onChange={(v) => patch({ surface: v })}
          />
          <ColorField
            label="Text"
            hint="Titles and body"
            value={draft.text}
            onChange={(v) => patch({ text: v })}
          />
          <ColorField
            label="Accent"
            hint="Buttons, links, progress"
            value={draft.primary}
            onChange={(v) => patch({ primary: v })}
          />

          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Corners
            </p>
            <div className="grid grid-cols-4 gap-2">
              {RADIUS_CHOICES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  aria-pressed={draft.radius === r.value}
                  onClick={() => patch({ radius: r.value })}
                  className={cn(
                    "border px-2 py-1.5 text-xs transition-all active:scale-95",
                    draft.radius === r.value
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground",
                  )}
                  style={{ borderRadius: `${Math.min(r.value, 1) * 12}px` }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setAdvanced((a) => !a)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            aria-expanded={advanced}
          >
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform", advanced && "rotate-180")}
            />
            Advanced overrides
          </button>
          {advanced ? (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <ColorField
                label="Chips"
                hint="Icon backgrounds, tags"
                value={draft.chip ?? derived.chip}
                onChange={(v) => patch({ chip: v })}
                onReset={draft.chip ? () => patch({ chip: undefined }) : undefined}
              />
              <ColorField
                label="Muted text"
                hint="Captions and hints"
                value={draft.muted ?? derived.muted}
                onChange={(v) => patch({ muted: v })}
                onReset={draft.muted ? () => patch({ muted: undefined }) : undefined}
              />
              <ColorField
                label="Borders"
                hint="Dividers and outlines"
                value={draft.border ?? derived.border}
                onChange={(v) => patch({ border: v })}
                onReset={draft.border ? () => patch({ border: undefined }) : undefined}
              />
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">Contrast</p>
            <Button
              size="sm"
              variant="outline"
              disabled={failing === 0}
              onClick={() => {
                setDraft(autoFixTheme(draft));
                toast.success("Adjusted text and accent to meet contrast");
              }}
            >
              <Wand2 className="h-3.5 w-3.5" />
              {failing === 0 ? "All checks pass" : `Fix ${failing} issue${failing > 1 ? "s" : ""}`}
            </Button>
          </div>
          <ContrastList derived={derived} />
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!draft.name.trim()}
            onClick={() => onSave({ ...draft, name: draft.name.trim() })}
          >
            Save theme
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------------------------------------- section */

export function CustomThemeSection() {
  const { themes, active } = useCustomThemes();
  const { settings, update } = useSettings();
  const [editing, setEditing] = useState<CustomTheme | null>(null);
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState("");

  function useTheme(t: CustomTheme) {
    setActiveCustomTheme(t.mode, t.id);
    update({ theme: t.mode });
  }

  function save(t: CustomTheme) {
    const isNew = !themes.some((x) => x.id === t.id);
    saveCustomTheme(t);
    setEditing(null);
    if (isNew) {
      useTheme(t);
      toast.success(`“${t.name}” saved on this device`);
    } else {
      toast.success("Theme updated");
    }
  }

  async function copyTheme(t: CustomTheme) {
    try {
      await navigator.clipboard.writeText(exportCustomTheme(t));
      toast.success("Theme copied. Paste it into Import on any device.");
    } catch {
      toast.error("Couldn't copy to the clipboard.");
    }
  }

  function remove(t: CustomTheme) {
    if (!confirm(`Delete “${t.name}”?`)) return;
    deleteCustomTheme(t.id);
  }

  function runImport() {
    const parsed = parseCustomTheme(importText);
    if (!parsed) {
      toast.error("That doesn't look like a Koka theme.");
      return;
    }
    saveCustomTheme(parsed);
    setImporting(false);
    setImportText("");
    toast.success(`Imported “${parsed.name}”`);
  }

  return (
    <div className="mt-6 border-t border-border pt-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">
            Custom themes
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground/80">
            Saved only in this browser. They are never uploaded or synced.
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button size="sm" variant="outline" onClick={() => setImporting(true)}>
            <Upload className="h-3.5 w-3.5" /> Import
          </Button>
          <Button size="sm" onClick={() => setEditing(blankTheme(settings.theme))}>
            <Plus className="h-3.5 w-3.5" /> New
          </Button>
        </div>
      </div>

      <button
        type="button"
        onClick={() =>
          setEditing({
            ...blankTheme(settings.theme),
            ...readCurrentThemeColors(),
            name: "My copy",
          })
        }
        className="mt-2 text-[11px] text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
      >
        Start from the current theme
      </button>

      {themes.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          No custom themes yet.
        </p>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {themes.map((t) => {
            const d = deriveTheme(t);
            const isActive = active[t.mode] === t.id && settings.theme === t.mode;
            const bad = d.checks.filter((c) => !c.pass).length;
            return (
              <div
                key={t.id}
                className={cn(
                  "rounded-xl border p-3 transition-all",
                  isActive ? "border-primary bg-primary/5" : "border-border",
                )}
              >
                <button
                  type="button"
                  onClick={() => useTheme(t)}
                  className="flex w-full items-center gap-3 text-left active:scale-[0.99]"
                >
                  <span className="flex gap-1">
                    {d.swatch.map((c, i) => (
                      <span
                        key={i}
                        className="h-4 w-4 rounded-full border border-black/10"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">
                      {t.name}
                    </span>
                    <span className="block text-[11px] capitalize text-muted-foreground">
                      {t.mode}
                      {bad ? ` · ${bad} contrast issue${bad > 1 ? "s" : ""}` : ""}
                    </span>
                  </span>
                  {isActive ? <Check className="h-4 w-4 text-primary" /> : null}
                </button>
                <div className="mt-2 flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => setEditing(t)}
                    aria-label={`Edit ${t.name}`}
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => void copyTheme(t)}
                    aria-label={`Copy ${t.name} as text`}
                  >
                    <Copy className="h-3 w-3" /> Copy
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto h-7 px-2 text-xs text-destructive"
                    onClick={() => remove(t)}
                    aria-label={`Delete ${t.name}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing ? (
        <ThemeEditor
          key={editing.id}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      ) : null}

      <Dialog open={importing} onOpenChange={setImporting}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import a theme</DialogTitle>
            <DialogDescription>
              Paste text copied from another Koka theme.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={5}
            placeholder='{"koka":"theme", ...}'
            className="font-mono text-xs"
            aria-label="Theme text"
          />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setImporting(false)}>
              Cancel
            </Button>
            <Button disabled={!importText.trim()} onClick={runImport}>
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
