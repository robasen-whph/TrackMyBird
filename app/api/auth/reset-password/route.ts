import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, passwordResets } from '@/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { hashToken, hashPassword } from '@/lib/auth';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, password } = body;

    // Type validation
    if (!token || typeof token !== 'string' || !password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      );
    }

    const trimmedPassword = password.trim();

    if (trimmedPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Hash token to lookup
    const tokenHash = hashToken(token);

    // Find valid reset token
    const [resetRecord] = await db
      .select()
      .from(passwordResets)
      .where(
        and(
          eq(passwordResets.tokenHash, tokenHash),
          eq(passwordResets.used, false),
          gt(passwordResets.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!resetRecord) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Hash new password
    const passwordHash = await hashPassword(trimmedPassword);

    // Update user password
    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, resetRecord.userId));

    // Mark token as used
    await db
      .update(passwordResets)
      .set({ used: true })
      .where(eq(passwordResets.id, resetRecord.id));

    console.log('[reset-password] Password reset successful for user:', resetRecord.userId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[reset-password] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
