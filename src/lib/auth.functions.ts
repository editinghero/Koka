import { createServerFn } from "@tanstack/react-start";

export type SessionUser = { id: string; email: string; name: string };

/** Current signed-in user, or null. */
export const getMe = createServerFn({ method: "GET" }).handler(async () => {
  const { currentUser } = await import("@/server/session.server");
  return await currentUser();
});

/** Whether the deployment accepts new accounts (ALLOW_SIGNUPS env flag). */
export const getAuthConfig = createServerFn({ method: "GET" }).handler(
  async () => {
    const { signupsAllowed } = await import("@/server/runtime.server");
    const { usingD1 } = await import("@/server/repo.server");
    return {
      signupsAllowed: signupsAllowed(),
      storage: usingD1() ? "d1" : "local",
    };
  },
);

export const signUp = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { email: string; name: string; password: string }) => data,
  )
  .handler(async ({ data }) => {
    const { signupsAllowed } = await import("@/server/runtime.server");
    if (!signupsAllowed())
      throw new Error("Sign-ups are disabled on this instance.");

    const email = data.email.trim().toLowerCase();
    const name = data.name.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      throw new Error("Enter a valid email.");
    if (name.length < 2) throw new Error("Enter your name.");
    if (data.password.length < 8)
      throw new Error("Password must be at least 8 characters.");

    const { getRepo } = await import("@/server/repo.server");
    const { hashPassword } = await import("@/server/crypto.server");
    const { startSession } = await import("@/server/session.server");

    const repo = getRepo();
    if (await repo.userByEmail(email))
      throw new Error("That email is already registered.");

    const user = {
      id: crypto.randomUUID(),
      email,
      name,
      password_hash: await hashPassword(data.password),
      created_at: Date.now(),
    };
    await repo.createUser(user);
    await startSession(user.id);
    return { id: user.id, email, name } satisfies SessionUser;
  });

export const signIn = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; password: string }) => data)
  .handler(async ({ data }) => {
    const { getRepo } = await import("@/server/repo.server");
    const { verifyPassword } = await import("@/server/crypto.server");
    const { startSession } = await import("@/server/session.server");

    const user = await getRepo().userByEmail(data.email.trim().toLowerCase());
    if (!user || !(await verifyPassword(data.password, user.password_hash))) {
      throw new Error("Wrong email or password.");
    }
    await startSession(user.id);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
    } satisfies SessionUser;
  });

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  const { endSession } = await import("@/server/session.server");
  await endSession();
  return { ok: true };
});

export const updateProfileName = createServerFn({ method: "POST" })
  .inputValidator((data: { name: string }) => data)
  .handler(async ({ data }) => {
    const { requireUser } = await import("@/server/session.server");
    const { getRepo } = await import("@/server/repo.server");
    const user = await requireUser();
    const name = data.name.trim();
    if (name.length < 2) throw new Error("Name is too short.");
    await getRepo().updateUserName(user.id, name);
    return { ok: true, name };
  });

export const changePassword = createServerFn({ method: "POST" })
  .inputValidator((data: { current: string; next: string }) => data)
  .handler(async ({ data }) => {
    const { requireUser } = await import("@/server/session.server");
    const { getRepo } = await import("@/server/repo.server");
    const { hashPassword, verifyPassword } =
      await import("@/server/crypto.server");

    const session = await requireUser();
    const repo = getRepo();
    const user = await repo.userById(session.id);
    if (!user) throw new Error("Account not found.");
    if (!(await verifyPassword(data.current, user.password_hash))) {
      throw new Error("Current password is incorrect.");
    }
    if (data.next.length < 8)
      throw new Error("New password must be at least 8 characters.");
    await repo.updateUserPassword(user.id, await hashPassword(data.next));
    return { ok: true };
  });
