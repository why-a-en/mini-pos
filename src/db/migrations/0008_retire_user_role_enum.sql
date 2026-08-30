-- Rename the functional role: customer_service -> support_agent.
-- The stored value, the UI label and CONTEXT.md's canonical term had drifted
-- to three different names; this settles them on one.
UPDATE "members" SET "role" = 'support_agent' WHERE "role" = 'customer_service';--> statement-breakpoint

-- The user_role enum has been orphaned since members.role became text (it
-- has to be, because better-auth writes comma-separated values for a
-- multi-role member). `AppRole` in src/lib/auth is the real union now, so
-- the type has nothing left to guard.
DROP TYPE "public"."user_role";
