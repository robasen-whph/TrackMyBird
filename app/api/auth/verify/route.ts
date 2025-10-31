export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, emailVerifications } from '@/db/schema';
import { hashToken } from '@/lib/auth';
import { createSession } from '@/lib/session';
import { eq, and, gt } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Verification token required' },
        { status: 400 }
      );
    }

    const tokenHash = hashToken(token);

    // Find verification record
    const [verification] = await db
      .select({
        verification: emailVerifications,
        user: users,
      })
      .from(emailVerifications)
      .innerJoin(users, eq(emailVerifications.userId, users.id))
      .where(
        and(
          eq(emailVerifications.tokenHash, tokenHash),
          eq(emailVerifications.used, false),
          gt(emailVerifications.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!verification) {
      return NextResponse.json(
        { error: 'token_expired', message: 'Invalid or expired verification token' },
        { status: 400 }
      );
    }

    // Mark email as verified
    await db
      .update(users)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(users.id, verification.user.id));

    // Mark token as used
    await db
      .update(emailVerifications)
      .set({ used: true })
      .where(eq(emailVerifications.id, verification.verification.id));

    // Create session and log user in
    await createSession(verification.user.id, false);

    // Redirect to dashboard (use actual host from headers for proxy environments)
    const host = request.headers.get('host') || new URL(request.url).host;
    const proto = request.headers.get('x-forwarded-proto') || 'http';
    const dashboardUrl = `${proto}://${host}/dashboard`;
    console.log('[verify] Redirecting to:', dashboardUrl);
    return NextResponse.redirect(dashboardUrl);
  } catch (error) {
    console.error('[verify] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
