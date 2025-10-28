import { NextResponse } from 'next/server';
import { db } from '@/db';
import { aircraft, guestTokens } from '@/db/schema';
import { requireVerified } from '@/lib/session';
import { eq, and, sql } from 'drizzle-orm';

export const runtime = 'edge';

// DELETE /api/aircraft/[id] - Delete aircraft
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Require verified owner
    const session = await requireVerified();

    const { id } = await context.params;
    const aircraftId = parseInt(id, 10);

    if (isNaN(aircraftId)) {
      return NextResponse.json(
        { error: 'Invalid aircraft ID' },
        { status: 400 }
      );
    }

    // Find aircraft
    const [aircraftRecord] = await db
      .select()
      .from(aircraft)
      .where(eq(aircraft.id, aircraftId))
      .limit(1);

    if (!aircraftRecord) {
      return NextResponse.json(
        { error: 'Aircraft not found' },
        { status: 404 }
      );
    }

    // Check ownership
    if (aircraftRecord.ownerUserId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Handle guest tokens that reference this aircraft
    // 1. Find all tokens containing this aircraft
    const affectedTokens = await db
      .select()
      .from(guestTokens)
      .where(
        and(
          eq(guestTokens.issuedByUserId, session.user.id),
          sql`${guestTokens.aircraftIds}::jsonb @> ${JSON.stringify([aircraftId])}::jsonb`
        )
      );

    // 2. Process each token
    for (const token of affectedTokens) {
      const aircraftIds = token.aircraftIds as number[];
      
      if (aircraftIds.length === 1) {
        // Single-aircraft token: revoke it
        await db
          .update(guestTokens)
          .set({ revoked: true })
          .where(eq(guestTokens.id, token.id));
      } else {
        // Multi-aircraft token: remove only this aircraft ID
        const updatedIds = aircraftIds.filter(id => id !== aircraftId);
        await db
          .update(guestTokens)
          .set({ aircraftIds: updatedIds })
          .where(eq(guestTokens.id, token.id));
      }
    }

    // Delete aircraft
    await db
      .delete(aircraft)
      .where(
        and(
          eq(aircraft.id, aircraftId),
          eq(aircraft.ownerUserId, session.user.id)
        )
      );

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
      if (error.message === 'Email not verified') {
        return NextResponse.json(
          { error: 'Email not verified' },
          { status: 403 }
        );
      }
    }

    console.error('[aircraft DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
