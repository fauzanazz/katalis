CREATE TABLE `gallery_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`child_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `gallery_likes` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`child_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gallery_likes_entry_child_idx` ON `gallery_likes` (`entry_id`,`child_id`);--> statement-breakpoint
DROP INDEX `gallery_entries_quest_id_unique`;--> statement-breakpoint
ALTER TABLE `gallery_entries` ADD `mission_id` text;--> statement-breakpoint
ALTER TABLE `gallery_entries` ADD `caption` text;--> statement-breakpoint
CREATE UNIQUE INDEX `gallery_entries_mission_id_unique` ON `gallery_entries` (`mission_id`);