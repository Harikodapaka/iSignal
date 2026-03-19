# iSignal Roadmap

---

## Tier 1 — High Impact, Buildable Now _(This Sprint)_

- [ ] **1. Voice logging via Siri Shortcut** (~1 day)
  - iOS Shortcut → POST to API
  - Biggest friction reducer — log without opening the app

- [ ] **2. Daily digest push notification** (~2 days)
  - 9am: streak, recent mood avg, missed metrics
  - Wire up existing SW stub. Core retention feature

- [ ] **3. Streak + gamification on Today page** (~1 day)
  - Visible streak counter, weekly ring fill, "best week" banner
  - `currentStreak` + `weeklyScore` already computed

- [ ] **4. Smart per-metric reminders** (~3 days)
  - "You usually log water at 2pm." Learned from logging history
  - Not available anywhere in the competitor space

---

## Tier 2 — Medium Effort, High Differentiation _(Next Milestone)_

- [ ] **5. React Native / Expo app** (weeks)
  - ~70% logic reuse. Unlocks widgets, proper notifications, Siri deep links
  - Separates side project from product

- [ ] **6. Apple Health / Google Fit sync** (~1 week)
  - Auto-import sleep, steps, heart rate
  - Passive data + active NLP logging, all correlated together

- [ ] **7. Weekly AI email digest** (~2 days)
  - Sunday: week in numbers, one correlation insight, one focus suggestion
  - Groq generates, Resend delivers

- [ ] **8. Metric starter packs** (~1 day)
  - Sleep stack, fitness stack, mental health stack
  - One-tap setup. Solves blank-slate problem for new users

---

## Tier 3 — Longer Term, Moat Builders _(Future Roadmap)_

- [ ] **9. Multi-user / shared metrics** (months)
  - Couples, trainer + clients, B2B coaching
  - No competitor does this well

- [ ] **10. LLM "ask your data"** (months)
  - "Why do I sleep badly?" → AI queries 90-day history
  - Surfaces correlations conversationally

- [ ] **11. Public API + Zapier** (months)
  - Pipe in data from Notion, Garmin, Whoop, IFTTT
  - NLP layer on top of integrations = hard to beat

- [ ] **12. Monetization** (when ready)
  - Free: 5 metrics, 7d history
  - Pro $4.99/mo: unlimited, 90d history, AI insights, Apple Health, weekly digest

---

## Recommended Build Order

1. Voice logging via Siri Shortcut
2. Daily push notification
3. Weekly email digest
4. Streak UI on Today page
5. Native app + Apple Health
