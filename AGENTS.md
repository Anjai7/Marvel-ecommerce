# Marvel E-Commerce Project Instructions

## Stack

- Frontend: React 19, Vite 8, JavaScript/JSX, Radix UI, Lucide, plain CSS.
- Backend: Express, Supabase, Cloudinary; Vercel serverless configuration is in `vercel.json`.
- Quality: Oxlint, Prettier, Vitest, Testing Library, Playwright, axe-core, Knip, and Lefthook.
- Runtime: Node.js 22.12 or newer with npm 10 or newer.

## Commands

- `npm run dev:all` — run the API and Vite together on Windows, macOS, or Linux.
- `npm run check` — run Oxlint, unit/component tests, and the production build.
- `npm run test:e2e` — run browser and accessibility checks, retaining failure traces, screenshots, and videos.
- `npm run build:analyze` — create `dist/bundle-report.html` for bundle inspection.
- `npm run analyze:unused` — report unused files, exports, and dependencies with Knip.
- `npm run audit` — fail on high or critical npm vulnerabilities.

## Working Rules

- Keep changes focused; do not reformat unrelated files or perform framework migrations unless requested.
- Preserve `.env` files and never print, commit, or copy secrets into logs or documentation.
- Do not edit `dist/`; it is generated output.
- Use project-local tooling through npm scripts rather than assuming global CLIs.
- For UI work, verify the relevant viewport in a real browser and run targeted Playwright checks.
- Add or update tests for behavior changes. Keep unit tests fast and use Playwright for full browser flows.
- Consult current version-matched documentation before using unfamiliar library APIs.
- Run the narrowest relevant check while iterating and `npm run check` before finishing.

## Where things live

- **Every stylesheet is in `src/styles/`.** `src/main.jsx` imports `src/styles/index.css`
  and that is the only entry point — components never import CSS. The order in
  `index.css` is the cascade order and is deliberate: a later sheet wins a tie.
  Add a rule to the sheet for its area (`base/`, `storefront/`, `admin/`, `portals/`,
  `ui/`).
- **No inline styles.** `npm run lint:styles` fails the build if a `style={{…}}` appears
  anywhere in `src/`. The only exceptions are one-off geometry, and the line says so
  with an `/* inline-style: allowed */` comment.
- **One table structure.** Every table is built from the `Table` parts in
  `src/components/ui/Table.jsx` and lives in a `.table-responsive-wrapper`. A table
  becomes cards when its column is narrower than 880px, so every cell that is not the
  headline or the actions carries a `data-label`.
- **Shared primitives** live in `src/components/ui/` and are imported from the barrel.
- **The documentation index** is `docs/README.md`; the frontend guide is
  `docs/frontend-guide.md`.
