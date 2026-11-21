# Vendor economics — to look into later

Not built. Recorded here so the decisions are not lost.

A vendor can add products, see their orders and update fulfilment, but the
marketplace has no money model for them yet. Everything below is open.

## Questions to answer first

- **Commission**: flat percentage of the item price, or per category? Who
  pays the payment-processing fee — the platform, the vendor, or split?
- **Payouts**: who receives the money? One platform account that later pays
  vendors, or a connected-account split payment at checkout? The latter is
  the Stripe Connect / RazorpayX route and changes the checkout design.
- **Settlement cycle**: on delivery, after the return window, or weekly?
- **Returns and refunds**: who bears the cost, and when is the vendor
  credited or debited?
- **Shipping**: who pays, and is there a platform rate card?
- **Seller rating**: derived from order cancellations, late fulfilment and
  review scores? Visible on the storefront?

## What the code already has (the starting point)

- `products.vendor_id` and `products.vendor_name` — every product belongs to
  one vendor.
- `orders.vendor_id` — each order is scoped to a vendor in the admin and in
  the vendor dashboard (`GET /api/orders?role=vendor&userId=…`).
- `orders.items` is a JSONB array; each item carries the product id, title,
  price, quantity, the customer's chosen options and the SKU. This is where
  a per-line commission could be recorded without a migration.
- `server/routes/orders.js` creates the order; its `total_amount` is a single
  number with no split.
- The vendor dashboard is in `src/components/vendor/`, its stylesheet in
  `src/styles/portals/vendor-dashboard.css`.

## Data that would need adding

- a payout/balance table (vendor, amount, status, period, reference)
- a ledger line per order item (gross, commission, fee, net)
- a payout status on the vendor dashboard and an admin reconciliation view
- tax fields if the platform is the merchant of record

## Why it was deferred

Checkout is mock-only (no payment processor yet), so there is no money to
split. The right moment to decide is when the real payment provider is
chosen — the commission and payout model determines whether checkout uses
a platform charge or a split payment.

See also: `docs/backend-owned-content.md` (the order and product shapes),
`docs/product-variants-contract.md` (the item options).
