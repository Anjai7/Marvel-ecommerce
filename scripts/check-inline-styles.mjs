#!/usr/bin/env node
/**
 * Fail the build when a component goes back to inline styles.
 *
 * Inline `style={{…}}` cannot be found with a search and cannot be themed, so
 * every style that is not one-off geometry belongs in a stylesheet. This guard
 * keeps it that way: the panels, the shared primitives and the two dashboards
 * must carry named classes instead.
 *
 * Usage: node scripts/check-inline-styles.mjs [dir ...]
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

const DIRECTORIES = [
  "src/components/admin",
  "src/components/ui",
  "src/components/vendor",
  "src/components/customer",
];

const INLINE_STYLE = /style=\{\{/;

/**
 * A line may opt out with an `inline-style: allowed` comment — for the rare
 * style that is computed at runtime (a progress bar's width, a star rating's
 * fill) and has no class to stand in for it.
 */
const OPT_OUT = /inline-style:\s*allowed/;

/** Every source file under a directory, recursively. */
function* sourceFiles(directory) {
  const stack = [join(ROOT, directory)];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSync(current)) {
      const path = join(current, entry);
      if (statSync(path).isDirectory()) {
        stack.push(path);
        continue;
      }
      if (/\.(jsx?|mjs)$/.test(entry) && !/\.test\.[a-z]+$/.test(entry)) {
        yield path;
      }
    }
  }
}

const offenders = [];
for (const directory of process.argv.slice(2).length ? process.argv.slice(2) : DIRECTORIES) {
  for (const file of sourceFiles(directory)) {
    const contents = readFileSync(file, "utf8");
    contents.split("\n").forEach((line, index) => {
      if (INLINE_STYLE.test(line) && !OPT_OUT.test(line)) {
        offenders.push(`${relative(ROOT, file)}:${index + 1}`);
      }
    });
  }
}

if (offenders.length) {
  console.error(`Inline styles found in ${offenders.length} place(s):`);
  for (const offender of offenders) console.error(`  ${offender}`);
  console.error("\nMove each style into a named class in the area's stylesheet.");
  process.exit(1);
}

console.log("No inline styles outside one-off geometry.");
