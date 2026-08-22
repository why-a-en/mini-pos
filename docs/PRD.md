# PRD: Mini POS — Order & Product Coordination Platform

**Status:** Draft v1
**Owner:** Yan Min Thwin
**Last updated:** 2026-08-23

---

## 1. Background

The business model today:

1. A product sale post goes out on social media (Facebook/Instagram/etc.).
2. Interested customers message in and send reference images, then clarify
   modifiers (color, size, variant, etc.) and quantity in chat.
3. A **Supplier** has to go find and purchase that exact item on Lazada or
   TikTok Shop — usually by searching with the image the customer sent.
4. There's a shared chat group between the Supplier and **Customer
   Service**. Customer Service posts each customer's order into that group
   as a message: a screenshot + product info + modifiers + quantity.
5. The Supplier scrolls the group, manually reads every message, and tracks
   in their head (or notes) what still needs to be bought.

### Problems with the current process

- **No structure.** Orders live as chat messages. Nothing is a record —
  it's a scrollback the Supplier has to re-read.
- **No source-of-truth for products.** The same product may be described
  slightly differently depending on who on Customer Service is handling it,
  or re-typed from scratch each time a customer asks about it.
- **Wasted Supplier effort.** The Supplier re-does image search on Lazada/TikTok
  even when Customer Service already found and clarified the exact listing
  during the chat with the customer — that link is thrown away once it's
  screenshotted into the group.
- **No aggregation.** If three customers order the same product today,
  the Supplier discovers this by luck while scrolling, not by design — so
  they may buy it three separate times instead of once, or miss orders
  entirely.
- **No status visibility.** Nothing tells anyone (Customer Service, Supplier, or the
  business owner) what's been bought vs. still pending vs. cancelled.
- **Not searchable.** Finding "what did customer X order yesterday" means
  scrolling chat history.

## 2. Goal

Replace the shared-chat-as-database workflow with a lightweight internal
tool where:

- **Customer Service** builds and maintains a **product catalog** (name,
  description, images, attributes) as they post things for sale, and log
  each **customer order** against a catalog product with modifiers and
  quantity.
- The **Supplier** gets a clean, structured, always-current list of what
  needs to be purchased today, with everything they need (image,
  marketplace link if known, modifiers, quantity) in one place — no chat
  scrolling — and marks items as purchased as they go.

## 3. Scope decisions (locked for MVP)

