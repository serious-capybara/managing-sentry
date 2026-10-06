/* ============================================================
 * pages/dashboard.js — Dashboard overview page renderer.
 * Renders stat cards, inventory table, and expiring/low-stock
 * panels as well as the sell tab container.
 * ============================================================ */

import { state }     from "../state.js";
import { money, escapeHtml } from "../utils.js";
import { isLowStock } from "../stock-logic.js";
import { renderSellTab } from "../cart.js";

export let activeDashTab = "expiring";
export function setActiveDashTab(tab) { activeDashTab = tab; }

/* ── stat cards (shown only on the dashboard) ─────────────── */
export function dashboardStats() {
  return `
    <div class="stats-grid dashboard-only-stats">
      <div class="stat-card">
        <div class="stat-icon purple"><img class="stat-svg" src="src/icon/set-capital.svg" alt=""></div>
        <div><span>Capital</span><strong id="capitalValue">${money(state.capital)}</strong></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green"><img class="stat-svg" src="src/icon/cart.svg" alt=""></div>
        <div><span>Sales</span><strong id="salesToday">${money(state.salesToday)}</strong></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon orange"><img class="stat-svg" src="src/icon/reports.svg" alt=""></div>
        <div><span>Total Sales</span><strong id="totalSales">${money(state.totalSales)}</strong></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon teal"><img class="stat-svg" src="src/icon/dashboard-left.svg" alt=""></div>
        <div><span>Profit</span><strong id="profitEarned">${money(state.profit)}</strong></div>
      </div>
    </div>`;
}

/* ── main inventory table ──────────────────────────────────── */
export function dashboardRows(products = state.products) {
  if (!products.length) {
    return `<tr><td colspan="9" class="table-empty">No products yet. Add a product from the Products menu.</td></tr>`;
  }
  return products.map((p, i) => {
    const sold = Number(p.sold || 0);
    const estProfit = (Number(p.price) - Number(p.cost)) * sold;
    return `<tr>
      <td>${i + 1}</td><td><strong>${escapeHtml(p.name)}</strong></td><td>${escapeHtml(p.category)}</td>
      <td>${money(p.cost)}</td><td>${money(p.price)}</td><td>${p.stock}</td><td>${sold}</td>
      <td>${money(estProfit)}</td><td>${p.expiry || "—"}</td>
    </tr>`;
  }).join("");
}

/* ── expiring-soon panel ───────────────────────────────────── */
export function expiringPanel() {
  const now  = new Date();
  const soon = state.products.filter(p => {
    if (!p.expiry) return false;
    const days = Math.ceil((new Date(p.expiry) - now) / 86400000);
    return days <= 7;
  });
  return `
    <div class="panel">
      <div class="panel-title">▣ &nbsp; Expiring Soon / Expired (within 7 days)</div>
      <div class="panel-body">
        ${soon.length
          ? `<div class="product-grid">${soon.map(productMini).join("")}</div>`
          : `<p class="empty">✓ No expiring items within the next 7 days.</p>`}
      </div>
    </div>`;
}

/* ── low-stock panel ───────────────────────────────────────── */
export function lowStockPanel() {
  const low = state.products.filter(isLowStock);
  return `
    <div class="panel">
      <div class="panel-title"><img class="panel-icon" src="src/icon/low-stock-alert.svg" alt=""> Low Stock Alerts ${low.length ? `<span class="alert-dot"></span>` : ""}</div>
      <div class="panel-body">
        ${low.length
          ? `<div class="product-grid">${low.map(productMini).join("")}</div>`
          : `<p class="empty">✓ No low stock items right now.</p>`}
      </div>
    </div>`;
}

/* ── mini product card (used in the panels above) ──────────── */
export function productMini(p) {
  const inCart   = state.cart.find(c => c.id === p.id)?.qty || 0;
  const available = Math.max(0, p.stock - inCart);
  const disabled  = available <= 0 ? "disabled" : "";
  return `<div class="product-card ${available <= 0 ? "out" : ""}">
    <h4>${escapeHtml(p.name)}</h4><p>${escapeHtml(p.category)} • <span class="stock-count">${available} in stock</span></p>
    <div class="product-price">${money(p.price)}</div>
    <div class="add-row">
      <input class="qty-input" type="number" min="1" max="${available}" value="1" data-qty="${p.id}" ${disabled}>
      <button data-add="${p.id}" ${disabled}>${available <= 0 ? "No Stock" : "Add to Cart"}</button>
    </div>
  </div>`;
}

/* ── dashboard tab content ─────────────────────────────────── */
export function cartCount() {
  return state.cart.reduce((s, i) => s + i.qty, 0);
}

export function dashTabHtml(tab) {
  if (tab === "sell") {
    return renderSellTab();
  }
  return expiringPanel() + lowStockPanel();
}

/* ── full dashboard page ───────────────────────────────────── */
export function renderDashboard() {
  return `
    <div class="dashboard-overview">
    ${dashboardStats()}
    <div class="dashboard-toolbar">
      <div class="toolbar-left">
        <span class="toolbar-label"><img class="inline-icon" src="src/icon/sort-filter.svg" alt=""> Sort:</span>
        <select class="compact-select" id="dashboardSort">
          <option value="selling">High Selling</option>
          <option value="name">By Name</option>
          <option value="stock">Low Stock</option>
        </select>
      </div>
      <div class="toolbar-right">
        <input class="compact-input" id="dashboardSearch" placeholder="Search Products">
      </div>
    </div>

    <div class="wire-table-wrap dashboard-table-wrap">
      <table class="dashboard-inventory-table">
        <thead><tr>
          <th>ID</th><th>Name</th><th>Category</th><th>Base</th><th>SRP</th><th>Stock</th><th>Sold</th><th>Est. Profit</th><th>Expiration</th>
        </tr></thead>
        <tbody id="dashboardRows">${dashboardRows()}</tbody>
      </table>
    </div>
    </div>

    <div class="dashboard-tabs">
      <button class="tab-btn ${activeDashTab === "expiring" ? "active" : ""}" data-tab="expiring"><img class="tab-icon" src="src/icon/low-stock-alert.svg" alt=""> Expiring Soon</button>
      <button class="tab-btn ${activeDashTab === "sell" ? "active" : ""}" data-tab="sell"><img class="tab-icon" src="src/icon/cart.svg" alt=""> Pick Items to Sell <span class="cart-pill" id="cartPill">${cartCount()}</span></button>
    </div>
    <div id="dashboardTab">${dashTabHtml(activeDashTab)}</div>
  `;
}

/** Sort a product list by the chosen mode. */
export function sortProducts(list, mode) {
  const copy = [...list];
  if (mode === "name")  return copy.sort((a, b) => a.name.localeCompare(b.name));
  if (mode === "stock") return copy.sort((a, b) => a.stock - b.stock);
  return copy.sort((a, b) => Number(b.sold || 0) - Number(a.sold || 0));
}
