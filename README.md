# Social Studio

**White-label AI social media marketing platform** — manage multiple client companies, generate marketing plans, AI posts, branded images and reels with voiceover, and publish automatically to Instagram, Facebook, LinkedIn, X, TikTok (and Snapchat in export mode).

Built with **Next.js 15 + TypeScript + Tailwind** and a **Python FastAPI media service** (image templates, reel rendering, free Arabic/English TTS).

---

## Quick start

Requirements: **Node.js ≥ 20** and **Python ≥ 3.10**.

```bash
# 1) Install web app dependencies
npm install

# 2) Create the database (SQLite, zero config)
npx prisma db push

# 3) Install Python media service dependencies + fonts (first run only)
npm run media:install
npm run fonts

# 4) Run BOTH services (two terminals)
npm run dev        # Next.js app  → http://localhost:3000
npm run media      # Python service → http://127.0.0.1:8000
```

Open http://localhost:3000 — the first run shows a **setup wizard** to create your admin account.

Copy `.env.example` to `.env` if it doesn't exist and set your own `SESSION_SECRET` + `APP_ENCRYPTION_KEY` (random values are pre-generated in the included `.env`).

## How the pieces fit

| Piece | What it does |
|---|---|
| **Next.js app** (port 3000) | Dashboard, companies, campaigns, posts, reels, marketing plans, calendar, analytics, settings, OAuth flows, publish scheduler |
| **Python media service** (port 8000) | Branded post-image templates (Arabic-capable), reel rendering (MoviePy + bundled FFmpeg), free TTS voiceover (edge-tts) |
| **SQLite** (`prisma/dev.db`) | All data. Postgres-ready schema — swap `DATABASE_URL` to migrate. |
| **`data/media/`** | All generated/uploaded media, served at `/api/media/...` |

## First-time setup (in the app)

1. **Settings → AI** — add one API key (recommended: **OpenRouter** — one key gives you GPT/Claude/Gemini text models). For AI-generated images add an **OpenAI** or **Google** key. Keys are encrypted at rest. Use “Test connection”.
2. **Companies** — create a company per client: industry, audience, tone of voice, brand colors, logo, language (AR/EN/both). Everything the AI generates uses this profile.
3. **Campaigns** *(optional)* — focus posts/plans/reels on a specific campaign.
4. **Settings → Connections** — add platform developer-app credentials and connect accounts via OAuth (see per-platform notes below).

## Feature guide

- **Marketing Plans** — generates a full strategy (objectives, KPIs, personas, content pillars, per-platform playbooks, hashtag strategy, budget split, week-by-week calendar). Open a plan → **Create drafts** turns any week into draft posts.
- **Posts → New post** — AI caption options per platform/language, branded template designs (quote/stat/announcement/showcase/tip in 3 sizes), AI images, or uploads; save as draft, schedule, or publish now. Preview included.
- **Reels → New reel** — AI scene-by-scene script → AI scene images (9:16) → optional voiceover (free `ar-SA`/`en-US` neural voices) → optional music → **Render video** (1080×1920, brand intro/outro, burned-in captions). Then create Instagram/TikTok/Snapchat posts from the result.
- **Calendar** — month view of scheduled/published posts.
- **Scheduler** — runs inside the app (every minute). For external cron (e.g. Task Scheduler), hit `GET /api/cron/publish`.

## Publishing — platform prerequisites

All credentials go in **Settings → Connections** (add the redirect URI shown there to each developer app).

| Platform | Notes |
|---|---|
| **Instagram** | Meta app with `instagram_content_publish` etc. Media must be publicly reachable — when running locally set `PUBLIC_BASE_URL` to a tunnel (e.g. ngrok) since Instagram's servers fetch the image/video URL. |
| **Facebook Pages** | Meta app with page permissions; supports text/photo/video; works fine from localhost. |
| **LinkedIn** | App with “Sign In with OpenID Connect” + “Share on LinkedIn” products. |
| **X (Twitter)** | App with OAuth 2.0 (PKCE) — scopes: `tweet.read tweet.write users.read offline.access`. |
| **TikTok** | Content Posting API access (requires app review for public posts; unaudited apps post as private on the connected account). |
| **Snapchat** | **No public posting API** — posts are marked “manual”: content is generated at 1080×1920 and downloadable for hand-posting. |

### WhatsApp inbox & AI concierge

Uses the official **WhatsApp Cloud API** (free tier: unlimited messages inside 24-hour customer windows + 1,000 service conversations/month).

1. In [Meta Developers](https://developers.facebook.com/apps) create an app with the **WhatsApp** product.
2. On the app's **WhatsApp page**, copy the **Phone number ID**.
3. In Meta Business Settings → System Users, generate a **permanent access token** with `whatsapp_business_messaging` permission.
4. Paste them into the setup card on the app's **WhatsApp** page → **Test connection**.
5. To **receive** replies, in Meta → WhatsApp → Configuration set the webhook URL shown on the WhatsApp page (includes your company id) plus the verify token. Webhooks need a public URL — when running locally use a tunnel (e.g. ngrok) and set `PUBLIC_BASE_URL`. **Sending works without a webhook.**

Features: two-pane inbox, send text/images from the media library, approved template sending outside the 24-hour window, unread badges, and an **AI auto-reply toggle** — the WhatsApp Concierge agent (Ziad) instantly answers incoming messages in the customer's language using the company's brand voice.

## Environment variables (`.env`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite file (default `file:./dev.db`) |
| `SESSION_SECRET` | Signs session cookies |
| `APP_ENCRYPTION_KEY` | Encrypts AI keys + OAuth tokens at rest (64 hex chars) |
| `MEDIA_SERVICE_URL` | Python service URL (default `http://127.0.0.1:8000`) |
| `MEDIA_DIR` | Media storage (default `./data/media`) |
| `PUBLIC_BASE_URL` | Public URL of this app — used by Instagram/TikTok to fetch media |

## Production notes

- `npm run build && npm start` for the web app; run uvicorn without `--reload` for the media service.
- Switch to PostgreSQL by changing `DATABASE_URL` and running `prisma db push`.
- Keep `SESSION_SECRET` / `APP_ENCRYPTION_KEY` stable — changing them invalidates sessions/encrypted keys.

## Troubleshooting

- **“Media service offline”** in the sidebar → start it: `npm run media`
- **Arabic text looks disconnected/wrong order in designs** → run `npm run fonts` (downloads Cairo)
- **Instagram publish fails “media fetch”** → your `PUBLIC_BASE_URL` isn't publicly reachable; use a tunnel or deploy.
- **TikTok post appears private** → expected for unaudited apps; open TikTok to review/publish manually.
