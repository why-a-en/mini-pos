"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Screen, ScrollBody, Foot, Toolbar } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchField } from "@/components/ui/search-field";
import { OptionChips } from "@/components/ui/option-chips";
import { QtyDial } from "@/components/ui/qty-dial";
import { CustomerRow } from "@/components/ui/customer-row";
import { ProductRow } from "@/components/ui/product-row";
import { OrderItemRow } from "@/components/ui/order-item-row";
import { SectionHeader } from "@/components/ui/section-header";
import { ErrorDialog } from "@/components/ui/error-dialog";
import { Icon } from "@/components/icon";
import { createProductInlineAction } from "@/app/(dashboard)/products/actions";
import { createCustomerAction, saveOrderAction } from "./actions";

export interface WizardCustomer {
  id: string;
  name: string;
  phone: string;
  address: string | null;
}

export interface WizardModifierGroup {
  id: string;
  name: string;
  options: { id: string; value: string }[];
}

export interface WizardProduct {
  id: string;
  name: string;
  price: string | null;
  sourceUrl: string | null;
  modifierGroups: WizardModifierGroup[];
}

/** A saved-but-not-placed Order — resuming it reopens the wizard straight
 *  at the Items step with its customer and whatever was already added. */
export interface DraftResume {
  orderId: string;
  customer: WizardCustomer;
  notes: string;
  existingItems: { productName: string; price: string | null; selection: string[]; quantity: number }[];
}

interface CartLine {
  key: string;
  productId: string;
  productName: string;
  selection: string[];
  modifierOptionIds: string[];
  quantity: number;
}

type Step = "customer" | "items" | "review";

function formatPrice(price: string | null): string | undefined {
  if (!price) return undefined;
  return `${Number(price).toLocaleString()} MMK`;
}

const STEPS = [
  { key: "customer", label: "Customer" },
  { key: "items", label: "Items" },
  { key: "review", label: "Review" },
] as const;

/** Persistent progress readout across all three steps — the eyebrow text
 *  alone ("Step 2 of 3") is easy to miss above a title that's changed to the
 *  customer's name by then. Making progress this visible is also what makes
 *  "Save as draft" legible as a concept: it's plainly a pause partway
 *  through a multi-step form, not a separate lesser kind of order. Stays put
 *  (doesn't add a fourth step) while configuring one product's modifiers —
 *  that's a sub-state of Items, not its own step. */
function StepIndicator({ step }: { step: Step }) {
  const activeIndex = STEPS.findIndex((s) => s.key === step);
  return (
    <Toolbar className="pt-[18px] pb-3">
      <div className="flex items-center">
        {STEPS.map((s, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          return (
            <div key={s.key} className={done || active ? "flex items-center" : "flex items-center"} style={{ flex: i < STEPS.length - 1 ? 1 : "0 0 auto" }}>
              <span
                className={
                  "flex size-[22px] shrink-0 items-center justify-center rounded-full font-mono text-[11px] " +
                  (done || active ? "border border-transparent bg-accent text-accent-ink" : "border border-line-strong text-text-faint")
                }
              >
                {done ? <Icon name="check" size={12} /> : i + 1}
              </span>
              <span className={"ml-1.5 whitespace-nowrap font-ui text-small-strong " + (active ? "text-text-strong" : "text-text-faint")}>{s.label}</span>
              {i < STEPS.length - 1 ? <span className={"mx-2.5 h-px flex-1 " + (done ? "bg-accent" : "bg-line-hairline")} /> : null}
            </div>
          );
        })}
      </div>
    </Toolbar>
  );
}

/** Order creation, as a real multi-step form — Customer, then Items, then
 *  Review — matching docs/PRD.md §7.1: search-or-create the Customer, then
 *  repeatably add products with their modifier selection and quantity,
 *  attach notes to the order as a whole, confirm, save. A dedicated route
 *  (`/orders/new`, this component's only mount point — see its page.tsx)
 *  rather than a Sheet dialog: a 3-step form with its own
 *  product-configuration sub-step is substantial enough to want the full
 *  screen and a real URL, not a modal stacked over the Orders list. Review
 *  is purely a client-side summary — nothing new to fetch or save, it just
 *  holds the actual commit actions ("Place order" / "Save as draft") behind
 *  one more confirmation once there's something to confirm. "Save draft"
 *  writes the order as-is (placed_at stays null) and returns to the list —
 *  it'll show up there to resume later (tap it — see orders-view.tsx linking
 *  to `/orders/new?draft=<id>`, which reopens this straight at the Items
 *  step via the `resume` prop, same as before Review existed). "Place order"
 *  is the same action with `place: true`, which also redirects to the order
 *  detail page. */
