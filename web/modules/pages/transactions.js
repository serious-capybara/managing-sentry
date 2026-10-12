/* ============================================================
 * pages/transactions.js — Transaction history (sales + stock
 * movements) page renderer, row builder, and executive print report.
 * ============================================================ */

import { state }             from "../state.js";
import { money, escapeHtml } from "../utils.js";
import { proDocument, proHeading, proSummary } from "../print-report.js";

export function renderTransactions() {
  return `<div class="transactions-overview">
    <div class="page-toolbar">
      <div class="toolbar-left">
        <div class="toolbar-sort-wrap">
          <span class="toolbar-label"><img class="inline-icon" src="src/icon/dark/sort-filter.svg" alt=""> Show:</span>
          <select class="compact-select styled-select-native" id="historySort" aria-label="Filter history">
            <option value="newest" selected>Newest</option>
            <option value="sales">Sales</option>
            <option value="stock">Stock</option>
          </select>
        </div>
      </div>
      <div class="toolbar-right">
        <input id="transactionSearch" class="compact-input" placeholder="Search transactions...">
        <button class="wire-btn" id="printHistoryBtn"><img class="btn-icon" src="src/icon/dark/reports.svg" alt=""> Print History</button>
      </div>
    </div>
    ${historyBanner()}
    <div class="wire-table-wrap transactions-table-card">
      <div class="transactions-table-scroll">
        <table class="transactions-inventory-table">
          <thead><tr><th>ID</th><th>Time Stamp</th><th>Order</th><th>Quantity</th><th>Amount</th><th>Status</th><th>Notes</th></tr></thead>
          <tbody id="transactionRows">${transactionRows()}</tbody>
        </table>
      </div>
    </div>
  </div>`;
}

/** Red notice above the table whenever the server history failed (fully or partly). */
export function historyBanner() {
  if (!state.historyError) return `<div id="historyBanner" class="history-banner hidden" role="alert"></div>`;
  const where = state.historySource ? ` <small>(server: ${escapeHtml(state.historySource)})</small>` : "";
  return `<div id="historyBanner" class="history-banner" role="alert">
    <span>${escapeHtml(state.historyError)}${where}</span>
    <button type="button" class="wire-btn" id="retryHistoryBtn">Retry</button>
  </div>`;
}

/** Type helpers shared by the filter, the table and the reports. */
export const isSaleType  = t => String(t?.type || "").trim().toUpperCase() === "SALE";
export const isStockType = t => /^STOCK[ _]?(IN|OUT)$/.test(String(t?.type || "").trim().toUpperCase());

/**
 * Filter + order the history list.
 *  newest → everything, newest first   sales → sales only   stock → stock in/out only
 */
export function filterHistory(list, mode = "newest", query = "") {
  const q = String(query || "").trim().toLowerCase();
  let out = [...list];
  if (mode === "sales") out = out.filter(isSaleType);
  else if (mode === "stock") out = out.filter(isStockType);
  if (q) out = out.filter(t => `${t.name} ${t.type} ${t.date} ${t.notes || ""}`.toLowerCase().includes(q));
  return out.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0) || (b.id || 0) - (a.id || 0));
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

