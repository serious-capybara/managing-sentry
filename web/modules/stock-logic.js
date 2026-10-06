/* ============================================================
 * stock-logic.js — Stock baseline, low-stock rules, and expiry
 * batch management. All functions are pure (state is passed in).
 * ============================================================ */

import { state } from "./state.js";
import { money } from "./utils.js";

// ---------------------------------------------------------------------------
// Stock baseline & low-stock threshold
// ---------------------------------------------------------------------------

export function ensureStockBaseline(product) {
  const current = Math.max(0, Number(product.stock || 0));
  if (
    !Number.isFinite(Number(product.stockBaseline)) ||
    Number(product.stockBaseline) <= 0
  ) {
    product.stockBaseline = current;
  }
  return Math.max(0, Number(product.stockBaseline || 0));
}

export function lowStockThreshold(product) {
  const baseline = ensureStockBaseline(product);
  return baseline > 0 ? Math.max(1, Math.ceil(baseline * 0.10)) : 0;
}

export function isLowStock(product) {
  const stock = Math.max(0, Number(product.stock || 0));
  const threshold = lowStockThreshold(product);
  return threshold > 0 && stock <= threshold;
}

export function lowStockLabel(product) {
  return `Alert at ${lowStockThreshold(product)} units (10% of ${ensureStockBaseline(product)})`;
}

// ---------------------------------------------------------------------------
// Expiry batch management
// ---------------------------------------------------------------------------

export function ensureExpiryBatches(product) {
  if (!Array.isArray(product.expiryBatches)) product.expiryBatches = [];
  if (
    !product.expiryBatches.length &&
    product.expiry &&
    Number(product.stock || 0) > 0
  ) {
    product.expiryBatches.push({
      expiry: product.expiry,
      qty: Number(product.stock || 0),
      addedAt: new Date().toISOString()
    });
  }
  return product.expiryBatches;
}

export function expiryDateInfo(dateStr) {
  if (!dateStr) return { state: "none", label: "No Expiry", days: null };
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const expiry = new Date(`${dateStr}T23:59:59`);
  if (Number.isNaN(expiry.getTime())) return { state: "none", label: "No Expiry", days: null };
  const days = Math.ceil((expiry - today) / 86400000);
  if (days < 0) return { state: "expired", label: "Expired", days };
  if (days <= 7) return { state: "soon", label: `${days} day${days === 1 ? "" : "s"} left`, days };
  return { state: "safe", label: `${days} days left`, days };
}

export function activeExpiryBatches(product) {
  return ensureExpiryBatches(product).filter(
    b => Number(b.qty || 0) > 0 && b.expiry
  );
}

export function earliestExpiry(product) {
  const batches = activeExpiryBatches(product).sort(
    (a, b) => String(a.expiry).localeCompare(String(b.expiry))
  );
  return batches[0] || null;
}

export function consumeExpiryBatches(product, qty) {
  let remaining = Math.max(0, Number(qty || 0));
  ensureExpiryBatches(product);

  product.expiryBatches.sort((a, b) => {
    if (!a.expiry && b.expiry) return 1;
    if (a.expiry && !b.expiry) return -1;
    return String(a.expiry || "").localeCompare(String(b.expiry || ""));
  });

  for (const batch of product.expiryBatches) {
    if (remaining <= 0) break;
    const available = Math.max(0, Number(batch.qty || 0));
    if (!available) continue;
    const take = Math.min(available, remaining);
    batch.qty = available - take;
    remaining -= take;
  }

  product.expiryBatches = product.expiryBatches.filter(b => Number(b.qty || 0) > 0);
  const earliest = earliestExpiry(product);
  product.expiry = earliest ? earliest.expiry : "";
}

export function expiryButton(product) {
  const batch = earliestExpiry(product);
  if (!batch) {
    return `<button type="button" class="expiry-btn expiry-none" data-expiry-product="${product.id}">No Expiry</button>`;
  }
  const info = expiryDateInfo(batch.expiry);
  const escaped = String(batch.expiry).replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
  return `<button type="button" class="expiry-btn expiry-${info.state}" data-expiry-product="${product.id}" title="Click to view all expiration batches">${escaped}<span>${info.label}</span></button>`;
}

// ---------------------------------------------------------------------------
// Dashboard stats & low-stock sidebar dots
// ---------------------------------------------------------------------------

export function updateStats() {
  const capital    = document.getElementById("capitalValue");
  const salesToday = document.getElementById("salesToday");
  const totalSales = document.getElementById("totalSales");
  const profit     = document.getElementById("profitEarned");

  if (capital)    capital.textContent    = money(state.capital);
  if (salesToday) salesToday.textContent = money(state.salesToday);
  if (totalSales) totalSales.textContent = money(state.totalSales);
  if (profit)     profit.textContent     = money(state.profit);

  updateLowStockIndicator();
}

export function updateLowStockIndicator() {
  const hasLowStock = state.products.some(isLowStock);
  const dot    = document.getElementById("sidebarLowStockDot");
  const lowDot = document.getElementById("sidebarLowStockAlertDot");
  if (dot)    dot.classList.toggle("hidden", !hasLowStock);
  if (lowDot) lowDot.classList.toggle("hidden", !hasLowStock);
}
