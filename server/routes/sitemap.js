/**
 * The sitemap and the robots file.
 *
 * The sitemap lists the pages the public visibility rule allows: published,
 * inside the schedule window, and not expired. It uses the same predicate as
 * `GET /api/pages`, so a draft never reaches a crawler.
 *
 * The URLs are **clean** URLs (`/pages/<slug>`), not hash URLs: a hash URL is
 * not sent to the server and is not part of the HTTP resource identity, so
 * every entry in a hash-based sitemap would resolve to the same document.
 *
 * The two routers are exported by name because `server/app.js` mounts them.
 */

import express from "express";
import { supabase } from "../db.js";

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';
const SITE_URLSET = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

/**
 * The public visibility predicate, expressed in PostgREST.
 *
 * `published` AND (no schedule OR the schedule has been reached) AND (no
 * expiry OR the expiry is still ahead). This is the same filter as the one in
 * `server/routes/pages.js`.
 */
function applyPublicVisibility(query, now = new Date()) {
  const nowIso = now.toISOString();
  let next = query.eq("status", "published");
  next = next.or(`scheduled_at.is.null,scheduled_at.lte.${nowIso}`);
  next = next.or(`expired_at.is.null,expired_at.gt.${nowIso}`);
  return next;
}

/** Escape the characters that may not appear raw in an XML document. */
function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * The site origin.
 *
 * `SITE_ORIGIN` wins, then the first `ALLOWED_ORIGINS` entry, then the host
 * the request came in on, so the sitemap works in development without any
 * configuration.
 */
function siteOrigin(req) {
  const configured = (process.env.SITE_ORIGIN || "").trim();
  if (configured) return configured.replace(/\/+$/, "");

  const allowed = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .find(Boolean);
  if (allowed) return allowed.replace(/\/+$/, "");

  return `http://${req.headers.host || "localhost"}`;
}

export const sitemapRouter = express.Router();
export const robotsRouter = express.Router();

sitemapRouter.get("/", async (req, res) => {
  try {
    const { data, error } = await applyPublicVisibility(supabase.from("pages").select("*")).order(
      "created_at",
      { ascending: false }
    );

    if (error) {
      console.error("Supabase sitemap error:", error.message);
      res.status(500).type("application/xml").send(`${XML_HEADER}\n<urlset></urlset>`);
      return;
    }

    const origin = siteOrigin(req);
    const entries = (data ?? [])
      .map((row) => {
        const location = escapeXml(`${origin}/pages/${row.slug}`);
        const lastmod = String(row.updated_at ?? row.created_at ?? "").slice(0, 10);
        return `  <url><loc>${location}</loc><lastmod>${lastmod}</lastmod></url>`;
      })
      .join("\n");

    res
      .status(200)
      .type("application/xml")
      .set("Cache-Control", "public, max-age=300")
      .send(`${XML_HEADER}\n${SITE_URLSET}\n${entries}\n</urlset>`);
  } catch (thrown) {
    console.error("Supabase sitemap exception:", thrown.message);
    res.status(500).type("application/xml").send(`${XML_HEADER}\n<urlset></urlset>`);
  }
});

robotsRouter.get("/", (req, res) => {
  const origin = siteOrigin(req);
  res
    .status(200)
    .type("text/plain")
    .set("Cache-Control", "public, max-age=300")
    .send(`User-agent: *\nDisallow: /admin\nSitemap: ${origin}/api/sitemap.xml\n`);
});
