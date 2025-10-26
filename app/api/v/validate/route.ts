import { NextResponse } from 'next/server';
import { db } from '@/db';
import { guestTokens, aircraft } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token_hash } = body;

    if (!token_hash) {
      return NextResponse.json(
        { error: 'Token hash is required' },
        { status: 400 }
      );
    }

    // Find the guest token by hash
    const [token] = await db
      .select()
      .from(guestTokens)
      .where(eq(guestTokens.tokenHash, token_hash))
      .limit(1);

    if (!token) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 404 }
      );
    }

    // Check if revoked
    if (token.revoked) {
      return NextResponse.json(
        { error: 'This access has been revoked' },
        { status: 403 }
      );
    }

    // Check if expired
    const now = new Date();
    if (token.expiresAt && token.expiresAt < now) {
      return NextResponse.json(
        { error: 'This access has expired' },
        { status: 403 }
      );
    }

    // Check if dormant (>6 months since last view or creation) and auto-revoke
    const sixMonthsAgo = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000);
    const isDormant = 
      (token.lastViewAt && token.lastViewAt < sixMonthsAgo) ||
      (!token.lastViewAt && token.createdAt < sixMonthsAgo);

    if (isDormant) {
      // Auto-revoke dormant token
      await db
        .update(guestTokens)
        .set({ revoked: true })
        .where(eq(guestTokens.id, token.id));

      return NextResponse.json(
        { error: 'This access has been automatically revoked due to inactivity (>6 months)' },
        { status: 403 }
      );
    }

    // Update last_view_at (token is active and valid)
    await db
      .update(guestTokens)
      .set({ lastViewAt: now })
      .where(eq(guestTokens.id, token.id));

    // Fetch aircraft details
    const aircraftIds = Array.isArray(token.aircraftIds) ? token.aircraftIds : [];
    
    let aircraftList: typeof aircraft.$inferSelect[] = [];
    if (aircraftIds.length > 0) {
      aircraftList = await db
        .select()
        .from(aircraft)
        .where(inArray(aircraft.id, aircraftIds));
    }

    // Status is Active (we've already checked and auto-revoked dormant tokens above)
    const status = 'Active';

    // Duration label
    const durationLabel = token.expiresAt ? '24h' : 'Permanent';

    return NextResponse.json({
      nickname: token.nickname,
      aircraft: aircraftList.map(ac => ({
        id: ac.id,
        tail: ac.tail,
        hex: ac.icaoHex,
      })),
      duration: durationLabel,
      status,
      expiresAt: token.expiresAt,
    });
  } catch (error) {
    console.error('[v/validate] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
