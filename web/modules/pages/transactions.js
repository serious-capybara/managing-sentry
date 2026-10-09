/* ============================================================
 * pages/transactions.js — Transaction history (sales + stock
 * movements) page renderer, row builder, and executive print report.
 * ============================================================ */

import { state }             from "../state.js";
import { money, escapeHtml } from "../utils.js";

export function renderTransactions() {
  return `<div class="transactions-overview">
    <div class="page-toolbar">
      <div class="toolbar-left">
        <div class="toolbar-sort-wrap">
          <span class="toolbar-label"><img class="inline-icon" src="src/icon/dark/sort-filter.svg" alt=""> View / Sort:</span>
          <select class="compact-select styled-select-native" id="historySort" aria-label="View or sort history">
            <option value="date" selected>Newest First</option>
            <option value="name">By Product Name</option>
            <option value="SALE">Sales Only</option>
            <option value="STOCK_IN">Stock In Only (Restock)</option>
            <option value="STOCK_OUT">Stock Out Only</option>
            <option value="sales">Highest Sales Amount</option>
          </select>
        </div>
      </div>
      <div class="toolbar-right">
        <input id="transactionSearch" class="compact-input" placeholder="Search transactions...">
        <button class="wire-btn" id="printHistoryBtn"><img class="btn-icon" src="src/icon/dark/reports.svg" alt=""> Print History</button>
      </div>
    </div>
    <div class="wire-table-wrap transactions-table-card">
      <div class="transactions-table-scroll">
        <table class="transactions-inventory-table">
          <thead><tr><th>ID</th><th>Time Stamp</th><th>Order</th><th>Quantity</th><th>Sales</th><th>Status</th><th>Notes</th></tr></thead>
          <tbody id="transactionRows">${transactionRows()}</tbody>
        </table>
      </div>
    </div>
  </div>`;
}

export function parseOrderItems(fullName, tx = null) {
  if (tx) {
    const rawItems = tx.items || tx.order_items || tx.orderItems;
    if (Array.isArray(rawItems) && rawItems.length > 0) {
      return rawItems.map(item => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") {
          const name = item.name || item.product_name || item.productName || "Item";
          const qty = item.qty || item.quantity;
          return qty && Number(qty) > 1 ? `${name} (x${qty})` : name;
        }
        return String(item);
      }).filter(Boolean);
    }
  }
  if (!fullName) return [];
  return String(fullName)
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

export function truncate(str, maxLength = 28) {
  if (!str) return "";
  const s = String(str).trim();
  if (s.length <= maxLength) return s;
  return s.slice(0, maxLength - 3) + "...";
}

