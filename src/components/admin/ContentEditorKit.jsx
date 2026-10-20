import { useId, useState } from "react";
import { ArrowDown, ArrowUp, Edit2, Trash2 } from "lucide-react";
import { Button, ImageUploadDropzone } from "../ui";
import { apiUploadImage } from "../../api/contentApi";
import ConfirmDialog from "./ConfirmDialog";

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
    <fieldset className="form-group" style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
      <legend className="form-label">{label}</legend>
      <span className="text-sm text-muted image-field-value" style={{ overflowWrap: "anywhere" }}>
        {value || "No image selected."}
      </span>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
    <span className="order-controls" style={{ display: "inline-flex", gap: 4 }}>
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

/** A toggle button whose pressed state is the row's `is_active`. */
export function ActiveToggle({ active, onChange, label }) {
  const isActive = Boolean(active);
  const suffix = label ? ` ${label}` : "";
  return (
    <Button
      type="button"
      variant={isActive ? "primary" : "outline"}
      size="sm"
      aria-pressed={isActive}
      aria-label={`${isActive ? "Deactivate" : "Activate"}${suffix}`}
      onClick={() => onChange?.(!isActive)}
    >
      {isActive ? "Active" : "Hidden"}
    </Button>
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

/** Compact table for the list-shaped editors; deletes go through ConfirmDialog. */
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
      <table className="editor-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {humanize(column)}
              </th>
            ))}
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const rowId = row?.id ?? index;
            return (
              <tr key={rowId} data-testid={`editor-row-${rowId}`}>
                {columns.map((column) => (
                  <td key={column}>{cellValue(row?.[column])}</td>
                ))}
                <td>
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
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ConfirmDialog
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
