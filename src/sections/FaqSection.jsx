import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/ui/Accordion";
import { SectionShell } from "./SectionShell";

/**
 * The FAQ section: a list of question-and-answer pairs as an accessible
 * disclosure list.
 *
 * The Radix accordion gives every trigger a button with the right ARIA
 * wiring, so the list works with a keyboard and a screen reader.
 */
export default function FaqSection({ items, style }) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];

  if (!list.length) return null;

  return (
    <SectionShell style={style} className="section-faq">
      <Accordion type="single" collapsible className="section-faq__list">
        {list.map((item, index) => (
          <AccordionItem
            key={`${item?.question || "item"}-${index}`}
            value={`faq-${index}`}
            className="section-faq__item"
          >
            <AccordionTrigger className="section-faq__question">{item?.question}</AccordionTrigger>
            <AccordionContent className="section-faq__answer">{item?.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </SectionShell>
  );
}
