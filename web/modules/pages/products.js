/* ============================================================
 * pages/products.js — Products catalog page renderer.
 * Includes the sortable product table and toolbar with
 * "Add New Product" and "Remove Product" buttons.
 * ============================================================ */

import { state }              from "../state.js";
import { money, escapeHtml }  from "../utils.js";

export function renderProducts() {
  return `
    <div class="products-overview">
      <div class="page-toolbar">
        <div class="toolbar-left">
          <div class="toolbar-sort-wrap">
            <span class="toolbar-label"><img class="inline-icon" src="src/icon/dark/sort-filter.svg" alt=""> Sort:</span>
            <select class="compact-select styled-select-native" id="productSort" aria-label="Sort products">
              <option value="name">Name</option>
              <option value="stock">Low Stock</option>
              <option value="stock-desc">High Stock</option>
            </select>
          </div>
        </div>
        <div class="toolbar-right">
          <button class="wire-btn" id="addProductBtn">Add New Product</button>
          <button class="wire-btn" id="removeProductBtn">Remove Product</button>
        </div>
      </div>
      <div class="wire-table-wrap products-table-card">
        <div class="products-table-scroll">
          <table class="products-inventory-table">
            <thead><tr><th>ID</th><th>Name</th><th>Category</th><th>Base</th><th>SRP</th><th>Stock</th></tr></thead>
            <tbody id="productRows">${productRows([...state.products].sort((a, b) => String(a.name).localeCompare(String(b.name))))}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

export function productRows(products = state.products) {
  if (!products.length) {
    return `<tr><td colspan="6" class="table-empty">No products available.</td></tr>`;
  }
  return products.map((p, i) => `<tr>
    <td>${i + 1}</td><td><strong>${escapeHtml(p.name)}</strong></td><td>${escapeHtml(p.category)}</td>
    <td>${money(p.cost)}</td><td>${money(p.price)}</td><td>${p.stock}</td>
  </tr>`).join("");
}
