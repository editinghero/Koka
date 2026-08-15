/** Server-only crypto: password hashing + at-rest encryption for the Gemini key. */
import { envVar } from "./runtime.server";

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(value: string): Uint8Array {
  const bin = atob(value);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ------------------------- passwords (PBKDF2) ------------------------- */

const ITERATIONS = 100_000;

async function pbkdf2(
  password: string,
  salt: Uint8Array,
  iterations: number = ITERATIONS,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: salt as BufferSource,
      iterations,
    },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt);
  return `pbkdf2$${ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  const salt = fromB64(parts[2]!);
  const expected = fromB64(parts[3]!);
  const actual = await pbkdf2(password, salt, iterations);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i]! ^ expected[i]!;
  return diff === 0;
}

/* --------------------- secret encryption (AES-GCM) -------------------- */

async function aesKey(): Promise<CryptoKey> {
  const secret = envVar("KOKA_ENCRYPTION_KEY") ?? envVar("KURO_ENCRYPTION_KEY");
  if (!secret) throw new Error("KOKA_ENCRYPTION_KEY is not set");
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

/** Encrypts a value (e.g. the Gemini API key) for storage in D1. */
export async function encryptValue(plain: string): Promise<string> {
  if (!plain) return "";
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await aesKey();
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      enc.encode(plain),
    ),
  );
  const packed = new Uint8Array(iv.length + cipher.length);
  packed.set(iv, 0);
  packed.set(cipher, iv.length);
  return `enc:${toB64(packed)}`;
}

export async function decryptValue(
  stored: string | null | undefined,
): Promise<string> {
  if (!stored) return "";
  if (!stored.startsWith("enc:")) return stored; // legacy plaintext
  try {
    const packed = fromB64(stored.slice(4));
    const iv = packed.slice(0, 12);
    const cipher = packed.slice(12);
    const key = await aesKey();
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      cipher,
    );
    return dec.decode(plain);
  } catch {
    return "";
  }
}
