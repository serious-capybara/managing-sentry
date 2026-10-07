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
