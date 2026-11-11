import { useId, useState } from "react";
import { ArrowDown, ArrowUp, Edit2, Trash2 } from "lucide-react";
import {
  Button,
  ImageUploadDropzone,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui";
import Switch from "../ui/Switch";
import { apiUploadImage } from "../../api/contentApi";
import AdminConfirmStrip from "./AdminConfirmStrip";
import "./admin-panels.css";

/**
 * Lowercase, collapse every run outside [a-z0-9] to "-", then trim "-".
 * Mirrors `server/lib/validation.js` exactly — there is no shared module
 * between the two runtimes, so the two copies must stay identical.
 */
export function slugify(name) {
  return String(name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * A labelled image slot. The visible value is the upload endpoint's `url`
 * (never `signed_url`); the dropzone uploads through `apiUploadImage` and a
 * failure is rendered inline instead of being swallowed.
 */
export function ImageField({ label, value, onChange, folder = "marvel_content" }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const panelId = useId();

  const handleUpload = (url) => {
    setError("");
    setOpen(false);
    onChange(url || null);
  };

  const handleClear = () => {
    setError("");
    setOpen(false);
    onChange(null);
  };

  return (
    <fieldset className="form-group image-field">
      <legend className="form-label">{label}</legend>
      <span className="text-sm text-muted image-field-value">{value || "No image selected."}</span>
      <div className="image-field-actions">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Upload ${label}`}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={() => {
            setError("");
            setOpen((previous) => !previous);
          }}
        >
          Upload
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Clear ${label}`}
          onClick={handleClear}
          disabled={!value}
        >
          Clear
        </Button>
      </div>
      {open && (
        <div id={panelId}>
          <ImageUploadDropzone
            value={value || ""}
            onChange={handleUpload}
            folder={folder}
            upload={apiUploadImage}
            onError={setError}
          />
        </div>
      )}
      {error && (
        <p role="alert" className="form-error text-sm">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/** Up/down buttons for one item inside an ordered sibling group. */
export function OrderControls({ index, total, onMove, label, disabled = false }) {
  const suffix = label ? ` ${label}` : "";
  return (
    <span className="order-controls">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Move up${suffix}`}
        disabled={disabled || index <= 0}
        onClick={() => onMove?.(index, index - 1)}
      >
        <ArrowUp size={16} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Move down${suffix}`}
        disabled={disabled || index < 0 || index >= total - 1}
        onClick={() => onMove?.(index, index + 1)}
      >
        <ArrowDown size={16} />
      </Button>
    </span>
  );
}

/**
 * An on/off switch whose state is the row's `is_active`.
 *
 * The switch is named after the thing it controls, so the state is announced
 * as "Electronics, switch, on" rather than as a button that happens to be
 * pressed. The visible ON/OFF text is decoration for the eye; the state a
 * screen reader hears comes from `aria-checked`.
 */
export function ActiveToggle({ active, onChange, label }) {
  const isActive = Boolean(active);
  const itemName = String(label ?? "").trim() || "this item";
  return (
    <span className={`admin-active-toggle ${isActive ? "is-on" : "is-off"}`}>
      <Switch
        checked={isActive}
        onChange={(event) => onChange?.(event.target.checked)}
        slotProps={{ input: { "aria-label": itemName } }}
        title={`${isActive ? "Deactivate" : "Activate"} ${itemName}`}
      />
      <span className="admin-active-toggle-text" aria-hidden="true">
        {isActive ? "ON" : "OFF"}
      </span>
    </span>
  );
}

/** Text for one table cell; shared so every editor renders values the same way. */
export const cellValue = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
};

const humanize = (column) =>
  String(column)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

/** Compact table for the list-shaped editors; deletes go through AdminConfirmStrip. */
export function EditorTable({
  columns = [],
  rows = [],
  onEdit,
  onDelete,
  onToggleActive,
  rowLabel = (row) => row?.name ?? row?.title ?? row?.id,
}) {
  const [deleteTarget, setDeleteTarget] = useState(null);

  return (
    <>
      <div className="table-responsive-wrapper">
        <Table className="ui-table--cards">
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column} scope="col">
                  {humanize(column)}
                </TableHead>
              ))}
              <TableHead scope="col">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => {
              const rowId = row?.id ?? index;
              return (
                <TableRow key={rowId} data-testid={`editor-row-${rowId}`}>
                  {columns.map((column) => (
                    <TableCell key={column} data-label={humanize(column)}>
                      {cellValue(row?.[column])}
                    </TableCell>
                  ))}
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${rowLabel(row)}`}
                      onClick={() => onEdit?.(row)}
                    >
                      <Edit2 size={15} />
                    </Button>
                    <ActiveToggle
                      active={row?.is_active !== false}
                      label={rowLabel(row)}
                      onChange={(active) => onToggleActive?.(row, active)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${rowLabel(row)}`}
                      onClick={() => setDeleteTarget(row)}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <AdminConfirmStrip
        open={Boolean(deleteTarget)}
        title={`Delete '${deleteTarget ? rowLabel(deleteTarget) : "item"}'?`}
        message="This action cannot be undone."
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          const row = deleteTarget;
          setDeleteTarget(null);
          onDelete?.(row);
        }}
      />
    </>
  );
}
