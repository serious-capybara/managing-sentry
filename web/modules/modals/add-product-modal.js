/* ============================================================
 * modals/add-product-modal.js — Add New Product modal.
 * Floating modal dialog replacing the separate add-product page.
 * ============================================================ */

import { apiRequest } from "../api.js";
import { loadDashboardData } from "../data-loader.js";
import { updateStats } from "../stock-logic.js";
import { toast } from "../utils.js";
import { renderPage } from "../router.js";

export function openAddProductModal() {
  const existing = document.getElementById("addProductModal");
  if (existing) existing.remove();

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
              <input id="modalProdCategory" name="category" required placeholder="e.g. Beverages" autocomplete="off">
            </div>
            <div class="form-group">
              <label for="modalProdPrice">Selling Price (SRP)</label>
              <input id="modalProdPrice" name="price" type="number" min="0" step=".01" required placeholder="0.00">
            </div>
            <div class="form-group">
              <label for="modalProdCost">Cost Price (Base)</label>
              <input id="modalProdCost" name="cost" type="number" min="0" step=".01" required placeholder="0.00">
            </div>
            <div class="form-group">
              <label for="modalProdStock">Initial Stock</label>
              <input id="modalProdStock" name="stock" type="number" min="0" required placeholder="0">
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
              <label for="modalProdDesc">Description</label>
              <textarea id="modalProdDesc" name="description" placeholder="Optional product notes" rows="2"></textarea>
            </div>
          </div>
        </div>
        <div class="modal-foot">
          <button class="ghost-btn" id="cancelAddProduct" type="button">Cancel</button>
          <button class="primary-btn" id="confirmAddProduct" type="submit">
            <img class="btn-icon" src="src/icon/add.svg" alt=""> Save Product
          </button>
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

  const hasExpiry = document.getElementById("modalHasExpiry");
  const expiryWrap = document.getElementById("modalExpiryWrap");
  const expiryInput = document.getElementById("modalProdExpiry");
  hasExpiry.addEventListener("change", () => {
    const on = hasExpiry.value === "yes";
    expiryWrap.style.display = on ? "" : "none";
    expiryInput.required = on;
    if (!on) expiryInput.value = "";
  });

  document.getElementById("addProductModalForm").addEventListener("submit", async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const saveBtn = document.getElementById("confirmAddProduct");
    saveBtn.disabled = true;
    try {
      await apiRequest("products.php?action=add", {
        method: "POST",
        body: JSON.stringify({
          name: f.get("name"),
          category: f.get("category"),
          price: Number(f.get("price")),
          cost: Number(f.get("cost")),
          stock: Number(f.get("stock")),
          expiry: f.get("hasExpiry") === "yes" ? f.get("expiry") : "",
          description: f.get("description")
        })
      });
      await loadDashboardData();
      updateStats();
      close();
      toast("Product added successfully.");
      renderPage("products");
    } catch (error) {
      toast(`Could not add product: ${error.message}`);
      saveBtn.disabled = false;
    }
  });

  setTimeout(() => document.getElementById("modalProdName")?.focus(), 50);
}
