import { SectionShell } from "./SectionShell";

/**
 * The spacer section: empty vertical space between two sections.
 *
 * The height is the `height` field, clamped to the range the schema allows
 * (8–320 px) so a hand-edited value cannot blow the page apart.
 */
export default function SpacerSection({ height, style }) {
  const value = Number(height);
  const size = Number.isFinite(value) ? Math.min(320, Math.max(8, value)) : 48;

  return (
    <SectionShell style={style} className="section-spacer">
      <div className="section-spacer__gap" style={{ height: `${size}px` }} aria-hidden="true" />
    </SectionShell>
  );
}
