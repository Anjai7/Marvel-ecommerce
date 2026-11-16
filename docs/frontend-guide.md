# The frontend guide

How the app is put together, and how to extend it without breaking anything.

If you are new to the project, read this after the [README](../README.md). It covers
the two surfaces, where the code and the styles live, the conventions every screen
follows, and a recipe for each kind of change.

---

## 1. Two surfaces

The app has two separate layouts that do not share a shell.

|            | The storefront                       | The admin console                              |
| ---------- | ------------------------------------ | ---------------------------------------------- |
| Who        | anyone                               | an admin, a super admin or a vendor            |
| Layout     | the page scrolls                     | a fixed sidebar and a scrolling content column |
| On a phone | one column                           | the sidebar becomes a drawer                   |
| Components | `src/components/` (the public parts) | `src/components/admin/`                        |
| Styles     | `src/styles/storefront/`             | `src/styles/admin/`                            |

The two dashboards (the customer portal and the vendor dashboard) have their own
layout again; their styles are in `src/styles/portals/`.

---

## 2. The styles

Every rule in the app lives in `src/styles/`. `src/main.jsx` imports
`src/styles/index.css` and that is the only stylesheet entry point: components never
import CSS.

```
src/styles/index.css        the entry point — imports every sheet in cascade order
src/styles/base/            tokens, the shell, the primitives, the responsive rules
src/styles/storefront/      the public screens
src/styles/admin/           the console
src/styles/portals/         the customer and vendor dashboards
src/styles/ui/              the primitives every screen shares
```

**The order in `index.css` is the cascade order.** A later sheet wins a tie, so the
list is deliberate: the base first, then the primitives, then the areas that
deliberately adjust what came before. When you add a sheet, add its `@import` where it
belongs in that order, and say why in the comment above it.

**Which sheet does a rule go in?**

| The rule is about                                                                    | It goes in        |
| ------------------------------------------------------------------------------------ | ----------------- |
| a token, the reset, the base type                                                    | `base/tokens.css` |
| the header, the footer, the home page, the product page, the cart, the sign-in pages | `storefront/…`    |
| the console's shell, an editor, a panel, a form                                      | `admin/…`         |
| the customer portal or the vendor dashboard                                          | `portals/…`       |
| a primitive every screen shares (a button, a table)                                  | `ui/…`            |

**Tokens, not literals.** Colours, radii, shadows and spacing come from the `:root`
block in `base/tokens.css`:

```
--navy --navy-dark --navy-light --navy-bg --orange --orange-dark --orange-light
--green --green-light --white --gray-50 … --gray-900
--radius-xs|sm|md|lg --shadow-xs|sm|md|lg|xl
```

A value with no token goes into the area's stylesheet as a rule — never as a hex inside
a component.

**No inline styles.** `npm run lint:styles` fails the build if a `style={{…}}` appears
anywhere in `src/`. The only exceptions are one-off geometry — a column count, a
spacer height — and the line says so with an `/* inline-style: allowed */` comment.

---

## 3. The shared primitives

`src/components/ui/` holds the primitives every screen uses, exported from one barrel:

```jsx
import { Button, Badge, Table, TableCell, Input, Switch, RequiredMark } from "../ui";
```

| Primitive                                                                           | For                                                                |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `Button` `Badge` `Card` `Input` `Rating` `Avatar` `Toast`                           | the everyday controls                                              |
| `Dialog` `DropdownMenu` `Popover` `Select` `Tooltip` `Tabs` `Accordion`             | overlays and disclosure                                            |
| `Table` `TableHeader` `TableBody` `TableRow` `TableHead` `TableCell` `TableCaption` | **every** table                                                    |
| `Switch`                                                                            | every on/off control (Material UI, brand colour applied with `sx`) |
| `RequiredMark`                                                                      | the `*` on a required field                                        |
| `SearchInput`                                                                       | every search field                                                 |
| `ImageUploadDropzone` `CommandSearch` `ProductPrice`                                | the rest                                                           |

**Build a control once.** If two screens need the same control, it belongs in
`src/components/ui/` — that is how the six search bars that had drifted apart became
one.

---

## 4. The conventions

### Tables

```jsx
<div className="table-responsive-wrapper">
  <Table className="ui-table--cards">
    <TableHeader>
      <TableRow>
        <TableHead scope="col">Name</TableHead>
        <TableHead scope="col" className="text-right">
          Actions
        </TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell>Plain Canvas Shoe</TableCell>
        <TableCell data-label="Price">₹1,499</TableCell>
        <TableCell>…</TableCell>
      </TableRow>
    </TableBody>
  </Table>
</div>
```

- `scope="col"` on every header.
- `data-label` on **every** cell that is not the first (the headline) or the last (the
  actions) — the label is what the card shows when the table becomes a stack of cards.
- The table becomes cards when the **column it sits in** is narrower than 880px, not
  when the window is narrow: the console keeps a 280px sidebar, so a table can fit the
  screen and still be too wide for its column. The rule is a container query in
  `src/styles/ui/table.css`.

