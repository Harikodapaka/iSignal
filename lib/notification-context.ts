import { toLocalDateString } from './timezone';
import EventModel from '@/models/Event';
import MetricModel from '@/models/Metric';

export interface NotificationContext {
  userName: string;
  pinnedMetrics: { metricKey: string; displayName: string }[];
  loggedToday: Set<string>;
  sleepStreak: number;
  sleepLoggedYesterday: boolean;
}

/**
 * Build per-user notification context by querying their metrics and events.
 * Used by the cron notification route to personalize messages.
 */
export async function buildNotificationContext(
  userId: string,
  tz: string,
  userName?: string
): Promise<NotificationContext> {
  const today = toLocalDateString(tz);

  // Get yesterday's date
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const yesterdayDate = formatter.format(d);

  // Parallel queries
  const [pinnedMetrics, todayEvents, sleepEvents] = await Promise.all([
    // Get pinned metrics
    MetricModel.find({ userId, pinned: true }).select('metricKey displayName').lean().maxTimeMS(5000),

    // Get today's events (unique metric keys)
    EventModel.find({ userId, date: today }).select('metricKey').lean().maxTimeMS(5000),

    // Check if sleep was logged yesterday + recent sleep dates for streak
    EventModel.find({
      userId,
      metricKey: 'sleep',
      date: { $gte: getDateNDaysAgo(30, tz) },
    })
      .select('date')
      .lean()
      .maxTimeMS(5000),
  ]);

  // Build logged-today set
  const loggedToday = new Set(todayEvents.map((e) => (e as { metricKey: string }).metricKey));

  // Check if sleep was logged yesterday
  const sleepDates = sleepEvents.map((e) => (e as { date: string }).date);
  const sleepLoggedYesterday = sleepDates.includes(yesterdayDate);

  // Calculate sleep streak
  const sleepStreak = calculateStreak(sleepDates, today);

  return {
    userName: userName || 'there',
    pinnedMetrics: (pinnedMetrics as { metricKey: string; displayName: string }[]).map((m) => ({
      metricKey: m.metricKey,
      displayName: m.displayName,
    })),
    loggedToday,
    sleepStreak,
    sleepLoggedYesterday,
  };
}

function calculateStreak(dates: string[], today: string): number {
  const unique = [...new Set(dates)].sort().reverse();
  let streak = 0;
  let cursor = new Date(today);

  for (const date of unique) {
    const d = new Date(date);
    const diff = Math.round((cursor.getTime() - d.getTime()) / 86400000);
    if (diff === 0 || diff === 1) {
      streak++;
      cursor = d;
    } else break;
  }
  return streak;
}

function getDateNDaysAgo(n: number, tz: string): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(d);
  } catch {
    return d.toISOString().split('T')[0];
  }
}

/**
 * Get the current hour in a given timezone (0-23).
 */
export function getLocalHour(tz: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false,
    });
    return parseInt(formatter.format(new Date()), 10);
  } catch {
    return new Date().getUTCHours();
  }
}

/**
 * Determine which notification window applies for a given timezone.
 * Returns null if no window matches the current local time.
 */
export function getNotificationWindow(tz: string): 'morning' | 'midday' | 'evening' | null {
  const hour = getLocalHour(tz);

  if (hour >= 6 && hour <= 8) return 'morning';
  if (hour >= 12 && hour <= 13) return 'midday';
  if (hour >= 19 && hour <= 20) return 'evening'; // 7-8 PM
  return null;
}
