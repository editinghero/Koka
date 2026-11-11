import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useLibrary, useMediaMode, useSettings } from "@/lib/store";
import {
  buildStatsCardData,
  CARD_FORMATS,
  renderStatsBlob,
  type CardFormat,
} from "@/lib/stats-card";
import { cn } from "@/lib/utils";

export function StatsShareDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { library } = useLibrary();
  const { mode } = useMediaMode();
  const { settings } = useSettings();
  const [format, setFormat] = useState<CardFormat>("story");
  const [showUser, setShowUser] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  const username = settings.anilistUser?.trim() || null;
  const data = useMemo(
    () =>
      buildStatsCardData(library, mode, showUser && username ? username : null),
    [library, mode, showUser, username],
  );

  // Re-render whenever the dialog is open and an option changes.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setBusy(true);
    setError(null);
    void renderStatsBlob(data, format)
      .then((b) => {
        if (cancelled) return;
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        const next = URL.createObjectURL(b);
        urlRef.current = next;
        setBlob(b);
        setUrl(next);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not draw the card.");
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, data, format]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const fileName = `koka-${mode.toLowerCase()}-stats-${format}.png`;
  const canShareFile =
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    blob !== null &&
    navigator.canShare({
      files: [new File([blob], fileName, { type: "image/png" })],
    });
  const canCopy =
    typeof navigator !== "undefined" &&
    !!navigator.clipboard &&
    typeof ClipboardItem !== "undefined";

  function download() {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function share() {
    if (!blob) return;
    try {
      await navigator.share({
        files: [new File([blob], fileName, { type: "image/png" })],
        title: data.title,
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      toast.error("Couldn't open the share sheet. Try Download instead.");
    }
  }

  async function copy() {
    if (!blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.success("Image copied");
    } catch {
      toast.error("Couldn't copy the image. Try Download instead.");
    }
  }

  const { w, h } = CARD_FORMATS[format];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Share your stats</DialogTitle>
          <DialogDescription>
            A frosted card in your current theme, ready for a story or post.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2" role="group" aria-label="Card format">
          {(Object.keys(CARD_FORMATS) as CardFormat[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              aria-pressed={format === f}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all active:scale-95",
                format === f
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {CARD_FORMATS[f].label}
            </button>
          ))}
        </div>

        {username ? (
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <Label htmlFor="share-user" className="text-xs">
              Show @{username}
            </Label>
            <Switch
              id="share-user"
              checked={showUser}
              onCheckedChange={setShowUser}
            />
          </div>
        ) : null}

        <div
          className="relative mx-auto w-full overflow-hidden rounded-xl border border-border bg-secondary"
          style={{ aspectRatio: `${w} / ${h}`, maxHeight: "52vh" }}
        >
          {url ? (
            <img
              src={url}
              alt="Preview of your stats card"
              className={cn(
                "h-full w-full object-contain transition-opacity",
                busy ? "opacity-50" : "opacity-100",
              )}
            />
          ) : null}
          {busy ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : null}
          {error ? (
            <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={download} disabled={!blob || busy} className="flex-1">
            <Download className="h-4 w-4" /> Download
          </Button>
          {canShareFile ? (
            <Button
              variant="outline"
              onClick={() => void share()}
              disabled={busy}
              className="flex-1"
            >
              <Share2 className="h-4 w-4" /> Share
            </Button>
          ) : null}
          {canCopy ? (
            <Button
              variant="outline"
              onClick={() => void copy()}
              disabled={!blob || busy}
              className="flex-1"
            >
              <Copy className="h-4 w-4" /> Copy
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