export function transactionRows(list = state.transactions) {
  if (!list.length) {
    const why = state.historyError
      ? `Could not load history from the server: ${escapeHtml(state.historyError)}`
      : "No transactions to show.";
    return `<tr><td colspan="7" class="table-empty">${why}</td></tr>`;
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
    const formattedDate = t.timestamp ? format24hDate(t.timestamp) : (t.date || "—");
    const isStock = isStockType(t);
    const qtyText = isStock ? `${Number(t.qty) > 0 ? "+" : ""}${Number(t.qty)}` : String(t.qty);

    return `<tr>
    <td>${i + 1}</td>
    <td>${escapeHtml(formattedDate)}</td>
    <td class="${isMultiItem ? "order-hover-cell" : ""}" data-order-items="${encodedItems}">${orderDisplayText}</td>
    <td>${qtyText}</td>
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

  const salesQty = salesList.reduce((s, t) => s + Math.abs(Number(t.qty || 0)), 0);
  const stockInQty = stockInList.reduce((s, t) => s + Math.abs(Number(t.qty || 0)), 0);
  const stockOutQty = stockOutList.reduce((s, t) => s + Math.abs(Number(t.qty || 0)), 0);

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
 * Printable transaction-history report (professional layout, see css/print-report.css).
 * @param {Array} list  the rows currently shown on screen
 * @param {string} mode "newest" | "sales" | "stock" — printed as the filter used
 */
export function renderHistoryPrintReport(list = state.transactions, mode = "newest") {
  const typeOf = t => String(t.type || "").toUpperCase().replace(/_/g, " ");
  const sales = list.filter(isSaleType);
  const stockIn = list.filter(t => typeOf(t) === "STOCK IN");
  const stockOut = list.filter(t => typeOf(t) === "STOCK OUT");
  const sum = (arr, f) => arr.reduce((n, t) => n + f(t), 0);
  const revenue = sum(sales, t => Number(t.amount || 0));
  const unitsSold = sum(sales, t => Math.abs(Number(t.qty || 0)));
  const unitsIn = sum(stockIn, t => Math.abs(Number(t.qty || 0)));
  const unitsOut = sum(stockOut, t => Math.abs(Number(t.qty || 0)));
  const filterLabel = { newest: "All activity (newest first)", sales: "Sales only", stock: "Stock movements only" }[mode] || "All activity";

  const rows = list.map((t, i) => {
    const items = parseOrderItems(t.name, t);
    const type = typeOf(t) || "SALE";
    const cls = type === "SALE" ? "sale" : type === "STOCK IN" ? "stock-in" : "stock-out";
    const qty = isStockType(t) ? `${Number(t.qty) > 0 ? "+" : ""}${Number(t.qty)}` : String(t.qty ?? 1);
    return `<tr>
      <td class="num">${i + 1}</td>
      <td class="nowrap">${escapeHtml(t.timestamp ? format24hDate(t.timestamp) : (t.date || "—"))}</td>
      <td><span class="pro-tag ${cls}">${escapeHtml(type)}</span></td>
      <td>${escapeHtml(items.join(", ") || "—")}</td>
      <td class="num">${escapeHtml(qty)}</td>
      <td class="num">${money(t.amount || 0)}</td>
      <td>${escapeHtml(t.notes || "—")}</td>
    </tr>`;
  }).join("");

  const body = `
    ${proHeading("Summary")}
    ${proSummary([
      { label: "Records listed", value: String(list.length), note: filterLabel },
      { label: "Sales", value: String(sales.length), note: `${unitsSold} units sold` },
      { label: "Sales revenue", value: money(revenue), tone: "good", note: sales.length ? `Avg ${money(revenue / sales.length)} per sale` : "No sales" },
      { label: "Stock movements", value: String(stockIn.length + stockOut.length), note: `+${unitsIn} in / −${unitsOut} out` }
    ])}


    ${generateHistoryChartSvg(list)}

    ${proHeading("Transaction log", `${list.length} record${list.length === 1 ? "" : "s"}`)}
    <table class="pro-table">
      <colgroup><col style="width:5%"><col style="width:21%"><col style="width:11%"><col style="width:27%"><col style="width:6%"><col style="width:12%"><col style="width:18%"></colgroup>
      <thead><tr>
        <th class="num">No.</th><th>Date &amp; time</th><th>Type</th><th>Order / item</th>
        <th class="num">Qty</th><th class="num">Amount</th><th>Notes</th>
      </tr></thead>
      <tbody>${rows || `<tr><td colspan="7" class="empty">No transaction records found.</td></tr>`}</tbody>
      ${list.length ? `<tfoot><tr>
        <td colspan="5" class="label">Total sales revenue</td>
        <td class="num">${money(revenue)}</td><td></td>
      </tr></tfoot>` : ""}
    </table>`;

  return proDocument({
    prefix: "HST",
    title: "Transaction History Report",
    subtitle: "Sales and inventory movements",
    details: [["Filter", filterLabel]],
    body
  });
}
