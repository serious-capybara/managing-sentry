/* ============================================================
 * pages/reports.js — Inventory & Capital report and
 * Sales & Profit report renderers, plus printable report helpers.
 * ============================================================ */

import { state }             from "../state.js";
import { money, escapeHtml } from "../utils.js";
import { truncate, parseOrderItems, isSaleType } from "./transactions.js";
import { proDocument, proHeading, proSummary } from "../print-report.js";

export let activeReportTab = "inventory";
export let activeReportRange = "30";

export function setActiveReportTab(tab) { activeReportTab = tab; }
export function setActiveReportRange(range) { activeReportRange = range; }

/** On-screen Sales & Profit report shows ONE of these at a time: "breakdown" | "prices". */
export let activeSalesView = "breakdown";
export function setActiveSalesView(view) { activeSalesView = view === "prices" ? "prices" : "breakdown"; }

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
  return state.transactions.filter(t => Number(t.timestamp) > 0 && inRange(t.timestamp, range));
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

// ---------------------------------------------------------------------------
// Sales & profit engine (built on order_items snapshots)
// ---------------------------------------------------------------------------

function rangeStart(range = activeReportRange) {
  const now = new Date();
  if (range === "60") return { from: Date.now() - 60 * 86400000, to: Infinity };
  if (range === "90") return { from: Date.now() - 90 * 86400000, to: Infinity };
  if (range === "this_year") return { from: new Date(now.getFullYear(), 0, 1).getTime(), to: Infinity };
  if (range === "last_year") {
    return {
      from: new Date(now.getFullYear() - 1, 0, 1).getTime(),
      to: new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999).getTime()
    };
  }
  return { from: Date.now() - 30 * 86400000, to: Infinity };
}

function inRange(ts, range) {
  const { from, to } = rangeStart(range);
  return Number(ts) >= from && Number(ts) <= to;
}

/** One line per product sold. Uses the order_items snapshot (price/cost at the time of sale). */
export function saleLines(sales) {
  const lines = [];
  sales.forEach(t => {
    const items = Array.isArray(t.items) ? t.items.filter(i => i && typeof i === "object") : [];
    if (items.length && items.every(i => i.price != null && i.cost != null)) {
      items.forEach(i => {
        const qty = Number(i.qty ?? i.quantity ?? 0);
        const price = Number(i.price);
        const cost = Number(i.cost);
        lines.push({
          orderId: t.order_id ?? t.id, ts: t.timestamp, date: t.date,
          productId: i.product_id ?? null, name: i.name || "Item",
          qty, price, cost, revenue: price * qty, cogs: cost * qty
        });
      });
    } else {
      // Older cached rows without line items: fall back to the order totals.
      const qty = Number(t.qty || 0);
      const cogs = t.cogs != null ? Number(t.cogs) : Number(t.costPerUnit || 0) * qty;
      const revenue = Number(t.amount || 0);
      lines.push({
        orderId: t.order_id ?? t.id, ts: t.timestamp, date: t.date, productId: null,
        name: t.name || "Transaction Item", qty,
        price: qty ? revenue / qty : 0, cost: qty ? cogs / qty : 0, revenue, cogs
      });
    }
  });
  return lines;
}

/**
 * Price / cost changes detected from sales history.
 * For each product, walk its sale lines oldest → newest; whenever the price (or cost) snapshot differs from
 * the previous sale, that is one change. A product whose CURRENT price differs from its last sold snapshot is
 * also reported as a pending change (not sold yet at the new price).
 */