export function NewOrderWizard({
  customers,
  products,
  resume,
}: {
  customers: WizardCustomer[];
  products: WizardProduct[];
  resume?: DraftResume | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(resume ? "items" : "customer");
  const [customerQuery, setCustomerQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerAddress, setNewCustomerAddress] = useState("");
  const [customer, setCustomer] = useState<WizardCustomer | null>(resume?.customer ?? null);

  const [addingProduct, setAddingProduct] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductDescription, setNewProductDescription] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [newProductSourceUrl, setNewProductSourceUrl] = useState("");
  // Products created inline during this wizard run. The `products` prop is a
  // server snapshot taken when the route rendered; a product created here
  // has to join the list the Items step is filtering over without a
  // navigation, or the thing you just made isn't there to add.
  const [extraProducts, setExtraProducts] = useState<WizardProduct[]>([]);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [notes, setNotes] = useState(resume?.notes ?? "");
  const [picking, setPicking] = useState<WizardProduct | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const matches = customers.filter((c) => (c.name + c.phone).toLowerCase().includes(customerQuery.toLowerCase()));
  // Unfiltered (no query typed yet), the customer list can run to hundreds —
  // capped here rather than trimmed at the query, so search still reaches
  // everyone once you type a character. Keeps the empty-state list short
  // enough that "+ New customer" doesn't need scrolling to find in the first
  // place, on top of it now living in the pinned footer below regardless.
  const BROWSE_CAP = 8;
  const visibleMatches = customerQuery ? matches : matches.slice(0, BROWSE_CAP);
  const hiddenMatchCount = matches.length - visibleMatches.length;
  // Same shape as the customer search above: filter client-side over the
  // already-fetched catalog, cap the unfiltered browse view so a large
  // catalog doesn't turn "add a product" into a long scroll before search
  // was even tried.
  // A Server Action re-renders the current route as part of its response, so
  // `products` usually comes back already containing anything created here —
  // but not always (the action can resolve before that payload is applied),
  // and holding it locally is what makes the new product appear instantly.
  // Keeping both means deduping: without this the list rendered the same id
  // twice and React warned about duplicate keys.
  const allProducts = [...extraProducts.filter((e) => !products.some((p) => p.id === e.id)), ...products];
  const matchingProducts = allProducts.filter((p) => p.name.toLowerCase().includes(productQuery.toLowerCase()));
  const visibleProducts = productQuery ? matchingProducts : matchingProducts.slice(0, BROWSE_CAP);
  const hiddenProductCount = matchingProducts.length - visibleProducts.length;
  const existingItems = resume?.existingItems ?? [];
  const totalItemCount = existingItems.length + cart.length;
  // Cart lines only carry a productId, existing (resumed) lines carry their
  // own price straight from the DB — either way, a null price (product has
  // none set) can't be assumed to be 0, so it's tracked separately rather
  // than silently under-totaling.
  let priceTotal = 0;
  let hasUnpricedItem = false;
  for (const line of existingItems) {
    if (line.price == null) hasUnpricedItem = true;
    else priceTotal += Number(line.price) * line.quantity;
  }
  for (const line of cart) {
    const price = allProducts.find((p) => p.id === line.productId)?.price;
    if (price == null) hasUnpricedItem = true;
    else priceTotal += Number(price) * line.quantity;
  }

  function handleCreateCustomer() {
    setError(null);
    startTransition(async () => {
      try {
        const created = await createCustomerAction({ name: newCustomerName, phone: newCustomerPhone, address: newCustomerAddress });
        setCustomer({ id: created.id, name: created.name, phone: created.phone, address: newCustomerAddress });
        setStep("items");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't create that customer.");
      }
    });
  }

  /** Mirrors handleCreateCustomer: create, drop the row into local state,
   *  and land the agent where they can immediately use it. Here that means
   *  opening the new product's picker straight away — it has no modifiers,
   *  so "Add item" is live on the spot and the only remaining decision is
   *  quantity. */
  function handleCreateProduct() {
    setError(null);
    startTransition(async () => {
      try {
        const created = await createProductInlineAction({
          name: newProductName,
          description: newProductDescription,
          price: newProductPrice,
          sourceUrl: newProductSourceUrl,
        });
        const product: WizardProduct = { ...created, modifierGroups: [] };
        setExtraProducts((prev) => [product, ...prev]);
        setAddingProduct(false);
        setNewProductName("");
        setNewProductDescription("");
        setNewProductPrice("");
        setNewProductSourceUrl("");
        // Narrow the list to the new product rather than clearing the
        // query. Cleared, it lands wherever the refreshed catalog sorts it —
        // for anything past the third product that is below the fold, with
        // its picker open somewhere the agent can't see. Filtered, the thing
        // just created is the only row, at the top, already expanded.
        setProductQuery(created.name);
        setPicking(product);
        setSelections({});
        setQty(1);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't create that product.");
      }
    });
  }

  // Expands/collapses inline under the tapped ProductRow (an accordion, not
  // a separate "configure item" screen — that used to fully replace the
  // Items view for one product, which made adding a second item a confusing
  // trip back to something that looked like square one). Tapping the same
  // product again closes it; tapping a different one swaps which is open,
  // since configuring two at once isn't a real use case.
  function togglePicker(product: WizardProduct) {
    if (picking?.id === product.id) {
      setPicking(null);
      return;
    }
    setPicking(product);
    setSelections({});
    setQty(1);
  }

  function commitItem() {
    if (!picking) return;
    const modifierOptionIds = picking.modifierGroups.map((g) => {
      const value = selections[g.id];
      return g.options.find((o) => o.value === value)!.id;
    });
    setCart((prev) => [
      ...prev,
      {
        key: `${picking.id}-${Date.now()}`,
        productId: picking.id,
        productName: picking.name,
        selection: picking.modifierGroups.map((g) => selections[g.id]).filter(Boolean),
        modifierOptionIds,
        quantity: qty,
      },
    ]);
    setPicking(null);
    setSelections({});
    setQty(1);
  }

  function handleSave(place: boolean) {
    if (!customer) return;
    if (place && totalItemCount === 0) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await saveOrderAction({
          orderId: resume?.orderId,
          customerId: customer.id,
          notes,
          items: cart.map((line) => ({ productId: line.productId, modifierOptionIds: line.modifierOptionIds, quantity: line.quantity })),
          place,
        });
        // saveOrderAction redirects when place=true (throws internally, so
        // this line only runs for a draft save) — the revalidated Orders
        // list already reflects it, just head back there.
        void result;
        router.push("/orders");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save the order.");
      }
    });
  }

  let title = "New order";
  let eyebrow = "Customer";
  // Default (Customer step, and Items below): back leaves the wizard route
  // entirely, back to the Orders list — there's nothing "behind" Customer to
  // step to within the wizard itself. Items also has its own inline "Change
  // customer" link for stepping back a wizard step without leaving the route.
  let onBack: (() => void) | undefined = () => router.push("/orders");
  let body;
  let footer;

  if (step === "customer") {
    body = addingCustomer ? (
      <div className="grid gap-3">
        <Field label="Name" required>
          <Input icon="user" autoComplete="name" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} />
        </Field>
        <Field label="Phone" required>
          <Input icon="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="09 …" value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} />
        </Field>
        <Field label="Address" required hint="Needed to ship the parcel once it arrives.">
          <Textarea icon="map-pin" rows={2} autoComplete="street-address" value={newCustomerAddress} onChange={(e) => setNewCustomerAddress(e.target.value)} />
        </Field>
      </div>
    ) : (
      <div className="grid gap-3">
        <p className="font-ui text-small text-text-muted">Choose a customer to continue.</p>
        <SearchField value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} onClear={() => setCustomerQuery("")} placeholder="Name or phone" />
        {visibleMatches.map((c) => (
          <CustomerRow
            key={c.id}
            name={c.name}
            phone={c.phone}
            address={c.address}
            onClick={() => {
              setCustomer(c);
              setStep("items");
            }}
          />
        ))}
        {hiddenMatchCount > 0 ? (
          <p className="font-ui text-small text-text-faint">
            Showing {BROWSE_CAP} of {matches.length} — search by name or phone to find someone else.
          </p>
        ) : null}
      </div>
    );
    // Pinned regardless of scroll position, same reasoning noted on Items/
    // Review's footers below — "+ New customer" going unreachable behind a
    // long customer list (nothing to do with list length once it's here) was
    // the actual bug report this fixed. Back is a real, equally-weighted
    // button here too, not the small inline text link this used to be.
    footer = addingCustomer ? (
      <div className="flex gap-2">
        <Button variant="secondary" icon="arrow-left" onClick={() => setAddingCustomer(false)}>
          Back
        </Button>
        <Button
          full
          icon="user-plus"
          disabled={!newCustomerName || !newCustomerPhone || !newCustomerAddress || isPending}
          onClick={handleCreateCustomer}
          className="flex-1 rounded-full shadow-raised"
        >
          {isPending ? "Creating…" : "Create customer"}
        </Button>
      </div>
    ) : (
      <Button
        full
        variant="secondary"
        icon="user-plus"
        onClick={() => {
          setAddingCustomer(true);
          setNewCustomerName(customerQuery);
        }}
        className="rounded-full"
      >
        + New customer
      </Button>
    );
  } else if (step === "items") {
    title = customer?.name ?? "Items";
    eyebrow = "Items";
    body = addingProduct ? (
      // Same shape as the Customer step's inline create: the step's body
      // becomes the form and its footer becomes Back / Create, rather than a
      // Sheet stacked over a wizard that already owns the whole screen.
      <div className="grid gap-4">
        <Field label="Name" required>
          <Input icon="package" autoComplete="off" value={newProductName} onChange={(e) => setNewProductName(e.target.value)} />
        </Field>
        <Field label="Description" required>
          <Textarea icon="align-left" rows={2} value={newProductDescription} onChange={(e) => setNewProductDescription(e.target.value)} />
        </Field>
        <Field label="Source URL" hint="Link to the exact Lazada/TikTok Shop listing.">
          <Input
            type="url"
            icon="link"
            placeholder="https://…"
            value={newProductSourceUrl}
            onChange={(e) => setNewProductSourceUrl(e.target.value)}
          />
        </Field>
        <Field label="Price" hint="Optional, MMK">
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            icon="coins"
            suffix="MMK"
            value={newProductPrice}
            onChange={(e) => setNewProductPrice(e.target.value)}
          />
        </Field>
        <p className="font-ui text-small text-text-faint">
          Photos and modifiers can be added on the product&rsquo;s own page later — neither is needed to put it on this order.
        </p>
      </div>
    ) : (
      <div className="grid gap-3">
        {totalItemCount ? (
          <div className="min-w-0">
            <SectionHeader right={`${totalItemCount} items`}>On this order</SectionHeader>
            {existingItems.map((line, i) => (
              <OrderItemRow key={`existing-${i}`} product={line.productName} selection={line.selection} qty={line.quantity} status="Pending" />
            ))}
            {cart.map((line) => (
              <OrderItemRow key={line.key} product={line.productName} selection={line.selection} qty={line.quantity} status="Pending" />
            ))}
          </div>
        ) : null}

        <p className="font-ui text-small text-text-muted">Add at least one product to continue.</p>
        <SectionHeader>Add a product</SectionHeader>
        {allProducts.length ? (
          <SearchField value={productQuery} onChange={(e) => setProductQuery(e.target.value)} onClear={() => setProductQuery("")} placeholder="Search products" />
        ) : null}
        {allProducts.length && visibleProducts.length === 0 ? (
          <p className="font-ui text-small text-text-muted">No products match &ldquo;{productQuery}&rdquo;.</p>
        ) : null}
        {allProducts.length ? (
          visibleProducts.map((p) => {
            const expanded = picking?.id === p.id;
            const allSelected = p.modifierGroups.every((g) => selections[g.id]);
            return (
              <div key={p.id}>
                <ProductRow
                  name={p.name}
                  meta={formatPrice(p.price)}
                  sourceUrl={p.sourceUrl}
                  onClick={() => togglePicker(p)}
                  right={<Icon name={expanded ? "chevron-up" : "chevron-down"} size={16} color="var(--color-text-faint)" />}
                />
                {expanded ? (
                  <div className="grid gap-3 border-b border-line-hairline bg-surface-sunken px-5 py-3">
                    {p.modifierGroups.map((group) => (
                      <Field key={group.id} label={group.name} required group>
                        <OptionChips
                          options={group.options.map((o) => o.value)}
                          value={selections[group.id]}
                          onChange={(v) => setSelections((prev) => ({ ...prev, [group.id]: v as string }))}
                        />
                      </Field>
                    ))}
                    <Field label="Quantity" group>
                      <QtyDial value={qty} onChange={setQty} min={1} />
                    </Field>
                    <Button full icon="plus" disabled={!allSelected} onClick={commitItem} className="rounded-full shadow-raised">
                      Add item
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <p className="font-ui text-small text-text-muted">No active products yet — create the first one below.</p>
        )}
        {hiddenProductCount > 0 ? (
          <p className="font-ui text-small text-text-faint">
            Showing {BROWSE_CAP} of {matchingProducts.length} — search by name to find another.
          </p>
        ) : null}

        {/* Sits in the body rather than the footer, unlike the Customer
            step's "+ New customer". That footer holds one action; this one
            already carries the commit set (Previous / Review / Save draft),
            and a create button among them reads as a fourth way to finish.
            The list above it is capped at BROWSE_CAP with search, so it
            can't scroll out of reach the way the customer list did. */}
        <Button
          full
          variant="secondary"
          icon="plus"
          onClick={() => {
            setAddingProduct(true);
            setNewProductName(productQuery);
          }}
          className="rounded-full"
        >
          + New product
        </Button>

        <Field label="Notes" hint="Optional — anything the Supplier should know">
          <Textarea icon="align-left" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    );
    footer = addingProduct ? (
      <div className="flex gap-2">
        <Button variant="secondary" icon="arrow-left" onClick={() => setAddingProduct(false)}>
          Back
        </Button>
        <Button
          full
          icon="plus"
          disabled={!newProductName || !newProductDescription || isPending}
          onClick={handleCreateProduct}
          className="flex-1 rounded-full shadow-raised"
        >
          {isPending ? "Creating…" : "Create product"}
        </Button>
      </div>
    ) : (
      <div className="grid gap-2">
        <div className="flex gap-2">
          <Button variant="secondary" icon="arrow-left" onClick={() => (resume ? router.push("/orders") : setStep("customer"))}>
            Previous
          </Button>
          <Button full iconAfter="chevron-right" disabled={!totalItemCount} onClick={() => setStep("review")} className="flex-1 rounded-full shadow-raised">
            Review order
          </Button>
        </div>
        <Button full variant="secondary" icon="clock" disabled={isPending} onClick={() => handleSave(false)}>
          Save as draft
        </Button>
      </div>
    );
  } else {
    // Review — purely a client-side summary of what's already in state
    // (existingItems + cart + notes); nothing here has been saved yet.
    title = customer?.name ?? "Review";
    eyebrow = "Review";
    onBack = () => setStep("items");
    body = (
      <div className="grid gap-3">
        <div className="min-w-0">
          <p className="font-ui text-small text-text-muted">Check everything, then place the order.</p>
          <SectionHeader>Customer</SectionHeader>
          {customer ? <CustomerRow name={customer.name} phone={customer.phone} address={customer.address} /> : null}
        </div>

        <div className="min-w-0">
          <SectionHeader right={`${totalItemCount} items`}>Items</SectionHeader>
          {existingItems.map((line, i) => (
            <OrderItemRow key={`existing-${i}`} product={line.productName} selection={line.selection} qty={line.quantity} status="Pending" />
          ))}
          {cart.map((line) => (
            <OrderItemRow key={line.key} product={line.productName} selection={line.selection} qty={line.quantity} status="Pending" />
          ))}
          <div className="flex items-baseline justify-between px-5 pt-3">
            <span className="font-ui text-body-strong text-text-strong">Total</span>
            <span className="font-ui text-body-strong text-text-strong [font-variant-numeric:tabular-nums]">
              {priceTotal.toLocaleString()} MMK{hasUnpricedItem ? "+" : ""}
            </span>
          </div>
          {hasUnpricedItem ? (
            <p className="px-5 pt-0.5 font-ui text-small text-text-faint">One or more items don&rsquo;t have a set price yet — total is a minimum.</p>
          ) : null}
        </div>

        <Field label="Notes">
          <p className={"font-ui text-body " + (notes ? "text-text-body" : "text-text-faint")}>{notes || "No notes added."}</p>
        </Field>
      </div>
    );
    footer = (
      <div className="grid gap-2">
        <div className="flex gap-2">
          <Button variant="secondary" icon="arrow-left" onClick={() => setStep("items")}>
            Previous
          </Button>
          <Button full icon="check" disabled={!totalItemCount || isPending} onClick={() => handleSave(true)} className="flex-1 rounded-full shadow-raised">
            {isPending ? "Saving…" : "Place order"}
          </Button>
        </div>
        <Button full variant="secondary" icon="clock" disabled={isPending} onClick={() => handleSave(false)}>
          Save as draft
        </Button>
      </div>
    );
  }

  return (
    <Screen>
      <TopBar title={title} eyebrow={eyebrow} onBack={onBack} />
      <StepIndicator step={step} />
      <ScrollBody>
        <div className="px-5 pt-3 pb-12">{body}</div>
      </ScrollBody>
      {footer ? <Foot padded>{footer}</Foot> : null}
      <ErrorDialog open={!!error} message={error} onOk={() => setError(null)} />
    </Screen>
  );
}
