`wrangler.toml`:

```toml
name = "koka"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"            # must be exactly DB
database_name = "koka"
database_id = "<id printed by wrangler d1 create>"
```

## 3. Apply the schema

```bash
npx wrangler d1 execute koka --remote --file db/d1-schema.sql
```

## 4. Secrets

```bash
npx wrangler pages secret put SESSION_SECRET        # 32+ random chars, signs the session cookie
npx wrangler pages secret put KOKA_ENCRYPTION_KEY   # 32+ random chars, encrypts the Gemini key at rest
npx wrangler pages secret put ALLOW_SIGNUPS         # "false" to close registration, "true" to allow it
```

`ALLOW_SIGNUPS=false` hides the sign-up tab and rejects sign-up requests on the
server, so only existing accounts can sign in.

## 5. Deploy

```bash
npm run build
npx wrangler deploy
```

## Table map

| Table             | Holds                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `users`           | id, email, name, PBKDF2 password hash                                                     |
| `settings`        | encrypted Gemini key, model, AniList username, spoiler mode, themes, media mode           |
| `library_entries` | status, progress, decimal score, favourite, start/finish dates, rewatches, media snapshot |
| `notes`           | markdown body, title, tags per title (anime and manga kept apart)                         |
| `import_log`      | source, merge/replace, count for the Import activity feed                                 |

Every key includes `media_type`, so an anime and a manga with the same AniList
id never collide.

## Security notes

- Passwords: PBKDF2-SHA256, 100 000 iterations, per-user random salt.
- Gemini API key: AES-GCM encrypted with `KURO_ENCRYPTION_KEY`; the plaintext is
  only decrypted for the signed-in owner.
- Sessions: httpOnly, secure, SameSite=Lax encrypted cookie (30 days).
- Exports never include the Gemini key.