export function format24hDate(raw) {
  if (!raw) return "—";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return String(raw);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function transactionRows(list = state.transactions.slice().reverse()) {
  if (!list.length) {
    return `<tr><td colspan="7" class="table-empty">No transactions recorded yet.</td></tr>`;
  }
  return list.map((t, i) => {
    const hasNotes = !!(t.notes && String(t.notes).trim());
    const items = parseOrderItems(t.name, t);
    const firstItem = items[0] || "Transaction Item";
    const extraCount = items.length - 1;
    const isMultiItem = extraCount > 0;
    const orderDisplayText = isMultiItem
      ? `${escapeHtml(firstItem)} <span class="order-extra-badge">+${extraCount}</span>`
      : escapeHtml(firstItem);

    const encodedItems = encodeURIComponent(JSON.stringify(items));
    const formattedDate = format24hDate(t.timestamp || t.date || t.created_at);

    return `<tr>
    <td>${i + 1}</td>
    <td>${escapeHtml(formattedDate)}</td>
    <td class="${isMultiItem ? "order-hover-cell" : ""}" data-order-items="${encodedItems}">${orderDisplayText}</td>
    <td>${t.qty}</td>
    <td>${money(t.amount)}</td>
    <td><span class="badge ${t.type === "SALE" ? "green" : "orange"}">${escapeHtml(t.type)}</span></td>
    <td><button class="notes-btn ${hasNotes ? "has" : "none"}" data-notes-idx="${state.transactions.indexOf(t)}" ${hasNotes ? "" : "disabled"}>${hasNotes ? "Notes" : "Unavailable"}</button></td>
  </tr>`;
  }).join("");
}

/**
 * Generate a vector SVG bar chart comparing Sales vs Stock In vs Stock Out,
 * plus top item breakdowns for the printable history audit report.
 * @param {Array} list - Filtered transaction history list
 * @returns {string} SVG HTML string
 */
export function generateHistoryChartSvg(list = []) {
  const salesList = list.filter(t => (t.type || "").toUpperCase() === "SALE");
  const stockInList = list.filter(t => (t.type || "").toUpperCase() === "STOCK IN" || (t.type || "").toUpperCase() === "STOCK_IN");
  const stockOutList = list.filter(t => (t.type || "").toUpperCase() === "STOCK OUT" || (t.type || "").toUpperCase() === "STOCK_OUT");

  const totalSalesVal = salesList.reduce((s, t) => s + Number(t.amount || 0), 0);
  const totalStockInVal = stockInList.reduce((s, t) => s + Number(t.amount || 0), 0);
  const totalStockOutVal = stockOutList.reduce((s, t) => s + Number(t.amount || 0), 0);

  const salesQty = salesList.reduce((s, t) => s + Number(t.qty || 0), 0);
  const stockInQty = stockInList.reduce((s, t) => s + Number(t.qty || 0), 0);
  const stockOutQty = stockOutList.reduce((s, t) => s + Number(t.qty || 0), 0);

  // Top 5 products by sales volume/value
  const productMap = {};
  salesList.forEach(t => {
    const items = parseOrderItems(t.name, t);
    items.forEach(itemStr => {
      const cleanName = itemStr.replace(/\s*\([^)]*\)\s*$/, "").trim() || "Item";
      if (!productMap[cleanName]) {
        productMap[cleanName] = { count: 0, amount: 0 };
      }
      productMap[cleanName].count += Number(t.qty || 1);
      productMap[cleanName].amount += Number(t.amount || 0) / (items.length || 1);
    });
  });

  const topProducts = Object.entries(productMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const maxCategoryVal = Math.max(totalSalesVal, totalStockInVal, totalStockOutVal, 1);
  const maxProductVal = Math.max(...topProducts.map(p => p.amount), 1);

  const colSales = "#059669";   // emerald
  const colStockIn = "#2563EB"; // blue
  const colStockOut = "#D97706"; // amber

  const barWidth = 46;
  const categories = [
    { label: "Sales Revenue", val: totalSalesVal, sub: `${salesQty} units`, color: colSales },
    { label: "Stock In (Restock)", val: totalStockInVal, sub: `${stockInQty} units`, color: colStockIn },
    { label: "Stock Out", val: totalStockOutVal, sub: `${stockOutQty} units`, color: colStockOut }
  ];

  return `
    <div class="report-chart-section">
      <div class="report-section-title">
        <span>TRANSACTION &amp; MOVEMENT COMPARISON ANALYTICS</span>
      </div>

      <div class="report-chart-container">
        <div class="report-chart-block">
          <div class="chart-block-header">
            <span class="chart-title">TOTAL TRANSACTION VALUE COMPARISON</span>
            <span class="chart-subtitle">Sales vs Restock vs Stock Out</span>
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
                  <text x="${x + barWidth / 2}" y="168" font-size="9" font-weight="500" fill="#64748B" text-anchor="middle">${escapeHtml(c.sub)}</text>
                </g>
              `;
            }).join("")}
          </svg>
        </div>

        <div class="report-chart-block">
          <div class="chart-block-header">
            <span class="chart-title">TOP SALES CONTRIBUTION BY ITEM</span>
            <span class="chart-subtitle">Ranked by revenue contribution</span>
          </div>
          ${topProducts.length > 0 ? `
            <div class="top-products-list">
              ${topProducts.map((p, idx) => {
                const pct = Math.min(100, Math.max(10, Math.round((p.amount / maxProductVal) * 100)));
                return `
                  <div class="top-product-row">
                    <div class="top-product-info">
                      <span class="rank">#${idx + 1}</span>
                      <span class="name">${escapeHtml(p.name)}</span>
                      <span class="val">${money(p.amount)}</span>
                    </div>
                    <div class="top-product-bar-track">
                      <div class="top-product-bar-fill" style="width: ${pct}%;"></div>
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          ` : `<div class="chart-empty-note">No product sales recorded in current view range.</div>`}
        </div>
      </div>
    </div>
  `;
}

/**
 * Render an executive printable PDF report for transaction history.
 * @param {Array} list
 * @returns {string} HTML printable report
 */
