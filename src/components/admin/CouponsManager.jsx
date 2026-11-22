import { useCallback, useEffect, useState } from "react";
import { Edit2, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  apiCreateCoupon,
  apiDeleteCoupon,
  apiFetchCoupons,
  apiUpdateCoupon,
} from "../../api/backendApi";
import { formatCurrency } from "../../lib/currency";
import { Button, Input, Switch, useToast } from "../ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/Table";
import SearchInput from "../ui/SearchInput";
import AdminInlinePanel from "./AdminInlinePanel";
import AdminConfirmStrip from "./AdminConfirmStrip";

const EMPTY_FORM = {
  code: "",
  kind: "percent",
  value: "",
  min_subtotal: "",
  max_uses: "",
  expires_at: "",
  is_active: true,
};

/**
 * The console's Coupons screen.
 *
 * Lists the codes the `coupons` table carries and lets an admin create, edit,
 * toggle and delete them. The checkout's pre-check and redeem steps live behind
 * the public `/api/coupons/validate` and `/api/coupons/redeem` endpoints; this
 * screen only owns the catalogue rows.
 */
export default function CouponsManager() {
  const { addToast } = useToast();
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingCoupon, setDeletingCoupon] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const list = await apiFetchCoupons();
      setCoupons(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err?.message || "Could not load the coupons.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingCoupon(null);
    setForm(EMPTY_FORM);
    setPanelOpen(true);
  };

  const openEdit = (coupon) => {
    setEditingCoupon(coupon);
    setForm({
      code: coupon.code ?? "",
      kind: coupon.kind ?? "percent",
      value: coupon.value ?? "",
      min_subtotal: coupon.min_subtotal ?? "",
      max_uses: coupon.max_uses ?? "",
      expires_at: coupon.expires_at ? String(coupon.expires_at).slice(0, 10) : "",
      is_active: Boolean(coupon.is_active),
    });
    setPanelOpen(true);
  };

  const handleSave = async () => {
    if (saving) return;
    const value = Number(form.value);
    const minSubtotal = Number(form.min_subtotal);
    const maxUses = Number(form.max_uses);

    if (String(form.code ?? "").trim().length < 2) {
      addToast({
        title: "Coupon Not Saved",
        message: "The coupon code must be at least 2 characters.",
        type: "error",
      });
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      addToast({
        title: "Coupon Not Saved",
        message: "The coupon value must be greater than 0.",
        type: "error",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        code: String(form.code).trim().toUpperCase(),
        kind: form.kind,
        value,
        min_subtotal: Number.isFinite(minSubtotal) && minSubtotal >= 0 ? minSubtotal : 0,
        max_uses: Number.isInteger(maxUses) && maxUses >= 0 ? maxUses : 0,
        expires_at: form.expires_at || null,
        is_active: Boolean(form.is_active),
      };

      if (editingCoupon) {
        const updated = await apiUpdateCoupon(editingCoupon.id, payload);
        setCoupons((prev) =>
          prev.map((coupon) => (coupon.id === editingCoupon.id ? updated : coupon))
        );
        addToast({
          title: "Coupon Updated",
          message: `'${updated?.code}' saved.`,
          type: "success",
        });
      } else {
        const created = await apiCreateCoupon(payload);
        setCoupons((prev) => [created, ...prev]);
        addToast({
          title: "Coupon Created",
          message: `'${created?.code}' is now available at checkout.`,
          type: "success",
        });
      }
      setPanelOpen(false);
    } catch (err) {
      addToast({
        title: "Coupon Save Failed",
        message: err?.message || "Failed to save the coupon.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (coupon) => {
    const nextActive = !coupon.is_active;
    try {
      const updated = await apiUpdateCoupon(coupon.id, { is_active: nextActive });
      setCoupons((prev) => prev.map((row) => (row.id === coupon.id ? updated : row)));
      addToast({
        title: nextActive ? "Coupon Activated" : "Coupon Deactivated",
        message: `'${coupon.code}' is now ${nextActive ? "active" : "inactive"} at checkout.`,
        type: "info",
      });
    } catch (err) {
      addToast({
        title: "Coupon Update Failed",
        message: err?.message || "Failed to update the coupon.",
        type: "error",
      });
    }
  };

  const handleDelete = async () => {
    if (!deletingCoupon) return;
    setDeleteLoading(true);
    try {
      await apiDeleteCoupon(deletingCoupon.id);
      setCoupons((prev) => prev.filter((coupon) => coupon.id !== deletingCoupon.id));
      addToast({
        title: "Coupon Deleted",
        message: `'${deletingCoupon.code}' removed.`,
        type: "info",
      });
      setDeletingCoupon(null);
    } catch (err) {
      addToast({
        title: "Coupon Delete Failed",
        message: err?.message || "Failed to delete the coupon.",
        type: "error",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatKindValue = (kind, value) => {
    const amount = Number(value ?? 0);
    if (kind === "percent") return `${amount}% off`;
    if (kind === "flat") return `₹${amount} off`;
    return "Free shipping";
  };

  const visibleCoupons = coupons.filter((coupon) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [coupon.code, coupon.kind, formatKindValue(coupon.kind, coupon.value)]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  return (
    <section className="admin-coupons dashboard-tab-view" aria-label="Coupons">
      <div className="chart-card-header">
        <div>
          <h3 className="chart-title">Coupons</h3>
          <p className="chart-subtitle">
            Discount codes the storefront can apply. Create, edit, toggle or delete them here.
          </p>
        </div>
        <Button type="button" variant="accent" size="sm" onClick={openCreate}>
          <Plus size={14} /> Create Coupon
        </Button>
      </div>

      {error ? (
        <p role="alert" className="admin-coupons-error">
          {error}
        </p>
      ) : (
        <div className="console-table-card">
          <div className="console-list-toolbar">
            <SearchInput
              value={search}
              onValueChange={setSearch}
              ariaLabel="Search coupons"
              placeholder="Search coupons by code or kind"
            />
            <span className="text-muted text-sm">
              <strong>{visibleCoupons.length}</strong> of <strong>{coupons.length}</strong> coupons
            </span>
          </div>

          <div className="table-responsive-wrapper">
            <Table className="ui-table--cards">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Sl. No.</TableHead>
                  <TableHead scope="col">CODE</TableHead>
                  <TableHead scope="col">DISCOUNT</TableHead>
                  <TableHead scope="col">MIN. SUBTOTAL</TableHead>
                  <TableHead scope="col">USES</TableHead>
                  <TableHead scope="col">STATUS</TableHead>
                  <TableHead scope="col">EXPIRES</TableHead>
                  <TableHead scope="col" className="text-right">
                    ACTIONS
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} data-empty className="empty-table-cell">
                      Loading coupons…
                    </TableCell>
                  </TableRow>
                ) : visibleCoupons.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} data-empty className="empty-table-cell">
                      <p>
                        {search
                          ? `No coupons match "${search}".`
                          : "No coupons yet. Create the first one."}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleCoupons.map((coupon, index) => (
                    <TableRow key={coupon.id}>
                      <TableCell data-label="Sl. No.">{index + 1}</TableCell>
                      <TableCell data-label="Code">
                        <span className="admin-coupon-code">{coupon.code}</span>
                      </TableCell>
                      <TableCell data-label="Discount">
                        {formatKindValue(coupon.kind, coupon.value)}
                      </TableCell>
                      <TableCell data-label="Min. subtotal">
                        {formatCurrency(Number(coupon.min_subtotal ?? 0))}
                      </TableCell>
                      <TableCell data-label="Uses">
                        {coupon.used_count ?? 0}
                        {Number(coupon.max_uses ?? 0) > 0 ? ` / ${coupon.max_uses}` : " / ∞"}
                      </TableCell>
                      <TableCell data-label="Status">
                        <div className="admin-coupon-status-cell">
                          <Switch
                            checked={Boolean(coupon.is_active)}
                            onChange={() => handleToggle(coupon)}
                            slotProps={{ input: { "aria-label": `Toggle coupon ${coupon.code}` } }}
                          />
                          <span>{coupon.is_active ? "Active" : "Inactive"}</span>
                        </div>
                      </TableCell>
                      <TableCell data-label="Expires">
                        {coupon.expires_at ? String(coupon.expires_at).slice(0, 10) : "No expiry"}
                      </TableCell>
                      <TableCell data-label="Actions" className="text-right">
                        <div className="admin-coupon-actions">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(coupon)}
                          >
                            <Edit2 size={14} /> Edit
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setDeletingCoupon(coupon)}
                          >
                            <Trash2 size={14} /> Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <AdminInlinePanel
        open={panelOpen}
        title={editingCoupon ? "Edit Coupon" : "Create Coupon"}
        subtitle="The code is trimmed and uppercased before it is stored."
        tone="blue"
        onClose={() => setPanelOpen(false)}
        closeLabel="Close the coupon form"
      >
        <div className="form-group">
          <label className="form-label" htmlFor="coupon-code">
            Code <span className="required-mark">*</span>
          </label>
          <Input
            id="coupon-code"
            type="text"
            value={form.code}
            onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
            placeholder="e.g. MARVEL20"
          />
        </div>
        <div className="form-group-row">
          <div className="form-group">
            <label className="form-label" htmlFor="coupon-kind">
              Kind <span className="required-mark">*</span>
            </label>
            <select
              id="coupon-kind"
              className="filter-dropdown"
              value={form.kind}
              onChange={(event) => setForm((prev) => ({ ...prev, kind: event.target.value }))}
            >
              <option value="percent">Percent</option>
              <option value="flat">Flat</option>
              <option value="free_shipping">Free shipping</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="coupon-value">
              Value <span className="required-mark">*</span>
            </label>
            <Input
              id="coupon-value"
              type="number"
              min={0}
              step="any"
              value={form.value}
              onChange={(event) => setForm((prev) => ({ ...prev, value: event.target.value }))}
              placeholder={form.kind === "percent" ? "e.g. 20" : "e.g. 500"}
            />
          </div>
        </div>
        <div className="form-group-row">
          <div className="form-group">
            <label className="form-label" htmlFor="coupon-min-subtotal">
              Minimum subtotal
            </label>
            <Input
              id="coupon-min-subtotal"
              type="number"
              min={0}
              step="any"
              value={form.min_subtotal}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, min_subtotal: event.target.value }))
              }
              placeholder="0"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="coupon-max-uses">
              Max uses
            </label>
            <Input
              id="coupon-max-uses"
              type="number"
              min={0}
              step={1}
              value={form.max_uses}
              onChange={(event) => setForm((prev) => ({ ...prev, max_uses: event.target.value }))}
              placeholder="0 for unlimited"
            />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="coupon-expires-at">
            Expires at
          </label>
          <Input
            id="coupon-expires-at"
            type="date"
            value={form.expires_at}
            onChange={(event) => setForm((prev) => ({ ...prev, expires_at: event.target.value }))}
          />
        </div>
        <div className="form-group">
          <label className="settings-checkbox" htmlFor="coupon-is-active">
            <Switch
              id="coupon-is-active"
              checked={Boolean(form.is_active)}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, is_active: event.target.checked }))
              }
              slotProps={{ input: { "aria-label": "Coupon is active" } }}
            />
            <span>Active</span>
          </label>
        </div>
        <div className="admin-inline-actions">
          <Button type="button" variant="outline" onClick={() => setPanelOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? <RefreshCw size={15} className="spin-animation" /> : <Plus size={15} />}
            {editingCoupon ? "Save Changes" : "Create Coupon"}
          </Button>
        </div>
      </AdminInlinePanel>

      <AdminConfirmStrip
        open={Boolean(deletingCoupon)}
        title={`Delete coupon '${deletingCoupon?.code}'?`}
        message="The code will no longer be valid at checkout. This cannot be undone."
        destructive
        pending={deleteLoading}
        onCancel={() => setDeletingCoupon(null)}
        onConfirm={handleDelete}
        confirmLabel="Delete Coupon"
      />
    </section>
  );
}
