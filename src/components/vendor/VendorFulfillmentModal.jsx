import { Button, Input } from "../ui";

/**
 * Fulfillment and shipping update modal for Vendor Dashboard.
 */
export default function VendorFulfillmentModal({
  isOpen,
  onClose,
  selectedOrder,
  fulfillmentForm,
  setFulfillmentForm,
  onSubmit,
}) {
  if (!isOpen || !selectedOrder) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: 16,
          maxWidth: 480,
          width: "100%",
          padding: 28,
          boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
        }}
      >
        <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 16 }}>
          Update Shipment for Order #{selectedOrder.id.toUpperCase()}
        </h3>

        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "#475569",
                marginBottom: 4,
              }}
            >
              Fulfillment Status
            </label>
            <select
              value={fulfillmentForm.status}
              onChange={(e) => setFulfillmentForm({ ...fulfillmentForm, status: e.target.value })}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: 14,
              }}
            >
              <option value="processing">Processing</option>
              <option value="shipped">Shipped (In Transit)</option>
              <option value="delivered">Delivered</option>
            </select>
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "#475569",
                marginBottom: 4,
              }}
            >
              Shipping Carrier
            </label>
            <select
              value={fulfillmentForm.carrier}
              onChange={(e) => setFulfillmentForm({ ...fulfillmentForm, carrier: e.target.value })}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: 14,
              }}
            >
              <option value="FedEx Express">FedEx Express</option>
              <option value="DHL Express">DHL Express</option>
              <option value="UPS Ground">UPS Ground</option>
              <option value="BlueDart">BlueDart</option>
            </select>
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "#475569",
                marginBottom: 4,
              }}
            >
              Tracking Number
            </label>
            <Input
              type="text"
              placeholder="e.g. FX-984920194"
              value={fulfillmentForm.tracking_number}
              onChange={(e) =>
                setFulfillmentForm({ ...fulfillmentForm, tracking_number: e.target.value })
              }
              required
            />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <Button type="submit" variant="primary" style={{ flex: 1, background: "#7c3aed" }}>
              Save Shipment Info
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
