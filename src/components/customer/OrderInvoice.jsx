import { Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../ui";
import { formatCurrency } from "../../lib/currency";
import { formatOptionChoices } from "../../lib/productOptions";

/** The site name the invoice is issued under. */
const SITE_NAME = "Marvel";

/**
 * The order's invoice — a printable, self-contained view of the placed order:
 * order id and date, customer, shipping address, the items with options and
 * SKU, and the totals. No server round trip: everything comes from the order
 * row the portal already holds, so there is nothing to go stale.
 */
export default function OrderInvoice({ order, onClose }) {
  if (!order) return null;

  const items = Array.isArray(order.items) ? order.items : [];
  const subtotal = items.reduce(
    (sum, item) => sum + (Number(item?.price) || 0) * (Number(item?.quantity) || 0),
    0
  );
  const total = Number(order.total_amount);
  const placedAt = order.created_at
    ? new Date(order.created_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  return (
    <div className="customer-invoice-panel">
      <div className="customer-invoice">
        <header className="customer-invoice__header">
          <div className="customer-invoice__brand">{SITE_NAME}</div>
          <h2 className="customer-invoice__title">Order Invoice</h2>
          <p className="customer-invoice__meta">
            Order #{String(order.id).toUpperCase()} · {placedAt}
          </p>
        </header>

        <dl className="customer-invoice__details">
          <div className="customer-invoice__detail">
            <dt>Customer</dt>
            <dd className="customer-invoice__detail-name">{order.customer_name || ""}</dd>
            <dd>{order.customer_email || ""}</dd>
          </div>
          <div className="customer-invoice__detail">
            <dt>Shipping address</dt>
            <dd>{order.shipping_address || ""}</dd>
          </div>
        </dl>

        <Table className="customer-invoice__items">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Product</TableHead>
              <TableHead scope="col">Options</TableHead>
              <TableHead scope="col">Qty</TableHead>
              <TableHead scope="col" className="text-right">
                Unit price
              </TableHead>
              <TableHead scope="col" className="text-right">
                Amount
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => {
              const options = formatOptionChoices(item?.options);
              const sku = typeof item?.sku === "string" ? item.sku.trim() : "";
              const unitPrice = Number(item?.price) || 0;
              const quantity = Number(item?.quantity) || 0;
              const detail = [options, sku].filter(Boolean).join(" · ");
              return (
                <TableRow key={index}>
                  <TableCell>
                    <div>{item?.title || "—"}</div>
                    {sku && <div className="customer-invoice__sku">{sku}</div>}
                  </TableCell>
                  <TableCell>{detail || "—"}</TableCell>
                  <TableCell>{quantity || "—"}</TableCell>
                  <TableCell className="text-right">{formatCurrency(unitPrice)}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(unitPrice * quantity)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <dl className="customer-invoice__totals">
          <div className="customer-invoice__total">
            <dt>Subtotal</dt>
            <dd>{formatCurrency(subtotal)}</dd>
          </div>
          <div className="customer-invoice__total customer-invoice__total--grand">
            <dt>Total</dt>
            <dd>{formatCurrency(total || subtotal)}</dd>
          </div>
        </dl>
      </div>
      <div className="customer-invoice-actions">
        <Button onClick={() => window.print()}>Print invoice</Button>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
