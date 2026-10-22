import { SectionShell } from "./SectionShell";
import { renderMarkdown } from "./markdown";

/**
 * The rich text section: a block of markdown.
 *
 * The markdown is rendered into React elements — never into an HTML string —
 * so every character the admin typed is escaped by React.
 */
export default function RichTextSection({ body, align, style }) {
  const blocks = renderMarkdown(body);

  return (
    <SectionShell style={style} className="section-richtext">
      <div className={`section-prose section-prose--${align || "left"}`}>{blocks}</div>
    </SectionShell>
  );
}