export function computePriceChanges(range = activeReportRange) {
  const allSales = state.transactions.filter(isSaleType);
  const lines = saleLines(allSales)
    .filter(l => l.productId != null)
    .sort((a, b) => (a.ts || 0) - (b.ts || 0));

  const byProduct = new Map();
  lines.forEach(l => {
    if (!byProduct.has(l.productId)) byProduct.set(l.productId, []);
    byProduct.get(l.productId).push(l);
  });

  const eq = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005;
  const events = [];

  byProduct.forEach((list, productId) => {
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1], cur = list[i];
      if (eq(prev.price, cur.price) && eq(prev.cost, cur.cost)) continue;
      if (!inRange(cur.ts, range)) continue;
      events.push({
        productId, name: cur.name, ts: cur.ts, date: cur.date, pending: false,
        oldPrice: prev.price, newPrice: cur.price, oldCost: prev.cost, newCost: cur.cost
      });
    }
    const last = list[list.length - 1];
    const product = state.products.find(p => Number(p.id) === Number(productId));
    if (product && (!eq(product.price, last.price) || !eq(product.cost, last.cost))) {
      events.push({
        productId, name: product.name, ts: null, date: null, pending: true,
        oldPrice: last.price, newPrice: Number(product.price), oldCost: last.cost, newCost: Number(product.cost)
      });
    }
  });

  events.sort((a, b) => (b.ts ?? Infinity) - (a.ts ?? Infinity));
  const products = new Set(events.map(e => e.productId));
  return { events, productsChanged: products.size, changeCount: events.length };
}

export function computeSalesReport(range = activeReportRange) {
  const filtered = getFilteredTransactions(range);
  const sales = filtered.filter(isSaleType);
  const typeOf = t => String(t.type || "").toUpperCase().replace(/_/g, " ");
  const stockIn = filtered.filter(t => typeOf(t) === "STOCK IN");
  const stockOut = filtered.filter(t => typeOf(t) === "STOCK OUT");
  const lines = saleLines(sales);

  const revenue = sales.reduce((s, t) => s + Number(t.amount || 0), 0);
  const cogs = lines.reduce((s, l) => s + l.cogs, 0);
  const grossProfit = revenue - cogs;
  const stockInCost = stockIn.reduce((s, t) => s + Number(t.amount || 0), 0);
  const productsAdded = filtered.filter(t => /^product added/i.test(String(t.notes || ""))).length;
  const priceChanges = computePriceChanges(range);

  return {
    filtered, sales, stockIn, stockOut, lines, revenue, cogs, grossProfit,
    margin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
    stockInCost, productsAdded, priceChanges
  };
}

function salesLineRows(lines, range = activeReportRange) {
  if (!lines.length) {
    return `<tr><td colspan="9" class="table-empty">No sales recorded for ${getRangeLabel(range)}.</td></tr>`;
  }
  return lines.map((l, i) => {
    const profit = l.revenue - l.cogs;
    return `<tr>
      <td>#${i + 1}</td>
      <td class="report-order-cell"><strong title="${escapeHtml(l.name)}">${escapeHtml(truncate(l.name, 30))}</strong></td>
      <td>${escapeHtml(l.date || "—")}</td>
      <td>${l.qty}</td>
      <td>${reportMoney(l.price)}</td>
      <td>${reportMoney(l.cost)}</td>
      <td>${reportMoney(l.revenue)}</td>
      <td>${reportMoney(l.cogs)}</td>
      <td><strong style="color: ${profit >= 0 ? "#059669" : "#DC2626"};">${reportMoney(profit)}</strong></td>
    </tr>`;
  }).join("");
}

