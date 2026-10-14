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
