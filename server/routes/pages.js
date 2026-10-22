/**
 * The CMS pages API.
 *
 * A page is a slug, an editorial lifecycle and an ordered list of sections.
 * This router owns three contracts:
 *
 *   1. **Visibility** — a page is public only when it is `published` *and* it
 *      is inside its schedule window (`scheduled_at` null or reached,
 *      `expired_at` null or still ahead). A page that is not public answers
 *      `404 { error: "Page not found." }` exactly like a page that does not
 *      exist, so a visitor can never tell a draft from a missing page.
 *   2. **Preview** — `?preview=1` reveals a draft to an admin and to nobody
 *      else. A preview that is not authorised is **not** a 401 or a 403: it
 *      falls through to the public check, so the answer is the same 404.
 *   3. **Columns** — a write touches the whitelisted columns only. `id`,
 *      `created_at` and `updated_at` belong to the database.
 *
 * The router is hand-rolled rather than built with `createCrudRouter` because
 * the CRUD factory cannot express the slug uniqueness check, the public
 * visibility predicate or the two-pass position rewrite. This is the same
 * reason `server/routes/categories.js` hand-rolls its routes.
 *
 * The house error convention applies throughout: the raw database message is
 * logged with `console.error`, and the caller receives a generic string.
 */

import express from "express";
import { supabase } from "../db.js";
import { adminGuards, includesInactive, inactiveRefused } from "../lib/guards.js";
import { isPublicPage, validatePage } from "../lib/pageRules.js";
import { normalizeSections, SECTION_MAX, validateSection } from "../lib/sectionTypes.js";

const READ_ERROR = "Could not load pages.";
const SAVE_ERROR = "Could not save the page.";
const DELETE_ERROR = "Could not delete the page.";
const NOT_FOUND = "Page not found.";
const DUPLICATE_SLUG_ERROR = "A page with this slug already exists.";
const FOREIGN_SECTION_ERROR = "A section does not belong to this page.";
const REPEATED_SECTION_ERROR = "A section may not appear twice.";
const SECTIONS_SAVED_MESSAGE = "Sections saved.";

/**
 * The only columns a write may touch.
 *
 * The whitelist is the guarantee that a PATCH cannot set an arbitrary column:
 * `id`, `created_at` and `updated_at` belong to the database, and `sections`
 * live in their own table.
 */
const PAGE_COLUMNS = Object.freeze([
  "slug",
  "title",
  "description",
  "kind",
  "template",
  "status",
  "published_at",
  "scheduled_at",
  "expired_at",
  "category_id",
  "seo",
]);

/** The values of a query flag that mean "off". */
const FALSE_FLAGS = Object.freeze(["0", "false", "off", "no"]);

/**
 * The public visibility predicate, re-exported under the name the storefront
 * contract uses, so there is one import site for "is this page visible?".
 *
 * It is the same predicate as `isPublicPage` in `server/lib/pageRules.js`,
 * which the migration's RLS policy mirrors.
 */
export function isPublicPageRow(row, now = new Date()) {
  return isPublicPage(row, now);
}

/** True when a query flag asks for something other than the default. */
function flagEnabled(value) {
  if (value === undefined || value === null) return false;
  return !FALSE_FLAGS.includes(String(value).trim().toLowerCase());
}

/** True when the request asks for a preview of an unpublished page. */
function wantsPreview(req) {
  return flagEnabled(req.query.preview);
}

/**
 * The public visibility predicate, expressed in PostgREST.
 *
 * `published` AND (no schedule OR the schedule has been reached) AND (no
 * expiry OR the expiry is still ahead). PostgREST combines the two `or`
 * filters with AND, so the three filters express the whole rule.
 */
function applyPublicVisibility(query, now = new Date()) {
  const nowIso = now.toISOString();
  let next = query.eq("status", "published");
  next = next.or(`scheduled_at.is.null,scheduled_at.lte.${nowIso}`);
  next = next.or(`expired_at.is.null,expired_at.gt.${nowIso}`);
  return next;
}

/** Escape the LIKE wildcards, so a slug cannot match every row. */
function escapeLike(value) {
  return String(value ?? "").replace(/[\\%_]/g, (character) => `\\${character}`);
}

/**
 * True when the request carries an admin token.
 *
 * The write guards answer `401`/`403`, but a preview must not: an unauthorised
 * preview has to look exactly like a page that does not exist. The guards
 * therefore run against a response that swallows their answer, and a failure
 * simply means "not an admin".
 */
