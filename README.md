# iSignal — Health Tracker

> Log fast. Structure quietly. Analyze later.

## Stack

- **Next.js 16** + App Router
- **Mantine 8** UI + Charts
- **Auth.js v5** (Google OAuth)
- **MongoDB Atlas M0** (free)
- **Gemini Flash 2.0** (free tier AI)
- **TypeScript 5**

---

## Setup

### 1. Install dependencies

```bash
npm install
```

> Uses `overrides` in package.json to resolve next-auth peer dep with Next.js 16. No `--legacy-peer-deps` needed.

### 2. Configure environment

Copy `.env.local` and fill in your values:

```bash
# MongoDB Atlas M0 — free at cloud.mongodb.com
MONGODB_URI=mongodb+srv://...

# Auth.js secret — run: npx auth secret
AUTH_SECRET=...

# Google OAuth — console.cloud.google.com
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...

# Gemini — aistudio.google.com (free)
GEMINI_API_KEY=...

NEXTAUTH_URL=http://localhost:3000
```

### 3. Google OAuth setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → APIs & Services → Credentials
3. Create OAuth 2.0 Client ID (Web application)
4. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
5. Copy Client ID + Secret into `.env.local`

### 4. Seed system aliases

```bash
npx tsx scripts/seed-aliases.ts
```

### 5. Run dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Architecture

```
Raw Event Layer  →  events collection     (every log, rawText preserved)
Metric Layer     →  metrics collection    (auto-created at 1 log, pinned at 3)
Analytics Layer  →  computed on-the-fly  (cached 5min in MongoDB TTL cache)
Alias Layer      →  aliases collection   (rawKey → canonicalKey, user + global)
Cache Layer      →  cache collection     (TTL index, auto-delete)
```

## How logging works

```
User types "slept 7.5"
  → Tokenizer extracts: key="slept", value=7.5
  → Alias lookup: "slept" → "sleep" (system alias)
  → Event saved immediately
  → Metric upserted, frequencyScore++
  → frequencyScore >= 3 → auto-pinned to dashboard
  → Cache invalidated
  → [background] AI context extraction
```

## AI Features (Gemini Flash, free tier)

| Feature            | Trigger              | Model        |
| ------------------ | -------------------- | ------------ |
| Alias resolution   | Unknown key logged   | Gemini Flash |
| Context extraction | Input > 3 words      | Gemini Flash |
| Correlations       | User clicks Analyze  | Gemini Flash |
| Weekly summary     | User clicks Generate | Gemini Flash |

All AI calls are async — never block the write path.

## Error handling

- All AI calls have 4s timeout + graceful fallback
- Rate limits: 60 events/min, 10 AI calls/min (per user)
- MongoDB queries have `maxTimeMS(5000)`
- Cache misses never crash — always fail open
- Input validated with Zod (max 200 chars)

---

## Deploy to Vercel

```bash
npm run build
vercel deploy
```

Add all `.env.local` values to Vercel environment variables.
Update Google OAuth redirect URI to your production URL.
