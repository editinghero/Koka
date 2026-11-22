/** Server-only session handling (encrypted cookie). */
import { useSession } from "@tanstack/react-start/server";
import { envVar } from "./runtime.server";
import { getRepo } from "./repo.server";

export type SessionData = { userId?: string };

function config() {
  const password = envVar("SESSION_SECRET");
  if (!password) throw new Error("SESSION_SECRET is not set");
  return {
    password,
    name: "koka-session",
    maxAge: 60 * 60 * 24 * 30,
    cookie: {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax" as const,
      path: "/",
    },
  };
}

export async function startSession(userId: string) {
  const session = await useSession<SessionData>(config());
  await session.update({ userId });
}

export async function endSession() {
  const session = await useSession<SessionData>(config());
  await session.clear();
}

export async function currentUserId(): Promise<string | null> {
  try {
    const session = await useSession<SessionData>(config());
    return session.data.userId ?? null;
  } catch {
    return null;
  }
}

export async function currentUser() {
  const id = await currentUserId();
  if (!id) return null;
  const user = await getRepo().userById(id);
  return user ? { id: user.id, email: user.email, name: user.name } : null;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error("Not signed in.");
  return user;
}
