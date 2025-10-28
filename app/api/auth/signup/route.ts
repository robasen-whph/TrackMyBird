import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, emailVerifications } from '@/db/schema';
import { hashPassword, generateToken, hashToken, isValidEmail, isValidPassword } from '@/lib/auth';
import { sendVerificationEmail } from '@/lib/email';
import { eq } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    if (!isValidPassword(password)) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const [user] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        passwordHash,
        role: 'owner',
      })
      .returning();

    // Generate verification token
    const token = generateToken();
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create verification record
    await db.insert(emailVerifications).values({
      userId: user.id,
      tokenHash,
      expiresAt,
      used: false,
    });

    // Send verification email with baseUrl from request
    try {
      // Get actual host from headers (for proxy/load balancer environments)
      const host = request.headers.get('host') || new URL(request.url).host;
      const proto = request.headers.get('x-forwarded-proto') || 'http';
      const baseUrl = `${proto}://${host}`;
      await sendVerificationEmail(email, token, baseUrl);
    } catch (error) {
      console.error('[signup] Failed to send verification email:', error);
      // Continue even if email fails - user can request resend
    }

    return NextResponse.json({
      ok: true,
      message: 'Account created. Please check your email for verification link.',
      userId: user.id,
    });
  } catch (error) {
    console.error('[signup] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
