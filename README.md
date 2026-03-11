# iSignal — Activity Logger

> Log fast. Structure quietly. Analyze later.

Type anything — `"slept 7.5"`, `"water 2L"`, `"feeling awesome"` — and iSignal figures out what you mean, stores it, and builds your trends automatically.

---

## Stack

| Layer      | Technology                                |
| ---------- | ----------------------------------------- |
| Framework  | Next.js 16 + App Router + React 19        |
| UI         | Mantine 8 + Tabler Icons + Recharts       |
| Auth       | Auth.js v5 (Google OAuth)                 |
| Database   | MongoDB Atlas M0 (free) + Mongoose 8      |
| AI         | Groq — `llama-3.1-8b-instant` (free tier) |
| Validation | Zod                                       |
| Language   | TypeScript 5                              |
| Deployment | Vercel                                    |

---

## Setup

### 1. Install dependencies

```bash
npm install
```

> Uses `overrides` in `package.json` to resolve next-auth peer dep with Next.js 16. No `--legacy-peer-deps` needed.

### 2. Configure environment

Create `.env.local`:

```bash
# MongoDB Atlas M0 — free at cloud.mongodb.com
MONGODB_URI=mongodb+srv://...

# Auth.js secret — run: npx auth secret
AUTH_SECRET=...

# Google OAuth — console.cloud.google.com
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...

# Groq — console.groq.com (free tier)
GROQ_API_KEY=...

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

## How Logging Works

```
User types "slept 7.5"
  → Parser tokenizes + strips noise words
  → Alias lookup: "slept" → "sleep" (system alias, no AI needed)
  → Unit fallback: parsed.unit ?? KNOWN_METRICS.unit ?? existing DB metric unit
  → Event saved immediately (rawText preserved)
  → Metric upserted, frequencyScore++
  → frequencyScore >= 3 → auto-pinned to dashboard
  → Analytics + alias cache invalidated

User types "feeling awesome" (all noise words, parser returns null)
  → Temp event saved { metricKey: '__unknown__' }
  → AI extraction fires async (non-blocking)
  → Client polls /api/events?id=... every 2s
  → AI corrects: '__unknown__' → 'mood', value: 9
  → Toast updates: "✓ Mood logged"
  → Alias written for next time (rawText → canonicalKey)
```

### Parser pipeline

```
raw input
  → lowercase + tokenize
  → strip NOISE_WORDS (filler: "i", "my", "done", "feeling" ...)
  → VERB_TOKENS get -0.5 score penalty ("drank", "shaved" ...)
  → extract numeric value + unit via UNIT_MAP
  → exact match remaining tokens against KNOWN_METRICS + user metric keys
  → alias cache lookup (MongoDB TTL cache)
  → single word with no match → 400 error
  → multi-word with no match → AI extraction via Groq
```

---

## Known Metrics

16 built-in metrics with preset units, colors, and aggregation rules:

| Metric         | Unit | Aggregation |
| -------------- | ---- | ----------- |
| Sleep 🌙       | h    | last        |
| Workout 💪     | —    | last        |
| Protein 🥩     | g    | sum         |
| Mood 😊        | /10  | avg         |
| Water 💧       | L    | sum         |
| Steps 👟       | k    | sum         |
| Weight ⚖️      | kg   | last        |
| Meditation 🧘  | min  | sum         |
| Reading 📚     | min  | sum         |
| Caffeine ☕    | mg   | sum         |
| Calories 🍽️    | kcal | sum         |
| Run 🏃         | km   | sum         |
| Energy ⚡      | /10  | avg         |
| Stress 😰      | /10  | avg         |
| Screen Time 📱 | h    | sum         |
| Alcohol 🍺     | —    | last        |

User-created metrics (e.g. `"shaved beard"`, `"cold shower"`) are fully supported — the parser falls through to AI which creates a new metric with inferred `valueType`, `unit`, and `aggregation`.

**Aggregation** controls how multiple same-day logs combine:

- `sum` — additive (water, steps, calories)
- `avg` — averaged (mood, energy, stress)
- `last` — most recent wins (sleep, weight)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Raw Event Layer   events collection                     │
│  every log stored with rawText, value, unit, metricKey  │
├─────────────────────────────────────────────────────────┤
│  Metric Layer      metrics collection                    │
│  auto-created on first log, auto-pinned at 3 logs       │
├─────────────────────────────────────────────────────────┤
│  Alias Layer       aliases collection                    │
│  rawKey → canonicalKey, written by system + AI          │
├─────────────────────────────────────────────────────────┤
│  Analytics Layer   computed on-the-fly                  │
│  daily aggregation, streaks, trends, range avg          │
├─────────────────────────────────────────────────────────┤
│  Cache Layer       cache collection (MongoDB TTL)        │
│  analytics:userId:key:range, metrics:pinned, aliases    │
└─────────────────────────────────────────────────────────┘
```

### File Structure

