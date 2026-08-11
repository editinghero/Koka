/**
 * Server-only runtime helpers.
 *
 * Cloudflare hands the Worker `env` (bindings + secrets) to `fetch()`.
 * `src/server.ts` stashes it here so server functions can reach the D1
 * binding and secrets without threading the value through every call.
 */

export type D1Result<T = Record<string, unknown>> = { results: T[] };

export type D1PreparedStatement = {
  bind: (...values: unknown[]) => D1PreparedStatement;
  all: <T = Record<string, unknown>>() => Promise<D1Result<T>>;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  run: () => Promise<unknown>;
};

export type D1Database = {
  prepare: (sql: string) => D1PreparedStatement;
  batch: (statements: D1PreparedStatement[]) => Promise<unknown>;
  exec?: (sql: string) => Promise<unknown>;
};

let cloudflareEnv: Record<string, unknown> | undefined;

export function setCloudflareEnv(env: unknown) {
  if (env && typeof env === "object") {
    cloudflareEnv = env as Record<string, unknown>;
  }
}

/** The D1 binding named `DB` in wrangler.toml, when the app runs on Cloudflare. */
export function getD1(): D1Database | null {
  const binding = cloudflareEnv?.["DB"];
  if (binding && typeof (binding as D1Database).prepare === "function") {
    return binding as D1Database;
  }
  return null;
}

/** Secrets come from the Worker env on Cloudflare and process.env elsewhere. */
export function envVar(name: string): string | undefined {
  const fromWorker = cloudflareEnv?.[name];
  if (typeof fromWorker === "string" && fromWorker) return fromWorker;
  const fromNode = process.env[name];
  return fromNode || undefined;
}

export function signupsAllowed(): boolean {
  const raw = (envVar("ALLOW_SIGNUPS") ?? "true").toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "off";
}
