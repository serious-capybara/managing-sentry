/* ============================================================
 * modals/checkout-modal.js — Payment & Checkout modal.
 * Captures payment, records the sale, and presents its receipt.
 * ============================================================ */

import { state, getSession, persist } from "../state.js";
import { money, toast } from "../utils.js";
import { apiRequest } from "../api.js";
import { loadDashboardData } from "../data-loader.js";
import { updateStats } from "../stock-logic.js";
import { printReceipt } from "../print.js";
import { renderReceipt } from "../receipt.js";
import { renderPage, setActiveDashTab } from "../router.js";

const saleTotal = items => items.reduce(
  (sum, item) => sum + Math.round((item.price * item.qty + Number.EPSILON) * 100) / 100,
  0
);
let checkoutKeyHandler = null;

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

  const total = saleTotal(state.cart);
  const session = getSession();
  const cashier = session?.fullName || session?.username || "Cashier";
  const date = new Date().toLocaleString("en-PH");
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay checkout-overlay";
  overlay.id = "checkoutModal";
  overlay.innerHTML = `
    <div class="modal checkout-modal" role="dialog" aria-modal="true" aria-labelledby="checkoutTitle">
      <div class="modal-head">
        <div>
          <h3 id="checkoutTitle">Checkout Confirmation</h3>
          <p class="modal-caption">Review the receipt and confirm payment.</p>
        </div>
        <button class="modal-close checkout-close" id="closeCheckout" type="button" aria-label="Close checkout">×</button>
      </div>
      <form class="checkout-form-shell" id="checkoutForm">
        <div class="modal-body checkout-content" id="checkoutContent">
          ${renderReceipt({
            orderId: null,
            date,
            cashier,
            items: state.cart,
            subtotal: total,
            total,
            received: 0,
            change: 0,
            method: "Cash"
          }, true)}
          <div class="checkout-payment-fields">
            <div class="checkout-payment-method">
              <span class="checkout-field-label">Payment Method</span>
              <div class="payment-options">
                ${PAYMENT_METHODS.map((method, index) => `
                  <label class="pay-opt">
                    <input type="radio" name="payMethod" value="${method.value}" data-online="${method.online}" ${index === 0 ? "checked" : ""}>
                    <span>${method.value}</span>
                  </label>`).join("")}
              </div>
            </div>
            <div class="form-group checkout-cash-field">
              <label for="amountReceived">Cash Received (₱)</label>
              <input id="amountReceived" name="amount_received" type="number" min="0" step="0.01" value="0" required inputmode="decimal">
            </div>
            <div class="form-group checkout-reference-field hidden" id="referenceField">
              <label for="refNumber">Reference Number</label>
              <input id="refNumber" name="reference" type="text" maxlength="120" placeholder="Enter payment reference number">
            </div>
            <div class="checkout-payment-totals" aria-live="polite">
              <div><span>Subtotal</span><strong>${money(total)}</strong></div>
              <div class="checkout-grand-total"><span>Total</span><strong>${money(total)}</strong></div>
              <div><span>Cash</span><strong id="checkoutCash">${money(0)}</strong></div>
              <div><span>Change Due</span><strong id="changeAmount">${money(0)}</strong></div>
            </div>
            <p class="checkout-payment-error hidden" id="checkoutPaymentError" role="alert"></p>
            <div class="form-group checkout-notes">
              <label for="saleNotes">Notes (optional)</label>
              <textarea id="saleNotes" name="notes" rows="2" maxlength="2000" placeholder="Add a note for this sale"></textarea>
            </div>
          </div>
        </div>
        <div class="modal-foot checkout-actions">
          <button class="ghost-btn" id="cancelCheckout" type="button">Cancel</button>
          <button class="primary-btn" id="confirmCheckout" type="submit">Confirm Payment</button>
        </div>
      </form>
    </div>`;

  document.body.classList.add("checkout-open");
  document.body.appendChild(overlay);

  const form = overlay.querySelector("#checkoutForm");
  const receivedInput = overlay.querySelector("#amountReceived");
  const cashAmount = overlay.querySelector("#checkoutCash");
  const changeAmount = overlay.querySelector("#changeAmount");
  const referenceField = overlay.querySelector("#referenceField");
  const referenceInput = overlay.querySelector("#refNumber");
  const error = overlay.querySelector("#checkoutPaymentError");
  const confirmButton = overlay.querySelector("#confirmCheckout");
  let saving = false;

  const selectedMethod = () => overlay.querySelector('input[name="payMethod"]:checked');
  const refreshPayment = () => {
    const online = selectedMethod()?.dataset.online === "true";
    referenceField.classList.toggle("hidden", !online);
    overlay.querySelector(".checkout-cash-field").classList.toggle("hidden", online);

    const received = online ? total : Number(receivedInput.value || 0);
    const cashIsShort = !online && received < total;
    cashAmount.textContent = money(received);
    changeAmount.textContent = money(Math.max(0, received - total));
    changeAmount.classList.toggle("is-short", cashIsShort);

    const missingReference = online && !referenceInput.value.trim();
    error.textContent = cashIsShort
      ? "Cash received is less than the total."
      : missingReference
        ? "Enter the payment reference number to continue."
        : "";
    error.classList.toggle("hidden", !cashIsShort && !missingReference);
    confirmButton.disabled = saving || cashIsShort || missingReference;
  };

  receivedInput.addEventListener("input", refreshPayment);
  referenceInput.addEventListener("input", refreshPayment);
  overlay.querySelectorAll('input[name="payMethod"]').forEach(input => {
    input.addEventListener("change", refreshPayment);
  });
  refreshPayment();

  const close = () => {
    if (!saving) closeCheckoutModal();
  };
  checkoutKeyHandler = event => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };
  document.addEventListener("keydown", checkoutKeyHandler);
  overlay.querySelector("#closeCheckout").addEventListener("click", close);
  overlay.querySelector("#cancelCheckout").addEventListener("click", close);
  overlay.addEventListener("click", event => {
    if (event.target === overlay) close();
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (saving) return;
    refreshPayment();
    if (confirmButton.disabled) return;

    const method = selectedMethod();
    const online = method?.dataset.online === "true";
    const received = online ? total : Number(receivedInput.value || 0);
    const ref = referenceInput.value.trim();
    const notes = overlay.querySelector("#saleNotes").value.trim();
    saving = true;
    confirmButton.disabled = true;
    confirmButton.textContent = "Saving…";
    error.classList.add("hidden");

    try {
      const sale = await finalizeSale({
        method: method?.value || "Cash",
        online,
        received,
        ref,
        notes,
        cashier,
        date
      });
      saving = false;
      renderSuccessReceipt(overlay, {
        orderId: sale.order_id,
        date,
        cashier,
        items: sale.items,
        subtotal: sale.total,
        total: sale.total,
        received,
        change: Math.max(0, received - sale.total),
        method: method?.value || "Cash",
        ref: online ? ref : "",
        notes
      });
    } catch (saveError) {
      saving = false;
      error.textContent = `Could not complete sale: ${saveError.message}`;
      error.classList.remove("hidden");
      confirmButton.disabled = false;
      confirmButton.textContent = "Confirm Payment";
    }
  });

  setTimeout(() => receivedInput.focus(), 50);
}

