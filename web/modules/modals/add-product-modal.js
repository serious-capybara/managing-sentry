/* ============================================================
 * modals/add-product-modal.js — Add / Edit Product modal.
 * Allows adding a new product or selecting an existing product to edit.
 * ============================================================ */

import { apiRequest } from "../api.js";
import { loadDashboardData } from "../data-loader.js";
import { updateStats } from "../stock-logic.js";
import { toast, escapeHtml } from "../utils.js";
import { renderPage } from "../router.js";
import { state } from "../state.js";
import { bindStyledSelects } from "../styled-select.js";
import { removeProductOptions } from "./remove-product-modal.js";

/**
 * Open the selection modal to pick an existing product to edit.
 * @param {number|null} currentSelectedId
 * @param {function(object): void} onSelect
 */

function openSelectProductToEditModal(currentSelectedId, onSelect) {
  const existing = document.getElementById("selectProductToEditModal");
  if (existing) existing.remove();

  if (!state.products || !state.products.length) {
    toast("No products available to edit.");
    return;
  }

  const overlaySelect = document.createElement("div");
  overlaySelect.className = "modal-overlay";
  overlaySelect.id = "selectProductToEditModal";
  overlaySelect.style.zIndex = "210";
  overlaySelect.innerHTML = `
    <div class="modal remove-product-modal">
      <div class="modal-head">
        <div>
          <h3>Select Product to Edit</h3>
          <p class="modal-caption">Choose an existing product from your inventory to edit.</p>
        </div>
        <button class="modal-close" id="closeSelectProduct" type="button">×</button>
      </div>
      <div class="modal-body">
        <div class="remove-search-wrap">
          <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input id="editProductSearch" type="search" placeholder="Search products by name or category..." autocomplete="off">
        </div>
        <div class="remove-product-list" id="editProductList">
          ${removeProductOptions(state.products, currentSelectedId)}
        </div>
      </div>
      <div class="modal-foot remove-modal-foot">
        <button class="ghost-btn" id="cancelSelectProduct" type="button">Cancel</button>
        <button class="primary-btn" id="confirmSelectProduct" type="button" ${currentSelectedId ? "" : "disabled"}>Okay</button>
      </div>
    </div>`;

  document.body.appendChild(overlaySelect);

  let tempSelectedId = currentSelectedId ? Number(currentSelectedId) : null;
  const searchInput = overlaySelect.querySelector("#editProductSearch");
  const listEl = overlaySelect.querySelector("#editProductList");
  const confirmBtn = overlaySelect.querySelector("#confirmSelectProduct");
  const cancelBtn = overlaySelect.querySelector("#cancelSelectProduct");
  const closeBtn = overlaySelect.querySelector("#closeSelectProduct");

  const closeSelectionModal = () => overlaySelect.remove();

  const bindListEvents = () => {
    listEl.querySelectorAll(".remove-product-option").forEach(btn => {
      btn.addEventListener("click", () => {
        tempSelectedId = Number(btn.dataset.id);
        listEl.querySelectorAll(".remove-product-option").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        confirmBtn.disabled = false;
      });
    });
  };

  const renderFilteredOptions = () => {
    const query = (searchInput.value || "").trim().toLowerCase();
    const filtered = state.products
      .filter(p => `${p.name} ${p.category}`.toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name));

    listEl.innerHTML = filtered.length
      ? removeProductOptions(filtered, tempSelectedId)
      : `<div class="remove-empty">No matching products found.</div>`;

    bindListEvents();
  };

  searchInput.addEventListener("input", renderFilteredOptions);
  closeBtn.addEventListener("click", closeSelectionModal);
  cancelBtn.addEventListener("click", closeSelectionModal);
  overlaySelect.addEventListener("click", e => {
    if (e.target === overlaySelect) closeSelectionModal();
  });

  confirmBtn.addEventListener("click", () => {
    if (!tempSelectedId) return;
    const prod = state.products.find(p => Number(p.id) === tempSelectedId);
    if (prod) {
      onSelect(prod);
    }
    closeSelectionModal();
  });

  bindListEvents();
  setTimeout(() => searchInput?.focus(), 50);
}