async function hasAdminToken(req) {
  return new Promise((resolve) => {
    const silent = {
      answered: false,
      headersSent: false,
      writableEnded: false,
      status() {
        return silent;
      },
      json() {
        silent.answered = true;
        return silent;
      },
      send() {
        silent.answered = true;
        return silent;
      },
      setHeader() {
        return silent;
      },
      end() {
        silent.answered = true;
        return silent;
      },
    };

    let index = 0;
    const next = (error) => {
      if (error) {
        resolve(false);
        return;
      }

      const guard = adminGuards[index];
      index += 1;
      if (!guard) {
        resolve(true);
        return;
      }

      try {
        guard(req, silent, next);
      } catch {
        resolve(false);
        return;
      }
      if (silent.answered) resolve(false);
    };

    next();
  });
}

/**
 * The write payload: the whitelisted columns the body carries.
 *
 * Unknown keys are ignored — never written and never rejected — so the
 * whitelist is what keeps a request from touching a column the API does not
 * own.
 */
function toPayload(body = {}) {
  const payload = {};
  for (const column of PAGE_COLUMNS) {
    if (Object.hasOwn(body, column) && body[column] !== undefined) payload[column] = body[column];
  }
  return payload;
}

/** True when the database refused the write because a unique index collided. */
function isUniqueViolation(error) {
  if (!error) return false;
  if (error.code === "23505") return true;
  return /duplicate key|unique constraint/i.test(String(error.message ?? ""));
}

/**
 * The sections of one page, ordered by position, or null when the read failed.
 *
 * `enabledOnly` drops the disabled rows: the storefront renders what the
 * editor enabled. The admin read keeps them, because the editor has to be
 * able to switch one back on.
 */
async function loadSections(pageId, { enabledOnly = true } = {}) {
  const { data, error } = await supabase
    .from("page_sections")
    .select("*")
    .eq("page_id", pageId)
    .order("position", { ascending: true });

  if (error) {
    console.error("Supabase page sections read error:", error.message);
    return null;
  }

  const rows = data ?? [];
  return enabledOnly ? rows.filter((row) => row.enabled !== false) : rows;
}

const router = express.Router();

/* -------------------------------------------------------------------------- */
/* The public list                                                             */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/pages — the list.
 *
 * A public request sees only the pages the visibility rule allows. An admin
 * sees the whole editorial list; `?includeInactive=1` is honoured only when
 * the admin guard passes, exactly like the other content lists.
 */
router.get("/", async (req, res) => {
  const withInactive = await includesInactive(req, res);
  if (!withInactive && inactiveRefused(req, res)) return undefined;

  const privileged = withInactive || (await hasAdminToken(req));

  try {
    let query = supabase.from("pages").select("*");
    if (!privileged) query = applyPublicVisibility(query);

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) {
      console.error("Supabase pages list error:", error.message);
      return res.status(500).json({ error: READ_ERROR });
    }
    return res.json({ pages: data ?? [] });
  } catch (thrown) {
    console.error("Supabase pages list exception:", thrown.message);
    return res.status(500).json({ error: READ_ERROR });
  }
});

/* -------------------------------------------------------------------------- */
/* The public reads                                                            */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/pages/slug/:slug — one page and its sections.
 *
 * The row is loaded by its slug and then checked against the visibility rule.
 * A missing row and a hidden row answer the same 404, so nothing leaks the
 * title of an unpublished page.
 */
router.get("/slug/:slug", async (req, res) => {
  const slug = String(req.params.slug ?? "")
    .trim()
    .toLowerCase();
  const privileged = wantsPreview(req) ? await hasAdminToken(req) : false;

  try {
    const { data: page, error } = await supabase
      .from("pages")
      .select("*")
      .ilike("slug", escapeLike(slug))
      .maybeSingle();

    if (error) {
      console.error("Supabase pages read error:", error.message);
      return res.status(500).json({ error: READ_ERROR });
    }

    if (!page || (!privileged && !isPublicPageRow(page))) {
      return res.status(404).json({ error: NOT_FOUND });
    }

    const sections = await loadSections(page.id);
    if (!sections) return res.status(500).json({ error: READ_ERROR });

    // The envelope the storefront contract asks for (`{ page, sections }`),
    // with the page's own fields also at the top level, so a client that does
    // not unwrap the envelope still sees `slug`, `seo` and `title`.
    return res.json({ ...page, page, sections });
  } catch (thrown) {
    console.error("Supabase pages read exception:", thrown.message);
    return res.status(500).json({ error: READ_ERROR });
  }
});

/**
 * GET /api/pages/slug/:slug/version — lightweight version check.
 *
 * Answers with { updatedAt: ISOString } or 404. Used by browsers to detect
 * when an admin publishes or edits a page, without having to fetch the full
 * payload or database sections.
 */
