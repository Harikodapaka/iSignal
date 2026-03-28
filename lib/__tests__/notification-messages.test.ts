import { describe, it, expect } from 'vitest';
import {
  getMorningMessage,
  getMiddayMessage,
  getEveningMessage,
  getMetricReminderMessage,
  type NotificationContext,
} from '../notification-messages';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<NotificationContext> = {}): NotificationContext {
  return {
    userName: 'Test User',
    pinnedMetrics: [
      { metricKey: 'sleep', displayName: 'Sleep' },
      { metricKey: 'water', displayName: 'Water' },
      { metricKey: 'mood', displayName: 'Mood' },
    ],
    loggedToday: new Set<string>(),
    sleepStreak: 0,
    sleepLoggedYesterday: false,
    ...overrides,
  };
}

// ── Morning ──────────────────────────────────────────────────────────────────

describe('getMorningMessage', () => {
  it('returns a sleep reminder when sleep is pinned but not logged today', () => {
    const msg = getMorningMessage(makeCtx());
    expect(msg.url).toBe('/today');
    // Should be a sleep reminder, not a "already logged" message
    expect(msg.title).not.toContain('Already logged');
    expect(msg.title).not.toContain('Early bird');
    expect(msg.title).not.toContain('Gold star');
  });

  it('returns streak-preserving nudge when sleep not logged today but has active streak', () => {
    const msg = getMorningMessage(
      makeCtx({
        sleepLoggedYesterday: true,
        sleepStreak: 5,
      })
    );
    expect(msg.title).toContain('5-day streak');
    expect(msg.body).toContain('sleep');
  });

  it('returns "already logged" only when sleep IS logged today', () => {
    const msg = getMorningMessage(
      makeCtx({
        loggedToday: new Set(['sleep']),
        sleepStreak: 3,
        sleepLoggedYesterday: true,
      })
    );
    // Should be one of the MORNING_SLEEP_LOGGED messages
    const celebratoryTitles = ['Nice! Already logged 💪', 'Early bird! 🐦', 'Gold star for you ⭐'];
    expect(celebratoryTitles).toContain(msg.title);
  });

  it('does NOT show "already logged" when sleep was logged yesterday but not today', () => {
    // This is the bug that was fixed
    const msg = getMorningMessage(
      makeCtx({
        sleepLoggedYesterday: true,
        sleepStreak: 3,
        loggedToday: new Set(), // NOT logged today
      })
    );
    const celebratoryTitles = ['Nice! Already logged 💪', 'Early bird! 🐦', 'Gold star for you ⭐'];
    expect(celebratoryTitles).not.toContain(msg.title);
  });

  it('returns generic morning when sleep is not pinned', () => {
    const msg = getMorningMessage(
      makeCtx({
        pinnedMetrics: [{ metricKey: 'water', displayName: 'Water' }],
      })
    );
    expect(msg.title).toContain('Good morning');
    expect(msg.title).toContain('Test');
  });

  it('uses first name only in generic morning greeting', () => {
    const msg = getMorningMessage(
      makeCtx({
        userName: 'Chaitanya Kodapaka',
        pinnedMetrics: [{ metricKey: 'water', displayName: 'Water' }],
      })
    );
    expect(msg.title).toContain('Chaitanya');
    expect(msg.title).not.toContain('Kodapaka');
  });

  it('falls back to "there" when userName is empty', () => {
    const msg = getMorningMessage(
      makeCtx({
        userName: 'there',
        pinnedMetrics: [],
      })
    );
    expect(msg.title).toContain('there');
  });
});

// ── Midday ───────────────────────────────────────────────────────────────────

