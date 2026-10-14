// remove product pop-up

import { state } from "../state.js";
import { escapeHtml, money, toast } from "../utils.js";
import { apiRequest } from "../api.js";
import { loadDashboardData } from "../data-loader.js";
import { updateStats } from "../stock-logic.js";
import { askYesNo } from "./dialogs.js";
import { renderPage } from "../router.js";

export function renderProductPickerItem(p, selectedId = null) {
  const isSelected = Number(p.id) === Number(selectedId);
  const isLow = Number(p.stock) <= Number(p.low_stock_alert_level || 20);
  return `
    <button type="button" class="remove-product-option ${isSelected ? "selected" : ""}" data-id="${p.id}">
      <div class="remove-product-info">
        <span class="remove-product-title">${escapeHtml(p.name)}</span>
        <div class="remove-product-meta">
          <span class="meta-tag category">${escapeHtml(p.category || "General")}</span>
          <span class="meta-tag stock ${isLow ? "low" : ""}">${p.stock} in stock</span>
        </div>
      </div>
      <div class="remove-product-right">
        <span class="remove-product-price">${money(p.price)}</span>
        <div class="select-indicator">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
      </div>
    </button>`;
}

export function removeProductOptions(products = state.products, selectedId = null) {
  return products
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(p => renderProductPickerItem(p, selectedId))
    .join("");
}

export async function deleteProductById(productId) {
  const product = state.products.find(p => Number(p.id) === Number(productId));
  if (!product) return;
  const confirmed = await askYesNo(`Remove "${product.name}" from your inventory?`, {
    title: "Confirm Removal",
    yesText: "Remove",
    noText: "Cancel"
  });
  if (!confirmed) return;
  try {
    await apiRequest("products.php?action=delete", {
      method: "POST",
      body: JSON.stringify({ product_id: product.id })
    });
    await loadDashboardData();
    updateStats();
    renderPage("products");
    toast(`${product.name} removed.`);
  } catch (error) {
    toast(`Could not remove product: ${error.message}`);
  }
}

export function openRemoveProductModal() {
  const existing = document.getElementById("removeProductModal");
  if (existing) existing.remove();

  if (!state.products.length) {
    toast("There are no products to remove.");
    return;
  }

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "removeProductModal";
  overlay.innerHTML = `
    <div class="modal remove-product-modal">
      <div class="modal-head">
        <div>
          <h3>Remove Product</h3>
          <p class="modal-caption">Choose a product to remove from your inventory.</p>
        </div>
        <button class="modal-close" id="closeRemoveProduct" type="button">×</button>
      </div>
      <div class="modal-body">
        <div class="remove-search-wrap">
          <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input id="removeProductSearch" type="search" placeholder="Search products by name or category..." autocomplete="off">
        </div>
        <div class="remove-product-list" id="removeProductList">
          ${removeProductOptions()}
        </div>
      </div>
      <div class="modal-foot remove-modal-foot">
        <button class="ghost-btn" id="cancelRemoveProduct" type="button">Cancel</button>
        <button class="primary-btn" id="confirmRemoveProduct" type="button" disabled>Remove Product</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  let selectedId = null;
  const search = document.getElementById("removeProductSearch");
  const list = document.getElementById("removeProductList");
  const confirmBtn = document.getElementById("confirmRemoveProduct");

  const renderOptions = () => {
    const query = search.value.trim().toLowerCase();
    const filtered = state.products
      .filter(p => `${p.name} ${p.category}`.toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name));
    list.innerHTML = filtered.length
      ? removeProductOptions(filtered, selectedId)
      : `<div class="remove-empty">No matching products found.</div>`;

    list.querySelectorAll(".remove-product-option").forEach(btn => {
      btn.addEventListener("click", () => {
        selectedId = Number(btn.dataset.id);
        list.querySelectorAll(".remove-product-option").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        confirmBtn.disabled = false;
      });
    });
  };

  search.addEventListener("input", renderOptions);
  document.getElementById("closeRemoveProduct").addEventListener("click", () => overlay.remove());
  document.getElementById("cancelRemoveProduct").addEventListener("click", () => overlay.remove());

  confirmBtn.addEventListener("click", async () => {
    if (selectedId === null) return;
    await deleteProductById(selectedId);
    overlay.remove();
  });

  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
  renderOptions();
  search.focus();
}