function priceChangeSection(pc) {
  const pct = (a, b) => (a > 0 ? ((b - a) / a) * 100 : 0);
  const arrow = (a, b) => (b > a ? "▲" : b < a ? "▼" : "•");
  const color = (a, b) => (b > a ? "#D97706" : b < a ? "#2563EB" : "#475569");
  const rows = pc.events.length
    ? pc.events.map(e => `<tr>
        <td><strong title="${escapeHtml(e.name)}">${escapeHtml(truncate(e.name, 28))}</strong></td>
        <td>${reportMoney(e.oldPrice)}</td>
        <td>${reportMoney(e.newPrice)}</td>
        <td style="color:${color(e.oldPrice, e.newPrice)}; font-weight:700;">${arrow(e.oldPrice, e.newPrice)} ${reportMoney(Math.abs(e.newPrice - e.oldPrice))} (${pct(e.oldPrice, e.newPrice).toFixed(1)}%)</td>
        <td>${reportMoney(e.oldCost)} → ${reportMoney(e.newCost)}</td>
        <td>${e.pending ? "Current price (not sold yet)" : escapeHtml(e.date || "—")}</td>
      </tr>`).join("")
    : `<tr><td colspan="6" class="table-empty">No price changes found in the sales snapshots for this range.</td></tr>`;

  return `
    <div class="report-divider-title">
      <span>PRICE CHANGES</span>
      <small>(${pc.productsChanged} product${pc.productsChanged === 1 ? "" : "s"} changed • ${pc.changeCount} change${pc.changeCount === 1 ? "" : "s"} — from order item snapshots)</small>
    </div>
    <div class="report-table-wrap">
      <table class="report-table price-change-table">
        <thead><tr><th>PRODUCT</th><th>OLD SRP</th><th>NEW SRP</th><th>CHANGE</th><th>COST (OLD → NEW)</th><th>SEEN ON</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
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

export function generateSalesProfitChartSvg(totalSales, cogs, grossProfit, lines = []) {
  const productProfitMap = {};
  lines.forEach(l => {
    const key = (l.name || "Item").trim();
    productProfitMap[key] = (productProfitMap[key] || 0) + (l.revenue - l.cogs);
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
          <div class="kpi-label"><img class="inline-icon" src="src/icon/dark/set-capital.svg" alt=""> Current Capital</div>
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
  const r = computeSalesReport(range);
  const { filtered, sales, stockIn, stockOut, revenue: totalSales, cogs, grossProfit, stockInCost } = r;
  const priceChanges = r.priceChanges.productsChanged;
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
          <div class="kpi-label"><img class="inline-icon" src="src/icon/dark/set-capital.svg" alt=""> Current Capital</div>
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
        <div class="report-pill"><span>Products Added</span><strong>${r.productsAdded}</strong></div>
        <div class="report-pill"><span>Products w/ Price Changes</span><strong>${priceChanges}</strong></div>
        <div class="report-pill"><span>Filtered Logs</span><strong>${filtered.length}</strong></div>
      </div>

      <div class="report-subtabs" role="tablist" aria-label="Sales report sections">
        <button type="button" role="tab" class="report-subtab ${activeSalesView === "breakdown" ? "active" : ""}" data-sales-view="breakdown" aria-selected="${activeSalesView === "breakdown"}">
          Detailed Breakdown <span class="report-subtab-count">${r.lines.length}</span>
        </button>
        <button type="button" role="tab" class="report-subtab ${activeSalesView === "prices" ? "active" : ""}" data-sales-view="prices" aria-selected="${activeSalesView === "prices"}">
          Price Changes <span class="report-subtab-count">${r.priceChanges.changeCount}</span>
        </button>
      </div>

      ${activeSalesView === "prices" ? priceChangeSection(r.priceChanges) : `
      <div class="report-divider-title">
        <span>DETAILED SALES BREAKDOWN</span>
        <small>(${rangeTitle} — price &amp; cost as recorded at the time of each sale)</small>
      </div>

      <div class="report-table-wrap">
        <table class="report-table sales-report-table">
          <thead><tr><th>ID</th><th>ITEM</th><th>DATE/TIME</th><th>QTY</th><th>SRP/UNT</th><th>BASE/UNT</th><th>SRP TOT</th><th>BASE TOT</th><th>PROFIT</th></tr></thead>
          <tbody>${salesLineRows(r.lines, range)}</tbody>
          ${r.lines.length ? `<tfoot><tr><td colspan="6" class="tfoot-label">RUNNING TOTALS:</td><td class="tfoot-val">${reportMoney(totalSales)}</td><td class="tfoot-val">${reportMoney(cogs)}</td><td class="tfoot-val highlight-profit">${reportMoney(grossProfit)}</td></tr></tfoot>` : ""}
        </table>
      </div>`}
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Executive Formal Printable PDF/Paper Reports
// ---------------------------------------------------------------------------

export function renderInventoryCapitalPrintReport(range = activeReportRange) {
  const d = inventoryReportData();

  const rows = d.products.map((p, i) => `<tr>
      <td class="num">${i + 1}</td>
      <td><strong>${escapeHtml(p.name)}</strong></td>
      <td>${escapeHtml(p.category || "General")}</td>
      <td class="num">${Number(p.stock || 0)}</td>
      <td class="num">${reportMoney(p.cost || 0)}</td>
      <td class="num">${reportMoney(p.price || 0)}</td>
      <td class="num">${reportMoney(Number(p.cost || 0) * Number(p.stock || 0))}</td>
      <td class="num">${reportMoney(Number(p.price || 0) * Number(p.stock || 0))}</td>
    </tr>`).join("");

  const body = `
    ${proHeading("Summary", "Position as of the generated date")}
    ${proSummary([
      { label: "Current capital", value: reportMoney(state.capital) },
      { label: "Stock cost on hand", value: reportMoney(d.tieUp), note: "Tie-up capital at base cost" },
      { label: "Retail value (SRP)", value: reportMoney(d.retail) },
      { label: "Potential gross profit", value: reportMoney(d.potentialProfit), tone: d.potentialProfit >= 0 ? "good" : "bad" }
    ])}
    ${proSummary([
      { label: "Products", value: String(state.products.length) },
      { label: "Units in stock", value: String(d.units) },
      { label: "Expired items", value: String(d.expiry.expired), tone: d.expiry.expired ? "bad" : "" },
      { label: "Expiring within 7 days", value: String(d.expiry.expiringSoon) }
    ])}


    ${generateInventoryChartSvg(d)}

    ${proHeading("Inventory &amp; capital detail", `${d.products.length} products, highest SRP value first`)}
    <table class="pro-table">
      <colgroup><col style="width:5%"><col style="width:24%"><col style="width:12%"><col style="width:7%"><col style="width:11%"><col style="width:11%"><col style="width:15%"><col style="width:15%"></colgroup>
      <thead><tr>
        <th class="num">No.</th><th>Product</th><th>Category</th><th class="num">Stock</th>
        <th class="num">Cost / unit</th><th class="num">SRP / unit</th><th class="num">Cost value</th><th class="num">SRP value</th>
      </tr></thead>
      <tbody>${rows || `<tr><td colspan="8" class="empty">No products available.</td></tr>`}</tbody>
      ${d.products.length ? `<tfoot><tr>
        <td colspan="3" class="label">Totals</td><td class="num">${d.units}</td><td></td><td></td>
        <td class="num">${reportMoney(d.tieUp)}</td><td class="num">${reportMoney(d.retail)}</td>
      </tr></tfoot>` : ""}
    </table>`;

  return proDocument({
    prefix: "INV",
    title: "Inventory &amp; Capital Report",
    subtitle: "Stock valuation and capital position",
    details: [["Report range", getRangeLabel(range)]],
    body
  });
}

export function renderSalesProfitPrintReport(range = activeReportRange) {
  const r = computeSalesReport(range);
  const { sales, stockIn, stockOut, revenue, cogs, grossProfit, stockInCost } = r;
  const rangeTitle = getRangeLabel(range);

  const body = `
    ${proHeading("Summary", rangeTitle)}
    ${proSummary([
      { label: "Revenue", value: reportMoney(revenue), note: `${sales.length} sale${sales.length === 1 ? "" : "s"}` },
      { label: "Cost of goods sold", value: reportMoney(cogs), note: "Cost at time of sale" },
      { label: "Gross profit", value: reportMoney(grossProfit), tone: grossProfit >= 0 ? "good" : "bad" },
      { label: "Gross margin", value: `${r.margin.toFixed(1)}%` }
    ])}
    ${proSummary([
      { label: "Stock-in purchases", value: reportMoney(stockInCost), note: `${stockIn.length} entr${stockIn.length === 1 ? "y" : "ies"}` },
      { label: "Stock-out entries", value: String(stockOut.length) },
      { label: "Products added", value: String(r.productsAdded) },
      { label: "Products with price changes", value: String(r.priceChanges.productsChanged), note: `${r.priceChanges.changeCount} change${r.priceChanges.changeCount === 1 ? "" : "s"}` }
    ])}


    ${generateSalesProfitChartSvg(revenue, cogs, grossProfit, r.lines)}

    ${proHeading("Detailed sales breakdown", `${r.lines.length} item line${r.lines.length === 1 ? "" : "s"} — price and cost as recorded at each sale`)}
    <table class="pro-table sales-table">
      <colgroup><col style="width:4%"><col style="width:20%"><col style="width:14%"><col style="width:5%"><col style="width:10%"><col style="width:10%"><col style="width:12%"><col style="width:12%"><col style="width:13%"></colgroup>
      <thead><tr>
        <th class="num">No.</th><th>Item</th><th>Date &amp; time</th><th class="num">Qty</th>
        <th class="num">SRP / unit</th><th class="num">Cost / unit</th><th class="num">Total SRP</th><th class="num">Total cost</th><th class="num">Profit</th>
      </tr></thead>
      <tbody>${printSalesRows(r.lines, rangeTitle)}</tbody>
      ${r.lines.length ? `<tfoot><tr>
        <td colspan="6" class="label">Totals</td>
        <td class="num">${reportMoney(revenue)}</td><td class="num">${reportMoney(cogs)}</td><td class="num">${reportMoney(grossProfit)}</td>
      </tr></tfoot>` : ""}
    </table>

    ${printPriceChanges(r.priceChanges)}`;

  return proDocument({
    prefix: "SPR",
    title: "Sales &amp; Profit Report",
    subtitle: "Revenue, cost of goods and price changes",
    details: [["Report range", rangeTitle]],
    body
  });
}

function printSalesRows(lines, rangeTitle) {
  if (!lines.length) return `<tr><td colspan="9" class="empty">No sales recorded for ${rangeTitle}.</td></tr>`;
  return lines.map((l, i) => {
    const profit = l.revenue - l.cogs;
    return `<tr>
      <td class="num">${i + 1}</td>
      <td><strong>${escapeHtml(l.name)}</strong></td>
      <td>${escapeHtml(l.date || "—")}</td>
      <td class="num">${l.qty}</td>
      <td class="num">${reportMoney(l.price)}</td>
      <td class="num">${reportMoney(l.cost)}</td>
      <td class="num">${reportMoney(l.revenue)}</td>
      <td class="num">${reportMoney(l.cogs)}</td>
      <td class="num ${profit >= 0 ? "pos" : "neg"}">${reportMoney(profit)}</td>
    </tr>`;
  }).join("");
}

function printPriceChanges(pc) {
  const pct = (a, b) => (a > 0 ? ((b - a) / a) * 100 : 0);
  const rows = pc.events.map(e => {
    const diff = e.newPrice - e.oldPrice;
    return `<tr>
      <td><strong>${escapeHtml(e.name)}</strong></td>
      <td class="num">${reportMoney(e.oldPrice)}</td>
      <td class="num">${reportMoney(e.newPrice)}</td>
      <td class="num ${diff > 0 ? "up" : diff < 0 ? "down" : ""}">${diff > 0 ? "+" : diff < 0 ? "−" : ""}${reportMoney(Math.abs(diff))} (${pct(e.oldPrice, e.newPrice).toFixed(1)}%)</td>
      <td class="num">${reportMoney(e.oldCost)} → ${reportMoney(e.newCost)}</td>
      <td>${e.pending ? "Current price (not sold yet)" : escapeHtml(e.date || "—")}</td>
    </tr>`;
  }).join("");
  return `
    ${proHeading("Price changes", `${pc.productsChanged} product${pc.productsChanged === 1 ? "" : "s"}, ${pc.changeCount} change${pc.changeCount === 1 ? "" : "s"} — from order item snapshots`)}
    <table class="pro-table">
      <colgroup><col style="width:24%"><col style="width:11%"><col style="width:11%"><col style="width:20%"><col style="width:18%"><col style="width:16%"></colgroup>
      <thead><tr><th>Product</th><th class="num">Old SRP</th><th class="num">New SRP</th><th class="num">Change</th><th class="num">Cost (old → new)</th><th>Seen on</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="6" class="empty">No price changes found for this range.</td></tr>`}</tbody>
    </table>`;
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
