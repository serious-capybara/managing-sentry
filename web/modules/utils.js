/* ============================================================
 * utils.js — Pure helper utilities (no DOM side-effects).
 * ============================================================ */

/**
 * Format a numeric value as Philippine Peso currency string.
 * @param {number|string} value
 * @returns {string}  e.g. "₱1,234.00"
 */
export function money(value) {
  return Number(value || 0).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Escape special HTML characters to prevent XSS injection in
 * template-literal HTML strings.
 * @param {*} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[ch]));
}

/**
 * Display a brief toast notification at the bottom of the screen.
 * @param {string} message
 */
export function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2400);
}


/**
 * Parse a database timestamp into epoch milliseconds.
 * Handles "2026-10-12T15:50:44+00:00", "2026-10-12 15:50:44.123456+08" and
 * zone-less values (treated as local time). Returns null when unreadable.
 */
export function parseTimestamp(raw) {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === "number") return raw;
  const text = String(raw).trim();
  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d+))?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i);
  if (!m) {
    const t = new Date(text).getTime();
    return Number.isNaN(t) ? null : t;
  }
  const [, y, mo, d, h, mi, sec = "0", frac = "0", zone] = m;
  const ms = Math.round(Number(`0.${frac}`) * 1000);
  if (!zone) return new Date(+y, +mo - 1, +d, +h, +mi, +sec, ms).getTime();
  let offsetMin = 0;
  if (zone.toUpperCase() !== "Z") {
    const sign = zone[0] === "-" ? -1 : 1;
    const digits = zone.slice(1).replace(":", "");
    const oh = Number(digits.slice(0, 2));
    const om = Number(digits.slice(2, 4) || 0);
    offsetMin = sign * (oh * 60 + om);
  }
  return Date.UTC(+y, +mo - 1, +d, +h, +mi, +sec, ms) - offsetMin * 60000;
}

/**
 * Format any date or timestamp into Asia/Manila timezone using 24-hour format.
 * @param {number|string|Date} raw
 * @param {boolean} includeSeconds
 * @returns {string} e.g. "2026-10-13 16:15:00"
 */
export function formatAsiaManila(raw, includeSeconds = true) {
  const ts = parseTimestamp(raw) ?? (raw ? new Date(raw).getTime() : Date.now());
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";

  try {
    const options = {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      ...(includeSeconds ? { second: "2-digit" } : {}),
      hour12: false
    };
    const formatter = new Intl.DateTimeFormat("en-CA", options);
    const parts = formatter.formatToParts(d);
    const map = {};
    for (const part of parts) {
      map[part.type] = part.value;
    }
    const yr = map.year || d.getFullYear();
    const mo = map.month || String(d.getMonth() + 1).padStart(2, "0");
    const da = map.day || String(d.getDate()).padStart(2, "0");
    let hr = map.hour || String(d.getHours()).padStart(2, "0");
    if (hr === "24") hr = "00";
    const mi = map.minute || String(d.getMinutes()).padStart(2, "0");
    const se = map.second || String(d.getSeconds()).padStart(2, "0");

    return includeSeconds
      ? `${yr}-${mo}-${da} ${hr}:${mi}:${se}`
      : `${yr}-${mo}-${da} ${hr}:${mi}`;
  } catch (e) {
    const p2 = n => String(n).padStart(2, "0");
    const yr = d.getFullYear();
    const mo = p2(d.getMonth() + 1);
    const da = p2(d.getDate());
    const hr = p2(d.getHours());
    const mi = p2(d.getMinutes());
    const se = p2(d.getSeconds());
    return includeSeconds
      ? `${yr}-${mo}-${da} ${hr}:${mi}:${se}`
      : `${yr}-${mo}-${da} ${hr}:${mi}`;
  }
}

/** "2026-10-12 15:50:44" in Asia/Manila 24-hour format. */
export function formatDateTime24(ts) {
  return formatAsiaManila(ts, true);
}
