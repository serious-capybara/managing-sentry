/* ============================================================
 * modals/stock-modal.js — Stock In & Stock Out floating modals.
 * Allows adding or removing stock quantities for products via
 * floating dialog modals.
 * ============================================================ */

import { state } from "../state.js";
import { escapeHtml, toast } from "../utils.js";
import { apiRequest } from "../api.js";
import { loadDashboardData } from "../data-loader.js";
import { updateStats } from "../stock-logic.js";
import { renderPage, currentPage } from "../router.js";

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

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "stockInModal";

  const productOptions = state.products
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(p => `<option value="${p.id}" ${Number(p.id) === Number(targetProductId) ? "selected" : ""}>${escapeHtml(p.name)} — ${p.stock} units in stock</option>`)
    .join("");

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
              <label for="stockInProduct">Select Product</label>
              <select id="stockInProduct" name="product" required>${productOptions}</select>
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
              <label for="stockInNotes">Notes</label>
              <textarea id="stockInNotes" name="notes" placeholder="Optional stock in details" rows="2"></textarea>
            </div>
          </div>
        </div>
        <div class="modal-foot">
          <button class="ghost-btn" id="cancelStockIn" type="button">Cancel</button>
          <button class="primary-btn" id="confirmStockIn" type="submit">
            <img class="btn-icon" src="src/icon/white/add.svg" alt=""> Record Stock In
          </button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  document.getElementById("closeStockIn").addEventListener("click", close);
  document.getElementById("cancelStockIn").addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });

  const hasExpiry = document.getElementById("stockInHasExpiry");
  const expiryWrap = document.getElementById("stockInExpiryWrap");
  const expiryInput = document.getElementById("stockInExpiry");

  hasExpiry.addEventListener("change", () => {
    const on = hasExpiry.value === "yes";
    expiryWrap.style.display = on ? "" : "none";
    expiryInput.required = on;
    if (!on) expiryInput.value = "";
  });

  document.getElementById("stockInForm").addEventListener("submit", async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const productId = Number(f.get("product"));
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

  setTimeout(() => document.getElementById("stockInQty")?.focus(), 50);
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

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "stockOutModal";

  const productOptions = state.products
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(p => `<option value="${p.id}" ${Number(p.id) === Number(targetProductId) ? "selected" : ""}>${escapeHtml(p.name)} — ${p.stock} units in stock</option>`)
    .join("");

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
              <label for="stockOutProduct">Select Product</label>
              <select id="stockOutProduct" name="product" required>${productOptions}</select>
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
              <label for="stockOutNotes">Notes</label>
              <textarea id="stockOutNotes" name="notes" placeholder="Optional stock out details" rows="2"></textarea>
            </div>
          </div>
        </div>
        <div class="modal-foot">
          <button class="ghost-btn" id="cancelStockOut" type="button">Cancel</button>
          <button class="primary-btn" id="confirmStockOut" type="submit">
            <img class="btn-icon" src="src/icon/white/minus.svg" alt=""> Record Stock Out
          </button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  document.getElementById("closeStockOut").addEventListener("click", close);
  document.getElementById("cancelStockOut").addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });

  const productSelect = document.getElementById("stockOutProduct");
  const qtyInput = document.getElementById("stockOutQty");

  const syncMaxQty = () => {
    const selected = state.products.find(p => p.id === Number(productSelect.value));
    if (selected) {
      qtyInput.max = selected.stock;
    }
  };

  productSelect.addEventListener("change", syncMaxQty);
  syncMaxQty();

  document.getElementById("stockOutForm").addEventListener("submit", async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const productId = Number(f.get("product"));
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

  setTimeout(() => document.getElementById("stockOutQty")?.focus(), 50);
}
