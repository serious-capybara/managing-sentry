/* ============================================================
 * modals/checkout-modal.js — Payment & Checkout modal.
 * Supports multiple payment methods, change calculation, and
 * finalizing transactions against the backend API.
 * ============================================================ */

import { state } from "../state.js";
import { money, escapeHtml, toast } from "../utils.js";
import { apiRequest } from "../api.js";
import { loadDashboardData } from "../data-loader.js";
import { updateStats } from "../stock-logic.js";
import { askYesNo } from "./dialogs.js";
import { printReceipt } from "../print.js";
import { renderPage, setActiveDashTab } from "../router.js";

export const PAYMENT_METHODS = [
  { value: "Cash", online: false },
  { value: "GCash", online: true },
  { value: "Maya", online: true },
  { value: "Gotyme", online: true },
  { value: "Bank Transfer", online: true }
];

export function openCheckoutModal() {
  if (!state.cart.length) return;
  closeCheckoutModal();

  const total = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "checkoutModal";
  overlay.innerHTML = `
    <div class="modal checkout-modal">
      <div class="modal-head">
        <h3>Payment &amp; Checkout</h3>
        <button class="modal-close" id="closeCheckout" type="button">×</button>
      </div>
      <div class="modal-body">
        <section class="checkout-section">
          <h4>Order Summary</h4>
          <div class="checkout-table-scroll">
            <table class="checkout-receipt-table">
              <thead><tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Subtotal</th></tr></thead>
              <tbody>${state.cart.map(i => `
                <tr>
                  <td>${escapeHtml(i.name)}</td>
                  <td>${i.qty}</td>
                  <td>${money(i.price)}</td>
                  <td>${money(i.price * i.qty)}</td>
                </tr>`).join("")}</tbody>
              <tfoot><tr><th colspan="3">Total Amount</th><th id="receiptTotal">${money(total)}</th></tr></tfoot>
            </table>
          </div>
        </section>

        <section class="checkout-section">
          <h4>Payment Details</h4>
          <div class="checkout-table-scroll">
            <table class="checkout-payment-table">
              <tbody>
                <tr><th scope="row">Payment Method</th><td><div class="payment-options">
                  ${PAYMENT_METHODS.map((m, idx) => `
                    <label class="pay-opt">
                      <input type="radio" name="payMethod" value="${m.value}" data-online="${m.online}" ${idx === 0 ? "checked" : ""}>
                      <span>${m.value}</span>
                    </label>`).join("")}
                </div></td></tr>
                <tr><th scope="row"><label for="amountReceived">Amount Received</label></th><td><input id="amountReceived" type="number" min="0" step="0.01" value="${total.toFixed(2)}"></td></tr>
                <tr><th scope="row">Change</th><td><output class="change-box" id="changeAmount">${money(0)}</output></td></tr>
                <tr id="refWrap" style="display:none"><th scope="row"><label for="refNumber">Reference Number</label></th><td><input id="refNumber" type="text" placeholder="Enter payment reference number"></td></tr>
                <tr><th scope="row"><label for="saleNotes">Notes (optional)</label></th><td><textarea id="saleNotes" placeholder="Add a note for this sale"></textarea></td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <div class="modal-foot">
        <button class="ghost-btn" id="cancelCheckout" type="button">Cancel</button>
        <button class="primary-btn" id="confirmCheckout" type="button">Confirm &amp; Complete Sale</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const receivedInput = document.getElementById("amountReceived");
  const changeBox = document.getElementById("changeAmount");
  const refWrap = document.getElementById("refWrap");

  const refreshChange = () => {
    const received = Number(receivedInput.value) || 0;
    const change = Math.max(0, received - total);
    changeBox.textContent = money(change);
    changeBox.classList.toggle("due", received < total);
    if (received < total) changeBox.textContent = money(total - received) + " due";
  };

  const selectedMethod = () => overlay.querySelector('input[name="payMethod"]:checked');

  const refreshMethod = () => {
    const m = selectedMethod();
    const online = m && m.dataset.online === "true";
    refWrap.style.display = online ? "" : "none";
  };

  overlay.querySelectorAll('input[name="payMethod"]').forEach(r => r.addEventListener("change", refreshMethod));
  receivedInput.addEventListener("input", refreshChange);
  refreshMethod();
  refreshChange();

  document.getElementById("closeCheckout").addEventListener("click", closeCheckoutModal);
  document.getElementById("cancelCheckout").addEventListener("click", closeCheckoutModal);
  overlay.addEventListener("click", e => { if (e.target === overlay) closeCheckoutModal(); });
  document.getElementById("confirmCheckout").addEventListener("click", async () => {
    const m = selectedMethod();
    const method = m ? m.value : "Cash";
    const online = m && m.dataset.online === "true";
    const received = Number(receivedInput.value) || 0;
    const ref = document.getElementById("refNumber").value.trim();
    const notes = document.getElementById("saleNotes").value.trim();

    if (online && !ref) return toast("Please enter the payment reference number.");
    if (!online && received < total) return toast("Amount received is less than the total.");

    await finalizeSale({ method, online, received, ref, notes, total });
  });
}

export function closeCheckoutModal() {
  const existing = document.getElementById("checkoutModal");
  if (existing) existing.remove();
}

export async function finalizeSale({ method, online, received, ref, notes }) {
  const date = new Date().toLocaleString();
  const saleItems = state.cart.map(i => ({ ...i }));
  const confirmButton = document.getElementById("confirmCheckout");
  if (confirmButton) confirmButton.disabled = true;
  let total;
  try {
    const result = await apiRequest("make_sale.php", {
      method: "POST",
      body: JSON.stringify({
        items: saleItems.map(item => ({ product_id: item.id, quantity: item.qty })),
        method,
        reference: online ? ref : "",
        notes,
        amount_received: received
      })
    });
    total = Number(result.total_amount);
    state.cart = [];
    await loadDashboardData();
    updateStats();
  } catch (error) {
    toast(`Could not complete sale: ${error.message}`);
    if (confirmButton && confirmButton.isConnected) confirmButton.disabled = false;
    return;
  }
  const change = Math.max(0, received - total);

  closeCheckoutModal();
  setActiveDashTab("sell");
  renderPage("dashboard");
  toast("Sale completed successfully.");

  askYesNo("Sale completed! Do you want to print the receipt?", { title: "Print Receipt", yesText: "Yes", noText: "No" })
    .then(yes => {
      if (yes) printReceipt({ items: saleItems, total, method, ref: online ? ref : "", received, change, notes, date });
    });
}
