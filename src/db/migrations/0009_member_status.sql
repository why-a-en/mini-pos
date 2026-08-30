CREATE TYPE "public"."member_status" AS ENUM('active', 'suspended');--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "status" "member_status" DEFAULT 'active' NOT NULL;