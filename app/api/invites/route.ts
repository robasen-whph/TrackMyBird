import { NextResponse } from 'next/server';
import { db } from '@/db';
import { guestTokens, aircraft } from '@/db/schema';
import { requireAuth } from '@/lib/session';
import { generateToken, hashToken } from '@/lib/auth';
import { appConfig } from '@/config/app';
import { eq, and, inArray } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const { aircraft_ids, nickname, duration } = body;

    // Validate input
    if (!aircraft_ids || !Array.isArray(aircraft_ids) || aircraft_ids.length === 0) {
      return NextResponse.json(
        { error: 'At least one aircraft ID is required' },
        { status: 400 }
      );
    }

    // Verify all aircraft belong to the user
    const userAircraft = await db
      .select()
      .from(aircraft)
      .where(
        and(
          eq(aircraft.ownerUserId, session.user.id),
          inArray(aircraft.id, aircraft_ids)
        )
      );

    if (userAircraft.length !== aircraft_ids.length) {
      return NextResponse.json(
        { error: 'One or more aircraft not found or not owned by user' },
        { status: 404 }
      );
    }

    // Generate token and hash
    const token = generateToken();
    const tokenHash = hashToken(token);

    // Calculate expiry (24h or permanent)
    let expiresAt: Date | null = null;
    if (duration === '24h') {
      expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    // Create guest token record
    const [guestToken] = await db
      .insert(guestTokens)
      .values({
        tokenHash,
        issuedByUserId: session.user.id,
        aircraftIds: aircraft_ids,
        nickname: nickname || null,
        expiresAt,
        revoked: false,
        lastViewAt: null,
      })
      .returning();

    // Construct invite URL using request headers for proxy-aware URL
    const host = request.headers.get('host') || new URL(request.url).host;
    const proto = request.headers.get('x-forwarded-proto') || 'http';
    const inviteUrl = `${proto}://${host}/v/${token}`;

    return NextResponse.json({
      ok: true,
      invite_url: inviteUrl,
      token_id: guestToken.id,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('[invites] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const session = await requireAuth();

    // Get all tokens for this user
    const tokens = await db
      .select()
      .from(guestTokens)
      .where(eq(guestTokens.issuedByUserId, session.user.id))
      .orderBy(guestTokens.createdAt);

    // Compute status for each token (no DB mutation)
    const now = new Date();
    const sixMonthsAgo = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000);

    const tokensWithStatus = tokens.map((token) => {
      let status = 'Active';
      
      // Check if revoked
      if (token.revoked) {
        status = 'Revoked';
      }
      // Check if expired
      else if (token.expiresAt && token.expiresAt < now) {
        status = 'Expired';
      }
      // Check if dormant (>6 months since last view, or never viewed and >6 months old)
      else if (
        (token.lastViewAt && token.lastViewAt < sixMonthsAgo) ||
        (!token.lastViewAt && token.createdAt < sixMonthsAgo)
      ) {
        status = 'Dormant';
      }

      // Duration label
      const durationLabel = token.expiresAt ? '24h' : 'Permanent';

      return {
        id: token.id,
        nickname: token.nickname,
        aircraft_ids: token.aircraftIds,
        aircraft_count: Array.isArray(token.aircraftIds) ? token.aircraftIds.length : 0,
        duration: durationLabel,
        status,
        last_view_at: token.lastViewAt,
        created_at: token.createdAt,
      };
    });

    return NextResponse.json({
      ok: true,
      tokens: tokensWithStatus,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('[invites] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
