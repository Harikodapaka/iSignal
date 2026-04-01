import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { cache } from '@/lib/cache';
import { aiCorrelations } from '@/lib/ai';

// ── Server-side Pearson correlation + conditional stats ──────────────────────
interface DayMetrics {
  [metricKey: string]: number;
}

interface CorrelationInput {
  metricA: string;
  metricB: string;
  r: number; // Pearson coefficient
  avgAWhenBHigh: number;
  avgAWhenBLow: number;
  avgBWhenAHigh: number;
  avgBWhenALow: number;
  overlapDays: number;
}

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 3) return 0;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0,
    denX = 0,
    denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}

function computeCorrelations(events: { metricKey: string; value: number; date: string }[]): CorrelationInput[] {
  // Group by date → { date: { metricKey: value } }
  const byDate = new Map<string, DayMetrics>();
  for (const e of events) {
    if (!byDate.has(e.date)) byDate.set(e.date, {});
    const day = byDate.get(e.date)!;
    // Sum same-day same-metric entries
    day[e.metricKey] = (day[e.metricKey] ?? 0) + e.value;
  }

  // Get unique metric keys
  const metricKeys = [...new Set(events.map((e) => e.metricKey))];
  const results: CorrelationInput[] = [];

  for (let i = 0; i < metricKeys.length; i++) {
    for (let j = i + 1; j < metricKeys.length; j++) {
      const a = metricKeys[i];
      const b = metricKeys[j];

      // Find days where both metrics have data
      const xs: number[] = [];
      const ys: number[] = [];
      for (const day of byDate.values()) {
        if (day[a] !== undefined && day[b] !== undefined) {
          xs.push(day[a]);
          ys.push(day[b]);
        }
      }

      if (xs.length < 5) continue; // need enough overlap

      const r = pearson(xs, ys);
      if (Math.abs(r) < 0.2) continue; // skip weak correlations

      // Conditional averages: split by median
      const medianA = [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
      const medianB = [...ys].sort((a, b) => a - b)[Math.floor(ys.length / 2)];

      const bWhenAHigh = ys.filter((_, k) => xs[k] > medianA);
      const bWhenALow = ys.filter((_, k) => xs[k] <= medianA);
      const aWhenBHigh = xs.filter((_, k) => ys[k] > medianB);
      const aWhenBLow = xs.filter((_, k) => ys[k] <= medianB);

      const avg = (arr: number[]) =>
        arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;

      results.push({
        metricA: a,
        metricB: b,
        r: Math.round(r * 100) / 100,
        avgAWhenBHigh: avg(aWhenBHigh),
        avgAWhenBLow: avg(aWhenBLow),
        avgBWhenAHigh: avg(bWhenAHigh),
        avgBWhenALow: avg(bWhenALow),
        overlapDays: xs.length,
      });
    }
  }

  // Sort by absolute correlation strength
  results.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  return results.slice(0, 5); // top 5
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Rate limit AI calls
    const rl = await cache.checkRateLimit(userId, 'aiInsights', 5, 3600);
    if (!rl.allowed) {
      return NextResponse.json({ success: false, error: 'Too many AI requests. Try again later.' }, { status: 429 });
    }

    const body = await req.json().catch(() => ({ events: [] }));
    const events = body.events ?? [];

    // Pre-compute correlations server-side, then let AI interpret
    const computed = computeCorrelations(events);

    const correlations = await aiCorrelations(events, computed, userId);

    return NextResponse.json({ success: true, data: correlations });
  } catch (err) {
    console.error('POST /api/analytics/correlations error:', err);
    return NextResponse.json({ success: false, error: 'Failed to compute correlations' }, { status: 500 });
  }
}
