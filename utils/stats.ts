import type { IAnalytics } from '@/types';

export function getBestStreak(analytics: IAnalytics[]): number {
  return Math.max(...analytics.map((a) => a.currentStreak ?? 0), 0);
}

export function getLoggedToday(analytics: IAnalytics[]): number {
  return analytics.filter((a) => a.todayValue !== null).length;
}

/** 0-100 score based on trends + completion */
export function getWeeklyScore(analytics: IAnalytics[]): number {
  if (!analytics.length) return 0;
  const scores = analytics.map((a) => {
    if (a.valueType === 'boolean') return ((a.daysCompletedThisWeek ?? 0) / 7) * 100;
    if (a.trend === 'up') return 85;
    if (a.trend === 'flat') return 65;
    return 45;
  });
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}
