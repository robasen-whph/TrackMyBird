import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/session';

export const runtime = 'edge';

export async function POST() {
  try {
    await destroySession();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[logout] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
