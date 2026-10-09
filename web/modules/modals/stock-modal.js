/* ============================================================
 * modals/stock-modal.js — Stock In & Stock Out floating modals.
 * Allows adding or removing stock quantities for products via
 * floating dialog modals with searchable product picker.
 * ============================================================ */

import { state } from "../state.js";
import { escapeHtml, money, toast } from "../utils.js";
import { apiRequest } from "../api.js";
import { loadDashboardData } from "../data-loader.js";
import { updateStats } from "../stock-logic.js";
import { renderPage, currentPage } from "../router.js";

function stockProductOptions(products = state.products, selectedId = null) {
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

/**
 * Open Stock In (Add Stock) floating modal dialog.
 * @param {number|null} targetProductId - Optional pre-selected product ID
 */
export function openStockInModal(targetProductId = null) {
  const existing = document.getElementById("stockInModal");
  if (existing) existing.remove();

  if (!state.products.length) {
    toast("No products available. Add a product first.");
    return;
  }

  const defaultId = targetProductId || state.products[0].id;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "stockInModal";

  overlay.innerHTML = `
    <div class="modal stock-modal">
      <div class="modal-head">
        <div>
          <h3>Add Stock (Stock In)</h3>
          <p class="modal-caption">Record incoming stock quantity for a product.</p>
        </div>
        <button class="modal-close" id="closeStockIn" type="button">×</button>
      </div>
      <form id="stockInForm">
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group full">
              <label>Select Product</label>
              <div class="remove-search-wrap" style="margin-bottom: 8px;">
                <input id="stockInSearch" type="text" placeholder="Search products..." autocomplete="off">
              </div>
              <div class="remove-product-list" id="stockInProductList" style="max-height: 200px;">
                ${stockProductOptions(state.products, defaultId)}
              </div>
              <input type="hidden" id="stockInProduct" name="product" value="${defaultId}" required>
            </div>
            <div class="form-group">
              <label for="stockInQty">Quantity to Add</label>
              <input id="stockInQty" name="qty" type="number" min="1" value="1" required placeholder="1">
            </div>
            <div class="form-group">
              <label for="stockInRef">Reference / Supplier</label>
              <input id="stockInRef" name="ref" placeholder="Optional PO or Supplier Ref" autocomplete="off">
            </div>
            <div class="form-group">
              <label for="stockInHasExpiry">Expiry Date Available?</label>
              <select name="hasExpiry" id="stockInHasExpiry">
                <option value="no">No Expiration</option>
                <option value="yes">Yes</option>
              </select>
            </div>
            <div class="form-group" id="stockInExpiryWrap" style="display:none">
              <label for="stockInExpiry">Expiry Date</label>
              <input id="stockInExpiry" name="expiry" type="date">
            </div>
            <div class="form-group full">
              <label for="stockInNotes">Notes <small class="form-hint">(Max 50 words)</small></label>
              <textarea id="stockInNotes" name="notes" placeholder="Optional stock in details or supplier notes (Max 50 words)" rows="4" maxlength="300" style="resize:none"></textarea>
            </div>
          </div>
        </div>
        <div class="modal-foot">
          <button class="ghost-btn" id="cancelStockIn" type="button">Cancel</button>
          <button class="primary-btn" id="confirmStockIn" type="submit">Record Stock In</button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  document.getElementById("closeStockIn").addEventListener("click", close);
  document.getElementById("cancelStockIn").addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });

  let selectedProductId = defaultId;
  const searchInput = document.getElementById("stockInSearch");
  const productList = document.getElementById("stockInProductList");
  const hiddenInput = document.getElementById("stockInProduct");

  const renderStockOptions = () => {
    const query = searchInput.value.trim().toLowerCase();
    const filtered = state.products.filter(p => `${p.name} ${p.category}`.toLowerCase().includes(query));
    productList.innerHTML = filtered.length
      ? stockProductOptions(filtered, selectedProductId)
      : `<div class="remove-empty" style="padding: 12px; text-align: center; color: var(--text-secondary);">No matching products found.</div>`;

    productList.querySelectorAll(".remove-product-option").forEach(btn => {
      btn.addEventListener("click", () => {
        selectedProductId = Number(btn.dataset.id);
        hiddenInput.value = selectedProductId;
        productList.querySelectorAll(".remove-product-option").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
      });
    });
  };

  searchInput.addEventListener("input", renderStockOptions);
  renderStockOptions();

  const hasExpiry = document.getElementById("stockInHasExpiry");
  const expiryWrap = document.getElementById("stockInExpiryWrap");
  const expiryInput = document.getElementById("stockInExpiry");

  hasExpiry.addEventListener("change", () => {
    const on = hasExpiry.value === "yes";
    expiryWrap.style.display = on ? "" : "none";
    expiryInput.required = on;
    if (!on) expiryInput.value = "";
  });

  const notesTextarea = document.getElementById("stockInNotes");
  if (notesTextarea) {
    notesTextarea.addEventListener("input", () => {
      const words = notesTextarea.value.trim().split(/\s+/).filter(Boolean);
      if (words.length > 50) {
        notesTextarea.value = words.slice(0, 50).join(" ");
      }
    });
  }

  document.getElementById("stockInForm").addEventListener("submit", async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const productId = Number(hiddenInput.value);
    const product = state.products.find(p => p.id === productId);
    if (!product) return toast("Please select a valid product.");

    const submitBtn = document.getElementById("confirmStockIn");
    submitBtn.disabled = true;

    try {
      await apiRequest("products.php?action=stock", {
        method: "POST",
        body: JSON.stringify({
          product_id: product.id,
          quantity: Number(f.get("qty")),
          type: "STOCK IN",
          reference: f.get("ref"),
          notes: f.get("notes"),
          expiry: f.get("hasExpiry") === "yes" ? f.get("expiry") : ""
        })
      });
      await loadDashboardData();
      updateStats();
      close();
      toast(`Added ${f.get("qty")} units to ${product.name}.`);
      renderPage(currentPage || "stocks");
    } catch (error) {
      toast(`Could not update stock: ${error.message}`);
      submitBtn.disabled = false;
    }
  });

  setTimeout(() => searchInput?.focus(), 50);
}

/**
 * Open Stock Out (Remove Stock) floating modal dialog.
 * @param {number|null} targetProductId - Optional pre-selected product ID
 */
export function openStockOutModal(targetProductId = null) {
  const existing = document.getElementById("stockOutModal");
  if (existing) existing.remove();

  if (!state.products.length) {
    toast("No products available.");
    return;
  }

  const defaultId = targetProductId || state.products[0].id;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "stockOutModal";

  overlay.innerHTML = `
    <div class="modal stock-modal">
      <div class="modal-head">
        <div>
          <h3>Remove Stock (Stock Out)</h3>
          <p class="modal-caption">Record outgoing stock or deduction for a product.</p>
        </div>
        <button class="modal-close" id="closeStockOut" type="button">×</button>
      </div>
      <form id="stockOutForm">
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group full">
              <label>Select Product</label>
              <div class="remove-search-wrap" style="margin-bottom: 8px;">
                <input id="stockOutSearch" type="text" placeholder="Search products..." autocomplete="off">
              </div>
              <div class="remove-product-list" id="stockOutProductList" style="max-height: 200px;">
                ${stockProductOptions(state.products, defaultId)}
              </div>
              <input type="hidden" id="stockOutProduct" name="product" value="${defaultId}" required>
            </div>
            <div class="form-group">
              <label for="stockOutQty">Quantity to Remove</label>
              <input id="stockOutQty" name="qty" type="number" min="1" value="1" required placeholder="1">
            </div>
            <div class="form-group">
              <label for="stockOutRef">Reason / Reference</label>
              <input id="stockOutRef" name="ref" placeholder="e.g. Damaged / Returned / Adjustment" autocomplete="off">
            </div>
            <div class="form-group full">
              <label for="stockOutNotes">Notes <small class="form-hint">(Max 50 words)</small></label>
              <textarea id="stockOutNotes" name="notes" placeholder="Optional stock out reason or details (Max 50 words)" rows="4" maxlength="300" style="resize:none"></textarea>
            </div>
          </div>
        </div>
        <div class="modal-foot">
          <button class="ghost-btn" id="cancelStockOut" type="button">Cancel</button>
          <button class="primary-btn" id="confirmStockOut" type="submit">Record Stock Out</button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  document.getElementById("closeStockOut").addEventListener("click", close);
  document.getElementById("cancelStockOut").addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });

  let selectedProductId = defaultId;
  const searchInput = document.getElementById("stockOutSearch");
  const productList = document.getElementById("stockOutProductList");
  const hiddenInput = document.getElementById("stockOutProduct");
  const qtyInput = document.getElementById("stockOutQty");

  const syncMaxQty = (prodId) => {
    const selected = state.products.find(p => p.id === Number(prodId));
    if (selected) {
      qtyInput.max = selected.stock;
    }
  };

  const renderStockOptions = () => {
    const query = searchInput.value.trim().toLowerCase();
    const filtered = state.products.filter(p => `${p.name} ${p.category}`.toLowerCase().includes(query));
    productList.innerHTML = filtered.length
      ? stockProductOptions(filtered, selectedProductId)
      : `<div class="remove-empty" style="padding: 12px; text-align: center; color: var(--text-secondary);">No matching products found.</div>`;

    productList.querySelectorAll(".remove-product-option").forEach(btn => {
      btn.addEventListener("click", () => {
        selectedProductId = Number(btn.dataset.id);
        hiddenInput.value = selectedProductId;
        syncMaxQty(selectedProductId);
        productList.querySelectorAll(".remove-product-option").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
      });
    });
  };

  searchInput.addEventListener("input", renderStockOptions);
  renderStockOptions();
  syncMaxQuery(selectedProductId);

  const notesTextarea = document.getElementById("stockOutNotes");
  if (notesTextarea) {
    notesTextarea.addEventListener("input", () => {
      const words = notesTextarea.value.trim().split(/\s+/).filter(Boolean);
      if (words.length > 50) {
        notesTextarea.value = words.slice(0, 50).join(" ");
      }
    });
  }

  document.getElementById("stockOutForm").addEventListener("submit", async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const productId = Number(hiddenInput.value);
    const product = state.products.find(p => p.id === productId);
    const qty = Number(f.get("qty"));

    if (!product) return toast("Please select a valid product.");
    if (qty > product.stock) return toast(`Cannot remove ${qty} units. Only ${product.stock} available in stock.`);

    const submitBtn = document.getElementById("confirmStockOut");
    submitBtn.disabled = true;

    try {
      await apiRequest("products.php?action=stock", {
        method: "POST",
        body: JSON.stringify({
          product_id: product.id,
          quantity: qty,
          type: "STOCK OUT",
          reference: f.get("ref"),
          notes: f.get("notes")
        })
      });
      await loadDashboardData();
      updateStats();
      close();
      toast(`Deducted ${qty} units from ${product.name}.`);
      renderPage(currentPage || "stocks");
    } catch (error) {
      toast(`Could not update stock: ${error.message}`);
      submitBtn.disabled = false;
    }
  });

  setTimeout(() => searchInput?.focus(), 50);
}