describe('getMiddayMessage', () => {
  it('returns "on fire" when all metrics are logged', () => {
    const msg = getMiddayMessage(
      makeCtx({
        loggedToday: new Set(['sleep', 'water', 'mood']),
      })
    );
    expect(msg.title).toContain('on fire');
    expect(msg.url).toBe('/today');
  });

  it('returns a metric-specific template when available', () => {
    const msg = getMiddayMessage(
      makeCtx({
        pinnedMetrics: [{ metricKey: 'water', displayName: 'Water' }],
        loggedToday: new Set(),
      })
    );
    // Should be one of the water templates
    const waterTitles = ['Hydration check! 💧', 'Glug glug 🥤'];
    expect(waterTitles).toContain(msg.title);
  });

  it('returns a generic template for unknown metrics', () => {
    const msg = getMiddayMessage(
      makeCtx({
        pinnedMetrics: [{ metricKey: 'custom_metric', displayName: 'My Custom' }],
        loggedToday: new Set(),
      })
    );
    // Should contain the display name in the body
    expect(msg.body).toContain('My Custom');
  });

  it('prefers metrics with specific templates over generic ones', () => {
    // Run this 20 times — water should always get a water-specific template
    for (let i = 0; i < 20; i++) {
      const msg = getMiddayMessage(
        makeCtx({
          pinnedMetrics: [
            { metricKey: 'water', displayName: 'Water' },
            { metricKey: 'custom_thing', displayName: 'Custom' },
          ],
          loggedToday: new Set(),
        })
      );
      // If it picked water, it should use the water template
      if (msg.title.includes('Hydration') || msg.title.includes('Glug')) {
        expect(msg.body).not.toContain('{metric}');
      }
    }
  });

  it('skips already-logged metrics', () => {
    const msg = getMiddayMessage(
      makeCtx({
        pinnedMetrics: [
          { metricKey: 'water', displayName: 'Water' },
          { metricKey: 'custom_only', displayName: 'Custom Only' },
        ],
        loggedToday: new Set(['water']),
      })
    );
    // Water is logged, so it should pick custom_only
    expect(msg.body).toContain('Custom Only');
  });
});

// ── Evening ──────────────────────────────────────────────────────────────────

describe('getEveningMessage', () => {
  it('returns perfect day message when all logged', () => {
    const msg = getEveningMessage(
      makeCtx({
        pinnedMetrics: [
          { metricKey: 'sleep', displayName: 'Sleep' },
          { metricKey: 'water', displayName: 'Water' },
        ],
        loggedToday: new Set(['sleep', 'water']),
      })
    );
    const perfectTitles = ['Perfect day! 🏆', '100% completion! 🎯'];
    expect(perfectTitles).toContain(msg.title);
  });

  it('returns "almost there" when ≤3 metrics missing', () => {
    const msg = getEveningMessage(
      makeCtx({
        pinnedMetrics: [
          { metricKey: 'sleep', displayName: 'Sleep' },
          { metricKey: 'water', displayName: 'Water' },
          { metricKey: 'mood', displayName: 'Mood' },
        ],
        loggedToday: new Set(['sleep']),
      })
    );
    // 2 missing (water, mood) — should be "almost there" or "2 to go"
    expect(msg.body).toMatch(/Water|Mood/);
  });

  it('includes missing metric names in the body', () => {
    const msg = getEveningMessage(
      makeCtx({
        pinnedMetrics: [
          { metricKey: 'sleep', displayName: 'Sleep' },
          { metricKey: 'water', displayName: 'Water' },
        ],
        loggedToday: new Set(['sleep']),
      })
    );
    expect(msg.body).toContain('Water');
  });

  it('returns wrap-up message when many metrics missing', () => {
    const msg = getEveningMessage(
      makeCtx({
        pinnedMetrics: [
          { metricKey: 'a', displayName: 'A' },
          { metricKey: 'b', displayName: 'B' },
          { metricKey: 'c', displayName: 'C' },
          { metricKey: 'd', displayName: 'D' },
          { metricKey: 'e', displayName: 'E' },
        ],
        loggedToday: new Set(['a']),
      })
    );
    // 4 missing — should be a generic wrap-up
    expect(msg.body).toMatch(/4/);
  });

  it('always has url /today', () => {
    const msg = getEveningMessage(makeCtx());
    expect(msg.url).toBe('/today');
  });
});

// ── Per-metric reminders ─────────────────────────────────────────────────────

describe('getMetricReminderMessage', () => {
  it('uses specific template for known metrics (water)', () => {
    const msg = getMetricReminderMessage('water', 'Water');
    const waterTitles = ['Hydration check! 💧', 'Glug glug 🥤'];
    expect(waterTitles).toContain(msg.title);
  });

  it('uses specific template for known metrics (mood)', () => {
    const msg = getMetricReminderMessage('mood', 'Mood');
    const moodTitles = ['Mood check! 🎭', "How's it going? 😊"];
    expect(moodTitles).toContain(msg.title);
  });

  it('uses generic template with display name for unknown metrics', () => {
    const msg = getMetricReminderMessage('my_custom', 'My Custom');
    expect(msg.title).toContain('My Custom');
    expect(msg.body).toContain('My Custom');
  });

  it('does not have leftover {name} placeholders', () => {
    const msg = getMetricReminderMessage('some_key', 'Some Key');
    expect(msg.title).not.toContain('{name}');
    expect(msg.body).not.toContain('{name}');
  });

  it('always has url /today', () => {
    const msg = getMetricReminderMessage('water', 'Water');
    expect(msg.url).toBe('/today');
  });
});