router.get("/slug/:slug/version", async (req, res) => {
  const slug = String(req.params.slug ?? "")
    .trim()
    .toLowerCase();
  const privileged = wantsPreview(req) ? await hasAdminToken(req) : false;

  try {
    const { data: page, error } = await supabase
      .from("pages")
      .select("id, slug, status, updated_at, published_at, scheduled_at, expired_at")
      .ilike("slug", escapeLike(slug))
      .maybeSingle();

    if (error) {
      console.error("Supabase pages version check error:", error.message);
      return res.status(500).json({ error: READ_ERROR });
    }

    if (!page || (!privileged && !isPublicPageRow(page))) {
      return res.status(404).json({ error: NOT_FOUND });
    }

    return res.json({
      slug: page.slug,
      updatedAt: page.updated_at || page.published_at || null,
    });
  } catch (thrown) {
    console.error("Supabase pages version check exception:", thrown.message);
    return res.status(500).json({ error: READ_ERROR });
  }
});

/**
 * GET /api/pages/category/:categoryId — the page bound to one category.
 *
 * A category without a custom page is a normal case, not an error: the answer
 * is `200` with a `null` body. A category whose page exists but is not
 * public answers the same 404 as a missing page.
 */
router.get("/category/:categoryId", async (req, res) => {
  const categoryId = String(req.params.categoryId ?? "").trim();
  const privileged = wantsPreview(req) ? await hasAdminToken(req) : false;

  try {
    const { data: page, error } = await supabase
      .from("pages")
      .select("*")
      .eq("category_id", categoryId)
      .maybeSingle();

    if (error) {
      console.error("Supabase pages category read error:", error.message);
      return res.status(500).json({ error: READ_ERROR });
    }

    if (!page) return res.json(null);

    if (!privileged && !isPublicPageRow(page)) {
      return res.status(404).json({ error: NOT_FOUND });
    }

    const sections = await loadSections(page.id);
    if (!sections) return res.status(500).json({ error: READ_ERROR });

    return res.json({ ...page, sections });
  } catch (thrown) {
    console.error("Supabase pages category read exception:", thrown.message);
    return res.status(500).json({ error: READ_ERROR });
  }
});

/* -------------------------------------------------------------------------- */
/* The admin reads and writes                                                  */
/* -------------------------------------------------------------------------- */

/** GET /api/pages/:id — one page with every section, including the disabled ones. */
router.get("/:id", ...adminGuards, async (req, res) => {
  try {
    const { data: page, error } = await supabase
      .from("pages")
      .select("*")
      .eq("id", req.params.id)
      .maybeSingle();

    if (error) {
      console.error("Supabase pages admin read error:", error.message);
      return res.status(500).json({ error: READ_ERROR });
    }
    if (!page) return res.status(404).json({ error: NOT_FOUND });

    const sections = await loadSections(page.id, { enabledOnly: false });
    if (!sections) return res.status(500).json({ error: READ_ERROR });

    return res.json({ page, sections });
  } catch (thrown) {
    console.error("Supabase pages admin read exception:", thrown.message);
    return res.status(500).json({ error: READ_ERROR });
  }
});

/**
 * POST /api/pages — create a page.
 *
 * The page is a draft until it is published. A slug that is already taken is
 * refused by the unique index and answered with a 409.
 */
router.post("/", ...adminGuards, async (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};

  const validationError = validatePage(body);
  if (validationError) return res.status(400).json({ error: validationError });

  const payload = toPayload(body);
  if (payload.status === undefined) payload.status = "draft";

  try {
    const { data, error } = await supabase.from("pages").insert(payload).select().single();

    if (error) {
      if (isUniqueViolation(error)) {
        console.error("Supabase pages insert conflict:", error.message);
        return res.status(409).json({ error: DUPLICATE_SLUG_ERROR });
      }
      console.error("Supabase pages insert error:", error.message);
      return res.status(500).json({ error: SAVE_ERROR });
    }

    return res.status(201).json({ message: "Page created successfully.", page: data ?? null });
  } catch (thrown) {
    console.error("Supabase pages insert exception:", thrown.message);
    return res.status(500).json({ error: SAVE_ERROR });
  }
});

/**
 * PATCH /api/pages/:id — update the metadata.
 *
 * Only the whitelisted columns the body carries are written; the database
 * owns `id`, `created_at` and `updated_at`.
 */
