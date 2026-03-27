import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectDB } from '@/lib/mongodb';
import { getSmartSuggestions } from '@/lib/smart-reminders';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectDB();

    const tz = req.nextUrl.searchParams.get('tz') || 'UTC';
    const days = parseInt(req.nextUrl.searchParams.get('days') || '30', 10);
    const metricKeysParam = req.nextUrl.searchParams.get('metrics');
    const metricKeys = metricKeysParam ? metricKeysParam.split(',') : undefined;

    const suggestions = await getSmartSuggestions(session.user.id, tz, {
      lookbackDays: Math.min(days, 90), // Cap at 90 days
      metricKeys,
    });

    return NextResponse.json({ success: true, data: suggestions });
  } catch (error) {
    console.error('[api/metrics/suggestions] Error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
