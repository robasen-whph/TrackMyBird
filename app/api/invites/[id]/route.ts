export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { guestTokens } from '@/db/schema';
import { requireAuth } from '@/lib/session';
import { eq, and } from 'drizzle-orm';

export async function DELETE(
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

    // Mark as revoked (only if owned by user)
    const result = await db
      .update(guestTokens)
      .set({ revoked: true })
      .where(
        and(
          eq(guestTokens.id, tokenId),
          eq(guestTokens.issuedByUserId, session.user.id)
        )
      )
      .returning();

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Token not found or not owned by user' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: 'Token revoked successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('[invites] DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tokenId = parseInt(id);

    if (isNaN(tokenId)) {
      return NextResponse.json(
        { error: 'Invalid token ID' },
        { status: 400 }
      );
    }

    // Get token metadata (developer test endpoint)
    const [token] = await db
      .select()
      .from(guestTokens)
      .where(eq(guestTokens.id, tokenId))
      .limit(1);

    if (!token) {
      return NextResponse.json(
        { error: 'Token not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      token: {
        id: token.id,
        nickname: token.nickname,
        aircraft_ids: token.aircraftIds,
        expires_at: token.expiresAt,
        revoked: token.revoked,
        last_view_at: token.lastViewAt,
        created_at: token.createdAt,
      },
    });
  } catch (error) {
    console.error('[invites] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
