import { pgTable, uuid, varchar, text, doublePrecision, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ROOMS Table
export const rooms = pgTable('rooms', {
  id: uuid('id').defaultRandom().primaryKey(),
  roomCode: varchar('room_code', { length: 16 }).notNull().unique(),
  hostUserId: uuid('host_user_id').notNull(),
  currentVideoId: text('current_video_id'),
  currentPlaybackState: text('current_playback_state').notNull().default('paused'), // 'playing' | 'paused'
  currentPlaybackTime: doublePrecision('current_playback_time').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// PARTICIPANTS Table
export const participants = pgTable('participants', {
  id: uuid('id').defaultRandom().primaryKey(),
  roomId: uuid('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  username: varchar('username', { length: 50 }).notNull(),
  role: text('role').notNull().default('PARTICIPANT'), // 'HOST' | 'MODERATOR' | 'PARTICIPANT'
  socketId: text('socket_id'),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
});

// Drizzle Relations
export const roomsRelations = relations(rooms, ({ many }) => ({
  participants: many(participants),
}));

export const participantsRelations = relations(participants, ({ one }) => ({
  room: one(rooms, {
    fields: [participants.roomId],
    references: [rooms.id],
  }),
}));

export type RoomDbSelect = typeof rooms.$inferSelect;
export type RoomDbInsert = typeof rooms.$inferInsert;
export type ParticipantDbSelect = typeof participants.$inferSelect;
export type ParticipantDbInsert = typeof participants.$inferInsert;