router.patch("/:id", ...adminGuards, async (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};

  const validationError = validatePage(body, { partial: true });
  if (validationError) return res.status(400).json({ error: validationError });

  const id = req.params.id;

  try {
    const { data: existing, error: readError } = await supabase
      .from("pages")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (readError) {
      console.error("Supabase pages read error:", readError.message);
      return res.status(500).json({ error: READ_ERROR });
    }
    if (!existing) return res.status(404).json({ error: NOT_FOUND });

    const patch = toPayload(body);
    if (Object.keys(patch).length === 0) {
      return res.json({ message: "Page saved successfully.", page: existing });
    }

    const { data, error } = await supabase
      .from("pages")
      .update(patch)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        console.error("Supabase pages update conflict:", error.message);
        return res.status(409).json({ error: DUPLICATE_SLUG_ERROR });
      }
      console.error("Supabase pages update error:", error.message);
      return res.status(500).json({ error: SAVE_ERROR });
    }

    return res.json({ message: "Page saved successfully.", page: data ?? existing });
  } catch (thrown) {
    console.error("Supabase pages update exception:", thrown.message);
    return res.status(500).json({ error: SAVE_ERROR });
  }
});

/**
 * DELETE /api/pages/:id — delete the page and its sections.
 *
 * The sections go first: the foreign key cascades, but an explicit delete
 * keeps the route correct without relying on the cascade.
 */
router.delete("/:id", ...adminGuards, async (req, res) => {
  const id = req.params.id;

  try {
    const { data: existing, error: readError } = await supabase
      .from("pages")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (readError) {
      console.error("Supabase pages read error:", readError.message);
      return res.status(500).json({ error: READ_ERROR });
    }
    if (!existing) return res.status(404).json({ error: NOT_FOUND });

    const { error: sectionError } = await supabase.from("page_sections").delete().eq("page_id", id);
    if (sectionError) {
      console.error("Supabase page sections delete error:", sectionError.message);
      return res.status(500).json({ error: DELETE_ERROR });
    }

    const { error } = await supabase.from("pages").delete().eq("id", id);
    if (error) {
      console.error("Supabase pages delete error:", error.message);
      return res.status(500).json({ error: DELETE_ERROR });
    }

    return res.json({ message: "Page deleted successfully." });
  } catch (thrown) {
    console.error("Supabase pages delete exception:", thrown.message);
    return res.status(500).json({ error: DELETE_ERROR });
  }
});

/**
 * PUT /api/pages/:id/sections — replace the whole ordered section list.
 *
 * The body is `{ sections: [{ id?, type, enabled?, data?, style? }] }`. The
 * submitted order is authoritative: the sections come back in that order and
 * their `position` is the index in the array.
 */
