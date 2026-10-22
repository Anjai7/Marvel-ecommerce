/**
 * The markdown-subset renderer.
 *
 * `renderMarkdown` returns an **array of React elements** — never an HTML
 * string. Every text run is a React text child, so React escapes it and a
 * stored page can never inject markup. There is no raw-HTML escape hatch
 * anywhere in this feature, so XSS through a section is structurally
 * impossible.
 *
 * The supported subset:
 *
 *   `#` / `##` / `###`  headings
 *   a blank line         the block separator
 *   `- `                 an unordered list
 *   `1. `                an ordered list
 *   `> `                 a block quote
 *   anything else        a paragraph
 *
 * and inside a run: `**bold**`, `*italic*`, `` `code` `` and `[label](href)`.
 *
 * A link's href goes through `safeHref`: an unsafe href (`javascript:`,
 * `data:`, a protocol-relative `//host`) is dropped and the label is rendered
 * as plain text with no anchor.
 *
 * The elements are built with `React.createElement` rather than JSX: this
 * module is a `.js` file, and the bundler's JavaScript transform does not
 * parse JSX in a `.js` file.
 */

import React from "react";
import { safeHref } from "./SectionShell";

const h = React.createElement;

// A link: `[label](href)`. The href may hold one level of parentheses, so
// `[x](javascript:alert(1))` is read as one link and not as a link plus a
// stray bracket.
const LINK_TOKEN = /^\[([^\]]*)\]\(((?:[^()\s]|\([^()\s]*\))*)\)$/;

const INLINE_PATTERN =
  /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]\n]*\]\((?:[^()\s]|\([^()\s]*\))*\))/g;

const HEADING_PATTERN = /^(#{1,3})\s+(.*)$/;
const UNORDERED_PATTERN = /^\s*[-*]\s+(.*)$/;
const ORDERED_PATTERN = /^\s*\d+[.)]\s+(.*)$/;
const QUOTE_PATTERN = /^\s*>\s?(.*)$/;

/** Render one inline token — bold, italic, code or a link. */
function renderToken(token, key) {
  if (token.startsWith("**") && token.endsWith("**")) {
    return h("strong", { key }, renderInline(token.slice(2, -2), key));
  }
  if (token.startsWith("*") && token.endsWith("*")) {
    return h("em", { key }, renderInline(token.slice(1, -1), key));
  }
  if (token.startsWith("`") && token.endsWith("`")) {
    return h("code", { key }, token.slice(1, -1));
  }

  const link = LINK_TOKEN.exec(token);
  if (link) {
    const [, label, href] = link;
    const safe = safeHref(href);
    // An unsafe href renders the label as plain text — no anchor at all.
    if (!safe) return label;
    return h("a", { key, href: safe, className: "section-prose-link" }, renderInline(label, key));
  }

  return token;
}

/**
 * Render one inline run into a mix of text children and elements.
 *
 * `matchAll` copies the pattern, so the recursive call inside a link label
 * cannot disturb the iteration of the outer run.
 */
function renderInline(text, keyPrefix) {
  const nodes = [];
  let cursor = 0;
  for (const match of text.matchAll(INLINE_PATTERN)) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    nodes.push(renderToken(match[0], `${keyPrefix}-${match.index}`));
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

/** Render one block — a heading, a list, a quote or a paragraph. */
function renderBlock(block, key) {
  const lines = block.split("\n");

  const heading = HEADING_PATTERN.exec(lines[0]);
  if (heading) {
    const level = heading[1].length;
    return h(
      `h${level}`,
      { key, className: `section-prose-h${level}` },
      renderInline(heading[2], key)
    );
  }

  if (lines.length > 0 && lines.every((line) => UNORDERED_PATTERN.test(line))) {
    return h(
      "ul",
      { key, className: "section-prose-list section-prose-list--unordered" },
      lines.map((line, index) =>
        h(
          "li",
          { key: `${key}-${index}` },
          renderInline(UNORDERED_PATTERN.exec(line)[1], `${key}-${index}`)
        )
      )
    );
  }

  if (lines.length > 0 && lines.every((line) => ORDERED_PATTERN.test(line))) {
    return h(
      "ol",
      { key, className: "section-prose-list section-prose-list--ordered" },
      lines.map((line, index) =>
        h(
          "li",
          { key: `${key}-${index}` },
          renderInline(ORDERED_PATTERN.exec(line)[1], `${key}-${index}`)
        )
      )
    );
  }

  if (lines.length > 0 && lines.every((line) => QUOTE_PATTERN.test(line))) {
    return h(
      "blockquote",
      { key, className: "section-prose-quote" },
      lines.map((line, index) =>
        h(
          "p",
          { key: `${key}-${index}`, className: "section-prose-p" },
          renderInline(QUOTE_PATTERN.exec(line)[1], `${key}-${index}`)
        )
      )
    );
  }

  return h("p", { key, className: "section-prose-p" }, renderInline(lines.join(" "), key));
}

/**
 * Render a markdown string into an array of React elements.
 *
 * An empty or non-string input returns an empty array, so the caller can
 * render the result directly.
 */
export function renderMarkdown(markdown) {
  const text = typeof markdown === "string" ? markdown : "";
  if (!text.trim()) return [];

  const blocks = text.replace(/\r\n?/g, "\n").split(/\n{2,}/);
  const elements = [];
  blocks.forEach((block, index) => {
    const trimmed = block.trim();
    if (!trimmed) return;
    elements.push(renderBlock(trimmed, `md-${index}`));
  });
  return elements;
}
