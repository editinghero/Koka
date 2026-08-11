# Koka - All-in-One Anime & Manga Dashboard

A calm, full-stack anime and manga tracking workspace with AI news digests, custom tag search, airing schedule notifications, markdown notes, and serverless Cloudflare Pages SSR + D1 Database.

<br/>
  
  **[→ Visit Live App](https://koka.pages.dev)**
  
  <br/>

`Signups currently disabled (ALLOW_SIGNUPS=false)`

---

## Features

- **Custom Tagging & Search** - Add custom tags (`#ecchi`, `#fav`, `#must-watch`, `#comfort`) to any title. Filter library entries instantly by searching title names, genres, studios, or tags in the search bar or clicking interactive tag pills.
- **Grounded AI News Radar** - Real-time anime news digests, trailer drops, and release schedule tables powered by Google Gemini 2.5 Flash with Google Search Grounding.
- **Airing Schedule Notifications** - Countdown timers for upcoming episodes (`in 2h 45m`, `Today at 8:00 PM`), urgent (<3h) pulse alerts, and automatic episode reappearance (`animeId:episode` keys). Supports optional browser desktop notifications.
- **Persistent Koka AI Assistant** - Multi-turn AI chat assistant with conversation history persistence globally and per anime title, featuring in-panel clear buttons and an all-in-one clear option in Settings.
- **Personal Library & Progress Tracking** - Track anime and manga with status (Watching, Completed, Planning, On Hold, Dropped, Rewatching) and keep count of episodes watched or chapters read.
- **Analytics & Watch Time Insights** - Active watch/read hours counter (excludes planned/0 progress items), genre distribution breakdown, score distribution, and top studio analytics.
- **PIN Lock & Security** - Native device PIN protection for personal library and notes privacy. Encrypted Gemini API key storage.
- **AniList & MAL Import** - Automatic metadata fetching from AniList GraphQL API and full import/export support for AniList sync, MyAnimeList (MAL CSV), and local JSON backups.

---

## Getting Started

### 1. Create an Account

1. Visit [koka.pages.dev](https://koka.pages.dev) and sign in.
2. If registration is enabled, enter your email and password to create an account.
3. Start building your library!

### 2. Configure AI Features (Optional)

**Option A: Use Gemini AI**
1. Go to Settings.
2. Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).
3. Paste your key and select your preferred model (e.g., `gemini-2.5-flash`).
4. Your key is encrypted and stored securely on Cloudflare D1.

**Option B: Skip AI**
- The app works perfectly without AI. Manual tracking, custom tags, and AniList data are always available.

> **Note:** Your Gemini API key is encrypted at rest using AES-256-GCM (`KOKA_ENCRYPTION_KEY`) and is never exposed to the client.

### 3. Add Custom Tags & Search

**Method 1: Add via Title Details**
- Open any anime/manga detail page (`/anime/$id`).
- Under Custom Tags, click `+ Add tag` and type a tag (e.g., `ecchi`, `fav`, `must-watch`).

**Method 2: Filter in Library**
- Type `#ecchi` or `ecchi` in the main library search bar.
- Or click any active tag pill above the filter bar to filter matching titles instantly.

### 4. Airing Schedule Notifications

- Click the Bell icon in the top header to open the airing schedule dropdown.
- View real-time countdowns (`in 2h 45m`, `Today at 8:00 PM`).
- Episodes airing within 3 hours highlight with an URGENT pulse badge.
- Click `Enable Browser Desktop Alerts` for native desktop notifications.
- Dismissed notifications automatically reappear as new unread alerts when the next episode is announced (`animeId:episode` keys).

### 5. Quick Tips

- **Status Tabs:** Filter your library by Watching, Completed, Planning, On Hold, or Dropped.
- **Progress Updates:** Quick + / - buttons to update episode or chapter counts.
- **Clear AI History:** Clear chat history per anime title, in the global assistant, or use "Clear All Chat" in Settings.

---

## Install as App

Koka is a Progressive Web App (PWA) — install it for a native app experience!

**On Desktop:**
- Look for the install icon in your browser's address bar.
- Click to add to your desktop/dock.

**On Mobile:**
- Tap your browser's menu.
- Select "Add to Home Screen" or "Install App".

---

## Security & Privacy

- **Encrypted API Keys:** Your Gemini API key is encrypted at rest using AES-256-GCM.
- **Edge Computing:** Runs on Cloudflare Pages Workers & Cloudflare D1 for speed and security.
- **PIN Protection:** Built-in PIN lock secures your library and notes from local access.
- **No Tracking:** Your viewing habits stay private.

---

## Use Cases

- **Anime Enthusiasts:** Track seasonal anime, get episode countdowns, and never lose your place.
- **Manga Readers:** Keep reading progress organized across chapters and volumes.
- **Custom Categorization:** Tag series by custom moods, genres, or personal lists (`#ecchi`, `#fav`, `#must-watch`).
- **News Follower:** Use AI Search Grounding to read real-time news and trailer releases for your watchlist.

---

## Need Help?

**Can't find a series?**
- Search by the full AniList title or check [anilist.co](https://anilist.co).

**AI Features not working?**
- Verify your Gemini API key in Settings.
- Make sure you are using a valid free-tier model (e.g. `gemini-2.5-flash`).

---

## For Developers

Want to run your own instance or contribute?

### Tech Stack

- **Frontend:** React 19, TanStack Router, TanStack Query, Tailwind CSS 4
- **Backend:** Cloudflare Workers, TanStack Start SSR, h3
- **Database:** Cloudflare D1 (Serverless SQLite)
- **APIs:** AniList GraphQL API, Google Gemini AI (with Search Grounding)

### Quick Setup

```bash
npm install
npm run dev
```

### Database Setup

1. Create database:
```bash
npx wrangler d1 create koka
```

2. Update configuration (`wrangler.toml`):
```toml
name = "koka"
compatibility_date = "2026-02-24"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = "dist/client"

[[d1_databases]]
binding = "DB"
database_name = "koka"
database_id = "your-database-id-here"
```

3. Push schema:
```bash
npx wrangler d1 execute koka --local --file=docs/d1-schema.sql
npx wrangler d1 execute koka --remote --file=docs/d1-schema.sql
```

### Deploy to Cloudflare Pages

**Direct Deploy:**
```bash
npm run build
npx wrangler pages deploy
```

### Environment Variables

`.dev.vars`:
```env
SESSION_SECRET=your-32-char-random-session-secret
KOKA_ENCRYPTION_KEY=your-32-char-random-encryption-key
ALLOW_SIGNUPS=false
```

### Database Management

```bash
# View local data
npx wrangler d1 execute koka --command="SELECT * FROM users" --local

# View remote data
npx wrangler d1 execute koka --command="SELECT * FROM users" --remote

# Backup
npx wrangler d1 export koka --output=backup.sql --remote
```

### Project Structure

```text
src/
  components/            React UI components & panels
    AiPanel.tsx
    AnimeCard.tsx
    AppShell.tsx
    ChatPanel.tsx
    NotificationsDropdown.tsx
  lib/                   Application logic & store
    anilist.ts           AniList GraphQL client
    auth.functions.ts    Authentication server functions
    chat-storage.ts      Persistent AI chat history helper
    data.functions.ts    Database RPC server functions
    gemini.ts            Google Gemini AI & Search Grounding client
    store.ts             Client state management
    types.ts             TypeScript definitions
  routes/                TanStack Router pages
    __root.tsx
    index.tsx
    library.tsx
    news.tsx
    insights.tsx
    settings.tsx
    anime.$id.tsx
  server.ts              Cloudflare Workers SSR entry point & static asset fallback
```

---

**Built with ❤️ for anime and manga fans**

[Report an Issue](https://github.com/editinghero/koka/issues) • [Request a Feature](https://github.com/editinghero/koka/issues/new)