```
app/
├── (app)/
│   ├── today/          — log input + today's pinned metrics
│   ├── trends/         — charts with 7d / 30d / 3mo range selector
│   ├── metrics/        — all metrics, edit drawer (name/unit/aggregation)
│   └── insights/       — AI correlations + weekly summary (Groq)
├── api/
│   ├── events/         — POST log, GET by date or id (AI poll)
│   ├── metrics/        — GET pinned, PATCH (pin, edit, unit backfill)
│   ├── analytics/      — GET trends + stats per metric per range
│   └── aliases/        — GET pending aliases for user confirmation
lib/
├── parser.ts           — tokenizer, fuzzy matcher, unit extractor
├── parser-constants.ts — UNIT_MAP, NOISE_WORDS, VERB_TOKENS
├── metrics.ts          — KNOWN_METRICS, KnownMetric, AggregationType
├── ai.ts               — Groq calls: extraction, alias resolution, correlations
├── cache.ts            — MongoDB TTL cache helpers
├── mongodb.ts          — Mongoose connection (dev singleton)
└── timezone.ts         — getLastNDays, toLocalDateString
models/
├── Event.ts            — rawText, metricKey, value, valueType, unit, date
├── Metric.ts           — displayName, valueType, unit, aggregation, pinned, frequencyScore
├── Alias.ts            — rawKey, canonicalKey, confidence, createdBy
├── PendingAlias.ts     — aliases awaiting user confirmation
└── Cache.ts            — key, value, expiresAt (TTL index)
hooks/
├── useAnalytics.ts     — fetches analytics per range (7d/30d/3mo)
├── useEvents.ts        — fetches today's events
└── useMetrics.ts       — fetches pinned metrics, exposes updateMetric()
components/
├── log/LogInput.tsx              — log input with autocomplete + AI toast polling
├── metrics/MetricCard.tsx        — metric card with sparkline
├── metrics/MetricEditDrawer.tsx  — edit name, unit, aggregation, valueType
├── metrics/PendingAliasPrompt.tsx — confirm AI-suggested aliases
├── ui/                           — GlassCard, PageHeader, SectionLabel, SparkBars
├── Providers.tsx                 — session + auth provider wrapper
└── ServiceWorkerRegistration.tsx — registers SW on mount (client component)
public/
├── sw.js                  — service worker (pass-through now, offline-ready structure)
├── manifest.json          — PWA manifest with shortcuts
├── favicon.ico / favicon.svg / favicon-16x16.png / favicon-32x32.png / favicon-96x96.png
├── android-icon-*.png     — 36, 48, 72, 96, 144, 192
├── apple-icon-*.png       — 57, 60, 72, 76, 114, 120, 144, 152, 180
└── ms-icon-*.png          — 70, 144, 150, 310
proxy.ts                   — Next.js 16 auth middleware, allows all public/static assets
next.config.ts             — SW + manifest headers (Content-Type, Cache-Control, Service-Worker-Allowed)
```

---

## AI Features

All AI calls use Groq (`llama-3.1-8b-instant`) and are **always async — never blocking the write path**.

| Feature           | Trigger                               | What it does                                                     |
| ----------------- | ------------------------------------- | ---------------------------------------------------------------- |
| Metric extraction | Parser returns null (all noise words) | Identifies metric + value from free-form text, corrects spelling |
| Alias resolution  | Parser matched unknown key            | Maps raw key to canonical metric key                             |
| Correlations      | `/api/analytics/correlations`         | Finds patterns across metrics                                    |
| Weekly summary    | `/api/analytics/summary`              | Natural language summary                                         |

AI extraction also:

- Corrects spelling mistakes (`"wter"` → `water`, `"slep"` → `sleep`)
- Infers sentiment values for scored metrics (`"feeling awesome"` → `mood: 9`)
- Falls back gracefully if confidence < 0.7
- Never writes alias for `__unknown__` — prevents all future inputs mapping to the same metric

---

## PWA — Add to Home Screen

iSignal is a fully installable Progressive Web App.

**iOS (Safari):** Share → Add to Home Screen
**Android (Chrome):** Menu → Add to Home Screen, or browser install prompt

Features:

- Standalone display (no browser chrome)
- Custom icon per platform (android/apple/ms)
- App shortcuts: Log Today, Trends
- Orange theme color (`#ff6b00`) in status bar
- Service worker registered for future offline support + background sync

**Planned SW features:**

- Cache-first for static assets (`/_next/static/*`)
- Network-first with offline fallback for navigation
- Background sync — queue failed logs when offline, replay on reconnect
- Push notifications — daily reminders, streak alerts

---

## Error Handling & Limits

- All AI calls: 4s timeout + graceful fallback
- Rate limits: 60 events/min, 10 AI calls/min (per user)
- MongoDB queries: `maxTimeMS(5000)`
- Cache misses never crash — always fail open
- Input validated with Zod (max 200 chars)
- Single-word null parse → 400 error (not enough context for AI)
- Multi-word null parse → saved as `__unknown__`, AI resolves async

---

## Deploy to Vercel

```bash
npm run build
vercel deploy
```

Add all `.env.local` values to Vercel environment variables. Update Google OAuth redirect URI to your production domain.

> ⚠️ `GROQ_API_KEY` must be added to Vercel environment variables — it is not bundled at build time.