These were deliberately narrowed to keep the MVP tight; see [Section 9](#9-future-ideas--post-mvp)
for the deferred versions of each.

| Decision | MVP choice |
|---|---|
| Payment tracking | **Out of scope.** No deposit/paid/unpaid tracking in the platform; payment stays a manual, off-platform concern for now. |
| Supplier concurrency | **Single Supplier.** No claiming/assignment mechanism — only one person purchases, so there's no risk of double-buying. |
| Order lifecycle | **Minimal:** `Pending → Purchased → Cancelled`. No receiving/delivery/completion tracking yet. |
| Order–product link | **Product required.** Every order must reference a catalog product; no ad-hoc/one-off orders without a product record. |
| Customer-facing access | **None.** Customers stay in chat/social media; they are not platform users in the MVP (see idea in §9). |

## 4. Users & Roles

| Role | Who | Can do |
|---|---|---|
| **Customer Service** | Staff handling customer chats | Create/edit products; create/edit orders against products; view all orders |
| **Supplier** | Staff who purchases from Lazada/TikTok | View/search products; view today's (and all) orders; mark orders Purchased/Cancelled |
| **Admin** *(optional for MVP, see below)* | Business owner | Everything above + manage users |

**Open question:** are Customer Service and the Supplier the same one or two people
right now, or genuinely separate staff? If it's just you + one or two
people total, a single "Admin" role that can do everything (skip granular
permissions) is enough for MVP and saves build time. Assumed: **yes,
start with one role that can do everything, revisit permissions later**
unless told otherwise.

## 5. Core Concepts / Data Model

### 5.1 Product

The catalog entry for something being sold — created once, reused across
many orders.

| Field | Notes |
|---|---|
| Name | Required |
| Description | Required |
| Images | One or more; the reference images used in the sale post / shown to customers |
| Source marketplace | Lazada / TikTok Shop / Other |
| Source URL | **Link to the exact listing**, if known — see §9.1, this is the single highest-leverage field to add |
| Available modifiers | Free-form list, e.g. `Color: Black, White, Red` / `Size: S, M, L` — displayed as options when creating an order |
| Price (customer-facing) | Optional for MVP, but cheap to include now |
| Status | Active / Archived |
| Created by / Created at | Audit trail |

### 5.2 Order

A single customer's request for a product, logged by Customer Service.

| Field | Notes |
|---|---|
| Product | Required, references a Product |
| Customer name / contact | e.g. social media handle, phone, or chat name — free text |
| Selected modifier(s) | e.g. "Black, size M" — chosen from the product's modifier list, or free text if not pre-defined |
| Quantity | Required, default 1 |
| Order screenshot | Optional image upload (the chat screenshot Customer Service currently passes along) — useful during transition / for disputes |
| Notes | Free text — anything that doesn't fit elsewhere (e.g. "customer wants matte finish") |
| Status | `Pending` (default) → `Purchased` → done, or → `Cancelled` |
| Created by (Customer Service) / Created at | Audit trail |
| Purchased at | Set automatically when marked Purchased |

### 5.3 User

Just enough for login + attribution (who created what).

| Field | Notes |
|---|---|
| Name | |
| Email / username | |
| Role | Customer Service / Supplier / Admin (or single role for MVP, per §4) |

## 6. Features (MVP)

### 6.1 Product Management (Customer Service)
- Create a product: name, description, upload image(s), source
  marketplace, source URL, modifiers, price.
- Edit / archive a product.
- List/search products (by name, status).

### 6.2 Order Management (Customer Service)
- Create an order: pick a product (search/select from catalog), pick
  modifier(s), enter quantity, optionally attach a screenshot and note,
  enter customer contact.
- Edit an order (e.g. fix quantity) while still Pending.
- Cancel an order.
- View list of all orders — filter by status and date.

### 6.3 Supplier View
- **Today's Pending Orders** — the core screen. Shows every pending
  order with: product image, product name + source URL (tap to open
  the Lazada/TikTok listing directly), modifiers, quantity, customer
  reference, and a **"Mark Purchased"** button.
- Orders grouped/sorted by product, so if 3 customers want the same
  item today, the Supplier sees "Product X — 3 orders, qty 5 total" instead
  of three separate scattered entries. *(See §9.2 — this can go further.)*
- Ability to view/search past orders (e.g. "what was purchased
  yesterday").
- Mark an order Purchased or Cancelled.

### 6.4 Auth
- Simple login (email/password) so actions are attributed to a person.

## 7. User Flows

### 7.1 Customer Service logs a new customer order
1. Customer in chat sends an image and says "I want this in black, size
   M, qty 2."
2. Customer Service searches the catalog for the matching product.
   - **If it exists:** select it.
   - **If it doesn't exist yet:** create the product first (name,
     description, save the image, source URL if the customer already
     found it on Lazada/TikTok, modifiers) — then continue.
3. Customer Service creates the order: selects modifiers (Black, M), quantity
   (2), customer contact, optional screenshot/note. Save.
4. Order appears instantly in the Supplier's Pending list. No chat message
   needed.

### 7.2 Supplier processes today's orders
1. Supplier opens "Today's Pending Orders."
2. Sees orders grouped by product with total quantity needed.
3. Taps the source URL to jump straight to the Lazada/TikTok listing
   (skips manual image search entirely, when the URL was captured).
4. Buys the item(s), then taps "Mark Purchased" on each order (or a
   batch action for a grouped product).
5. Order disappears from Pending, moves into purchased history.

## 8. Non-Functional Requirements

- **Mobile-first, not just mobile-friendly.** This is a hard requirement,
  not a nice-to-have: Customer Service and the Supplier will use this primarily
  on phones, not desktop. Every screen is designed for the smallest
  target size first, then progressively enhanced for larger viewports —
  not designed for desktop and squeezed to fit. Must render correctly
  across the full range of phone sizes, from small (~320–375px wide) to
  large/phablet.
- **Performant and robust on real-world phone browsers.** Fast and
  reliable on the actual devices and networks in use (mid-range Android
  devices are the realistic baseline, not flagship phones), on Chrome
  Android, Safari iOS, and Samsung Internet — and tolerant of the
  variable/slow mobile network conditions common in Myanmar and
  Thailand (see [TECH_STACK.md](./TECH_STACK.md)): small JS payloads,
  resilient image loading, no hard failures on a flaky connection.
- **Fast product/order entry**: this replaces a chat message, so it must
  be at least as fast as typing a message — minimize required fields,
  support pasting an image directly.
- **Image storage**: need reliable image upload/storage (product images
  + order screenshots).
- **Small scale**: single small team, low concurrent users — no need to
  over-engineer for scale in MVP.

## 9. Future Ideas / Post-MVP

Brainstormed improvements, deliberately deferred but worth having on the
roadmap:

1. **Marketplace URL capture as a first-class habit.** The single
   biggest efficiency win available: today, once Customer Service (or the
   customer) finds the item on Lazada/TikTok, that link is thrown away
   after being screenshotted. If Customer Service gets in the habit of pasting
   the URL into the product record, the Supplier's "search by image"
   step — the most manual/error-prone part of the whole process —
   disappears almost entirely. Worth emphasizing in team process even
   before any extra tooling.
2. **Smarter order aggregation for the Supplier.** Beyond grouping same-day
   orders by product (already in MVP §6.3), could show running totals
   across a rolling window ("12 pending orders for Product X across the
   last 3 days") so the Supplier can decide to batch-purchase.
3. **Payment tracking.** Add deposit/paid/unpaid status per order, so
   the Supplier only purchases orders that are actually funded — a common
   safeguard in resale/dropship businesses. Deferred per §3, but likely
   the first thing to revisit post-MVP.
4. **Extended order lifecycle.** `Purchased → Received → Delivered to
   customer → Completed`, giving end-to-end visibility instead of
   stopping at "bought."
5. **Multi-Supplier support with claiming.** If a second Supplier is added,
   an explicit "claim" action prevents two people from buying the same
   order.
6. **Customer-facing lookup.** A simple, no-login page/link Customer Service
   can send a customer to see their own order status ("Purchased,
   arriving soon") instead of the customer having to ask in chat.
7. **Ad-hoc orders without a pre-made product.** For rare one-off items
   not worth cataloging.
8. **Basic reporting.** Daily/weekly order counts, most-ordered
   products, pending purchase value — useful once volume grows.
9. **Notifications.** Ping the Supplier (e.g. via chat bot) when new
   orders come in, instead of them having to check the app.
10. **Direct chat/social integration.** Eventually, auto-create a draft
    order from a forwarded chat message or DM, instead of manual entry.

## 10. Success Metrics

- Supplier no longer needs to open/scroll the shared chat group to know
  what to purchase.
- Time from "Customer Service logs order" to "Supplier can see and act on it"
  is near-instant (vs. depending on the Supplier noticing a chat message).
- Reduction in duplicate purchases or missed orders caused by chat
  scrollback being the only record.

## 11. Open Questions

- Are Customer Service and Supplier distinct people today, or is role separation
  mostly for future-proofing? (Affects whether we need real
  role-based permissions in MVP or can ship with one role — assumed
  the latter for now, see §4.)
- Should product modifiers be a structured list (e.g., predefined
  `Color`/`Size` option sets) or plain free text? Structured is more
  work but makes the Supplier's grouped view (§6.3) more reliable.
- Any existing product catalog / order history to migrate, or starting
  fresh?
