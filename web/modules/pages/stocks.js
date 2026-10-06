/* ============================================================
 * pages/stocks.js — Stocks overview, Stock In, Stock Out, and
 * Low Stock Alert page renderers.
 * ============================================================ */

import { state }             from "../state.js";
import { money, escapeHtml } from "../utils.js";
import { isLowStock, lowStockLabel, expiryButton } from "../stock-logic.js";

// ---------------------------------------------------------------------------
// Stocks overview page
// ---------------------------------------------------------------------------

export function renderStocks() {
  const low = state.products.filter(isLowStock);
  return `
    <div class="page-toolbar">
      <div class="toolbar-left"><div><h3>Stocks</h3><p>Monitor and update current inventory quantities.</p></div></div>
      <div class="toolbar-right">
        <span class="toolbar-label">Sort:</span>
        <select class="compact-select" id="stockSort">
          <option value="name">By Name</option>
          <option value="stock">Low Stock</option>
          <option value="selling">High Selling</option>
        </select>
        <button class="wire-btn" data-go="stock-in">Add Stock</button>
        <button class="wire-btn" data-go="stock-out">Remove Stock</button>
      </div>
    </div>
    <div class="wire-table-wrap">
      <table>
        <thead><tr><th>ID</th><th>Name</th><th>Category</th><th>Base</th><th>SRP</th><th>Stock</th><th>Expiration</th></tr></thead>
        <tbody id="stockRows">${stockRows()}</tbody>
      </table>
    </div>
    <div class="panel" style="margin-top:7px">
      <div class="panel-title">Low On Stock ${low.length ? `<span class="alert-dot"></span>` : ""}</div>
      <div class="panel-body">
        <div class="wire-table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Name</th><th>Category</th><th>Base</th><th>SRP</th><th>Stock</th><th>Expiration</th></tr></thead>
            <tbody>${stockRows(low)}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

export function stockRows(products = state.products) {
  if (!products.length) {
    return `<tr><td colspan="7" class="table-empty">No products available.</td></tr>`;
  }
  return products.map((p, i) => `<tr>
    <td>${i + 1}</td><td><strong>${escapeHtml(p.name)}</strong></td><td>${escapeHtml(p.category)}</td>
    <td>${money(p.cost)}</td><td>${money(p.price)}</td><td>${p.stock}</td><td>${expiryButton(p)}</td>
  </tr>`).join("");
}

// ---------------------------------------------------------------------------
// Low Stock Alert page
// ---------------------------------------------------------------------------

export function renderLowStock() {
  const low = state.products.filter(isLowStock);
  return `<div class="page-head"><div><h3>Low Stock Alert</h3><p>Products that need replenishment.</p></div></div>
    <div class="wire-table-wrap"><table><thead><tr><th>ID</th><th>Product</th><th>Category</th><th>Current Stock</th><th>Action</th></tr></thead>
    <tbody>${low.length
      ? low.map((p, i) => `<tr><td>${i + 1}</td><td><strong>${escapeHtml(p.name)}</strong></td><td>${escapeHtml(p.category)}</td><td><span class="badge red">${p.stock} units</span><br><small>${lowStockLabel(p)}</small></td><td><button class="action-btn" data-go="stock-in">Stock In</button></td></tr>`).join("")
      : `<tr><td colspan="5" class="table-empty">No low-stock products right now.</td></tr>`
    }</tbody></table></div>`;
}

// ---------------------------------------------------------------------------
// Stock In / Stock Out shared form
// ---------------------------------------------------------------------------

export function stockForm(type) {
  const isIn = type === "In";
  return `<div class="page-head"><div><h3>Stock ${type}</h3><p>Record ${type.toLowerCase()} movement for your products.</p></div></div>
    <div class="card form-card"><form id="stockForm"><div class="form-grid">
      <div class="form-group full"><label>Product</label><select name="product">${state.products.map(p => `<option value="${p.id}">${escapeHtml(p.name)} — ${p.stock} units</option>`).join("")}</select></div>
      <div class="form-group"><label>Quantity</label><input name="qty" type="number" min="1" required></div>
      <div class="form-group"><label>Reference / Supplier</label><input name="ref" placeholder="Optional"></div>
      ${isIn ? `
      <div class="form-group"><label>Expiry Date Available?</label><select name="hasExpiry" id="hasExpiry"><option value="no">No Expiration</option><option value="yes">Yes</option></select></div>
      <div class="form-group" id="expiryWrap" style="display:none"><label>Expiry Date</label><input name="expiry" type="date"></div>` : ""}
      <div class="form-group full"><label>Notes</label><textarea name="notes"></textarea></div>
    </div><button class="action-btn" style="margin-top:20px">Record Stock ${type}</button></form></div>`;
}

export function renderStockIn()  { return stockForm("In");  }
export function renderStockOut() { return stockForm("Out"); }
