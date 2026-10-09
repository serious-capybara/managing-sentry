/* ============================================================
 * modals/remove-product-modal.js — Remove Product modal dialog.
 * Allows searching and selecting a product to remove from inventory.
 * ============================================================ */

import { state } from "../state.js";
import { escapeHtml, money, toast } from "../utils.js";
import { apiRequest } from "../api.js";
import { loadDashboardData } from "../data-loader.js";
import { updateStats } from "../stock-logic.js";
import { askYesNo } from "./dialogs.js";
import { renderPage } from "../router.js";

export function removeProductOptions(products = state.products, selectedId = null) {
  return products
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(p => `
      <button type="button" class="remove-product-option ${Number(p.id) === Number(selectedId) ? "selected" : ""}" data-id="${p.id}">
        <span class="remove-product-main">
          <strong>${escapeHtml(p.name)}</strong>
          <small>${escapeHtml(p.category || "Uncategorized")} • ${p.stock} in stock</small>
        </span>
        <span class="remove-product-price">${money(p.price)}</span>
      </button>`).join("");
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
          <input id="removeProductSearch" type="search" placeholder="Search products..." autocomplete="off">
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
