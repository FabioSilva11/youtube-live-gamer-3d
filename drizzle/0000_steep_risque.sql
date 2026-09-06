CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`channel_url` text DEFAULT '' NOT NULL,
	`live_source` text DEFAULT '' NOT NULL,
	`overlay_token` text NOT NULL,
	`quality` text DEFAULT 'normal' NOT NULL,
	`entry_animation` text DEFAULT 'spotlight' NOT NULL,
	`exit_animation` text DEFAULT 'walk' NOT NULL,
	`chat_active` integer DEFAULT 0 NOT NULL,
	`mp_secret` text,
	`mp_amount` text DEFAULT '5.00' NOT NULL,
	`mp_email` text DEFAULT '' NOT NULL,
	`mp_active` integer DEFAULT 0 NOT NULL,
	`demo` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_profiles_overlay_token` ON `profiles` (`overlay_token`);--> statement-breakpoint
CREATE TABLE `runtimes` (
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`state` text DEFAULT '{}' NOT NULL,
	`next_poll` integer DEFAULT 0 NOT NULL,
	`lock_until` integer DEFAULT 0 NOT NULL,
	`lease` text DEFAULT '' NOT NULL,
	PRIMARY KEY(`user_id`, `kind`)
);
