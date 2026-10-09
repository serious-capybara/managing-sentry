/* ============================================================
 * pages/dashboard.js — Dashboard overview page renderer.
 * Renders stat cards, inventory table, and expiring/low-stock
 * panels as well as the sell tab container.
 * ============================================================ */

import { state }     from "../state.js";
import { money, escapeHtml } from "../utils.js";
import { renderSellTab } from "../cart.js";
import { getProfitBreakdown, getSalesRevenue } from "../finance.js";

export let activeDashTab = "expiring";
export function setActiveDashTab(tab) { activeDashTab = tab; }

export let activeProfitType = (function() {
  try {
    const savedType = localStorage.getItem("sentryDashboardProfitDisplay");
    return ["gross", "net"].includes(savedType) ? savedType : "net";
  } catch (e) {
    return "net";
  }
})();

export function setActiveProfitType(type) {
  if (!["gross", "net"].includes(type)) return;
  activeProfitType = type;
  try { localStorage.setItem("sentryDashboardProfitDisplay", type); } catch (e) {}
}

/* ── stat cards (shown only on the dashboard) ─────────────── */
export function dashboardStats() {
  const profit = getProfitBreakdown();
  const isNetProfit = activeProfitType === "net";
  const displayedProfit = isNetProfit ? profit.netProfit : profit.grossProfit;
  return `
    <div class="stats-grid dashboard-only-stats">
      <div class="stat-card">
        <div class="stat-icon purple"><img class="stat-svg" src="src/icon/dark/set-capital.svg" alt=""></div>
        <div><span>Capital Balance</span><strong id="capitalValue">${money(state.capital)}</strong></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green"><img class="stat-svg" src="src/icon/dark/cart.svg" alt=""></div>
        <div><span>Sales Today</span><strong id="salesToday">${money(getSalesRevenue("today"))}</strong></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon orange"><img class="stat-svg" src="src/icon/dark/reports.svg" alt=""></div>
        <div><span>Total Sales · All Time</span><strong id="totalSales">${money(getSalesRevenue("all"))}</strong></div>
      </div>
      <div class="stat-card profit-stat-card">
        <div class="stat-icon teal"><img class="stat-svg" src="src/icon/dark/dashboard-left.svg" alt=""></div>
        <div class="stat-card-main">
          <div class="profit-type-control">
            <select class="compact-select styled-select-native profit-type-select" id="profitMetricSelect" aria-label="Select profit type">
              <option value="net" ${activeProfitType === "net" ? "selected" : ""}>Net Profit</option>
              <option value="gross" ${activeProfitType === "gross" ? "selected" : ""}>Gross Profit</option>
            </select>
          </div>
          <strong id="profitEarned">${money(displayedProfit)}</strong>
        </div>
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
    const estProfit = p.soldRevenue != null && p.soldCogs != null
      ? Number(p.soldRevenue) - Number(p.soldCogs)
      : (Number(p.price) - Number(p.cost)) * sold;
    return `<tr>
      <td>${i + 1}</td><td><strong>${escapeHtml(p.name)}</strong></td><td>${escapeHtml(p.category)}</td>
      <td>${money(p.cost)}</td><td>${money(p.price)}</td><td>${p.stock}</td><td>${sold}</td>
      <td>${money(estProfit)}</td><td>${p.expiry || "—"}</td>
    </tr>`;
  }).join("");
}

export function expiringRows(list) {
  const now = new Date();
  return list.map((p, i) => {
    const inCart = state.cart.find(c => c.id === p.id)?.qty || 0;
    const available = Math.max(0, p.stock - inCart);
    const days = Math.ceil((new Date(p.expiry) - now) / 86400000);
    const isExpired = days <= 0;
    return `<tr>
      <td>${i + 1}</td>
      <td><strong>${escapeHtml(p.name)}</strong></td>
      <td>${escapeHtml(p.category)}</td>
      <td>${available} in stock</td>
      <td>${money(p.price)}</td>
      <td>${p.expiry || "—"}</td>
      <td><span class="badge ${isExpired ? "red" : "orange"}">${isExpired ? "EXPIRED" : `Expires in ${days}d`}</span></td>
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
    <div class="panel dash-panel-card">
      <div class="panel-title"><img class="panel-icon" src="src/icon/white/low-stock-alert.svg" alt=""> Expiring Soon / Expired (within 7 days)</div>
      <div class="panel-body panel-table-body">
        <div class="wire-table-wrap panel-table-wrap">
          <table class="dashboard-inventory-table">
            <thead><tr><th>ID</th><th>NAME</th><th>CATEGORY</th><th>STOCK</th><th>SRP</th><th>EXPIRATION DATE</th><th>STATUS</th></tr></thead>
            <tbody>${soon.length
              ? expiringRows(soon)
              : `<tr><td colspan="7" class="table-empty">✓ No expiring items within the next 7 days.</td></tr>`}
            </tbody>
          </table>
        </div>
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
  return expiringPanel();
}

