import type { PushPayload } from './push-sender';

export interface NotificationContext {
  userName: string;
  pinnedMetrics: { metricKey: string; displayName: string }[];
  loggedToday: Set<string>;
  sleepStreak: number;
  sleepLoggedYesterday: boolean;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Morning (6 AM) — sleep + good morning ──────────────────────────────────

const MORNING_SLEEP_REMINDER = [
  { title: 'Rise and shine! ☀️', body: "How'd you sleep last night? Quick — log it before you forget!" },
  { title: 'Good morning! 🌅', body: "Your pillow's still warm. How many hours did you get?" },
  { title: 'Wakey wakey! 😴', body: 'Before coffee kicks in — how was your sleep?' },
  { title: 'Morning check-in', body: 'Step 1: Log sleep. Step 2: Coffee. Step 3: Conquer the day.' },
  { title: 'Sleep report, please! 🛏️', body: "Your sleep tracker is waiting. Don't leave it hanging!" },
];

const MORNING_SLEEP_LOGGED = [
  { title: 'Nice! Already logged 💪', body: (streak: number) => `${streak}-day streak and counting. Keep it up!` },
  { title: 'Early bird! 🐦', body: () => "Sleep already logged — you're on top of things today." },
  { title: 'Gold star for you ⭐', body: (streak: number) => `Sleep tracked! That's ${streak} days in a row.` },
];

export function getMorningMessage(ctx: NotificationContext): PushPayload {
  const tracksSleep = ctx.pinnedMetrics.some((m) => m.metricKey === 'sleep');

  if (tracksSleep && !ctx.sleepLoggedYesterday) {
    const msg = pick(MORNING_SLEEP_REMINDER);
    return { title: msg.title, body: msg.body, url: '/today' };
  }

  if (tracksSleep && ctx.sleepStreak > 0) {
    const msg = pick(MORNING_SLEEP_LOGGED);
    return {
      title: msg.title,
      body: msg.body(ctx.sleepStreak),
      url: '/today',
    };
  }

  // Generic morning
  return {
    title: `Good morning, ${ctx.userName.split(' ')[0]}! ☀️`,
    body: 'New day, new data. What will you track first?',
    url: '/today',
  };
}

// ── Midday (~12 PM) — nudge for unlogged metrics ───────────────────────────

const MIDDAY_TEMPLATES: Record<string, { title: string; body: string }[]> = {
  water: [
    { title: 'Hydration check! 💧', body: 'Your water tracker is thirsty. How much have you had?' },
    { title: 'Glug glug 🥤', body: 'Quick — how many litres of water so far today?' },
  ],
  mood: [
    { title: 'Mood check! 🎭', body: "On a scale of 1-10, how's your vibe right now?" },
    { title: "How's it going? 😊", body: 'Take 2 seconds to log your mood. Future you will thank you.' },
  ],
  workout: [
    { title: 'Gym time? 🏋️', body: 'Have you worked out today? Log it or plan it!' },
    { title: 'Move your body! 💪', body: 'Your workout tracker is collecting dust today...' },
  ],
  steps: [
    { title: 'Step counter 👟', body: 'How many steps so far? Your tracker wants to know.' },
    { title: 'Walking update? 🚶', body: 'Drop your step count — even a rough guess counts!' },
  ],
  protein: [
    { title: 'Protein check 🥩', body: 'How much protein have you had so far today?' },
    { title: 'Gains tracker 💪', body: 'Your protein log is hungry for data.' },
  ],
  meditation: [
    { title: 'Zen moment? 🧘', body: 'Have you meditated today? Even 5 minutes counts!' },
    { title: 'Breathe in... 🌿', body: 'Quick meditation reminder. Did you find your calm today?' },
  ],
};

const MIDDAY_GENERIC = [
  { title: 'Midday check-in 📊', body: "You haven't logged {metric} today. Quick update?" },
  { title: 'Tracking reminder 📝', body: 'Your {metric} tracker misses you. Drop a quick log!' },
  { title: 'Data point needed! 📈', body: '{metric} is still empty today. Fix that?' },
];

export function getMiddayMessage(ctx: NotificationContext): PushPayload {
  // Find a pinned metric that hasn't been logged today
  const missing = ctx.pinnedMetrics.filter((m) => !ctx.loggedToday.has(m.metricKey));

  if (ctx.pinnedMetrics.length === 0) {
    return {
      title: 'No metrics pinned yet 📌',
      body: 'Pin a few metrics to start tracking your day!',
      url: '/today',
    };
  }

  if (missing.length === 0) {
    return {
      title: "You're on fire! 🔥",
      body: 'All metrics logged today. Impressive.',
      url: '/today',
    };
  }

  // Pick a random missing metric, prefer ones with specific templates
  const withTemplates = missing.filter((m) => MIDDAY_TEMPLATES[m.metricKey]);
  const target = withTemplates.length > 0 ? pick(withTemplates) : pick(missing);

  if (MIDDAY_TEMPLATES[target.metricKey]) {
    const msg = pick(MIDDAY_TEMPLATES[target.metricKey]);
    return { title: msg.title, body: msg.body, url: '/today' };
  }

  // Generic template with metric name
  const msg = pick(MIDDAY_GENERIC);
  return {
    title: msg.title,
    body: msg.body.replace('{metric}', target.displayName),
    url: '/today',
  };
}

// ── Per-metric reminders ────────────────────────────────────────────────────

const METRIC_REMINDER_GENERIC = [
  { title: 'Reminder: {name} 📝', body: "You haven't logged {name} today. Quick update?" },
  { title: "Don't forget {name}! 🔔", body: "Your {name} tracker is waiting for today's entry." },
  { title: '{name} check-in 📊', body: 'A quick {name} log keeps your data streak alive!' },
];

export function getMetricReminderMessage(metricKey: string, displayName: string): PushPayload {
  // Use specific templates if available, otherwise generic
  if (MIDDAY_TEMPLATES[metricKey]) {
    const msg = pick(MIDDAY_TEMPLATES[metricKey]);
    return { title: msg.title, body: msg.body, url: '/today' };
  }

  const msg = pick(METRIC_REMINDER_GENERIC);
  return {
    title: msg.title.replace('{name}', displayName),
    body: msg.body.replace('{name}', displayName),
    url: '/today',
  };
}

// ── Evening (7 PM) — wrap-up ────────────────────────────────────────────────

export function getEveningMessage(ctx: NotificationContext): PushPayload {
  const total = ctx.pinnedMetrics.length;
  const logged = ctx.loggedToday.size;
  const missing = ctx.pinnedMetrics.filter((m) => !ctx.loggedToday.has(m.metricKey));
  const missingCount = missing.length;

  if (total === 0) {
    return pick([
      {
        title: 'No metrics pinned yet 📌',
        body: 'Pin a few metrics to start tracking your day!',
        url: '/today',
      },
      {
        title: 'Get started! 🚀',
        body: 'Add some metrics to track and own your daily routine.',
        url: '/today',
      },
    ]);
  }

  if (missingCount === 0) {
    return pick([
      {
        title: 'Perfect day! 🏆',
        body: `All ${total} metrics logged. You absolute legend.`,
        url: '/today',
      },
      {
        title: '100% completion! 🎯',
        body: "Every single metric tracked today. That's dedication.",
        url: '/today',
      },
    ]);
  }

  if (missingCount <= 3) {
    const missingNames = missing.map((m) => m.displayName).join(', ');
    return pick([
      {
        title: `Almost there! ${logged}/${total} ✨`,
        body: `Just ${missingNames} left. Close out the day strong!`,
        url: '/today',
      },
      {
        title: `${missingCount} to go! 📋`,
        body: `${missingNames} — quick update and you're done for the day!`,
        url: '/today',
      },
    ]);
  }

  return pick([
    {
      title: `Evening wrap-up 🌙`,
      body: `You've logged ${logged}/${total} metrics today. ${missingCount} more to complete the day!`,
      url: '/today',
    },
    {
      title: `Day's not over yet! 💪`,
      body: `${missingCount} metrics still need love. A quick 2-minute log session?`,
      url: '/today',
    },
    {
      title: `Closing time 🔔`,
      body: `${logged} down, ${missingCount} to go. End the day with a clean sheet!`,
      url: '/today',
    },
  ]);
}
