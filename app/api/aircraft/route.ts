import { NextResponse } from 'next/server';
import { db } from '@/db';
import { aircraft } from '@/db/schema';
import { requireVerified } from '@/lib/session';
import { eq, and, desc } from 'drizzle-orm';
import { isValidNNumber, nNumberToIcao } from '@/lib/nnumber-converter';

// Validate ICAO hex code (6 hex characters, US range A00001-ADF7C7)
function isValidUSIcao(hex: string): boolean {
  if (!/^[A-Fa-f0-9]{6}$/.test(hex)) {
    return false;
  }
  
  // Check if it starts with 'A' (US range)
  return hex.toUpperCase().startsWith('A');
}

// POST /api/aircraft - Add aircraft
export async function POST(request: Request) {
  try {
    // Require verified owner
    const session = await requireVerified();

    const body = await request.json();
    const { tail, icao_hex } = body;

    // Validate inputs
    if (!tail || !icao_hex) {
      return NextResponse.json(
        { error: 'invalid_input', message: 'Tail number and ICAO hex are required' },
        { status: 400 }
      );
    }

    // Validate tail (US N-number format)
    const normalizedTail = tail.trim().toUpperCase();
    if (!isValidNNumber(normalizedTail)) {
      return NextResponse.json(
        { error: 'invalid_input', message: 'Invalid US N-number format' },
        { status: 400 }
      );
    }

    // Validate ICAO hex (6 hex characters, US range)
    const normalizedHex = icao_hex.trim().toUpperCase();
    if (!isValidUSIcao(normalizedHex)) {
      return NextResponse.json(
        { error: 'invalid_input', message: 'Invalid US ICAO hex code (must be 6 hex characters starting with A)' },
        { status: 400 }
      );
    }

    // Verify tail and hex match
    const expectedHex = nNumberToIcao(normalizedTail);
    if (expectedHex && expectedHex.toUpperCase() !== normalizedHex) {
      return NextResponse.json(
        { error: 'invalid_input', message: 'Tail number and ICAO hex do not match' },
        { status: 400 }
      );
    }

    // Check for duplicate (same owner, same tail)
    const [existing] = await db
      .select()
      .from(aircraft)
      .where(
        and(
          eq(aircraft.ownerUserId, session.user.id),
          eq(aircraft.tail, normalizedTail)
        )
      )
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: 'duplicate', message: 'Aircraft already added' },
        { status: 409 }
      );
    }

    // Create aircraft record
    const [newAircraft] = await db
      .insert(aircraft)
      .values({
        ownerUserId: session.user.id,
        tail: normalizedTail,
        icaoHex: normalizedHex,
        authorizedAt: new Date(),
      })
      .returning();

    return NextResponse.json({
      ok: true,
      aircraft: {
        id: newAircraft.id,
        tail: newAircraft.tail,
        icao_hex: newAircraft.icaoHex,
        authorized_at: newAircraft.authorizedAt,
        created_at: newAircraft.createdAt,
      },
    });
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

    console.error('[aircraft POST] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/aircraft - List owner's aircraft
export async function GET() {
  try {
    // Require verified owner
    const session = await requireVerified();

    // Get all aircraft for this owner, newest first
    const aircraftList = await db
      .select()
      .from(aircraft)
      .where(eq(aircraft.ownerUserId, session.user.id))
      .orderBy(desc(aircraft.createdAt));

    return NextResponse.json({
      ok: true,
      aircraft: aircraftList.map((a) => ({
        id: a.id,
        tail: a.tail,
        icao_hex: a.icaoHex,
        authorized_at: a.authorizedAt,
        created_at: a.createdAt,
      })),
    });
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

    console.error('[aircraft GET] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