/* ── full dashboard page ───────────────────────────────────── */
export function renderDashboard() {
  return `
    <div class="dashboard-overview">
      <div class="dashboard-top-dock">
        ${dashboardStats()}
        <div class="dashboard-toolbar">
          <div class="toolbar-left">
            <span class="toolbar-label"><img class="inline-icon" src="src/icon/dark/sort-filter.svg" alt=""> Sort:</span>
            <select class="compact-select styled-select-native" id="dashboardSort" aria-label="Sort dashboard products">
              <option value="selling">High Selling</option>
              <option value="name">Name</option>
              <option value="stock">Low Stock</option>
              <option value="stock-desc">High Stock</option>
            </select>
          </div>
          <div class="toolbar-right">
            <input class="compact-input" id="dashboardSearch" placeholder="Search Products">
            <div class="dashboard-profit-controls">
              <button class="wire-btn" id="setExpenseTotalsBtn" type="button">Set Expense Totals</button>
            </div>
          </div>
        </div>
      </div>

      <div class="wire-table-wrap dashboard-table-card">
        <div class="dashboard-table-scroll">
          <table class="dashboard-inventory-table">
            <thead><tr>
              <th>ID</th><th>Name</th><th>Category</th><th>Base</th><th>SRP</th><th>Stock</th><th>Sold</th><th>Est. Profit</th><th>Expiration</th>
            </tr></thead>
            <tbody id="dashboardRows">${dashboardRows(sortProducts(state.products, "selling"))}</tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="dashboard-bottom-section" id="dashboardBottomSection">
      <div class="dashboard-tabs-header">
        <div class="dashboard-tabs">
          <button class="tab-btn ${activeDashTab === "expiring" ? "active" : ""}" data-tab="expiring">
            <img class="tab-icon" src="src/icon/${activeDashTab === "expiring" ? "white" : "dark"}/low-stock-alert.svg" alt=""> Expiring Soon
          </button>
          <button class="tab-btn ${activeDashTab === "sell" ? "active" : ""}" data-tab="sell">
            <img class="tab-icon" src="src/icon/${activeDashTab === "sell" ? "white" : "dark"}/cart.svg" alt=""> Pick Items to Sell
          </button>
        </div>
        <button class="dashboard-toggle-btn" id="dashboardSectionToggle" title="Toggle Section Visibility">
          <img id="dashboardToggleIcon" class="btn-icon" src="src/icon/dark/dropdown-close-expand.svg" alt="Toggle Section">
        </button>
      </div>
      <div id="dashboardTab" class="dashboard-tab-body">${dashTabHtml(activeDashTab)}</div>
    </div>
  `;
}

/** Sort a product list by the chosen mode. */
export function sortProducts(list, mode) {
  const copy = [...list];
  if (mode === "name") {
    return copy.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }
  if (mode === "stock") {
    return copy.sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0) || String(a.name).localeCompare(String(b.name)));
  }
  if (mode === "stock-desc") {
    return copy.sort((a, b) => Number(b.stock || 0) - Number(a.stock || 0) || String(a.name).localeCompare(String(b.name)));
  }
  return copy.sort((a, b) => Number(b.sold || 0) - Number(a.sold || 0) || String(a.name).localeCompare(String(b.name)));
}
