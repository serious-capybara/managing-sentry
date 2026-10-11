/* ============================================================
 * pages/reports.js — Inventory & Capital report and
 * Sales & Profit report renderers, plus printable report helpers.
 * ============================================================ */

import { state }             from "../state.js";
import { money, escapeHtml } from "../utils.js";
import { truncate, parseOrderItems } from "./transactions.js";

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
  const sales = transactions.filter(t => (t.type || "").toUpperCase() === "SALE");
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
      <td>${escapeHtml(t.date || "—")}</td><td>#${i + 1}</td><td>${escapeHtml(t.name || "—")}</td><td>${qty}</td>
      <td>${reportMoney(srpUnit)}</td><td>${reportMoney(baseUnit)}</td>
      <td>${reportMoney(srpTotal)}</td><td>${reportMoney(baseTotal)}</td><td>${reportMoney(profit)}</td>
    </tr>`;
  }).join("");
}

// ---------------------------------------------------------------------------
// SVG Vector Chart Generators for Print Reports
// ---------------------------------------------------------------------------

export function generateInventoryChartSvg(d) {
  const tieUp = Number(d.tieUp || 0);
  const retail = Number(d.retail || 0);
  const potentialProfit = Number(d.potentialProfit || 0);

  const topStockProducts = (d.products || [])
    .slice()
    .sort((a, b) => (Number(b.price || 0) * Number(b.stock || 0)) - (Number(a.price || 0) * Number(a.stock || 0)))
    .slice(0, 5);

  const maxCategoryVal = Math.max(tieUp, retail, potentialProfit, 1);
  const maxStockVal = topStockProducts.length ? Math.max(...topStockProducts.map(p => Number(p.price || 0) * Number(p.stock || 0)), 1) : 1;

  const barWidth = 46;
  const categories = [
    { label: "Tie-Up (Cost)", val: tieUp, color: "#2563EB" },
    { label: "Retail (SRP)", val: retail, color: "#059669" },
    { label: "Potential Profit", val: potentialProfit, color: "#7C3AED" }
  ];

  return `
    <div class="report-chart-section">
      <div class="report-section-title">
        <span>CAPITAL &amp; VALUATION COMPARISON ANALYTICS</span>
      </div>

      <div class="report-chart-container">
        <div class="report-chart-block">
          <div class="chart-block-header">
            <span class="chart-title">CAPITAL ALLOCATION BREAKDOWN</span>
            <span class="chart-subtitle">Cost Base vs SRP Valuation vs Margin</span>
          </div>
          <svg class="report-svg-chart" viewBox="0 0 360 180" width="100%" height="180">
            <line x1="40" y1="140" x2="340" y2="140" stroke="#CBD5E1" stroke-width="1.5" />
            <line x1="40" y1="20" x2="40" y2="140" stroke="#CBD5E1" stroke-width="1.5" />
            <line x1="40" y1="80" x2="340" y2="80" stroke="#F1F5F9" stroke-width="1" stroke-dasharray="3 3" />

            ${categories.map((c, i) => {
              const h = Math.max(14, Math.round((c.val / maxCategoryVal) * 105));
              const x = 75 + i * 90;
              const y = 140 - h;
              const formattedVal = c.val >= 1000 ? `₱${(c.val / 1000).toFixed(1)}k` : `₱${c.val.toFixed(0)}`;

              return `
                <g class="bar-group">
                  <rect x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="4" fill="${c.color}" />
                  <text x="${x + barWidth / 2}" y="${y - 6}" font-size="10" font-weight="700" fill="#0F172A" text-anchor="middle">${formattedVal}</text>
                  <text x="${x + barWidth / 2}" y="155" font-size="10" font-weight="700" fill="#334155" text-anchor="middle">${escapeHtml(c.label)}</text>
                  <text x="${x + barWidth / 2}" y="168" font-size="9" font-weight="500" fill="#64748B" text-anchor="middle">Valuation</text>
                </g>
              `;
            }).join("")}
          </svg>
        </div>

        <div class="report-chart-block">
          <div class="chart-block-header">
            <span class="chart-title">HIGHEST STOCK VALUE ALLOCATION</span>
            <span class="chart-subtitle">Top inventory items by SRP value</span>
          </div>
          ${topStockProducts.length > 0 ? `
            <div class="top-products-list">
              ${topStockProducts.map((p, idx) => {
                const srpVal = Number(p.price || 0) * Number(p.stock || 0);
                const pct = Math.min(100, Math.max(10, Math.round((srpVal / maxStockVal) * 100)));
                const truncatedName = truncate(p.name, 22);
                return `
                  <div class="top-product-row">
                    <div class="top-product-info">
                      <span class="rank">#${idx + 1}</span>
                      <span class="name" title="${escapeHtml(p.name)}">${escapeHtml(truncatedName)}</span>
                      <span class="val">${money(srpVal)}</span>
                    </div>
                    <div class="top-product-bar-track">
                      <div class="top-product-bar-fill" style="width: ${pct}%;"></div>
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          ` : `<div class="chart-empty-note">No inventory items available.</div>`}
        </div>
      </div>
    </div>
  `;
}

