// stock baseline, low-stock rules and expiry batches

import { state } from "./state.js";
import { money } from "./utils.js";
import { getProfitBreakdown, getSalesRevenue } from "./finance.js";
import { activeProfitType } from "./pages/dashboard.js";

// stock baseline and low-stock limit

export function ensureStockBaseline(product) {
  if (!product) return 0;
  const current = Math.max(0, Number(product.stock || product.stock_quantity || 0));
  if (
    !Number.isFinite(Number(product.stockBaseline)) ||
    Number(product.stockBaseline) <= 0
  ) {
    product.stockBaseline = current;
  }
  return Math.max(0, Number(product.stockBaseline || 0));
}

export function lowStockThreshold(product) {
  if (!product) return 20;
  const alertLevel = Number(product.low_stock_alert_level ?? product.lowStockAlertLevel ?? product.low_stock_threshold ?? 20);
  return Number.isFinite(alertLevel) && alertLevel > 0 ? alertLevel : 20;
}

export function isLowStock(product) {
  if (!product) return false;
  const stock = Math.max(0, Number(product.stock ?? product.stock_quantity ?? 0));
  const threshold = lowStockThreshold(product);
  return stock <= threshold;
}

export function lowStockLabel(product) {
  if (!product) return "Alert at 20 units";
  return `Alert at ${lowStockThreshold(product)} units`;
}

// expiry batches

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

  const cleanStr = String(dateStr).trim().substring(0, 10);
  const parts = cleanStr.split("-");
  if (parts.length < 3) return { state: "none", label: "No Expiry", days: null };
  const expiry = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (Number.isNaN(expiry.getTime())) return { state: "none", label: "No Expiry", days: null };

  const diffMillis = expiry.getTime() - today.getTime();
  const days = Math.round(diffMillis / 86400000);

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

export function getExpiredStock(product) {
  if (!product) return 0;
  const batches = activeExpiryBatches(product);
  if (!batches.length) {
    if (product.expiry) {
      const info = expiryDateInfo(product.expiry);
      if (info.days !== null && info.days < 0) return Math.max(0, Number(product.stock || 0));
    }
    return 0;
  }
  let expiredQty = 0;
  for (const b of batches) {
    const info = expiryDateInfo(b.expiry);
    if (info.days !== null && info.days < 0) {
      expiredQty += Math.max(0, Number(b.qty || 0));
    }
  }
  return expiredQty;
}

export function getSellableStock(product) {
  if (!product) return 0;
  const total = Math.max(0, Number(product.stock || 0));
  const expired = getExpiredStock(product);
  return Math.max(0, total - expired);
}

export function consumeExpiryBatches(product, qty) {
  let remaining = Math.max(0, Number(qty || 0));
  ensureExpiryBatches(product);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  product.expiryBatches.sort((a, b) => {
    if (!a.expiry && b.expiry) return 1;
    if (a.expiry && !b.expiry) return -1;
    if (!a.expiry && !b.expiry) return 0;

    const partsA = String(a.expiry).trim().substring(0, 10).split("-");
    const partsB = String(b.expiry).trim().substring(0, 10).split("-");
    const dateA = new Date(Number(partsA[0]), Number(partsA[1]) - 1, Number(partsA[2]));
    const dateB = new Date(Number(partsB[0]), Number(partsB[1]) - 1, Number(partsB[2]));

    const isExpiredA = dateA < today;
    const isExpiredB = dateB < today;

    // FEFO: Unexpired active batches take priority over expired batches for sales rerouting
    if (!isExpiredA && isExpiredB) return -1;
    if (isExpiredA && !isExpiredB) return 1;

    return dateA - dateB;
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

export function expiryDateCell(product) {
  const batch = earliestExpiry(product);
  if (!batch || !batch.expiry) {
    return `<span style="color:var(--text-secondary); font-size:13px; font-weight:500; display:inline-flex; align-items:center; min-height:28px;">No Expiry</span>`;
  }
  const escaped = String(batch.expiry).replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
  return `<button type="button" class="expiry-date-plain-btn" data-expiry-product="${product.id}" title="Click to view all expiration batches">${escaped}</button>`;
}

export function expiryStatusCell(product) {
  const batch = earliestExpiry(product);
  if (!batch || !batch.expiry) {
    return `<span style="color:var(--text-secondary); font-size:13px; display:inline-flex; align-items:center; min-height:28px;">—</span>`;
  }
  const info = expiryDateInfo(batch.expiry);
  const badgeClass = info.state === "expired" ? "red" : info.state === "soon" ? "orange" : "green";
  return `<span class="badge ${badgeClass}">${info.label}</span>`;
}

// dashboard numbers and the low-stock dot in the menu

export function updateStats() {
  const capital    = document.getElementById("capitalValue");
  const salesToday = document.getElementById("salesToday");
  const totalSales = document.getElementById("totalSales");
  const netProfit = document.getElementById("profitEarned");
  const profitMetric = document.getElementById("profitMetricSelect");

  if (capital)    capital.textContent    = money(state.capital);
  if (salesToday) salesToday.textContent = money(getSalesRevenue("today"));
  if (totalSales) totalSales.textContent = money(getSalesRevenue("all"));
  const profit = getProfitBreakdown();
  const selectedProfitType = profitMetric?.value || activeProfitType;
  if (netProfit) netProfit.textContent = money(selectedProfitType === "net" ? profit.netProfit : profit.grossProfit);

  updateLowStockIndicator();
}

export function updateLowStockIndicator() {
  const hasLowStock = state.products.some(isLowStock);
  const dot    = document.getElementById("sidebarLowStockDot");
  const lowDot = document.getElementById("sidebarLowStockAlertDot");
  if (dot)    dot.classList.toggle("hidden", !hasLowStock);
  if (lowDot) lowDot.classList.toggle("hidden", !hasLowStock);
}
