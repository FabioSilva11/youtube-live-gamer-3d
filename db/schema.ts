import { sqliteTable, text, integer, primaryKey, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
export const profiles = sqliteTable('profiles', {
 userId: text('user_id').primaryKey(),
 displayName: text('display_name').notNull(),
 channelUrl: text('channel_url').notNull().default(''),
 liveSource: text('live_source').notNull().default(''),
 overlayToken: text('overlay_token').notNull(),
 orientation: text('orientation').notNull().default('landscape'),
 sceneComposition: text('scene_composition').notNull().default('{}'),
 biome: text('biome').notNull().default('fantasy'),
 quality: text('quality').notNull().default('normal'),
 entry: text('entry_animation').notNull().default('spotlight'),
 exit: text('exit_animation').notNull().default('walk'),
 chatActive: integer('chat_active').notNull().default(0),
 mpSecret: text('mp_secret'),
 mpAmount: text('mp_amount').notNull().default('5.00'),
 mpEmail: text('mp_email').notNull().default(''),
 mpActive: integer('mp_active').notNull().default(0),
 demo: text('demo').notNull().default('[]'),
 createdAt: integer('created_at').notNull(),
}, t => [uniqueIndex('idx_profiles_overlay_token').on(t.overlayToken)]);
export const runtimes = sqliteTable('runtimes', {
 userId: text('user_id').notNull(),
 kind: text('kind').notNull(),
 state: text('state').notNull().default('{}'),
 nextPoll: integer('next_poll').notNull().default(0),
 lockUntil: integer('lock_until').notNull().default(0),
 lease: text('lease').notNull().default(''),
}, t => [primaryKey({columns:[t.userId,t.kind]})]);
export const events = sqliteTable('events', {
 id: text('id').primaryKey(), userId: text('user_id').notNull(),
 payload: text('payload').notNull(), createdAt: integer('created_at').notNull(),
},t=>[index('idx_events_user_created').on(t.userId,t.createdAt)]);
export const accounts = sqliteTable('accounts', {
 id:text('id').primaryKey(), email:text('email').notNull(), name:text('name').notNull(),
 passwordHash:text('password_hash').notNull(), createdAt:integer('created_at').notNull(),
},t=>[uniqueIndex('idx_accounts_email').on(t.email)]);
export const sessions = sqliteTable('sessions', {
 tokenHash:text('token_hash').primaryKey(), accountId:text('account_id').notNull(), expiresAt:integer('expires_at').notNull(),
});
export const loginLimits = sqliteTable('login_limits', {
 key:text('key').primaryKey(), attempts:integer('attempts').notNull().default(0), resetAt:integer('reset_at').notNull(),
});
export const liveConfigs = sqliteTable('live_configs', {
 id:text('id').primaryKey(),userId:text('user_id').notNull(),title:text('title').notNull(),
 config:text('config').notNull(),createdAt:integer('created_at').notNull(),
},t=>[index('idx_live_configs_user_created').on(t.userId,t.createdAt)]);
