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

    // Update last_view_at
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

    // Compute status
    const sixMonthsAgo = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000);
    let status = 'Active';
    
    if (token.revoked) {
      status = 'Revoked';
    } else if (token.expiresAt && token.expiresAt < now) {
      status = 'Expired';
    } else if (
      (token.lastViewAt && token.lastViewAt < sixMonthsAgo) ||
      (!token.lastViewAt && token.createdAt < sixMonthsAgo)
    ) {
      status = 'Dormant';
    }

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
