CREATE TABLE `access_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `access_codes_code_unique` ON `access_codes` (`code`);--> statement-breakpoint
CREATE TABLE `adjustment_events` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`mission_id` text NOT NULL,
	`original_instructions` text NOT NULL,
	`simplified_instructions` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `adjustment_events_mission_idx` ON `adjustment_events` (`mission_id`);--> statement-breakpoint
CREATE TABLE `badges` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`category` text NOT NULL,
	`tier` text DEFAULT 'bronze' NOT NULL,
	`icon` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `badges_slug_unique` ON `badges` (`slug`);--> statement-breakpoint
CREATE INDEX `badges_category_idx` ON `badges` (`category`);--> statement-breakpoint
CREATE TABLE `child_badges` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`badge_slug` text NOT NULL,
	`quest_id` text,
	`trigger` text NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `child_badges_child_slug_idx` ON `child_badges` (`child_id`,`badge_slug`);--> statement-breakpoint
CREATE INDEX `child_badges_child_idx` ON `child_badges` (`child_id`);--> statement-breakpoint
CREATE INDEX `child_badges_slug_idx` ON `child_badges` (`badge_slug`);--> statement-breakpoint
CREATE TABLE `child_gardner_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`intelligence` text NOT NULL,
	`score` real DEFAULT 0 NOT NULL,
	`session_count` integer DEFAULT 0 NOT NULL,
	`last_computed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `child_gardner_profiles_unique_idx` ON `child_gardner_profiles` (`child_id`,`intelligence`);--> statement-breakpoint
CREATE INDEX `child_gardner_profiles_child_idx` ON `child_gardner_profiles` (`child_id`);--> statement-breakpoint
CREATE TABLE `child_interest_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`taxonomy_version` text DEFAULT 'v1' NOT NULL,
	`interest_key` text NOT NULL,
	`score` real DEFAULT 0 NOT NULL,
	`confidence` real DEFAULT 0 NOT NULL,
	`signal_count` integer DEFAULT 0 NOT NULL,
	`distinct_days` integer DEFAULT 0 NOT NULL,
	`first_signal_at` integer,
	`last_signal_at` integer,
	`trend` text DEFAULT 'stable' NOT NULL,
	`stability` text DEFAULT 'fleeting' NOT NULL,
	`summary` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `child_interest_profiles_unique_idx` ON `child_interest_profiles` (`child_id`,`taxonomy_version`,`interest_key`);--> statement-breakpoint
CREATE INDEX `child_interest_profiles_score_idx` ON `child_interest_profiles` (`child_id`,`score`);--> statement-breakpoint
CREATE TABLE `child_zpd_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`score` real NOT NULL,
	`band` text NOT NULL,
	`mission_id` text,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `child_zpd_snapshots_child_created_idx` ON `child_zpd_snapshots` (`child_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `child_zpd_snapshots_mission_idx` ON `child_zpd_snapshots` (`mission_id`);--> statement-breakpoint
CREATE TABLE `child_zpd_states` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`score` real DEFAULT 0.3 NOT NULL,
	`band` text DEFAULT 'developing' NOT NULL,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `child_zpd_states_child_id_unique` ON `child_zpd_states` (`child_id`);--> statement-breakpoint
