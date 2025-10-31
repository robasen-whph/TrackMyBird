export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, emailVerifications } from '@/db/schema';
import { generateToken, hashToken } from '@/lib/auth';
import { sendVerificationEmail } from '@/lib/email';
import { requireAuth } from '@/lib/session';
import { eq } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    // Get current user
    const session = await requireAuth();

    // Check if already verified
    if (session.user.emailVerifiedAt) {
      return NextResponse.json(
        { error: 'Email already verified' },
        { status: 400 }
      );
    }

    // Generate new verification token
    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Mark old tokens as used
    await db
      .update(emailVerifications)
      .set({ used: true })
      .where(eq(emailVerifications.userId, session.user.id));

    // Create new verification record
    await db.insert(emailVerifications).values({
      userId: session.user.id,
      tokenHash,
      expiresAt,
      used: false,
    });

    // Send verification email with baseUrl from request
    const host = request.headers.get('host') || new URL(request.url).host;
    const proto = request.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = `${proto}://${host}`;
    await sendVerificationEmail(session.user.email, token, baseUrl);

    return NextResponse.json({
      ok: true,
      message: 'Verification email sent',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('[resend] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
