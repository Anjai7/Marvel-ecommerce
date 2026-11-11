import "./ui-table.css";

/**
 * The required-field mark.
 *
 * A single asterisk says the field is required. The mark is decorative — the
 * requirement itself is carried by the input's `required` attribute — so it
 * is hidden from assistive technology and cannot be read out on its own.
 */
export default function RequiredMark() {
  return (
    <span className="form-required" aria-hidden="true">
      *
    </span>
  );
}
