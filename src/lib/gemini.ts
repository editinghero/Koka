import { getSettings } from "./store";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export type GeminiResult = {
  text: string;
  sources: { title: string; uri: string }[];
  newTurns?: ChatTurn[];
};

type Part = {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: { content: string } };
};

type GeminiApiResponse = {
  error?: { message?: string };
  candidates?: {
    content?: { parts?: Part[] };
    groundingMetadata?: {
      groundingChunks?: { web?: { title?: string; uri?: string } }[];
    };
  }[];
};

async function postGemini(
  model: string,
  body: Record<string, unknown>,
  geminiKey?: string,
): Promise<GeminiApiResponse> {
  // If a direct key is present and not masked, use direct client fetch (local dev)
  if (geminiKey && geminiKey !== "••••••••") {
    const res = await fetch(
      `${BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    const json = (await res.json()) as GeminiApiResponse;
    if (!res.ok) {
      throw new Error(json.error?.message ?? `Gemini error ${res.status}`);
    }
    return json;
  }

  // Secure server-side execution: API key is never exposed to the client/devtools
  const { callGeminiServer } = await import("./data.functions");
  return (await callGeminiServer({
    data: { model, body },
  })) as GeminiApiResponse;
}

export async function askGemini(
  prompt: string,
  opts: { system?: string; search?: boolean; temperature?: number } = {},
): Promise<GeminiResult> {
  const { geminiKey, model } = getSettings();

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: opts.temperature ?? 0.6 },
  };
  if (opts.system) {
    body["systemInstruction"] = { parts: [{ text: opts.system }] };
  }
  if (opts.search !== false) body["tools"] = [{ google_search: {} }];

  const json = await postGemini(model, body, geminiKey);

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

export type ChatTurn = {
  role: "user" | "model" | "function";
  parts: Part[];
  text?: string; // Kept for backward compatibility with older saved local storage chats
};

/** Multi-turn chat with optional Google Search grounding. */
export async function chatGemini(
  turns: ChatTurn[],
  opts: {
    system?: string;
    search?: boolean;
    temperature?: number;
    getAnimeNote?: (title: string) => string | undefined;
  } = {},
): Promise<GeminiResult> {
  const { geminiKey, model } = getSettings();

  // Handle older saved chats that only have `text`
  const normalizedTurns: ChatTurn[] = turns.map((t) => ({
    role: t.role,
    parts: t.parts ?? [{ text: t.text }],
  }));

  const allTurns = [...normalizedTurns];
  const newTurns: ChatTurn[] = [];

  const tools: any[] = [];
  if (opts.search !== false) tools.push({ google_search: {} });
  if (opts.getAnimeNote) {
    tools.push({
      functionDeclarations: [
        {
          name: "getAnimeNote",
          description:
            "Get the user's personal note for a specific anime or manga title.",
          parameters: {
            type: "OBJECT",
            properties: {
              title: {
                type: "STRING",
                description: "The title of the anime or manga.",
              },
            },
            required: ["title"],
          },
        },
      ],
    });
  }

  while (true) {
    const body: Record<string, unknown> = {
      contents: allTurns.map((t) => ({ role: t.role, parts: t.parts })),
      generationConfig: { temperature: opts.temperature ?? 0.7 },
    };
    if (opts.system) {
      body["systemInstruction"] = { parts: [{ text: opts.system }] };
    }
    if (tools.length > 0) {
      body["tools"] = tools;
    }

    const json = await postGemini(model, body, geminiKey);

    const candidate = json.candidates?.[0];
    const responseParts = candidate?.content?.parts ?? [];

    if (responseParts.length === 0) {
      throw new Error("Gemini returned an empty response.");
    }

    const functionCalls = responseParts.filter((p) => p.functionCall);

    if (functionCalls.length > 0 && opts.getAnimeNote) {
      // Append the model's function call message
      const callTurn: ChatTurn = { role: "model", parts: responseParts };
      allTurns.push(callTurn);
      newTurns.push(callTurn);

      // Execute function calls and append the responses
      const responseTurnParts: Part[] = [];
      for (const part of functionCalls) {
        if (part.functionCall?.name === "getAnimeNote") {
          const title = part.functionCall.args["title"] as string;
          const noteContent = opts.getAnimeNote(title) ?? "No notes found.";
          responseTurnParts.push({
            functionResponse: {
              name: "getAnimeNote",
              response: { content: noteContent },
            },
          });
        }
      }

      const responseTurn: ChatTurn = {
        role: "function",
        parts: responseTurnParts,
      };
      allTurns.push(responseTurn);
      newTurns.push(responseTurn);

      // Loop to send the function response back to the model
      continue;
    }

    const text = responseParts
      .filter((p) => p.text)
      .map((p) => p.text ?? "")
      .join("")
      .trim();

    const sources = (candidate?.groundingMetadata?.groundingChunks ?? [])
      .map((c) => ({ title: c.web?.title ?? "Source", uri: c.web?.uri ?? "" }))
      .filter((s) => s.uri);

    if (!text && functionCalls.length === 0) {
      throw new Error("Gemini returned an empty response.");
    }

    // Append the final model response to newTurns to be returned
    const finalTurn: ChatTurn = { role: "model", parts: responseParts };
    newTurns.push(finalTurn);

    return { text, sources, newTurns };
  }
}

export const SPOILER_FREE_SYSTEM =
  "You are an anime research assistant. Write in clean markdown. " +
  "Never reveal plot twists, endings, deaths, or late-story developments. " +
  "Do not describe individual characters, their names, arcs, or relationships unless explicitly asked. " +
  "Focus on premise, setting, tone, themes, production and viewing context. Be concise and calm in tone.";
