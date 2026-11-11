import { Button, Input, RequiredMark } from "../ui";
import "./vendor-dashboard.css";

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
    <div className="vendor-modal__overlay">
      <div className="vendor-modal__dialog vendor-modal__dialog--compact">
        <h3 className="vendor-modal__title vendor-modal__title--compact">
          Update Shipment for Order #{selectedOrder.id.toUpperCase()}
        </h3>

        <form onSubmit={onSubmit} className="vendor-form">
          <div>
            <label className="vendor-field__label" htmlFor="vendor-fulfillment-status">
              Fulfillment Status
            </label>
            <select
              id="vendor-fulfillment-status"
              value={fulfillmentForm.status}
              onChange={(e) => setFulfillmentForm({ ...fulfillmentForm, status: e.target.value })}
              className="vendor-field__control"
            >
              <option value="processing">Processing</option>
              <option value="shipped">Shipped (In Transit)</option>
              <option value="delivered">Delivered</option>
            </select>
          </div>

          <div>
            <label className="vendor-field__label" htmlFor="vendor-fulfillment-carrier">
              Shipping Carrier
            </label>
            <select
              id="vendor-fulfillment-carrier"
              value={fulfillmentForm.carrier}
              onChange={(e) => setFulfillmentForm({ ...fulfillmentForm, carrier: e.target.value })}
              className="vendor-field__control"
            >
              <option value="FedEx Express">FedEx Express</option>
              <option value="DHL Express">DHL Express</option>
              <option value="UPS Ground">UPS Ground</option>
              <option value="BlueDart">BlueDart</option>
            </select>
          </div>

          <div>
            <label className="vendor-field__label" htmlFor="vendor-fulfillment-tracking">
              Tracking Number <RequiredMark />
            </label>
            <Input
              id="vendor-fulfillment-tracking"
              type="text"
              placeholder="e.g. FX-984920194"
              value={fulfillmentForm.tracking_number}
              onChange={(e) =>
                setFulfillmentForm({ ...fulfillmentForm, tracking_number: e.target.value })
              }
              required
            />
          </div>

          <div className="vendor-form__actions">
            <Button
              type="submit"
              variant="primary"
              className="vendor-button--accent vendor-button--grow"
            >
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
