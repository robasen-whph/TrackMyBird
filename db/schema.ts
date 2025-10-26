import { pgTable, serial, text, varchar, timestamp, boolean, integer, pgEnum, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enum for user roles
export const userRoleEnum = pgEnum('user_role', ['owner', 'guest']);

// Users table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').default('owner').notNull(),
  emailVerifiedAt: timestamp('email_verified_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Sessions table
export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Email verifications table
export const emailVerifications = pgTable('email_verifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  used: boolean('used').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Aircraft table
export const aircraft = pgTable('aircraft', {
  id: serial('id').primaryKey(),
  ownerUserId: integer('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tail: varchar('tail', { length: 20 }).notNull(),
  icaoHex: varchar('icao_hex', { length: 6 }).notNull(),
  authorizedAt: timestamp('authorized_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Guest tokens table
export const guestTokens = pgTable('guest_tokens', {
  id: serial('id').primaryKey(),
  tokenHash: text('token_hash').notNull().unique(),
  issuedByUserId: integer('issued_by_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  aircraftIds: jsonb('aircraft_ids').notNull(),
  nickname: text('nickname'),
  expiresAt: timestamp('expires_at'),
  revoked: boolean('revoked').default(false).notNull(),
  lastViewAt: timestamp('last_view_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  emailVerifications: many(emailVerifications),
  aircraft: many(aircraft),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const emailVerificationsRelations = relations(emailVerifications, ({ one }) => ({
  user: one(users, {
    fields: [emailVerifications.userId],
    references: [users.id],
  }),
}));

export const aircraftRelations = relations(aircraft, ({ one }) => ({
  owner: one(users, {
    fields: [aircraft.ownerUserId],
    references: [users.id],
  }),
}));

export const guestTokensRelations = relations(guestTokens, ({ one }) => ({
  issuedBy: one(users, {
    fields: [guestTokens.issuedByUserId],
    references: [users.id],
  }),
}));

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

export type EmailVerification = typeof emailVerifications.$inferSelect;
export type InsertEmailVerification = typeof emailVerifications.$inferInsert;

export type Aircraft = typeof aircraft.$inferSelect;
export type InsertAircraft = typeof aircraft.$inferInsert;

export type GuestToken = typeof guestTokens.$inferSelect;
export type InsertGuestToken = typeof guestTokens.$inferInsert;