router.put("/:id/sections", ...adminGuards, async (req, res) => {
  const id = req.params.id;
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const submitted = Array.isArray(body.sections) ? body.sections : null;

  if (!submitted) {
    return res.status(400).json({ error: "sections must be an array." });
  }
  if (submitted.length > SECTION_MAX) {
    return res.status(400).json({
      error: `A page may hold at most ${SECTION_MAX} sections.`,
    });
  }

  // Every section is validated before the database is touched, so a rejected
  // list writes nothing at all.
  const errors = [];
  const accepted = [];
  for (const entry of submitted) {
    const result = validateSection(entry);
    if (!result.ok) {
      errors.push(...result.errors);
      continue;
    }
    accepted.push({ source: entry, data: result.data, style: result.style });
  }
  if (errors.length) {
    return res.status(400).json({ error: errors[0], errors: errors.slice(0, 5) });
  }

  // The stored sections carry the defaults of their type, so the renderer
  // never has to guess what an absent field means.
  const wanted = normalizeSections(
    accepted.map((entry) => ({ ...entry.source, data: entry.data, style: entry.style }))
  );

  try {
    const existing = await loadSections(id, { enabledOnly: false });
    if (!existing) return res.status(500).json({ error: READ_ERROR });

    const existingIds = new Set(existing.map((row) => row.id));
    const keptIds = wanted.map((section) => section.id).filter(Boolean);

    if (keptIds.some((sectionId) => !existingIds.has(sectionId))) {
      return res.status(400).json({ error: FOREIGN_SECTION_ERROR });
    }
    if (new Set(keptIds).size !== keptIds.length) {
      return res.status(400).json({ error: REPEATED_SECTION_ERROR });
    }

    const kept = new Set(keptIds);

    // The rows that are no longer submitted go away.
    const removed = existing.filter((row) => !kept.has(row.id)).map((row) => row.id);
    if (removed.length) {
      const { error } = await supabase.from("page_sections").delete().in("id", removed);
      if (error) {
        console.error("Supabase page sections delete error:", error.message);
        return res.status(500).json({ error: SAVE_ERROR });
      }
    }

    // The unique index on (page_id, position) means a single in-place move can
    // collide mid-flight: the row that takes over a position still holds it.
    // Two passes fix that. First every remaining row goes negative, so no
    // positive target is occupied; then each row takes its final position.
    const retained = existing.filter((candidate) => kept.has(candidate.id));
    if (retained.length) {
      // The negative targets are taken below the lowest current position, so
      // the pass cannot collide with a value another row still holds.
      const lowest = Math.max(...retained.map((row) => Number(row.position ?? 0))) + 1;
      for (const [index, row] of retained.entries()) {
        const { error } = await supabase
          .from("page_sections")
          .update({ position: -(lowest + index) })
          .eq("id", row.id);
        if (error) {
          console.error("Supabase page sections position error:", error.message);
          return res.status(500).json({ error: SAVE_ERROR });
        }
      }
    }

    const saved = [];
    for (const [position, section] of wanted.entries()) {
      const row = {
        type: section.type,
        position,
        enabled: section.enabled !== false,
        data: section.data,
        style: section.style,
      };

      if (section.id) {
        const { data, error } = await supabase
          .from("page_sections")
          .update(row)
          .eq("id", section.id)
          .select()
          .single();
        if (error) {
          console.error("Supabase page sections update error:", error.message);
          return res.status(500).json({ error: SAVE_ERROR });
        }
        saved.push(data ?? { id: section.id, page_id: id, ...row });
        continue;
      }

      const { data, error } = await supabase
        .from("page_sections")
        .insert({ ...row, page_id: id })
        .select()
        .single();
      if (error) {
        console.error("Supabase page sections insert error:", error.message);
        return res.status(500).json({ error: SAVE_ERROR });
      }
      saved.push(data ?? { id: null, page_id: id, ...row });
    }

    // Touch the parent page's updated_at timestamp so clients observing version changes
    // detect section alterations immediately.
    await supabase.from("pages").update({ updated_at: new Date().toISOString() }).eq("id", id);

    return res.json({ message: SECTIONS_SAVED_MESSAGE, sections: saved });
  } catch (thrown) {
    console.error("Supabase page sections save exception:", thrown.message);
    return res.status(500).json({ error: SAVE_ERROR });
  }
});

/**
 * POST /api/pages/:id/publish — publish, or schedule.
 *
 * The page is always `published`: the schedule is expressed with the
 * timestamp, not with a status value, so the page becomes visible on its own
 * when the clock passes `scheduled_at` — no worker, no forgotten flip.
 * The response carries the derived `scheduled` flag so the admin UI does not
 * have to do date arithmetic.
 */
router.post("/:id/publish", ...adminGuards, async (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};

  const schedule = {};
  for (const field of ["scheduled_at", "expired_at"]) {
    if (Object.hasOwn(body, field) && body[field] !== undefined) schedule[field] = body[field];
  }

  const validationError = validatePage(schedule, { partial: true });
  if (validationError) return res.status(400).json({ error: validationError });

  const now = new Date();
  const scheduledAt = schedule.scheduled_at ?? null;
  const expiredAt = schedule.expired_at ?? null;

  const patch = {
    status: "published",
    published_at: now.toISOString(),
    // A publish without a schedule goes live now, so a stale schedule is
    // cleared rather than left to hide the page.
    scheduled_at: scheduledAt,
    // The expiry is cleared unless the caller supplied one.
    expired_at: expiredAt,
  };

  try {
    const { data, error } = await supabase
      .from("pages")
      .update(patch)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) {
      console.error("Supabase pages publish error:", error.message);
      return res.status(500).json({ error: SAVE_ERROR });
    }
    if (!data) return res.status(404).json({ error: NOT_FOUND });

    const scheduled = scheduledAt !== null && Date.parse(scheduledAt) > now.getTime();
    return res.json({ message: "Page published successfully.", page: data, scheduled });
  } catch (thrown) {
    console.error("Supabase pages publish exception:", thrown.message);
    return res.status(500).json({ error: SAVE_ERROR });
  }
});

/** POST /api/pages/:id/unpublish — back to draft. */
router.post("/:id/unpublish", ...adminGuards, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("pages")
      .update({ status: "draft", published_at: null })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) {
      console.error("Supabase pages unpublish error:", error.message);
      return res.status(500).json({ error: SAVE_ERROR });
    }
    if (!data) return res.status(404).json({ error: NOT_FOUND });

    return res.json({ message: "Page unpublished successfully.", page: data });
  } catch (thrown) {
    console.error("Supabase pages unpublish exception:", thrown.message);
    return res.status(500).json({ error: SAVE_ERROR });
  }
});

export default router;
