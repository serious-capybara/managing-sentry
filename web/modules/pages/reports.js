/* ============================================================
 * pages/reports.js — Inventory & Capital report and
 * Sales & Profit report renderers, plus print-section helpers.
 * ============================================================ */

import { state }             from "../state.js";
import { money, escapeHtml } from "../utils.js";

export let activeReportTab = "inventory";
export let activeReportRange = "30";

export function setActiveReportTab(tab) { activeReportTab = tab; }
export function setActiveReportRange(range) { activeReportRange = range; }

// ---------------------------------------------------------------------------
// Shared helpers & date range filter
// ---------------------------------------------------------------------------

export function reportMoney(value) { return money(value); }

export function getRangeLabel(range = activeReportRange) {
  switch (range) {
    case "60": return "Last 60 Days";
    case "90": return "Last 90 Days";
    case "this_year": return "This Year";
    case "last_year": return "Last Year";
    case "30":
    default:
      return "Last 30 Days";
  }
}

export function getFilteredTransactions(range = activeReportRange) {
  const now = Date.now();
  const currentDate = new Date();

  return state.transactions.filter(t => {
    const ts = Number(t.timestamp) || Date.now();

    if (range === "60") {
      return ts >= now - (60 * 86400 * 1000);
    }
    if (range === "90") {
      return ts >= now - (90 * 86400 * 1000);
    }
    if (range === "this_year") {
      const startThisYear = new Date(currentDate.getFullYear(), 0, 1).getTime();
      return ts >= startThisYear;
    }
    if (range === "last_year") {
      const startLastYear = new Date(currentDate.getFullYear() - 1, 0, 1).getTime();
      const endLastYear = new Date(currentDate.getFullYear() - 1, 11, 31, 23, 59, 59, 999).getTime();
      return ts >= startLastYear && ts <= endLastYear;
    }

    // Default "30": Last 30 Days
    return ts >= now - (30 * 86400 * 1000);
  });
}

function getExpiryStats() {
  const now  = new Date();
  const soonLimit = new Date(now);
  soonLimit.setDate(soonLimit.getDate() + 7);
  let expired = 0, expiringSoon = 0;
  state.products.forEach(p => {
    if (!p.expiry) return;
    const expiry = new Date(`${p.expiry}T23:59:59`);
    if (Number.isNaN(expiry.getTime())) return;
    if (expiry < now) expired++;
    else if (expiry <= soonLimit) expiringSoon++;
  });
  return { expired, expiringSoon };
}

function inventoryReportData() {
  const tieUp  = state.products.reduce((s, p) => s + Number(p.cost  || 0) * Number(p.stock || 0), 0);
  const retail = state.products.reduce((s, p) => s + Number(p.price || 0) * Number(p.stock || 0), 0);
  const units  = state.products.reduce((s, p) => s + Number(p.stock || 0), 0);
  const expiry = getExpiryStats();
  const products = [...state.products].sort(
    (a, b) => (Number(b.price || 0) * Number(b.stock || 0)) - (Number(a.price || 0) * Number(a.stock || 0))
  );
  return { tieUp, retail, potentialProfit: retail - tieUp, units, expiry, products };
}

function salesReportRows(transactions = getFilteredTransactions()) {
  const sales = transactions.filter(t => t.type === "SALE");
  if (!sales.length) {
    return `<tr><td colspan="9" class="table-empty">No sales recorded for ${getRangeLabel()}.</td></tr>`;
  }
  return sales.map((t, i) => {
    const qty      = Number(t.qty || 0);
    const product  = state.products.find(p => p.name === t.name);
    const baseTotal = t.cogs != null
      ? Number(t.cogs)
      : (t.costPerUnit != null ? Number(t.costPerUnit) : Number(product?.cost || 0)) * qty;
    const baseUnit = qty ? baseTotal / qty : 0;
    const srpTotal = Number(t.amount || 0);
    const profit   = srpTotal - baseTotal;
    const srpUnit  = qty ? srpTotal / qty : 0;
    return `<tr>
      <td>${escapeHtml(t.date || "—")}</td><td>${i + 1}</td><td>${escapeHtml(t.name || "—")}</td><td>${qty}</td>
      <td>${reportMoney(srpUnit)}</td><td>${reportMoney(baseUnit)}</td>
      <td>${reportMoney(srpTotal)}</td><td>${reportMoney(baseTotal)}</td><td>${reportMoney(profit)}</td>
    </tr>`;
  }).join("");
}

// ---------------------------------------------------------------------------
// Inventory & Capital report
// ---------------------------------------------------------------------------

