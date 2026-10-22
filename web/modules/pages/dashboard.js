// Dashboard page: KPI cards, main table and the bottom panel

import { state } from "../state.js";
import { money, escapeHtml } from "../utils.js";
import { renderSellTab } from "../cart.js";
import { getProfitBreakdown, getSalesRevenue } from "../finance.js";
import { sheetHandleHtml } from "../mobile-sheet.js";
import { activeExpiryBatches } from "../stock-logic.js";

export let activeDashTab = "expiring";
export function setActiveDashTab(tab) { activeDashTab = tab; }

export let activeProfitType = (function () {
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
  try { localStorage.setItem("sentryDashboardProfitDisplay", type); } catch (e) { }
}

// KPI cards
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

// main table
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

export function expiringRows(batchEntries) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return batchEntries.map((entry, i) => {
    const p = entry.product;
    const batch = entry.batch;
    const qty = Number(batch.qty || p.stock || 0);
    const expStr = String(batch.expiry || p.expiry || "").trim();
    const parts = expStr.substring(0, 10).split("-");
    let days = 0;
    if (parts.length >= 3) {
      const expDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      days = Math.round((expDate - today) / 86400000);
    }
    const isExpired = days < 0;
    return `<tr>
      <td>${i + 1}</td>
      <td><strong>${escapeHtml(p.name)}</strong></td>
      <td>${escapeHtml(p.category)}</td>
      <td>${qty} in batch</td>
      <td>${money(p.price)}</td>
      <td>${expStr || "—"}</td>
      <td><span class="badge ${isExpired ? "red" : "orange"}">${isExpired ? "EXPIRED" : days === 0 ? "Expires Today" : `Expires in ${days}d`}</span></td>
      <td>
        ${isExpired
          ? `<button class="confirm-removal-btn" type="button" data-confirm-expired-removal="${p.id}" data-batch-expiry="${escapeHtml(expStr)}" data-batch-qty="${qty}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Confirm Disposal
             </button>`
          : `<span style="color:var(--text-secondary); font-size:12px;">Active Batch</span>`}
      </td>
    </tr>`;
  }).join("");
}

// expiring soon panel
export function expiringPanel() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const batchEntries = [];

  for (const p of state.products) {
    const batches = activeExpiryBatches(p);
    if (batches.length) {
      for (const b of batches) {
        if (!b.expiry) continue;
        const parts = String(b.expiry).trim().substring(0, 10).split("-");
        if (parts.length < 3) continue;
        const expDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        const days = Math.round((expDate - today) / 86400000);
        if (days <= 7) {
          batchEntries.push({ product: p, batch: b, days });
        }
      }
    } else if (p.expiry) {
      const parts = String(p.expiry).trim().substring(0, 10).split("-");
      if (parts.length >= 3) {
        const expDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        const days = Math.round((expDate - today) / 86400000);
        if (days <= 7) {
          batchEntries.push({ product: p, batch: { expiry: p.expiry, qty: p.stock }, days });
        }
      }
    }
  }

  // Sort: expired batches first, then soonest expiry date
  batchEntries.sort((a, b) => a.days - b.days);

  return `
    <div class="wire-table-wrap dash-expiring-table-wrap">
      <table class="dashboard-inventory-table">
        <thead><tr><th>ID</th><th>NAME</th><th>CATEGORY</th><th>BATCH QTY</th><th>SRP</th><th>EXPIRATION DATE</th><th>STATUS</th><th>ACTION</th></tr></thead>
        <tbody>${batchEntries.length
      ? expiringRows(batchEntries)
      : `<tr><td colspan="8" class="table-empty">✓ No expiring items within the next 7 days.</td></tr>`}
        </tbody>
      </table>
    </div>`;
}

// bottom panel tabs
export function cartCount() {
  return state.cart.reduce((s, i) => s + i.qty, 0);
}

export function dashTabHtml(tab) {
  if (tab === "sell") {
    return renderSellTab();
  }
  return expiringPanel();
}

// the whole page
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
              <button class="wire-btn" id="setExpenseTotalsBtn" type="button" title="Set Expense Totals" aria-label="Set Expense Totals"><img class="btn-icon btn-icon-phone" src="src/icon/dark/set-capital.svg" alt=""><span class="btn-text">Set Expense Totals</span></button>
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
      <div class="dashboard-resizer-bar" id="dashboardResizerBar" title="Drag up or down to adjust section height">
        <span class="dashboard-resizer-grip"></span>
      </div>
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
      <div class="dashboard-tab-body" id="dashboardTabBody">
        ${sheetHandleHtml("dashSheetHandle", true)}
        <div id="dashboardTab" class="dashboard-tab-content">${dashTabHtml(activeDashTab)}</div>
      </div>
    </div>
  `;
}

// sorts products by the chosen option
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
