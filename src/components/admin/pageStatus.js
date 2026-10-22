/**
 * The status label of a page, derived from its status and timestamps.
 *
 * Rules:
 *   - status === "draft" -> "Draft"
 *   - status === "archived" -> "Archived"
 *   - status === "published" and scheduled_at is in the future -> "Scheduled"
 *   - status === "published" and expired_at is in the past -> "Expired"
 *   - otherwise -> "Published"
 */
export function pageStatusLabel(page, now = new Date()) {
  const status = typeof page?.status === "string" ? page.status : "";
  if (status === "draft") return "Draft";
  if (status === "archived") return "Archived";

  if (status === "published") {
    const at = now instanceof Date ? now.getTime() : new Date(now).getTime();
    const scheduled = Date.parse(page?.scheduled_at ?? "");
    if (!Number.isNaN(scheduled) && scheduled > at) return "Scheduled";
    const expired = Date.parse(page?.expired_at ?? "");
    if (!Number.isNaN(expired) && expired <= at) return "Expired";
  }

  return "Published";
}
