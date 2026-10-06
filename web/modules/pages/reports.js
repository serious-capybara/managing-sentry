/* ============================================================
 * pages/reports.js — Inventory & Capital report and
 * Sales & Profit report renderers, plus print-section helpers.
 * ============================================================ */

import { state }             from "../state.js";
import { money, escapeHtml } from "../utils.js";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export function reportMoney(value) { return money(value); }

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

function salesReportRows() {
  const sales = state.transactions.filter(t => t.type === "SALE");
  if (!sales.length) return `<tr><td colspan="9" class="table-empty">No sales recorded yet.</td></tr>`;
  return sales.map((t, i) => {
    const qty      = Number(t.qty || 0);
    const product  = state.products.find(p => p.name === t.name);
    const baseUnit = t.costPerUnit != null ? Number(t.costPerUnit) : Number(product?.cost || 0);
    const srpTotal = Number(t.amount || 0);
    const baseTotal = baseUnit * qty;
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

export function renderInventoryCapitalReport() {
  const d = inventoryReportData();
  return `<div class="report-section report-print-section" id="inventoryCapitalReport">
    <div class="report-section-head">
      <div><h3>Inventory &amp; Capital Report</h3><p>Current inventory value and capital position.</p></div>
      <button class="wire-btn report-print-btn" data-report-print="inventory">Print</button>
    </div>
    <div class="report-paper">
      <div class="report-print-title">INVENTORY &amp; CAPITAL REPORT</div>
      <div class="report-rule">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
      <div class="report-summary-lines">
        <div><span>💰 STARTING CAPITAL:</span><strong>${reportMoney(state.capital)}</strong></div>
        <div><span>📦 TIE-UP CAPITAL (Base):</span><strong>${reportMoney(d.tieUp)}</strong></div>
        <div><span>🛒 RETAIL VALUE (SRP):</span><strong>${reportMoney(d.retail)}</strong></div>
        <div><span>✨ POTENTIAL PROFIT:</span><strong>${reportMoney(d.potentialProfit)}</strong></div>
      </div>
      <div class="report-inline-stats">
        <span>🧮 TOTAL PRODUCTS: <strong>${state.products.length}</strong></span>
        <span>TOTAL UNITS IN STOCK: <strong>${d.units}</strong></span>
      </div>
      <div class="report-inline-stats">
        <span>🚨 EXPIRED ITEMS: <strong>${d.expiry.expired}</strong></span>
        <span>EXPIRING SOON (7d): <strong>${d.expiry.expiringSoon}</strong></span>
      </div>
      <div class="report-rule">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
      <div class="report-print-subtitle">PER-PRODUCT BREAKDOWN (sorted by SRP value of stock on hand)</div>
      <div class="report-rule thin">────────────────────────────────────────────────────────────────────────────────</div>
      <div class="report-table-wrap">
        <table class="report-table inventory-report-table">
          <thead><tr><th>ID</th><th>NAME</th><th>STOCK</th><th>BASE VAL</th><th>SRP VAL</th></tr></thead>
          <tbody>${d.products.length
            ? d.products.map((p, i) => `<tr>
                <td>${i + 1}</td><td>${escapeHtml(p.name)}</td><td>${Number(p.stock || 0)}</td>
                <td>${reportMoney(Number(p.cost || 0) * Number(p.stock || 0))}</td>
                <td>${reportMoney(Number(p.price || 0) * Number(p.stock || 0))}</td>
              </tr>`).join("")
            : `<tr><td colspan="5" class="table-empty">No products available.</td></tr>`
          }</tbody>
        </table>
      </div>
      <div class="report-rule thin">────────────────────────────────────────────────────────────────────────────────</div>
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Sales & Profit report
// ---------------------------------------------------------------------------

export function renderSalesProfitReport() {
  const sales      = state.transactions.filter(t => t.type === "SALE");
  const stockIn    = state.transactions.filter(t => t.type === "STOCK IN");
  const stockOut   = state.transactions.filter(t => t.type === "STOCK OUT");
  const productDeletes  = state.transactions.filter(t => t.type === "PRODUCT DELETE").length;
  const priceChanges    = state.transactions.filter(t => t.type === "PRICE CHANGE").length;
  const stockInCost     = stockIn.reduce((s, t) => s + Number(t.amount || 0), 0);
  const totalSales      = sales.reduce((s, t) => s + Number(t.amount || 0), 0);
  const cogs = sales.reduce((s, t) => {
    const qty = Number(t.qty || 0);
    const product = state.products.find(p => p.name === t.name);
    return s + (t.costPerUnit != null ? Number(t.costPerUnit) : Number(product?.cost || 0)) * qty;
  }, 0);
  const grossProfit = totalSales - cogs;

  return `<div class="report-section report-print-section" id="salesProfitReport">
    <div class="report-section-head">
      <div><h3>Sales, Profit &amp; Transaction Summary</h3><p>Sales history, costs and gross profit.</p></div>
      <button class="wire-btn report-print-btn" data-report-print="sales">Print</button>
    </div>
    <div class="report-paper">
      <div class="report-print-title">SALES, PROFIT &amp; TRANSACTION SUMMARY</div>
      <div class="report-rule">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
      <div class="report-summary-lines">
        <div><span>💰 STARTING CAPITAL:</span><strong>${reportMoney(state.capital)}</strong></div>
        <div><span>📦 TOTAL STOCK-IN COSTS:</span><strong>${reportMoney(stockInCost)}</strong><em>(${stockIn.length} purchase transactions)</em></div>
        <div><span>🛒 TOTAL SALES (REVENUE):</span><strong>${reportMoney(totalSales)}</strong><em>(${sales.length} sale transactions)</em></div>
        <div><span>COST OF GOODS SOLD:</span><strong>${reportMoney(cogs)}</strong></div>
        <div><span>GROSS PROFIT FROM SALES:</span><strong>${reportMoney(grossProfit)}</strong></div>
      </div>
      <div class="report-print-subtitle">── ALL TRANSACTIONS ──</div>
      <div class="transaction-count-grid">
        <span>Stock-IN: <strong>${stockIn.length}</strong></span>
        <span>Stock-OUT: <strong>${stockOut.length}</strong></span>
        <span>SOLD: <strong>${sales.length}</strong></span>
        <span>Products Add: <strong>${state.products.length}</strong></span>
        <span>Products Del: <strong>${productDeletes}</strong></span>
        <span>Price Changes: <strong>${priceChanges}</strong></span>
        <span>TOTAL LOGS: <strong>${state.transactions.length}</strong> entries</span>
      </div>
      <div class="report-rule">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
      <div class="report-print-subtitle">DETAILED SALES BREAKDOWN (prices at time of sale — not current)</div>
      <div class="report-rule thin">────────────────────────────────────────────────────────────────────────────────</div>
      <div class="report-table-wrap">
        <table class="report-table sales-report-table">
          <thead><tr><th>DATE/TIME</th><th>ID</th><th>ITEM</th><th>QTY</th><th>SRP/UNT</th><th>BASE/UNT</th><th>SRP TOT</th><th>BASE TOT</th><th>PROFIT</th></tr></thead>
          <tbody>${salesReportRows()}</tbody>
          <tfoot><tr><td colspan="6">RUNNING TOTALS:</td><td>${reportMoney(totalSales)}</td><td>${reportMoney(cogs)}</td><td>${reportMoney(grossProfit)}</td></tr></tfoot>
        </table>
      </div>
      <div class="report-rule">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Reports page container
// ---------------------------------------------------------------------------

export function renderReports() {
  return `<div class="page-head"><div><h3>Reports</h3><p>Inventory, capital, sales and profit reports.</p></div></div>
    <div class="report-tabs">
      <button class="report-tab active" data-report-tab="inventory">Inventory &amp; Capital</button>
      <button class="report-tab" data-report-tab="sales">Sales &amp; Profit</button>
    </div>
    <div id="reportTabContent">${renderInventoryCapitalReport()}</div>`;
}
