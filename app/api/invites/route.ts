import { NextResponse } from 'next/server';
import { db } from '@/db';
import { guestTokens, aircraft } from '@/db/schema';
import { requireAuth } from '@/lib/session';
import { generateToken, hashToken } from '@/lib/auth';
import { appConfig } from '@/config/app';
import { eq, and, inArray } from 'drizzle-orm';

export const runtime = 'edge';

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

    // Auto-revoke dormant tokens (>6 months inactivity)
    const now = new Date();
    const sixMonthsAgo = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000);

    const dormantTokenIds = tokens
      .filter(token => {
        if (token.revoked) return false;
        if (token.expiresAt && token.expiresAt < now) return false;
        
        return (
          (token.lastViewAt && token.lastViewAt < sixMonthsAgo) ||
          (!token.lastViewAt && token.createdAt < sixMonthsAgo)
        );
      })
      .map(token => token.id);

    if (dormantTokenIds.length > 0) {
      await db
        .update(guestTokens)
        .set({ revoked: true })
        .where(inArray(guestTokens.id, dormantTokenIds));
    }

    // Reload tokens after auto-revoke
    const updatedTokens = await db
      .select()
      .from(guestTokens)
      .where(eq(guestTokens.issuedByUserId, session.user.id))
      .orderBy(guestTokens.createdAt);

    // Fetch all aircraft for this user (for mapping IDs to details)
    const allUserAircraft = await db
      .select()
      .from(aircraft)
      .where(eq(aircraft.ownerUserId, session.user.id));
    
    const aircraftMap = new Map(
      allUserAircraft.map(ac => [ac.id, { id: ac.id, tail: ac.tail, icao_hex: ac.icaoHex }])
    );

    // Compute status for each token
    const tokensWithStatus = updatedTokens.map((token) => {
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

      // Map aircraft IDs to aircraft details
      const aircraftIds = Array.isArray(token.aircraftIds) ? token.aircraftIds : [];
      const aircraftDetails = aircraftIds
        .map(id => aircraftMap.get(id))
        .filter(Boolean) as { id: number; tail: string; icao_hex: string }[];

      return {
        id: token.id,
        nickname: token.nickname,
        aircraft_ids: token.aircraftIds,
        aircraft: aircraftDetails,
        aircraft_count: aircraftDetails.length,
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
