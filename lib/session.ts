import { cookies } from 'next/headers';
import { db } from '@/db';
import { sessions, users, type User } from '@/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { generateRandomToken, sha256 } from './crypto';

const SESSION_COOKIE_NAME = 'trackmybird_session';
const SESSION_TTL_24H = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_TTL_30D = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SessionData {
  sessionId: number;
  user: User;
}

/**
 * Create a new session for a user
 */
export async function createSession(userId: number, remember: boolean = false): Promise<string> {
  const ttl = remember ? SESSION_TTL_30D : SESSION_TTL_24H;
  const expiresAt = new Date(Date.now() + ttl);

  // Generate cryptographically secure session token
  const sessionToken = generateRandomToken();
  
  // Hash the token for storage
  const tokenHash = await sha256(sessionToken);

  const [session] = await db
    .insert(sessions)
    .values({
      userId,
      tokenHash,
      expiresAt,
    })
    .returning();
  
  // Set cookie with session ID and token
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, `${session.id}:${sessionToken}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });

  return sessionToken;
}

/**
 * Get the current session and user from cookie
 */
export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie) {
    return null;
  }

  // Parse session cookie (format: "sessionId:token")
  const parts = sessionCookie.value.split(':');
  if (parts.length !== 2) {
    return null;
  }

  const [sessionIdStr, sessionToken] = parts;
  const sessionId = parseInt(sessionIdStr, 10);

  if (!sessionId || isNaN(sessionId) || !sessionToken) {
    return null;
  }

  // Hash the token from cookie
  const tokenHash = await sha256(sessionToken);

  // Get session with user, validating both ID and token hash
  const [result] = await db
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.id, sessionId),
        eq(sessions.tokenHash, tokenHash),
        gt(sessions.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!result) {
    return null;
  }

  return {
    sessionId: result.session.id,
    user: result.user,
  };
}

/**
 * Require authentication - throws if not logged in
 */
export async function requireAuth(): Promise<SessionData> {
  const session = await getSession();
  
  if (!session) {
    throw new Error('Unauthorized');
  }

  return session;
}

/**
 * Require verified email - throws if not verified
 */
export async function requireVerified(): Promise<SessionData> {
  const session = await requireAuth();

  if (!session.user.emailVerifiedAt) {
    throw new Error('Email not verified');
  }

  return session;
}

/**
 * Destroy the current session
 */
export async function destroySession(): Promise<void> {
  const session = await getSession();

  if (session) {
    await db
      .delete(sessions)
      .where(eq(sessions.id, session.sessionId));
  }

  // Clear cookie
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
