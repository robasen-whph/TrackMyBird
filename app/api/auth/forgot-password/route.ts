import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, passwordResets } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateToken, hashToken } from '@/lib/auth';
import { sendPasswordResetEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    // Type validation
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Find user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, trimmedEmail))
      .limit(1);

    // Always return success even if user not found (security best practice)
    if (!user) {
      return NextResponse.json({ ok: true });
    }

    // Invalidate any existing unused tokens for this user
    await db
      .update(passwordResets)
      .set({ used: true })
      .where(
        and(
          eq(passwordResets.userId, user.id),
          eq(passwordResets.used, false)
        )
      );

    // Generate reset token (256-bit)
    const token = generateToken();
    const tokenHash = await hashToken(token);

    // Create password reset record (expires in 1 hour)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await db.insert(passwordResets).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    // Get base URL from request
    const baseUrl = new URL(request.url).origin;

    // Send reset email
    await sendPasswordResetEmail(user.email, token, baseUrl);

    console.log('[forgot-password] Password reset email sent to:', user.email);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[forgot-password] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
