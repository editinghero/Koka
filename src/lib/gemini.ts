import { getSettings } from "./store";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export type GeminiResult = {
  text: string;
  sources: { title: string; uri: string }[];
};

type Part = { text?: string };

export async function askGemini(
  prompt: string,
  opts: { system?: string; search?: boolean; temperature?: number } = {},
): Promise<GeminiResult> {
  const { geminiKey, model } = getSettings();
  if (!geminiKey) {
    throw new Error(
      "No Gemini API key set. Add one in Settings to use AI features.",
    );
  }

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: opts.temperature ?? 0.6 },
  };
  if (opts.system) {
    body["systemInstruction"] = { parts: [{ text: opts.system }] };
  }
  if (opts.search) body["tools"] = [{ google_search: {} }];

  const res = await fetch(
    `${BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  const json = (await res.json()) as {
    error?: { message?: string };
    candidates?: {
      content?: { parts?: Part[] };
      groundingMetadata?: {
        groundingChunks?: { web?: { title?: string; uri?: string } }[];
      };
    }[];
  };

  if (!res.ok) {
    throw new Error(json.error?.message ?? `Gemini error ${res.status}`);
  }

  const candidate = json.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();

  const sources = (candidate?.groundingMetadata?.groundingChunks ?? [])
    .map((c) => ({ title: c.web?.title ?? "Source", uri: c.web?.uri ?? "" }))
    .filter((s) => s.uri);

  if (!text) throw new Error("Gemini returned an empty response.");
  return { text, sources };
}

export type ChatTurn = { role: "user" | "model"; text: string };

/** Multi-turn chat with optional Google Search grounding. */
export async function chatGemini(
  turns: ChatTurn[],
  opts: { system?: string; search?: boolean; temperature?: number } = {},
): Promise<GeminiResult> {
  const { geminiKey, model } = getSettings();
  if (!geminiKey) {
    throw new Error(
      "No Gemini API key set. Add one in Settings to use AI features.",
    );
  }

  const body: Record<string, unknown> = {
    contents: turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
    generationConfig: { temperature: opts.temperature ?? 0.7 },
  };
  if (opts.system)
    body["systemInstruction"] = { parts: [{ text: opts.system }] };
  if (opts.search) body["tools"] = [{ google_search: {} }];

  const res = await fetch(
    `${BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  const json = (await res.json()) as {
    error?: { message?: string };
    candidates?: {
      content?: { parts?: Part[] };
      groundingMetadata?: {
        groundingChunks?: { web?: { title?: string; uri?: string } }[];
      };
    }[];
  };

  if (!res.ok)
    throw new Error(json.error?.message ?? `Gemini error ${res.status}`);

  const candidate = json.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  const sources = (candidate?.groundingMetadata?.groundingChunks ?? [])
    .map((c) => ({ title: c.web?.title ?? "Source", uri: c.web?.uri ?? "" }))
    .filter((s) => s.uri);

  if (!text) throw new Error("Gemini returned an empty response.");
  return { text, sources };
}

export const SPOILER_FREE_SYSTEM =
  "You are an anime research assistant. Write in clean markdown. " +
  "Never reveal plot twists, endings, deaths, or late-story developments. " +
  "Do not describe individual characters, their names, arcs, or relationships unless explicitly asked. " +
  "Focus on premise, setting, tone, themes, production and viewing context. Be concise and calm in tone.";
