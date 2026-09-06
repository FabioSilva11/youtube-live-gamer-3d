CREATE TABLE `live_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`config` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_live_configs_user_created` ON `live_configs` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_events_user_created` ON `events` (`user_id`,`created_at`);