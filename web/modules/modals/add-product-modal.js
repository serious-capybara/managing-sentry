/* ============================================================
 * modals/add-product-modal.js — Add New Product modal.
 * Floating modal dialog with fixed height notes (max 50 words).
 * ============================================================ */

import { apiRequest } from "../api.js";
import { loadDashboardData } from "../data-loader.js";
import { updateStats } from "../stock-logic.js";
import { toast, escapeHtml } from "../utils.js";
import { renderPage } from "../router.js";
import { state } from "../state.js";
import { bindStyledSelects } from "../styled-select.js";

export function openAddProductModal() {
  const existing = document.getElementById("addProductModal");
  if (existing) existing.remove();

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
          <h3>Add New Product</h3>
          <p class="modal-caption">Create a new item in your inventory catalog.</p>
        </div>
        <button class="modal-close" id="closeAddProduct" type="button">×</button>
      </div>
      <form id="addProductModalForm">
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group">
              <label for="modalProdName">Product Name</label>
              <input id="modalProdName" name="name" required placeholder="e.g. Mineral Water" autocomplete="off">
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
                    <button type="button" class="styled-select-option" data-category-val="__NEW__" role="option">+ Type Custom Category...</button>
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
              <label for="modalProdStock">Initial Stock Quantity</label>
              <input id="modalProdStock" name="stock" type="number" min="0" required placeholder="0">
            </div>
            <div class="form-group">
              <label for="modalAlertLevel">Low Stock Alert Threshold</label>
              <input id="modalAlertLevel" name="low_stock_alert_level" type="number" min="1" value="20" required placeholder="20">
            </div>
            <div class="form-group">
              <label for="modalHasExpiry">Expiry Date Available?</label>
              <select name="hasExpiry" id="modalHasExpiry">
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
          <button class="primary-btn" id="confirmAddProduct" type="submit">Save Product</button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  document.getElementById("closeAddProduct").addEventListener("click", close);
  document.getElementById("cancelAddProduct").addEventListener("click", close);
  overlay.addEventListener("click", e => {
    if (e.target === overlay) close();
  });

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

    try {
      await apiRequest("products.php?action=add", {
        method: "POST",
        body: JSON.stringify({
          name: f.get("name"),
          category: f.get("category"),
          price,
          cost,
          stock,
          low_stock_alert_level: alertLevel,
          expiry: f.get("hasExpiry") === "yes" ? f.get("expiry") : "",
          description: f.get("description")
        })
      });
      await loadDashboardData();
      updateStats();
      close();
      toast("Product added successfully to database.");
      renderPage("products");
    } catch (error) {
      toast(`Could not add product: ${error.message}`);
      saveBtn.disabled = false;
    }
  });

  setTimeout(() => document.getElementById("modalProdName")?.focus(), 50);
}
