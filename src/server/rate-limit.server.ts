/**
 * Server-only IP rate limiting to prevent brute force attacks.
 * Rule: 9 failed password attempts on an IP locks that IP for 9 minutes.
 */
import { getD1 } from "./runtime.server";

const MAX_ATTEMPTS = 9;
const LOCKOUT_MS = 9 * 60 * 1000; // 9 minutes

type RateLimitRecord = {
  attempts: number;
  lockedUntil: number;
  updatedAt: number;
};

const memStore = new Map<string, RateLimitRecord>();

function getMemRecord(key: string): RateLimitRecord {
  const existing = memStore.get(key);
  if (existing) return existing;
  const initial: RateLimitRecord = { attempts: 0, lockedUntil: 0, updatedAt: Date.now() };
  memStore.set(key, initial);
  return initial;
}

let tableReady = false;
async function ensureRateLimitTable(db: D1Database) {
  if (tableReady) return;
  try {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS rate_limits (
           key TEXT PRIMARY KEY,
           attempts INTEGER NOT NULL DEFAULT 0,
           locked_until INTEGER NOT NULL DEFAULT 0,
           updated_at INTEGER NOT NULL
         )`,
      )
      .run();
    tableReady = true;
  } catch {
    /* fallback to memory */
  }
}

export async function checkLoginRateLimit(ip: string): Promise<void> {
  const key = `login:${ip || "unknown"}`;
  const now = Date.now();

  const db = getD1();
  if (db) {
    try {
      await ensureRateLimitTable(db);
      const row = await db
        .prepare("SELECT attempts, locked_until FROM rate_limits WHERE key = ?")
        .bind(key)
        .first<{ attempts: number; locked_until: number }>();
      if (row && row.locked_until > now) {
        const remainingMin = Math.max(1, Math.ceil((row.locked_until - now) / 60000));
        throw new Error(
          `Too many failed login attempts from this IP. Locked for ${remainingMin} minute${remainingMin === 1 ? "" : "s"} to stop brute force.`,
        );
      }
      return;
    } catch (err) {
      if (err instanceof Error && err.message.includes("Too many failed login attempts")) {
        throw err;
      }
    }
  }

  // Memory fallback
  const rec = getMemRecord(key);
  if (rec.lockedUntil > now) {
    const remainingMin = Math.max(1, Math.ceil((rec.lockedUntil - now) / 60000));
    throw new Error(
      `Too many failed login attempts from this IP. Locked for ${remainingMin} minute${remainingMin === 1 ? "" : "s"} to stop brute force.`,
    );
  }
}

export async function recordFailedLogin(ip: string): Promise<void> {
  const key = `login:${ip || "unknown"}`;
  const now = Date.now();

  let attempts = 0;
  let lockedUntil = 0;

  const db = getD1();
  if (db) {
    try {
      await ensureRateLimitTable(db);
      const row = await db
        .prepare("SELECT attempts, locked_until FROM rate_limits WHERE key = ?")
        .bind(key)
        .first<{ attempts: number; locked_until: number }>();

      if (row) {
        if (row.locked_until > now) {
          lockedUntil = row.locked_until;
          attempts = row.attempts;
        } else {
          attempts = row.attempts + 1;
        }
      } else {
        attempts = 1;
      }

      if (attempts >= MAX_ATTEMPTS) {
        lockedUntil = now + LOCKOUT_MS;
      }

      await db
        .prepare(
          `INSERT INTO rate_limits (key, attempts, locked_until, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET
             attempts = excluded.attempts,
             locked_until = excluded.locked_until,
             updated_at = excluded.updated_at`,
        )
        .bind(key, attempts, lockedUntil, now)
        .run();
      return;
    } catch {
      // Fall through to memory
    }
  }

  // Memory fallback
  const rec = getMemRecord(key);
  if (rec.lockedUntil > now) {
    lockedUntil = rec.lockedUntil;
  } else {
    rec.attempts += 1;
  }
  if (rec.attempts >= MAX_ATTEMPTS) {
    rec.lockedUntil = now + LOCKOUT_MS;
  }
  rec.updatedAt = now;
}

export async function resetLoginRateLimit(ip: string): Promise<void> {
  const key = `login:${ip || "unknown"}`;
  memStore.delete(key);

  const db = getD1();
  if (db) {
    try {
      await db
        .prepare("DELETE FROM rate_limits WHERE key = ?")
        .bind(key)
        .run();
    } catch {
      /* ignore */
    }
  }
}
