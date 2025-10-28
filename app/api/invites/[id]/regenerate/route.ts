import { NextResponse } from 'next/server';
import { db } from '@/db';
import { guestTokens } from '@/db/schema';
import { requireAuth } from '@/lib/session';
import { generateToken, hashToken } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const tokenId = parseInt(id);

    if (isNaN(tokenId)) {
      return NextResponse.json(
        { error: 'Invalid token ID' },
        { status: 400 }
      );
    }

    // Verify token belongs to user
    const [existingToken] = await db
      .select()
      .from(guestTokens)
      .where(
        and(
          eq(guestTokens.id, tokenId),
          eq(guestTokens.issuedByUserId, session.user.id)
        )
      )
      .limit(1);

    if (!existingToken) {
      return NextResponse.json(
        { error: 'Token not found or not owned by user' },
        { status: 404 }
      );
    }

    // Generate new token and hash
    const newToken = generateToken();
    const newTokenHash = await hashToken(newToken);

    // Update with new token hash
    await db
      .update(guestTokens)
      .set({ tokenHash: newTokenHash })
      .where(eq(guestTokens.id, tokenId));

    // Construct invite URL using request headers for proxy-aware URL
    const host = request.headers.get('host') || new URL(request.url).host;
    const proto = request.headers.get('x-forwarded-proto') || 'http';
    const inviteUrl = `${proto}://${host}/v/${newToken}`;

    return NextResponse.json({
      ok: true,
      invite_url: inviteUrl,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('[invites] regenerate error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