function renderSuccessReceipt(overlay, receipt) {
  overlay.querySelector(".checkout-modal").classList.add("checkout-modal-success");
  overlay.querySelector(".modal-head").innerHTML = `
    <div>
      <h3 id="checkoutTitle">Sale Completed</h3>
      <p class="modal-caption">Payment was saved successfully.</p>
    </div>
    <button class="modal-close checkout-close" id="closeCheckout" type="button" aria-label="Close receipt">×</button>`;
  overlay.querySelector("#checkoutContent").innerHTML = `
    <div class="checkout-success-banner" role="status">Payment confirmed successfully.</div>
    ${renderReceipt(receipt, false)}`;
  overlay.querySelector(".checkout-actions").innerHTML = `
    <button class="ghost-btn" id="newSaleBtn" type="button">New Sale</button>
    <button class="primary-btn" id="printReceiptBtn" type="button">Print Receipt</button>`;
  overlay.querySelector("#closeCheckout").addEventListener("click", closeCheckoutModal);
  overlay.querySelector("#newSaleBtn").addEventListener("click", () => {
    closeCheckoutModal();
    setActiveDashTab("sell");
    renderPage("dashboard");
  });
  overlay.querySelector("#printReceiptBtn").addEventListener("click", () => printReceipt(receipt));
}

export function closeCheckoutModal() {
  const overlay = document.getElementById("checkoutModal");
  if (!overlay) return;
  if (checkoutKeyHandler) {
    document.removeEventListener("keydown", checkoutKeyHandler);
    checkoutKeyHandler = null;
  }
  overlay.remove();
  if (!document.getElementById("checkoutModal")) {
    document.body.classList.remove("checkout-open");
  }
}

export async function finalizeSale({ method, online, received, ref, notes, cashier, date }) {
  const saleItems = state.cart.map(item => ({ ...item }));
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
  const saleTotal = Number(result.total_amount);
  if (!Number.isFinite(saleTotal) || !Number.isInteger(Number(result.order_id))) {
    throw new Error("The server did not return a valid order ID and total.");
  }

  state.cart = [];
  persist();
  try {
    await loadDashboardData();
    updateStats();
  } catch (refreshError) {
    toast(`Sale saved, but dashboard refresh failed: ${refreshError.message}`);
  }
  toast("Sale completed successfully.");
  return {
    order_id: Number(result.order_id),
    total: saleTotal,
    items: saleItems,
    cashier,
    date
  };
}
