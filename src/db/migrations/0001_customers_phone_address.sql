-- Hand-written, not drizzle-kit generated: renaming a column needs an
-- interactive "was this a rename or a drop+add?" prompt that requires a
-- TTY, which isn't available in this environment. RENAME preserves the
-- existing test customer's phone value; a plain drop+add would have lost
-- it. The corresponding meta/0001_snapshot.json was hand-built to match
-- (see docs/DATA_MODEL.md — customers.contact -> customers.phone, plus
-- new customers.address).
ALTER TABLE "customers" RENAME COLUMN "contact" TO "phone";--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "phone" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "address" text;
