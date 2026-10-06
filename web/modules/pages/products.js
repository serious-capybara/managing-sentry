/* ============================================================
 * pages/products.js — Products catalog page renderer.
 * Includes the sortable product table and toolbar with
 * "Add New Product" and "Remove Product" buttons.
 * ============================================================ */

import { state }              from "../state.js";
import { money, escapeHtml }  from "../utils.js";

export function renderProducts() {
  return `
    <div class="page-toolbar">
      <div class="toolbar-left"><div><h3>Products (${state.products.length} Total)</h3><p>Manage your inventory catalog.</p></div></div>
      <div class="toolbar-right">
        <span class="toolbar-label"><img class="inline-icon" src="src/icon/sort-filter.svg" alt=""> Sort:</span>
        <select class="compact-select" id="productSort">
          <option value="selling">High Selling</option>
          <option value="name">By Name</option>
          <option value="stock">Low Stock</option>
        </select>
        <button class="wire-btn" id="addProductBtn"><img class="btn-icon" src="src/icon/add.svg" alt=""> Add New Product</button>
        <button class="wire-btn" id="removeProductBtn"><img class="btn-icon" src="src/icon/remove-stock-product.svg" alt=""> Remove Product</button>
      </div>
    </div>
    <div class="wire-table-wrap">
      <table>
        <thead><tr><th>ID</th><th>Name</th><th>Category</th><th>Base</th><th>SRP</th><th>Stock</th></tr></thead>
        <tbody id="productRows">${productRows()}</tbody>
      </table>
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