export function generateSalesProfitChartSvg(totalSales, cogs, grossProfit, salesList) {
  const productProfitMap = {};
  salesList.forEach(t => {
    const qty = Number(t.qty || 0);
    const name = t.name || "Item";
    const product = state.products.find(p => p.name === name);
    const baseTotal = t.cogs != null
      ? Number(t.cogs)
      : (t.costPerUnit != null ? Number(t.costPerUnit) : Number(product?.cost || 0)) * qty;
    const srpTotal = Number(t.amount || 0);
    const profit = srpTotal - baseTotal;

    const cleanName = name.trim();
    if (!productProfitMap[cleanName]) {
      productProfitMap[cleanName] = 0;
    }
    productProfitMap[cleanName] += profit;
  });

  const topProfitableProducts = Object.entries(productProfitMap)
    .map(([name, profit]) => ({ name, profit }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5);

  const maxCategoryVal = Math.max(totalSales, cogs, grossProfit, 1);
  const maxProfitVal = topProfitableProducts.length ? Math.max(...topProfitableProducts.map(p => p.profit), 1) : 1;

  const barWidth = 46;
  const categories = [
    { label: "Sales Revenue", val: totalSales, color: "#059669" },
    { label: "Cost of Goods", val: cogs, color: "#2563EB" },
    { label: "Gross Profit", val: grossProfit, color: "#0D9488" }
  ];

  return `
    <div class="report-chart-section">
      <div class="report-section-title">
        <span>FINANCIAL &amp; MARGIN PERFORMANCE ANALYTICS</span>
      </div>

      <div class="report-chart-container">
        <div class="report-chart-block">
          <div class="chart-block-header">
            <span class="chart-title">GROSS REVENUE VS COGS VS NET MARGIN</span>
            <span class="chart-subtitle">Financial performance overview</span>
          </div>
          <svg class="report-svg-chart" viewBox="0 0 360 180" width="100%" height="180">
            <line x1="40" y1="140" x2="340" y2="140" stroke="#CBD5E1" stroke-width="1.5" />
            <line x1="40" y1="20" x2="40" y2="140" stroke="#CBD5E1" stroke-width="1.5" />
            <line x1="40" y1="80" x2="340" y2="80" stroke="#F1F5F9" stroke-width="1" stroke-dasharray="3 3" />

            ${categories.map((c, i) => {
              const h = Math.max(14, Math.round((c.val / maxCategoryVal) * 105));
              const x = 75 + i * 90;
              const y = 140 - h;
              const formattedVal = c.val >= 1000 ? `₱${(c.val / 1000).toFixed(1)}k` : `₱${c.val.toFixed(0)}`;

              return `
                <g class="bar-group">
                  <rect x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="4" fill="${c.color}" />
                  <text x="${x + barWidth / 2}" y="${y - 6}" font-size="10" font-weight="700" fill="#0F172A" text-anchor="middle">${formattedVal}</text>
                  <text x="${x + barWidth / 2}" y="155" font-size="10" font-weight="700" fill="#334155" text-anchor="middle">${escapeHtml(c.label)}</text>
                  <text x="${x + barWidth / 2}" y="168" font-size="9" font-weight="500" fill="#64748B" text-anchor="middle">Financials</text>
                </g>
              `;
            }).join("")}
          </svg>
        </div>

        <div class="report-chart-block">
          <div class="chart-block-header">
            <span class="chart-title">TOP PROFIT GENERATING PRODUCTS</span>
            <span class="chart-subtitle">Ranked by gross profit margin contribution</span>
          </div>
          ${topProfitableProducts.length > 0 ? `
            <div class="top-products-list">
              ${topProfitableProducts.map((p, idx) => {
                const pct = Math.min(100, Math.max(10, Math.round((p.profit / maxProfitVal) * 100)));
                const truncatedName = truncate(p.name, 22);
                return `
                  <div class="top-product-row">
                    <div class="top-product-info">
                      <span class="rank">#${idx + 1}</span>
                      <span class="name" title="${escapeHtml(p.name)}">${escapeHtml(truncatedName)}</span>
                      <span class="val">${money(p.profit)}</span>
                    </div>
                    <div class="top-product-bar-track">
                      <div class="top-product-bar-fill" style="width: ${pct}%;"></div>
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          ` : `<div class="chart-empty-note">No sales records available in current view range.</div>`}
        </div>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// On-Screen Report Renderers
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

export function renderSalesProfitReport(range = activeReportRange) {
  const filtered = getFilteredTransactions(range);
  const sales      = filtered.filter(t => (t.type || "").toUpperCase() === "SALE");
  const stockIn    = filtered.filter(t => (t.type || "").toUpperCase() === "STOCK IN" || (t.type || "").toUpperCase() === "STOCK_IN");
  const stockOut   = filtered.filter(t => (t.type || "").toUpperCase() === "STOCK OUT" || (t.type || "").toUpperCase() === "STOCK_OUT");
  const priceChanges    = filtered.filter(t => (t.type || "").toUpperCase() === "PRICE CHANGE").length;
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
          ${sales.length ? `<tfoot><tr><td colspan="6" class="tfoot-label">RUNNING TOTALS:</td><td class="tfoot-val">${reportMoney(totalSales)}</td><td class="tfoot-val">${reportMoney(cogs)}</td><td class="tfoot-val highlight-profit">${reportMoney(grossProfit)}</td></tr></tfoot>` : ""}
        </table>
      </div>
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Executive Formal Printable PDF/Paper Reports
// ---------------------------------------------------------------------------

export function renderInventoryCapitalPrintReport(range = activeReportRange) {
  const d = inventoryReportData();
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const rangeTitle = getRangeLabel(range);
  const docRef = `INV-${Date.now().toString(36).toUpperCase()}`;

  return `
    <div class="report-paper history-print-paper">
      <div class="report-header-banner">
        <div class="report-header-left">
          <div class="report-company-title">MANAGING SENTRY • POS &amp; INVENTORY MANAGEMENT</div>
          <div class="report-title-main">OFFICIAL INVENTORY &amp; CAPITAL AUDIT REPORT</div>
          <div class="report-subtitle-date">Document ID: <strong>${docRef}</strong> • Range: <strong>${rangeTitle}</strong> • Generated on ${dateStr}</div>
        </div>
        <div class="report-header-badge">
          <span>MANAGEMENT AUDIT</span>
          <small>CONFIDENTIAL</small>
        </div>
      </div>

      <div class="report-kpi-grid">
        <div class="report-kpi-card">
          <div class="kpi-label">Starting Capital</div>
          <div class="kpi-value">${reportMoney(state.capital)}</div>
          <div class="kpi-sub">Baseline capital</div>
        </div>
        <div class="report-kpi-card">
          <div class="kpi-label">Tie-Up Capital (Cost)</div>
          <div class="kpi-value">${reportMoney(d.tieUp)}</div>
          <div class="kpi-sub">Stock cost on hand</div>
        </div>
        <div class="report-kpi-card">
          <div class="kpi-label">Retail Value (SRP)</div>
          <div class="kpi-value primary">${reportMoney(d.retail)}</div>
          <div class="kpi-sub">SRP stock value</div>
        </div>
        <div class="report-kpi-card highlight">
          <div class="kpi-label">Potential Gross Profit</div>
          <div class="kpi-value success">${reportMoney(d.potentialProfit)}</div>
          <div class="kpi-sub">Expected margin</div>
        </div>
      </div>

      <div class="report-pills-row">
        <div class="report-pill"><span>Total Products:</span> <strong>${state.products.length} items</strong></div>
        <div class="report-pill"><span>Units In Stock:</span> <strong>${d.units} units</strong></div>
        <div class="report-pill ${d.expiry.expired ? "alert-red" : ""}"><span>Expired Items:</span> <strong>${d.expiry.expired}</strong></div>
        <div class="report-pill ${d.expiry.expiringSoon ? "alert-amber" : ""}"><span>Expiring Soon (7d):</span> <strong>${d.expiry.expiringSoon}</strong></div>
      </div>

      ${generateInventoryChartSvg(d)}

      <div class="report-section-title" style="margin-top: 20px;">
        <span>PER-PRODUCT INVENTORY &amp; CAPITAL AUDIT (${d.products.length})</span>
      </div>

      <div class="report-table-wrap">
        <table class="report-table history-report-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>PRODUCT NAME</th>
              <th>CATEGORY</th>
              <th>STOCK</th>
              <th>COST / UNT</th>
              <th>SRP / UNT</th>
              <th>BASE VAL</th>
              <th>SRP VAL</th>
            </tr>
          </thead>
          <tbody>
            ${d.products.length ? d.products.map((p, i) => `
              <tr>
                <td>#${i + 1}</td>
                <td><strong title="${escapeHtml(p.name)}">${escapeHtml(truncate(p.name, 26))}</strong></td>
                <td>${escapeHtml(p.category || "General")}</td>
                <td>${Number(p.stock || 0)}</td>
                <td>${reportMoney(p.cost || 0)}</td>
                <td>${reportMoney(p.price || 0)}</td>
                <td>${reportMoney(Number(p.cost || 0) * Number(p.stock || 0))}</td>
                <td>${reportMoney(Number(p.price || 0) * Number(p.stock || 0))}</td>
              </tr>
            `).join("") : `<tr><td colspan="8" class="table-empty">No products available.</td></tr>`}
          </tbody>
          ${d.products.length ? `
            <tfoot>
              <tr>
                <td colspan="3" class="tfoot-label">TOTAL STOCK RUNNING VALUATION:</td>
                <td>${d.units} units</td>
                <td colspan="2"></td>
                <td class="tfoot-val">${reportMoney(d.tieUp)}</td>
                <td class="tfoot-val highlight-profit">${reportMoney(d.retail)}</td>
              </tr>
            </tfoot>
          ` : ""}
        </table>
      </div>

      <div class="report-sign-footer">
        <div class="sign-block">
          <div class="sign-line"></div>
          <div class="sign-label">Prepared By (Auditor / Staff)</div>
        </div>
        <div class="sign-block">
          <div class="sign-line"></div>
          <div class="sign-label">Approved By (Super Admin / Manager)</div>
        </div>
      </div>

      <div class="report-footer-note">
        <span>Confidential • Managing Sentry System Official Inventory &amp; Capital Audit Document</span>
        <span>Page 1 of 1 • ${dateStr}</span>
      </div>
    </div>
  `;
}

export function renderSalesProfitPrintReport(range = activeReportRange) {
  const filtered = getFilteredTransactions(range);
  const sales      = filtered.filter(t => (t.type || "").toUpperCase() === "SALE");
  const stockIn    = filtered.filter(t => (t.type || "").toUpperCase() === "STOCK IN" || (t.type || "").toUpperCase() === "STOCK_IN");
  const stockOut   = filtered.filter(t => (t.type || "").toUpperCase() === "STOCK OUT" || (t.type || "").toUpperCase() === "STOCK_OUT");
  const priceChanges = filtered.filter(t => (t.type || "").toUpperCase() === "PRICE CHANGE").length;
  const stockInCost  = stockIn.reduce((s, t) => s + Number(t.amount || 0), 0);
  const totalSales   = sales.reduce((s, t) => s + Number(t.amount || 0), 0);
  const cogs = sales.reduce((s, t) => {
    const qty = Number(t.qty || 0);
    const product = state.products.find(p => p.name === t.name);
    return s + (t.cogs != null
      ? Number(t.cogs)
      : (t.costPerUnit != null ? Number(t.costPerUnit) : Number(product?.cost || 0)) * qty);
  }, 0);
  const grossProfit = totalSales - cogs;
  const profitMarginPct = totalSales > 0 ? ((grossProfit / totalSales) * 100).toFixed(1) : "0.0";
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const rangeTitle = getRangeLabel(range);
  const docRef = `FIN-${Date.now().toString(36).toUpperCase()}`;

  return `
    <div class="report-paper history-print-paper">
      <div class="report-header-banner">
        <div class="report-header-left">
          <div class="report-company-title">MANAGING SENTRY • POS &amp; INVENTORY MANAGEMENT</div>
          <div class="report-title-main">OFFICIAL SALES, PROFIT &amp; FINANCIAL AUDIT REPORT</div>
          <div class="report-subtitle-date">Document ID: <strong>${docRef}</strong> • Range: <strong>${rangeTitle}</strong> • Generated on ${dateStr}</div>
        </div>
        <div class="report-header-badge">
          <span>FINANCIAL AUDIT</span>
          <small>CONFIDENTIAL</small>
        </div>
      </div>

      <div class="report-kpi-grid">
        <div class="report-kpi-card">
          <div class="kpi-label">Gross Revenue</div>
          <div class="kpi-value primary">${reportMoney(totalSales)}</div>
          <div class="kpi-sub">${sales.length} sales (${rangeTitle})</div>
        </div>
        <div class="report-kpi-card">
          <div class="kpi-label">Cost of Goods (COGS)</div>
          <div class="kpi-value">${reportMoney(cogs)}</div>
          <div class="kpi-sub">Total product base cost</div>
        </div>
        <div class="report-kpi-card highlight">
          <div class="kpi-label">Gross Profit</div>
          <div class="kpi-value success">${reportMoney(grossProfit)}</div>
          <div class="kpi-sub">Net revenue margin</div>
        </div>
        <div class="report-kpi-card">
          <div class="kpi-label">Profit Margin %</div>
          <div class="kpi-value">${profitMarginPct}%</div>
          <div class="kpi-sub">Gross margin ratio</div>
        </div>
      </div>

      <div class="report-pills-row">
        <div class="report-pill"><span>Stock-IN Purchases:</span> <strong>${reportMoney(stockInCost)} (${stockIn.length})</strong></div>
        <div class="report-pill"><span>Stock-OUT Entries:</span> <strong>${stockOut.length}</strong></div>
        <div class="report-pill"><span>Price Changes:</span> <strong>${priceChanges}</strong></div>
        <div class="report-pill"><span>Filtered Logs:</span> <strong>${filtered.length} records</strong></div>
      </div>

      ${generateSalesProfitChartSvg(totalSales, cogs, grossProfit, sales)}

      <div class="report-section-title" style="margin-top: 20px;">
        <span>DETAILED SALES AUDIT BREAKDOWN (${sales.length})</span>
      </div>

      <div class="report-table-wrap">
        <table class="report-table history-report-table">
          <thead>
            <tr>
              <th>DATE / TIME</th>
              <th>ID</th>
              <th>ITEM / ORDER</th>
              <th>QTY</th>
              <th>SRP / UNT</th>
              <th>BASE / UNT</th>
              <th>TOTAL SRP</th>
              <th>TOTAL BASE</th>
              <th>NET PROFIT</th>
            </tr>
          </thead>
          <tbody>
            ${sales.length ? sales.map((t, i) => {
              const qty = Number(t.qty || 0);
              const product = state.products.find(p => p.name === t.name);
              const baseTotal = t.cogs != null
                ? Number(t.cogs)
                : (t.costPerUnit != null ? Number(t.costPerUnit) : Number(product?.cost || 0)) * qty;
              const baseUnit = qty ? baseTotal / qty : 0;
              const srpTotal = Number(t.amount || 0);
              const profit   = srpTotal - baseTotal;
              const srpUnit  = qty ? srpTotal / qty : 0;

              return `
                <tr>
                  <td>${escapeHtml(t.date || "—")}</td>
                  <td>#${i + 1}</td>
                  <td><strong title="${escapeHtml(t.name)}">${escapeHtml(truncate(t.name || "—", 24))}</strong></td>
                  <td>${qty}</td>
                  <td>${reportMoney(srpUnit)}</td>
                  <td>${reportMoney(baseUnit)}</td>
                  <td>${reportMoney(srpTotal)}</td>
                  <td>${reportMoney(baseTotal)}</td>
                  <td><strong style="color: ${profit >= 0 ? "#059669" : "#DC2626"};">${reportMoney(profit)}</strong></td>
                </tr>
              `;
            }).join("") : `<tr><td colspan="9" class="table-empty">No sales recorded for ${getRangeLabel(range)}.</td></tr>`}
          </tbody>
          ${sales.length ? `
            <tfoot>
              <tr>
                <td colspan="6" class="tfoot-label">TOTAL FINANCIAL RUNNING SUMMARY:</td>
                <td class="tfoot-val">${reportMoney(totalSales)}</td>
                <td class="tfoot-val">${reportMoney(cogs)}</td>
                <td class="tfoot-val highlight-profit">${reportMoney(grossProfit)}</td>
              </tr>
            </tfoot>
          ` : ""}
        </table>
      </div>

      <div class="report-sign-footer">
        <div class="sign-block">
          <div class="sign-line"></div>
          <div class="sign-label">Prepared By (Auditor / Staff)</div>
        </div>
        <div class="sign-block">
          <div class="sign-line"></div>
          <div class="sign-label">Approved By (Super Admin / Manager)</div>
        </div>
      </div>

      <div class="report-footer-note">
        <span>Confidential • Managing Sentry System Official Financial Audit Document</span>
        <span>Page 1 of 1 • ${dateStr}</span>
      </div>
    </div>
  `;
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
            <select class="compact-select styled-select-native" id="reportDateRange" aria-label="Select report date range">
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
