---
status: accepted
---

# Order/Order Item split, with a per-Item lifecycle through packing

PRD §3 originally locked the MVP order lifecycle as
`Pending → Purchased → Cancelled`, deliberately deferring receiving/
packing/delivery tracking. That turned out to be wrong before MVP even
shipped: a Support Agent can't safely pack an item that hasn't
physically arrived, so a `Received` signal is required, not deferrable —
which pulled `Packed` and `Completed` in with it
(`Pending → Purchased → Received → Packed → Completed`, `Cancelled`
reachable from any non-Completed stage).

That, in turn, forced status off the `Order` entirely and onto a new
`Order Item`. An Order can hold multiple Products, and the Supplier's
Purchase Queue batch-purchases a single Product across many different
Orders and Customers at once — if status lived on `Order`, marking one
Product "Purchased" for everyone who ordered it today would have no
correct way to leave a different Product in the same Order untouched.
`Order` is now a header only (who, when); `Order Item` (Product +
Modifier Option selection + quantity) carries the status.

## Considered and rejected

- **Cancellation restricted to `Pending` only.** Rejected: it would force
  a Support Agent to push an Item through Received/Packed/Completed
  even after everyone already knows it's not going to the Customer.
  Cancellation is reachable from any stage except Completed instead.
- **A separate `Shipped` (in-transit) stage between Purchased and
  Received.** Rejected for MVP: it doesn't unlock any capability
  a Support Agent doesn't already have — they wait for physical arrival
  before packing either way. Cheap to add later
  (`Purchased → Shipped → Received`) if visibility into "on the way" ever
  becomes something people actually ask for.
