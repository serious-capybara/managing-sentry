/* ============================================================
 * pages/price-checker.js — Price Checker page renderer.
 * Shows an alphabetical/category product directory and an
 * instant-search panel with a highlighted price result.
 * ============================================================ */

import { state }             from "../state.js";
import { money, escapeHtml } from "../utils.js";

export function renderPriceChecker() {
  return `<div class="page-head">
      <div><h3>Price Checker</h3><p>Browse products or search to check a price.</p></div>
    </div>

    <div class="price-checker-new">
      <div class="price-checker-toolbar">
        <select class="price-sort-select" id="priceSort" aria-label="Sort products">
          <option value="alphabetical">Alphabetical Order</option>
          <option value="category">Category</option>
        </select>
        <div class="price-search-wrap">
          <span><img class="inline-icon" src="src/icon/price-checker.svg" alt=""></span>
          <input id="priceSearch" placeholder="Search product..." autocomplete="off">
        </div>
      </div>

      <div id="priceDirectory" class="price-directory">
        ${priceDirectoryRows()}
      </div>

      <div id="priceSearchResult" class="price-search-result hidden">
        <div class="price-checker"><div class="card form-card" style="max-width:none">
          <div class="form-group"><label>Search Product</label><input id="priceSearchEcho" placeholder="Type a product name..." autocomplete="off"></div>
        </div>
        <div class="price-result">
          <span>SELECTED PRODUCT</span>
          <h2 id="checkedName">Choose a product</h2>
          <div class="price" id="checkedPrice">₱0.00</div>
          <p id="checkedStock">Stock: —</p>
        </div></div>
        <div id="priceMatchList" class="price-match-list"></div>
      </div>
    </div>`;
}

export function priceDirectoryRows(mode = "alphabetical") {
  if (!state.products.length) {
    return `<p class="empty price-empty">No products available. Add products first.</p>`;
  }

  const products = [...state.products];

  if (mode === "category") {
    products.sort((a, b) => {
      const cc = String(a.category || "").localeCompare(String(b.category || ""));
      return cc || a.name.localeCompare(b.name);
    });
    let currentCategory = null;
    return products.map(p => {
      const category = p.category || "Uncategorized";
      const header = category !== currentCategory
        ? `<div class="price-group-header">${escapeHtml(category)}</div>` : "";
      currentCategory = category;
      return header + priceDirectoryItem(p);
    }).join("");
  }

  products.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  let currentLetter = null;
  return products.map(p => {
    const letter = (p.name || "#").trim().charAt(0).toUpperCase() || "#";
    const header = letter !== currentLetter
      ? `<div class="price-group-header">${escapeHtml(letter)}</div>` : "";
    currentLetter = letter;
    return header + priceDirectoryItem(p);
  }).join("");
}

export function priceDirectoryItem(p) {
  return `<button type="button" class="price-directory-item" data-price-product="${p.id}">
    <span class="price-product-name">${escapeHtml(p.name)}</span>
    <span class="price-product-price">${money(p.price)}</span>
  </button>`;
}

export function priceMatchRows(matches) {
  if (!matches.length) return `<p class="empty price-empty">No matching product found.</p>`;
  return matches.map(p => `<button type="button" class="price-match" data-price-product="${p.id}">
    <span>${escapeHtml(p.name)}</span><strong>${money(p.price)}</strong>
  </button>`).join("");
}