export function renderInventoryCapitalReport(range = activeReportRange) {
  const d = inventoryReportData();
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const rangeTitle = getRangeLabel(range);

  return `<div class="report-section report-print-section" id="inventoryCapitalReport">
    <div class="report-paper">
      <div class="report-header-banner">
        <div class="report-header-left">
          <div class="report-title-main">INVENTORY &amp; CAPITAL REPORT</div>
          <div class="report-subtitle-date">Range: <strong>${rangeTitle}</strong> • Generated on ${dateStr}</div>
        </div>
        <div class="report-header-badge">MANAGEMENT SUMMARY</div>
      </div>

      <div class="report-kpi-grid">
        <div class="report-kpi-card">
          <div class="kpi-label"><img class="inline-icon" src="src/icon/dark/set-capital.svg" alt=""> Starting Capital</div>
          <div class="kpi-value">${reportMoney(state.capital)}</div>
        </div>
        <div class="report-kpi-card">
          <div class="kpi-label"><img class="inline-icon" src="src/icon/dark/stock.svg" alt=""> Tie-Up Capital (Base)</div>
          <div class="kpi-value">${reportMoney(d.tieUp)}</div>
        </div>
        <div class="report-kpi-card">
          <div class="kpi-label"><img class="inline-icon" src="src/icon/dark/products.svg" alt=""> Retail Value (SRP)</div>
          <div class="kpi-value primary">${reportMoney(d.retail)}</div>
        </div>
        <div class="report-kpi-card highlight">
          <div class="kpi-label"><img class="inline-icon" src="src/icon/dark/dashboard-left.svg" alt=""> Potential Profit</div>
          <div class="kpi-value success">${reportMoney(d.potentialProfit)}</div>
        </div>
      </div>

      <div class="report-pills-row">
        <div class="report-pill"><span>Total Products</span><strong>${state.products.length}</strong></div>
        <div class="report-pill"><span>Units In Stock</span><strong>${d.units}</strong></div>
        <div class="report-pill ${d.expiry.expired ? "alert-red" : ""}"><span>Expired Items</span><strong>${d.expiry.expired}</strong></div>
        <div class="report-pill ${d.expiry.expiringSoon ? "alert-amber" : ""}"><span>Expiring Soon (7d)</span><strong>${d.expiry.expiringSoon}</strong></div>
      </div>

      <div class="report-divider-title">
        <span>PER-PRODUCT BREAKDOWN</span>
        <small>(Sorted by SRP stock value on hand)</small>
      </div>

      <div class="report-table-wrap">
        <table class="report-table inventory-report-table">
          <thead><tr><th>ID</th><th>NAME</th><th>STOCK</th><th>BASE VAL</th><th>SRP VAL</th></tr></thead>
          <tbody>${d.products.length
            ? d.products.map((p, i) => `<tr>
                <td>${i + 1}</td><td><strong>${escapeHtml(p.name)}</strong></td><td>${Number(p.stock || 0)}</td>
                <td>${reportMoney(Number(p.cost || 0) * Number(p.stock || 0))}</td>
                <td>${reportMoney(Number(p.price || 0) * Number(p.stock || 0))}</td>
              </tr>`).join("")
            : `<tr><td colspan="5" class="table-empty">No products available.</td></tr>`
          }</tbody>
        </table>
      </div>
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Sales & Profit report
// ---------------------------------------------------------------------------

export function renderSalesProfitReport(range = activeReportRange) {
  const filtered = getFilteredTransactions(range);
  const sales      = filtered.filter(t => t.type === "SALE");
  const stockIn    = filtered.filter(t => t.type === "STOCK IN");
  const stockOut   = filtered.filter(t => t.type === "STOCK OUT");
  const productDeletes  = filtered.filter(t => t.type === "PRODUCT DELETE").length;
  const priceChanges    = filtered.filter(t => t.type === "PRICE CHANGE").length;
  const stockInCost     = stockIn.reduce((s, t) => s + Number(t.amount || 0), 0);
  const totalSales      = sales.reduce((s, t) => s + Number(t.amount || 0), 0);
  const cogs = sales.reduce((s, t) => {
    const qty = Number(t.qty || 0);
    const product = state.products.find(p => p.name === t.name);
    return s + (t.cogs != null
      ? Number(t.cogs)
      : (t.costPerUnit != null ? Number(t.costPerUnit) : Number(product?.cost || 0)) * qty);
  }, 0);
  const grossProfit = totalSales - cogs;
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const rangeTitle = getRangeLabel(range);

  return `<div class="report-section report-print-section" id="salesProfitReport">
    <div class="report-paper">
      <div class="report-header-banner">
        <div class="report-header-left">
          <div class="report-title-main">SALES, PROFIT &amp; TRANSACTION SUMMARY</div>
          <div class="report-subtitle-date">Range: <strong>${rangeTitle}</strong> • Generated on ${dateStr}</div>
        </div>
        <div class="report-header-badge">FINANCIAL LOG</div>
      </div>

      <div class="report-kpi-grid">
        <div class="report-kpi-card">
          <div class="kpi-label"><img class="inline-icon" src="src/icon/dark/set-capital.svg" alt=""> Starting Capital</div>
          <div class="kpi-value">${reportMoney(state.capital)}</div>
        </div>
        <div class="report-kpi-card">
          <div class="kpi-label"><img class="inline-icon" src="src/icon/dark/cart.svg" alt=""> Total Revenue</div>
          <div class="kpi-value primary">${reportMoney(totalSales)}</div>
          <div class="kpi-sub">${sales.length} sales (${rangeTitle})</div>
        </div>
        <div class="report-kpi-card">
          <div class="kpi-label"><img class="inline-icon" src="src/icon/dark/stock.svg" alt=""> Cost of Goods Sold</div>
          <div class="kpi-value">${reportMoney(cogs)}</div>
        </div>
        <div class="report-kpi-card highlight">
          <div class="kpi-label"><img class="inline-icon" src="src/icon/dark/dashboard-left.svg" alt=""> Gross Profit</div>
          <div class="kpi-value success">${reportMoney(grossProfit)}</div>
        </div>
      </div>

      <div class="report-pills-row">
        <div class="report-pill"><span>Stock-IN Purchases</span><strong>${reportMoney(stockInCost)} (${stockIn.length})</strong></div>
        <div class="report-pill"><span>Stock-OUT Entries</span><strong>${stockOut.length}</strong></div>
        <div class="report-pill"><span>Products Added</span><strong>${state.products.length}</strong></div>
        <div class="report-pill"><span>Price Changes</span><strong>${priceChanges}</strong></div>
        <div class="report-pill"><span>Filtered Logs</span><strong>${filtered.length}</strong></div>
      </div>

      <div class="report-divider-title">
        <span>DETAILED SALES BREAKDOWN</span>
        <small>(${rangeTitle} — Prices at time of transaction)</small>
      </div>

      <div class="report-table-wrap">
        <table class="report-table sales-report-table">
          <thead><tr><th>DATE/TIME</th><th>ID</th><th>ITEM</th><th>QTY</th><th>SRP/UNT</th><th>BASE/UNT</th><th>SRP TOT</th><th>BASE TOT</th><th>PROFIT</th></tr></thead>
          <tbody>${salesReportRows(filtered)}</tbody>
          <tfoot><tr><td colspan="6">RUNNING TOTALS:</td><td>${reportMoney(totalSales)}</td><td>${reportMoney(cogs)}</td><td>${reportMoney(grossProfit)}</td></tr></tfoot>
        </table>
      </div>
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Reports page container
// ---------------------------------------------------------------------------

export function renderReports() {
  return `
    <div class="reports-overview">
      <div class="page-toolbar reports-toolbar">
        <div class="toolbar-left">
          <div class="report-tabs">
            <button class="report-tab ${activeReportTab === "inventory" ? "active" : ""}" data-report-tab="inventory">Inventory &amp; Capital</button>
            <button class="report-tab ${activeReportTab === "sales" ? "active" : ""}" data-report-tab="sales">Sales &amp; Profit</button>
          </div>
        </div>
        <div class="toolbar-right">
          <div class="toolbar-sort-wrap">
            <span class="toolbar-label"><img class="inline-icon" src="src/icon/dark/sort-filter.svg" alt=""> Range:</span>
            <select class="compact-select" id="reportDateRange">
              <option value="30" ${activeReportRange === "30" ? "selected" : ""}>Last 30 Days</option>
              <option value="60" ${activeReportRange === "60" ? "selected" : ""}>Last 60 Days</option>
              <option value="90" ${activeReportRange === "90" ? "selected" : ""}>Last 90 Days</option>
              <option value="this_year" ${activeReportRange === "this_year" ? "selected" : ""}>This Year</option>
              <option value="last_year" ${activeReportRange === "last_year" ? "selected" : ""}>Last Year</option>
            </select>
          </div>
          <button class="wire-btn report-print-btn" id="topReportPrintBtn" data-report-print="${activeReportTab}">
            <img class="btn-icon" src="src/icon/dark/reports.svg" alt=""> Print Report
          </button>
        </div>
      </div>
      <div id="reportTabContent" class="report-tab-content">
        ${activeReportTab === "sales" ? renderSalesProfitReport(activeReportRange) : renderInventoryCapitalReport(activeReportRange)}
      </div>
    </div>`;
}
