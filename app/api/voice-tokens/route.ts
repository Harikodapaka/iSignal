import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { auth } from '@/auth';
import { connectDB } from '@/lib/mongodb';
import VoiceTokenModel from '@/models/VoiceToken';
import type { ApiResponse } from '@/types';

// ── GET /api/voice-tokens ─────────────────────────────────────────────────────
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const tokens = await VoiceTokenModel.find({ userId: session.user.id })
      .select('name token createdAt lastUsedAt')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, data: tokens });
  } catch (err) {
    console.error('GET /api/voice-tokens error:', err);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to fetch tokens' }, { status: 500 });
  }
}

// ── POST /api/voice-tokens ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'Default';

    await connectDB();

    // Limit to 5 tokens per user
    const count = await VoiceTokenModel.countDocuments({ userId: session.user.id });
    if (count >= 5) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Maximum 5 voice tokens allowed. Revoke one first.' },
        { status: 400 }
      );
    }

    const token = randomBytes(24).toString('base64url');

    const doc = await VoiceTokenModel.create({
      userId: session.user.id,
      token,
      name,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: doc._id,
          token,
          name: doc.name,
          createdAt: doc.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('POST /api/voice-tokens error:', err);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to create token' }, { status: 500 });
  }
}

// ── DELETE /api/voice-tokens?id=... ───────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const id = new URL(req.url).searchParams.get('id');
    if (!id) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Missing id' }, { status: 400 });
    }

    await connectDB();
    const result = await VoiceTokenModel.findOneAndDelete({ _id: id, userId: session.user.id });
    if (!result) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/voice-tokens error:', err);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to revoke token' }, { status: 500 });
  }
}