### Forms

- A required field is marked with `<RequiredMark />` — a single `*`, never
  "(Mandatory)". An optional field is unmarked.
- The input carries `required` so the requirement is announced, and `aria-required`
  when the form's own validation handles the message.
- Every input has a real `<label htmlFor>`.
- The console's forms are one column by default and two at ≥900px
  (`.admin-inline-form`).

### The admin editors

An editor renders **in the page**, not in a popup. `AdminInlinePanel` is the panel an
editor opens in, and `AdminConfirmStrip` is how a destructive write is confirmed —
beside the list it acts on, never in a modal over it.

### Empty and loading states

A screen that has nothing to show says so in words. It never invents a price, a
rating, an offer or a placeholder row.

### The product options

A product may carry options — colour, size, capacity, storage, material, style,
weight, flavour — and variants, the sellable combinations with their own price, stock
and SKU. The kinds live in `src/lib/productOptions.js` and the server's copy in
`server/lib/productOptions.js`; a unit test asserts the two lists never drift apart.
The whole contract is in
**[product-variants-contract.md](product-variants-contract.md)**.

---

## 5. Responsive and touch

The breakpoints the app uses — do not invent new ones:

| Width           | Meaning                                        |
| --------------- | ---------------------------------------------- |
| 1280 / 1100     | wide desktop, the content gets a maximum width |
| 1024            | the console's sidebar becomes a drawer         |
| 900             | a two-column form becomes one column           |
| 768             | tablet                                         |
| 640 / 600 / 560 | small tablet, large phone                      |
| 480 / 380       | phone                                          |

**Break on the content, not on the device name.** A grid becomes one column when the
content no longer fits.

**Touch targets.** On a coarse pointer a control is at least 44×44px, and at least
32×32px for an icon-only one. The sizes that make the console dense belong behind
`@media (pointer: coarse)`, so a desktop mouse keeps the density it has.

**Nothing overflows.** At every width `document.documentElement.scrollWidth -
window.innerWidth` must be ≤ 1. The causes, in the order they usually turn up: a fixed
`width` or `min-width` on a container (use `max-width` and `flex`), a grid with fixed
columns (`repeat(auto-fit, minmax(min(100%, 260px), 1fr))`), a wide table (wrap it in
`.table-responsive-wrapper`) and a negative margin or `100vw` (the scrollbar adds
15px — use `width: 100%`).

---

## 6. Accessibility

- Every input has a label; every icon-only control has an `aria-label`.
- Contrast is at least 4.5:1 for text.
- The focus is always visible — never `outline: none` without a replacement ring.
- A toggle is `role="switch"` with a **static** accessible name; a name that flips
  with the state is a bug.
- `prefers-reduced-motion` is honoured (`src/styles/base/motion.css`).
- The Playwright suite runs axe over the storefront and the console.

---

## 7. Data and state

**One client per area.** `src/api/` holds the client for every endpoint — the store
never calls `fetch` directly. A new endpoint gets a function in the right module and a
test.

**Three contexts.** `AuthContext` (who is signed in), `CartContext` (the cart, in
`localStorage`) and `ContentContext` (the content the storefront renders). The console
fetches its own data with `useEffect` and keeps it in component state.

**The cart identifies a line by the product _and_ the combination.** Two colours of the
same product are two lines; the same combination added twice is one line with a bigger
quantity. `CartContext` handles that — do not key a cart line by the product id alone.

**Routing** is in `src/lib/routes.js`: the path table, the guards and the
menu-path mapping. A new page is registered there.

---

## 8. Recipes

### Add a screen

1. The component goes in the area's folder (`src/components/product/`, `src/components/admin/`).
2. The route goes in `src/lib/routes.js`.
3. The styles go in the area's sheet.
4. A Vitest test for the component, and a Playwright check if it is a flow.

### Add a column to a console table

1. The cell in the component, with a `data-label` that matches the header wording.
2. The header in the same table.
3. If the column is data the server does not send yet, the API shape first
   (`server/routes/…`), then the client function in `src/api/`.

### Add an admin editor

1. A component in `src/components/admin/` that reads and writes through
   `src/api/contentApi.js` (or the area's API module).
2. It renders inside `AdminInlinePanel`.
3. A row in the console's sidebar (`UnifiedAdminConsole.jsx`) with an `id` of
   `admin-tab-<area>-<name>`.
4. Its styles in `src/styles/admin/`.

### Add a design token

1. Add it to the `:root` block in `src/styles/base/tokens.css`.
2. Use it — do not write the hex at the call site.

---

## 9. Tests

- **Vitest** for units and components: `src/**/*.test.jsx`. A behaviour change needs a
  test; a change that only moves markup needs the existing test to still pass.
- **Playwright** for flows: `tests/*.spec.js`. The responsive specs walk the storefront
  and the console at every width and fail if anything overflows or is cut off.

Run `npm run check` before you commit; the pre-commit and pre-push hooks run it for you.
