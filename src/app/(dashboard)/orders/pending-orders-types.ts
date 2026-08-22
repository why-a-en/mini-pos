// Shared shape for the /prototype variants of the Supplier's pending-orders
// view. PROTOTYPE ONLY — throwaway alongside the variant components.
export type PendingOrderRow = {
  id: string;
  productId: string;
  productName: string;
  sourceUrl: string | null;
  customerName: string;
  customerContact: string | null;
  selectedModifiers: Record<string, string>;
  quantity: number;
  notes: string | null;
  createdAt: Date;
};

export function formatModifiers(modifiers: Record<string, string>): string | null {
  const entries = Object.entries(modifiers);
  if (entries.length === 0) return null;
  return entries.map(([k, v]) => `${k}: ${v}`).join(", ");
}

export function relativeAge(date: Date): string {
  const ms = Date.now() - date.getTime();
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/** Groups rows by productId, preserving each group's first-seen order. */
export function groupByProduct(rows: PendingOrderRow[]): {
  productId: string;
  productName: string;
  sourceUrl: string | null;
  orders: PendingOrderRow[];
  totalQuantity: number;
}[] {
  const order: string[] = [];
  const groups = new Map<string, PendingOrderRow[]>();
  for (const row of rows) {
    if (!groups.has(row.productId)) {
      groups.set(row.productId, []);
      order.push(row.productId);
    }
    groups.get(row.productId)!.push(row);
  }
  return order.map((productId) => {
    const groupOrders = groups.get(productId)!;
    return {
      productId,
      productName: groupOrders[0].productName,
      sourceUrl: groupOrders[0].sourceUrl,
      orders: groupOrders,
      totalQuantity: groupOrders.reduce((sum, o) => sum + o.quantity, 0),
    };
  });
}
