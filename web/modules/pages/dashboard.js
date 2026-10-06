/* ============================================================
 * pages/dashboard.js — Dashboard overview page renderer.
 * Renders stat cards, inventory table, and expiring/low-stock
 * panels as well as the sell tab container.
 * ============================================================ */

import { state }     from "../state.js";
import { money, escapeHtml } from "../utils.js";
import { isLowStock, lowStockLabel } from "../stock-logic.js";
import { renderSellTab } from "../cart.js";

export let activeDashTab = "expiring";
export function setActiveDashTab(tab) { activeDashTab = tab; }

export let activeProfitType = (function() {
  try { return localStorage.getItem("sentryActiveProfitType") || "gross"; }
  catch (e) { return "gross"; }
})();

export function setActiveProfitType(type) {
  activeProfitType = type;
  try { localStorage.setItem("sentryActiveProfitType", type); } catch (e) {}
}

export function getProfitValue(type = activeProfitType) {
  const sales = state.transactions.filter(t => t.type === "SALE");
  const gross = sales.reduce(
    (sum, sale) => sum + Number(sale.amount) - (Number(sale.costPerUnit || 0) * Number(sale.qty || 1)),
    0
  );

  if (type === "net") {
    const stockInCost = state.transactions
      .filter(t => t.type === "STOCK IN")
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    return gross - stockInCost;
  }

  return gross;
}

/* ── stat cards (shown only on the dashboard) ─────────────── */
export function dashboardStats() {
  const currentProfit = getProfitValue(activeProfitType);
  const currentLabel = activeProfitType === "net" ? "Net Profit" : "Gross Profit";
  return `
    <div class="stats-grid dashboard-only-stats">
      <div class="stat-card">
        <div class="stat-icon purple"><img class="stat-svg" src="src/icon/dark/set-capital.svg" alt=""></div>
        <div><span>Capital</span><strong id="capitalValue">${money(state.capital)}</strong></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green"><img class="stat-svg" src="src/icon/dark/cart.svg" alt=""></div>
        <div><span>Sales</span><strong id="salesToday">${money(state.salesToday)}</strong></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon orange"><img class="stat-svg" src="src/icon/dark/reports.svg" alt=""></div>
        <div><span>Total Sales</span><strong id="totalSales">${money(state.totalSales)}</strong></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon teal"><img class="stat-svg" src="src/icon/dark/dashboard-left.svg" alt=""></div>
        <div class="stat-card-main">
          <span id="profitLabel">${currentLabel}</span>
          <strong id="profitEarned">${money(currentProfit)}</strong>
        </div>
        <div class="stat-dropdown-right">
          <select class="stat-arrow-dropdown" id="profitTypeSelect" aria-label="Select Profit Metric" title="Switch between Gross and Net profit">
            <option value="gross" ${activeProfitType === "gross" ? "selected" : ""}>Gross Profit</option>
            <option value="net" ${activeProfitType === "net" ? "selected" : ""}>Net Profit</option>
          </select>
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
    const estProfit = (Number(p.price) - Number(p.cost)) * sold;
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
      <td><span class="badge ${isExpired ? "red" : "orange"}">${isExpired ? "EXPIRED" : `Expires in ${days}d`}</span><br><small>${p.expiry}</small></td>
    </tr>`;
  }).join("");
}

export function dashLowStockRows(list) {
  return list.map((p, i) => {
    const inCart = state.cart.find(c => c.id === p.id)?.qty || 0;
    const available = Math.max(0, p.stock - inCart);
    const disabled = available <= 0 ? "disabled" : "";
    return `<tr>
      <td>${i + 1}</td>
      <td><strong>${escapeHtml(p.name)}</strong></td>
      <td>${escapeHtml(p.category)}</td>
      <td><span class="badge red">${available} units</span></td>
      <td>${money(p.price)}</td>
      <td><small>${lowStockLabel(p)}</small></td>
      <td style="text-align:right">
        <button class="sell-add-btn" type="button" data-add="${p.id}" ${disabled}>${available <= 0 ? "Out" : "Add"}</button>
      </td>
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
          <table class="panel-inventory-table">
            <thead><tr><th>ID</th><th>Name</th><th>Category</th><th>Stock</th><th>SRP</th><th>Expiration</th></tr></thead>
            <tbody>${soon.length
              ? expiringRows(soon)
              : `<tr><td colspan="6" class="table-empty">✓ No expiring items within the next 7 days.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

/* ── low-stock panel ───────────────────────────────────────── */
export function lowStockPanel() {
  const low = state.products.filter(isLowStock);
  return `
    <div class="panel dash-panel-card">
      <div class="panel-title"><img class="panel-icon" src="src/icon/white/low-stock-alert.svg" alt=""> Low Stock Alerts ${low.length ? `<span class="alert-dot"></span>` : ""}</div>
      <div class="panel-body panel-table-body">
        <div class="wire-table-wrap panel-table-wrap">
          <table class="panel-inventory-table">
            <thead><tr><th>ID</th><th>Name</th><th>Category</th><th>Current Stock</th><th>SRP</th><th>Status</th><th style="text-align:right">Action</th></tr></thead>
            <tbody>${low.length
              ? dashLowStockRows(low)
              : `<tr><td colspan="7" class="table-empty">✓ No low stock items right now.</td></tr>`}
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
  return expiringPanel() + lowStockPanel();
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
      </div>

      <div class="wire-table-wrap dashboard-table-card">
        <div class="dashboard-table-scroll">
          <table class="dashboard-inventory-table">
            <thead><tr>
              <th>ID</th><th>Name</th><th>Category</th><th>Base</th><th>SRP</th><th>Stock</th><th>Sold</th><th>Est. Profit</th><th>Expiration</th>
            </tr></thead>
            <tbody id="dashboardRows">${dashboardRows()}</tbody>
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
  if (mode === "name")  return copy.sort((a, b) => a.name.localeCompare(b.name));
  if (mode === "stock") return copy.sort((a, b) => a.stock - b.stock);
  return copy.sort((a, b) => Number(b.sold || 0) - Number(a.sold || 0));
}
