import { requireUser } from "@/lib/auth";
import { withVendorScope, type Db } from "@/db/client";

type VendorContext = { vendorId: string; userId: string; tx: Db };

/**
 * Resolves the current session to its vendor and runs `fn` with a
 * vendor-scoped db handle (see docs/DATA_MODEL.md §5). This is the one
 * function feature code should call to touch products/orders — it's what
 * makes "every tenant-scoped query is scoped" a habit instead of something
 * to remember per query.
 *
 * Redirects to /login if there's no session (via requireUser()).
 */
export async function withCurrentVendor<T>(fn: (ctx: VendorContext) => Promise<T>): Promise<T> {
  const user = await requireUser();
  return withVendorScope(user.vendorId, (tx) => fn({ vendorId: user.vendorId, userId: user.id, tx }));
}