export function openAddProductModal(editingProduct = null) {
  const existing = document.getElementById("addProductModal");
  if (existing) existing.remove();

  if (editingProduct && (typeof editingProduct !== "object" || editingProduct instanceof Event || !("id" in editingProduct))) {
    editingProduct = null;
  }

  let currentEditingProductId = editingProduct ? Number(editingProduct.id) : null;

  const establishedCategories = Array.from(
    new Set(
      (state.products || [])
        .map(p => p.category && String(p.category).trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  const defaultCategories = ["Beverages", "Canned Goods", "Dry Goods", "Snacks", "Dairy", "General"];
  const allCategories = Array.from(new Set([...establishedCategories, ...defaultCategories]));

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "addProductModal";
  overlay.innerHTML = `
    <div class="modal add-product-modal">
      <div class="modal-head">
        <div>
          <h3 id="modalTitle">${currentEditingProductId ? `Edit Product: ${escapeHtml(editingProduct.name)}` : "Add / Edit Product"}</h3>
          <p class="modal-caption" id="modalSubTitle">${currentEditingProductId ? `Modify details, pricing, and stock level for ${escapeHtml(editingProduct.name)}.` : "Create a new item or select an existing product to edit."}</p>
        </div>
        <button class="modal-close" id="closeAddProduct" type="button">×</button>
      </div>
      <form id="addProductModalForm">
        <input type="hidden" id="modalEditingProductId" name="product_id" value="${currentEditingProductId || ""}">
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group">
              <label for="modalProdName">Product Name</label>
              <div class="product-name-input-row">
                <input id="modalProdName" name="name" required placeholder="e.g. Mineral Water" autocomplete="off">
                <button type="button" class="product-picker-btn" id="modalEditProductPickerBtn" title="edit existing product" aria-label="edit existing product">
                  <img class="btn-icon" src="src/icon/dark/set-capital.svg" alt="edit existing product">
                </button>
              </div>
            </div>
            <div class="form-group">
              <label for="modalProdCategory">Category</label>
              <div class="category-input-row">
                <input id="modalProdCategory" name="category" list="categoryDatalist" required placeholder="e.g. Beverages" autocomplete="off">
                <div class="category-picker-wrap">
                  <button type="button" class="category-picker-btn" id="modalCategoryPickerBtn" title="Select Established Category" aria-haspopup="listbox" aria-expanded="false">
                    <img class="btn-icon" src="src/icon/dark/sort-filter.svg" alt="Select Category">
                  </button>
                  <div id="modalCategoryMenu" class="styled-select-menu category-picker-menu" hidden role="listbox">
                    ${allCategories.map(cat => `
                      <button type="button" class="styled-select-option" data-category-val="${escapeHtml(cat)}" role="option">${escapeHtml(cat)}</button>
                    `).join("")}
                    <button type="button" class="styled-select-option" data-category-val="__NEW__" role="option">Custom</button>
                  </div>
                </div>
                <datalist id="categoryDatalist">
                  ${allCategories.map(cat => `<option value="${escapeHtml(cat)}"></option>`).join("")}
                </datalist>
              </div>
            </div>
            <div class="form-group">
              <label for="modalProdCost">Cost Price (Base Cost)</label>
              <input id="modalProdCost" name="cost" type="number" min="0" step=".01" required placeholder="0.00">
            </div>
            <div class="form-group">
              <label for="modalProdPrice">Selling Price (SRP)</label>
              <input id="modalProdPrice" name="price" type="number" min="0" step=".01" required placeholder="0.00">
            </div>
            <div class="form-group">
              <label for="modalProdStock">Stock Quantity</label>
              <input id="modalProdStock" name="stock" type="number" min="0" required placeholder="0">
            </div>
            <div class="form-group">
              <label for="modalAlertLevel">Low Stock Alert Threshold</label>
              <input id="modalAlertLevel" name="low_stock_alert_level" type="number" min="1" value="20" required placeholder="20">
            </div>
            <div class="form-group">
              <label for="modalHasExpiry">Expiry Date Available?</label>
              <select name="hasExpiry" id="modalHasExpiry" class="compact-select styled-select-native" aria-label="Expiry Date Available?">
                <option value="no">No Expiration</option>
                <option value="yes">Yes</option>
              </select>
            </div>
            <div class="form-group" id="modalExpiryWrap" style="display:none">
              <label for="modalProdExpiry">Expiry Date</label>
              <input id="modalProdExpiry" name="expiry" type="date">
            </div>
            <div class="form-group full">
              <label for="modalProdDesc">Description / Notes <small class="form-hint">(Max 50 words)</small></label>
              <textarea id="modalProdDesc" name="description" placeholder="Optional product details or supplier notes (Max 50 words)" rows="4" maxlength="300" style="resize:none"></textarea>
            </div>
          </div>
        </div>
        <div class="modal-foot">
          <button class="ghost-btn" id="cancelAddProduct" type="button">Cancel</button>
          <button class="primary-btn" id="confirmAddProduct" type="submit">${currentEditingProductId ? "Save Changes" : "Save Product"}</button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(overlay);
  bindStyledSelects(overlay);

  const close = () => overlay.remove();
  document.getElementById("closeAddProduct").addEventListener("click", close);
  document.getElementById("cancelAddProduct").addEventListener("click", close);
  overlay.addEventListener("click", e => {
    if (e.target === overlay) close();
  });

  const populateFormWithProduct = (product) => {
    if (!product) return;
    currentEditingProductId = Number(product.id);

    const editingIdInput = document.getElementById("modalEditingProductId");
    if (editingIdInput) editingIdInput.value = currentEditingProductId;

    const titleEl = document.getElementById("modalTitle");
    if (titleEl) titleEl.textContent = `Edit Product: ${product.name}`;

    const subTitleEl = document.getElementById("modalSubTitle");
    if (subTitleEl) subTitleEl.textContent = `Modify details, pricing, and stock level for ${product.name}.`;

    const confirmBtn = document.getElementById("confirmAddProduct");
    if (confirmBtn) confirmBtn.textContent = "Save Changes";

    const nameInput = document.getElementById("modalProdName");
    if (nameInput) nameInput.value = product.name || "";

    const catInput = document.getElementById("modalProdCategory");
    if (catInput) catInput.value = product.category || "";

    const costInput = document.getElementById("modalProdCost");
    if (costInput) costInput.value = product.cost !== undefined ? product.cost : (product.base_cost || 0);

    const priceInput = document.getElementById("modalProdPrice");
    if (priceInput) priceInput.value = product.price !== undefined ? product.price : (product.retail_price || 0);

    const stockInput = document.getElementById("modalProdStock");
    if (stockInput) stockInput.value = product.stock !== undefined ? product.stock : (product.stock_quantity || 0);

    const alertInput = document.getElementById("modalAlertLevel");
    if (alertInput) alertInput.value = product.lowStockAlertLevel || product.low_stock_alert_level || 20;

    const expiryVal = product.expiry || product.expiration_date || "";
    const hasExpirySelect = document.getElementById("modalHasExpiry");
    const expiryWrap = document.getElementById("modalExpiryWrap");
    const expiryInput = document.getElementById("modalProdExpiry");

    if (hasExpirySelect && expiryWrap && expiryInput) {
      if (expiryVal) {
        hasExpirySelect.value = "yes";
        expiryWrap.style.display = "";
        expiryInput.required = true;
        expiryInput.value = expiryVal;
      } else {
        hasExpirySelect.value = "no";
        expiryWrap.style.display = "none";
        expiryInput.required = false;
        expiryInput.value = "";
      }
    }

    const descInput = document.getElementById("modalProdDesc");
    if (descInput) descInput.value = product.description || product.notes || "";
  };

  if (editingProduct) {
    populateFormWithProduct(editingProduct);
  }

  const editPickerBtn = document.getElementById("modalEditProductPickerBtn");
  if (editPickerBtn) {
    editPickerBtn.addEventListener("click", () => {
      openSelectProductToEditModal(currentEditingProductId, (selectedProduct) => {
        populateFormWithProduct(selectedProduct);
      });
    });
  }

  const pickerBtn = document.getElementById("modalCategoryPickerBtn");
  const pickerMenu = document.getElementById("modalCategoryMenu");
  const catInput = document.getElementById("modalProdCategory");

  if (pickerBtn && pickerMenu && catInput) {
    pickerBtn.addEventListener("click", e => {
      e.stopPropagation();
      const willOpen = pickerMenu.hidden;
      pickerMenu.hidden = !willOpen;
      pickerBtn.setAttribute("aria-expanded", String(willOpen));
    });

    pickerMenu.querySelectorAll("[data-category-val]").forEach(optBtn => {
      optBtn.addEventListener("click", e => {
        e.stopPropagation();
        const val = optBtn.dataset.categoryVal;
        if (val === "__NEW__") {
          catInput.value = "";
          catInput.focus();
        } else if (val) {
          catInput.value = val;
        }
        pickerMenu.hidden = true;
        pickerBtn.setAttribute("aria-expanded", "false");
      });
    });

    document.addEventListener("click", e => {
      if (!pickerBtn.contains(e.target) && !pickerMenu.contains(e.target)) {
        pickerMenu.hidden = true;
        pickerBtn.setAttribute("aria-expanded", "false");
      }
    });
  }

  const hasExpiry = document.getElementById("modalHasExpiry");
  const expiryWrap = document.getElementById("modalExpiryWrap");
  const expiryInput = document.getElementById("modalProdExpiry");
  hasExpiry.addEventListener("change", () => {
    const on = hasExpiry.value === "yes";
    expiryWrap.style.display = on ? "" : "none";
    expiryInput.required = on;
    if (!on) expiryInput.value = "";
  });

  const titleCaseInput = (input) => {
    if (!input) return;
    input.addEventListener("input", () => {
      const start = input.selectionStart;
      const end = input.selectionEnd;
      input.value = input.value.replace(/(?:^|\s)\S/g, match => match.toUpperCase());
      input.setSelectionRange(start, end);
    });
  };

  titleCaseInput(document.getElementById("modalProdName"));
  titleCaseInput(document.getElementById("modalProdCategory"));

  const descTextarea = document.getElementById("modalProdDesc");
  if (descTextarea) {
    descTextarea.addEventListener("input", () => {
      const words = descTextarea.value.trim().split(/\s+/).filter(Boolean);
      if (words.length > 50) {
        descTextarea.value = words.slice(0, 50).join(" ");
      }
    });
  }

  document.getElementById("addProductModalForm").addEventListener("submit", async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const saveBtn = document.getElementById("confirmAddProduct");
    saveBtn.disabled = true;

    const price = Number(f.get("price"));
    const cost = Number(f.get("cost"));
    const stock = Number(f.get("stock"));
    const alertLevel = Number(f.get("low_stock_alert_level")) || 20;
    const editingId = f.get("product_id") || currentEditingProductId;

    const endpoint = editingId ? "products.php?action=edit" : "products.php?action=add";

    try {
      await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify({
          product_id: editingId ? Number(editingId) : undefined,
          id: editingId ? Number(editingId) : undefined,
          name: f.get("name"),
          category: f.get("category"),
          price,
          cost,
          stock,
          low_stock_alert_level: alertLevel,
          expiry: f.get("hasExpiry") === "yes" ? f.get("expiry") : ""
        })
      });
      await loadDashboardData();
      updateStats();
      close();
      toast(editingId ? "Product updated successfully." : "Product added successfully to database.");
      renderPage("products");
    } catch (error) {
      toast(`Could not ${editingId ? "update" : "add"} product: ${error.message}`);
      saveBtn.disabled = false;
    }
  });

  setTimeout(() => document.getElementById("modalProdName")?.focus(), 50);
}
