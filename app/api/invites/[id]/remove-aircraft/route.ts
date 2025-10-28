import { NextResponse } from 'next/server';
import { db } from '@/db';
import { guestTokens } from '@/db/schema';
import { requireAuth } from '@/lib/session';
import { eq, and } from 'drizzle-orm';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const tokenId = parseInt(id);
    const body = await request.json();
    const { aircraft_id } = body;

    if (isNaN(tokenId)) {
      return NextResponse.json(
        { error: 'Invalid token ID' },
        { status: 400 }
      );
    }

    if (!aircraft_id || typeof aircraft_id !== 'number') {
      return NextResponse.json(
        { error: 'Valid aircraft_id is required' },
        { status: 400 }
      );
    }

    const [token] = await db
      .select()
      .from(guestTokens)
      .where(
        and(
          eq(guestTokens.id, tokenId),
          eq(guestTokens.issuedByUserId, session.user.id)
        )
      )
      .limit(1);

    if (!token) {
      return NextResponse.json(
        { error: 'Token not found or not owned by user' },
        { status: 404 }
      );
    }

    const aircraftIds = Array.isArray(token.aircraftIds) ? token.aircraftIds : [];
    
    if (!aircraftIds.includes(aircraft_id)) {
      return NextResponse.json(
        { error: 'Aircraft not associated with this token' },
        { status: 400 }
      );
    }

    if (aircraftIds.length === 1) {
      return NextResponse.json(
        { error: 'Cannot remove the last aircraft. Use revoke instead.' },
        { status: 400 }
      );
    }

    const updatedIds = aircraftIds.filter(id => id !== aircraft_id);

    await db
      .update(guestTokens)
      .set({ aircraftIds: updatedIds })
      .where(eq(guestTokens.id, tokenId));

    return NextResponse.json({
      ok: true,
      message: 'Aircraft removed from token successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('[invites/remove-aircraft] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