CREATE INDEX `child_zpd_states_child_idx` ON `child_zpd_states` (`child_id`);--> statement-breakpoint
CREATE TABLE `children` (
	`id` text PRIMARY KEY NOT NULL,
	`access_code_id` text,
	`name` text,
	`locale` text DEFAULT 'id' NOT NULL,
	`date_of_birth` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `discoveries` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`type` text NOT NULL,
	`file_url` text,
	`ai_analysis` text,
	`detected_talents` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `discovery_ratings` (
	`id` text PRIMARY KEY NOT NULL,
	`discovery_id` text NOT NULL,
	`rater_user_id` text NOT NULL,
	`human_interest_keys` text NOT NULL,
	`human_tag_categories` text NOT NULL,
	`ai_interest_keys_at_rate` text NOT NULL,
	`ai_tag_categories_at_rate` text NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discovery_ratings_discovery_rater_idx` ON `discovery_ratings` (`discovery_id`,`rater_user_id`);--> statement-breakpoint
CREATE INDEX `discovery_ratings_created_idx` ON `discovery_ratings` (`created_at`);--> statement-breakpoint
CREATE TABLE `gallery_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`quest_id` text NOT NULL,
	`image_url` text NOT NULL,
	`talent_category` text NOT NULL,
	`country` text,
	`coordinates` text,
	`quest_context` text,
	`cluster_group` text,
	`talent_tags` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gallery_entries_quest_id_unique` ON `gallery_entries` (`quest_id`);--> statement-breakpoint
CREATE TABLE `interest_audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text,
	`actor_user_id` text,
	`event_type` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`before_json` text,
	`after_json` text,
	`metadata_json` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `interest_audit_events_child_idx` ON `interest_audit_events` (`child_id`);--> statement-breakpoint
CREATE INDEX `interest_audit_events_event_type_idx` ON `interest_audit_events` (`event_type`);--> statement-breakpoint
CREATE INDEX `interest_audit_events_created_at_idx` ON `interest_audit_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `interest_signals` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`taxonomy_version` text DEFAULT 'v1' NOT NULL,
	`interest_key` text NOT NULL,
	`source` text NOT NULL,
	`dimension` text NOT NULL,
	`strength` real NOT NULL,
	`confidence` real DEFAULT 1 NOT NULL,
	`discovery_id` text,
	`quest_id` text,
	`mission_id` text,
	`reflection_entry_id` text,
	`gallery_entry_id` text,
	`metadata_json` text,
	`observed_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `interest_signals_child_key_idx` ON `interest_signals` (`child_id`,`interest_key`);--> statement-breakpoint
CREATE INDEX `interest_signals_child_observed_idx` ON `interest_signals` (`child_id`,`observed_at`);--> statement-breakpoint
CREATE INDEX `interest_signals_source_idx` ON `interest_signals` (`source`);--> statement-breakpoint
CREATE TABLE `mentor_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`meta` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `mentor_messages_session_created_idx` ON `mentor_messages` (`session_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `mentor_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`mission_id` text NOT NULL,
	`child_id` text NOT NULL,
	`quest_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`adjustment_count` integer DEFAULT 0 NOT NULL,
	`checkin_pending` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mentor_sessions_mission_id_unique` ON `mentor_sessions` (`mission_id`);--> statement-breakpoint
CREATE INDEX `mentor_sessions_child_idx` ON `mentor_sessions` (`child_id`);--> statement-breakpoint
CREATE INDEX `mentor_sessions_quest_idx` ON `mentor_sessions` (`quest_id`);--> statement-breakpoint
CREATE TABLE `mission_interest_assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`mission_id` text NOT NULL,
	`taxonomy_version` text DEFAULT 'v1' NOT NULL,
	`interest_key` text NOT NULL,
	`explicit_rating` integer,
	`parent_rating` integer,
	`child_rating` integer,
	`observed_engagement` integer,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mission_interest_assessments_unique_idx` ON `mission_interest_assessments` (`child_id`,`mission_id`,`interest_key`);--> statement-breakpoint
CREATE INDEX `mission_interest_assessments_child_mission_idx` ON `mission_interest_assessments` (`child_id`,`mission_id`);--> statement-breakpoint
CREATE TABLE `missions` (
	`id` text PRIMARY KEY NOT NULL,
	`quest_id` text NOT NULL,
	`day` integer NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`instructions` text NOT NULL,
	`materials` text NOT NULL,
	`tips` text NOT NULL,
	`status` text DEFAULT 'locked' NOT NULL,
	`proof_photo_url` text,
	`phase` text,
	`intensity_hint` real,
	`intent` text,
	`estimated_minutes` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `missions_quest_day_idx` ON `missions` (`quest_id`,`day`);--> statement-breakpoint
CREATE TABLE `moderation_events` (
	`id` text PRIMARY KEY NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text,
	`content_type` text NOT NULL,
	`content_hash` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`category` text,
	`severity` text,
	`confidence` real,
	`ai_reasoning` text,
	`child_id` text,
	`reviewer_id` text,
	`reviewed_at` integer,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `moderation_events_source_status_idx` ON `moderation_events` (`source_type`,`status`);--> statement-breakpoint
CREATE INDEX `moderation_events_status_created_idx` ON `moderation_events` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `moderation_events_child_idx` ON `moderation_events` (`child_id`);--> statement-breakpoint
CREATE TABLE `parent_children` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`child_id` text NOT NULL,
	`claimed_at` integer NOT NULL,
	`consent_given_at` integer NOT NULL,
	`consent_text_version` text DEFAULT 'v1' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `parent_children_user_child_idx` ON `parent_children` (`user_id`,`child_id`);--> statement-breakpoint
CREATE INDEX `parent_children_user_idx` ON `parent_children` (`user_id`);--> statement-breakpoint
CREATE INDEX `parent_children_child_idx` ON `parent_children` (`child_id`);--> statement-breakpoint
CREATE TABLE `parent_quest_follows` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text NOT NULL,
	`child_id` text NOT NULL,
	`quest_id` text NOT NULL,
	`current_day` integer DEFAULT 1 NOT NULL,
	`last_viewed_at` integer NOT NULL,
	`notifications` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `parent_quest_follows_parent_quest_idx` ON `parent_quest_follows` (`parent_id`,`quest_id`);--> statement-breakpoint
CREATE INDEX `parent_quest_follows_parent_idx` ON `parent_quest_follows` (`parent_id`);--> statement-breakpoint
CREATE INDEX `parent_quest_follows_quest_idx` ON `parent_quest_follows` (`quest_id`);--> statement-breakpoint
CREATE TABLE `parent_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text NOT NULL,
	`child_id` text NOT NULL,
	`type` text NOT NULL,
	`period` text NOT NULL,
	`strengths` text NOT NULL,
	`growth_areas` text NOT NULL,
	`tips` text NOT NULL,
	`summary` text NOT NULL,
	`badge_highlights` text NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `parent_reports_parent_idx` ON `parent_reports` (`parent_id`);--> statement-breakpoint
CREATE INDEX `parent_reports_child_idx` ON `parent_reports` (`child_id`);--> statement-breakpoint
CREATE INDEX `parent_reports_created_idx` ON `parent_reports` (`created_at`);--> statement-breakpoint
CREATE TABLE `quests` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`discovery_id` text,
	`dream` text NOT NULL,
	`local_context` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`generated_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`endpoint` text DEFAULT 'default' NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`reset_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rate_limits_identifier_endpoint_idx` ON `rate_limits` (`identifier`,`endpoint`);--> statement-breakpoint
CREATE INDEX `rate_limits_reset_at_idx` ON `rate_limits` (`reset_at`);--> statement-breakpoint
CREATE TABLE `reflection_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`quest_id` text NOT NULL,
	`mission_day` integer NOT NULL,
	`type` text NOT NULL,
	`content` text NOT NULL,
	`file_url` text,
	`file_expires_at` integer,
	`ai_summary` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reflection_entries_child_idx` ON `reflection_entries` (`child_id`);--> statement-breakpoint
CREATE INDEX `reflection_entries_quest_idx` ON `reflection_entries` (`quest_id`);--> statement-breakpoint
CREATE INDEX `reflection_entries_file_expires_idx` ON `reflection_entries` (`file_expires_at`);--> statement-breakpoint
CREATE TABLE `reliability_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`layer` text NOT NULL,
	`kappa` real NOT NULL,
	`sample_size` integer NOT NULL,
	`snapshot_id` text NOT NULL,
	`acknowledged_at` integer,
	`acknowledged_by` text
);
--> statement-breakpoint
CREATE INDEX `reliability_alerts_layer_created_idx` ON `reliability_alerts` (`layer`,`created_at`);--> statement-breakpoint
CREATE INDEX `reliability_alerts_acknowledged_idx` ON `reliability_alerts` (`acknowledged_at`);--> statement-breakpoint
CREATE TABLE `reliability_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`computed_at` integer NOT NULL,
	`layer` text NOT NULL,
	`kappa` real NOT NULL,
	`sample_size` integer NOT NULL,
	`payload_json` text NOT NULL,
	`triggered_by` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reliability_snapshots_layer_computed_idx` ON `reliability_snapshots` (`layer`,`computed_at`);--> statement-breakpoint
CREATE TABLE `squad_members` (
	`id` text PRIMARY KEY NOT NULL,
	`squad_id` text NOT NULL,
	`child_id` text NOT NULL,
	`joined_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `squad_members_squad_child_idx` ON `squad_members` (`squad_id`,`child_id`);--> statement-breakpoint
CREATE INDEX `squad_members_child_idx` ON `squad_members` (`child_id`);--> statement-breakpoint
CREATE TABLE `squads` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`theme` text NOT NULL,
	`description` text NOT NULL,
	`icon` text DEFAULT '🌟' NOT NULL,
	`countries` text DEFAULT '[]' NOT NULL,
	`featured_entry_ids` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `squads_theme_idx` ON `squads` (`theme`);--> statement-breakpoint
CREATE INDEX `squads_status_idx` ON `squads` (`status`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);