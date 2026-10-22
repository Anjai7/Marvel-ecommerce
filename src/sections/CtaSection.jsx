import { SectionShell, SectionLink, safeHref } from "./SectionShell";

/**
 * The call-to-action section: a heading, a short message and one button.
 *
 * The body is plain text with its line breaks kept — the rich text section
 * is the one that speaks markdown.
 */
export default function CtaSection({ heading, body, button_label, button_href, align, style }) {
  const href = safeHref(button_href);
  const showButton = Boolean(button_label) && Boolean(href);

  return (
    <SectionShell style={style} className="section-cta">
      <div className={`section-cta__inner section-cta__inner--${align || "center"}`}>
        <h2 className="section-cta__heading">{heading}</h2>
        {body ? <p className="section-cta__body">{body}</p> : null}
        {showButton ? (
          <SectionLink href={href} variant="primary" size="lg" className="section-cta__button">
            {button_label}
          </SectionLink>
        ) : null}
      </div>
    </SectionShell>
  );
}