export function renderHistoryPrintReport(list = state.transactions) {
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const totalAmount = list.reduce((s, t) => s + Number(t.amount || 0), 0);
  const totalQty = list.reduce((s, t) => s + Number(t.qty || 0), 0);
  const salesCount = list.filter(t => (t.type || "").toUpperCase() === "SALE").length;
  const avgSaleVal = salesCount > 0 ? totalAmount / salesCount : 0;
  const docRef = `LOG-${Date.now().toString(36).toUpperCase()}`;

  return `
    <div class="report-paper history-print-paper">
      <div class="report-header-banner">
        <div class="report-header-left">
          <div class="report-company-title">MANAGING SENTRY • POS &amp; INVENTORY MANAGEMENT</div>
          <div class="report-title-main">OFFICIAL TRANSACTION HISTORY AUDIT REPORT</div>
          <div class="report-subtitle-date">Document ID: <strong>${docRef}</strong> • Generated on ${dateStr}</div>
        </div>
        <div class="report-header-badge">
          <span>OFFICIAL AUDIT REPORT</span>
          <small>CONFIDENTIAL</small>
        </div>
      </div>

      <div class="report-kpi-grid">
        <div class="report-kpi-card">
          <div class="kpi-label">Total Transactions</div>
          <div class="kpi-value">${list.length} <span class="kpi-unit">records</span></div>
          <div class="kpi-sub">All logged events</div>
        </div>
        <div class="report-kpi-card">
          <div class="kpi-label">Sales Transactions</div>
          <div class="kpi-value primary">${salesCount} <span class="kpi-unit">sales</span></div>
          <div class="kpi-sub">Completed purchases</div>
        </div>
        <div class="report-kpi-card">
          <div class="kpi-label">Total Volume</div>
          <div class="kpi-value">${totalQty} <span class="kpi-unit">units</span></div>
          <div class="kpi-sub">Items processed</div>
        </div>
        <div class="report-kpi-card highlight">
          <div class="kpi-label">Total Sales Revenue</div>
          <div class="kpi-value success">${money(totalAmount)}</div>
          <div class="kpi-sub">Avg ${money(avgSaleVal)} / sale</div>
        </div>
      </div>

      ${generateHistoryChartSvg(list)}

      <div class="report-section-title" style="margin-top: 20px;">
        <span>DETAILED TRANSACTION AUDIT LOGS (${list.length})</span>
      </div>

      <div class="report-table-wrap">
        <table class="report-table history-report-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>DATE / TIMESTAMP</th>
              <th>ORDER / ITEMS</th>
              <th>QTY</th>
              <th>AMOUNT</th>
              <th>TYPE</th>
              <th>NOTES</th>
            </tr>
          </thead>
          <tbody>
            ${list.length ? list.map((t, i) => {
              const items = parseOrderItems(t.name, t);
              const firstItem = items[0] || "Transaction Item";
              const truncatedFirst = truncate(firstItem, 20);
              const extraCount = items.length - 1;
              const orderSummaryHtml = extraCount > 0
                ? `<strong title="${escapeHtml(firstItem)}">${escapeHtml(truncatedFirst)}</strong> <span class="report-items-tag">+${extraCount} items</span>`
                : `<strong title="${escapeHtml(firstItem)}">${escapeHtml(truncatedFirst)}</strong>`;

              return `
                <tr>
                  <td>#${i + 1}</td>
                  <td>${escapeHtml(t.date || "—")}</td>
                  <td>${orderSummaryHtml}</td>
                  <td>${t.qty || 1}</td>
                  <td>${money(t.amount || 0)}</td>
                  <td><span class="report-type-badge ${String(t.type).toUpperCase().includes("SALE") ? "sale" : String(t.type).toUpperCase().includes("IN") ? "stock-in" : "stock-out"}">${escapeHtml(t.type || "SALE")}</span></td>
                  <td>${escapeHtml(t.notes || "—")}</td>
                </tr>
              `;
            }).join("") : `<tr><td colspan="7" class="table-empty">No transaction records found.</td></tr>`}
          </tbody>
          ${list.length ? `
            <tfoot>
              <tr>
                <td colspan="3" class="tfoot-label">TOTAL AUDIT RUNNING SUMMARY:</td>
                <td>${totalQty} units</td>
                <td class="tfoot-val highlight-profit">${money(totalAmount)}</td>
                <td colspan="2"></td>
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
        <span>Confidential • Managing Sentry System Official Audit Document</span>
        <span>Page 1 of 1 • ${dateStr}</span>
      </div>
    </div>
  `;
}
