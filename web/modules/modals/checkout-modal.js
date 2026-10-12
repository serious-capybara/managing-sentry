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
import { renderReceipt, receiptDate } from "../receipt.js";
import { renderPage, setActiveDashTab } from "../router.js";
import { bindStyledSelects } from "../styled-select.js";

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
  const date = receiptDate();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay checkout-overlay";
  overlay.id = "checkoutModal";
  overlay.innerHTML = `
    <div class="modal checkout-modal" role="dialog" aria-modal="true" aria-labelledby="checkoutTitle">
      <div class="modal-head">
        <div>
          <h3 id="checkoutTitle">Checkout Confirmation</h3>
          <p class="modal-caption">Review the receipt, choose how the customer pays, then confirm.</p>
        </div>
        <button class="modal-close checkout-close" id="closeCheckout" type="button" aria-label="Close checkout">×</button>
      </div>
      <form class="checkout-form-shell" id="checkoutForm" novalidate>
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
          }, true, true)}
          <div class="form-grid checkout-payment-fields">
            <div class="form-group full checkout-payment-method">
              <label for="payMethod">Payment Method</label>
              <select id="payMethod" name="payMethod" class="styled-select-native" aria-label="Payment Method">
                ${PAYMENT_METHODS.map((method, index) => `
                  <option value="${method.value}" ${index === 0 ? "selected" : ""} data-online="${method.online}">${method.value}</option>`).join("")}
              </select>
            </div>
            <div class="form-group full checkout-cash-field">
              <label for="amountReceived">Cash Received</label>
              <div class="input-prefix">
                <span aria-hidden="true">₱</span>
                <input id="amountReceived" name="amount_received" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00" value="">
              </div>
            </div>
            <div class="form-group full checkout-change-field" id="changeField">
              <label for="changeDue">Change Due</label>
              <div class="input-prefix input-prefix--readonly">
                <span aria-hidden="true">₱</span>
                <output id="changeDue" for="amountReceived" aria-live="polite">0.00</output>
              </div>
            </div>
            <div class="form-group full checkout-reference-field hidden" id="referenceField">
              <label for="refNumber">Reference Number</label>
              <input id="refNumber" name="reference" type="text" maxlength="120" placeholder="Enter payment reference number">
            </div>
            <p class="form-group full checkout-payment-error hidden" id="checkoutPaymentError" role="alert"></p>
            <div class="form-group full checkout-notes">
              <label for="saleNotes">Notes <small class="form-hint">(optional)</small></label>
              <textarea id="saleNotes" name="notes" rows="3" maxlength="2000" placeholder="Add a note for this sale"></textarea>
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
  const receiptCash = overlay.querySelector("#receiptCash");
  const receiptChange = overlay.querySelector("#receiptChange");
  const receiptPayment = overlay.querySelector("#receiptPayment");
  const changeField = overlay.querySelector("#changeField");
  const changeDue = overlay.querySelector("#changeDue");
  const cashField = overlay.querySelector(".checkout-cash-field");
  const referenceField = overlay.querySelector("#referenceField");
  const referenceInput = overlay.querySelector("#refNumber");
  const error = overlay.querySelector("#checkoutPaymentError");
  const confirmButton = overlay.querySelector("#confirmCheckout");
  const methodSelect = overlay.querySelector("#payMethod");
  let saving = false;

  const isOnline = () => methodSelect.options[methodSelect.selectedIndex]?.dataset.online === "true";
  const cashValue = () => {
    const n = Number(String(receivedInput.value).replace(/,/g, "").trim());
    return Number.isFinite(n) && n > 0 ? n : 0;   // empty box = 0
  };

  const refreshPayment = () => {
    const online = isOnline();
    referenceField.classList.toggle("hidden", !online);
    cashField.classList.toggle("hidden", online);
    changeField.classList.toggle("hidden", online);   // online payments are exact: no change

    const received = online ? total : cashValue();
    const cashIsShort = !online && received < total;
    const missingReference = online && !referenceInput.value.trim();
    const ref = referenceInput.value.trim();

    receiptCash.textContent = money(received);
    const change = Math.max(0, received - total);
    receiptChange.textContent = money(change);
    changeDue.textContent = change.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    changeField.classList.toggle("is-positive", change > 0);
    receiptPayment.textContent = online && ref ? `${methodSelect.value} · ${ref}` : methodSelect.value;

    // Only nag once the person has typed something; the empty box just keeps Confirm disabled.
    const typed = receivedInput.value.trim() !== "";
    const message = cashIsShort && typed
      ? "Cash received is less than the total."
      : missingReference && referenceInput.dataset.touched
        ? "Enter the payment reference number to continue."
        : "";
    error.textContent = message;
    error.classList.toggle("hidden", !message);
    confirmButton.disabled = saving || cashIsShort || missingReference;
  };

  // Keep the cash box numeric (digits + one decimal point, max 2 decimals)
  receivedInput.addEventListener("input", () => {
    let v = receivedInput.value.replace(/[^\d.]/g, "");
    const firstDot = v.indexOf(".");
    if (firstDot !== -1) v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, "").slice(0, 2);
    receivedInput.value = v;
    refreshPayment();
  });
  receivedInput.addEventListener("focus", () => receivedInput.select());
  referenceInput.addEventListener("input", () => { referenceInput.dataset.touched = "1"; refreshPayment(); });
  methodSelect.addEventListener("change", () => {
    refreshPayment();
    (isOnline() ? referenceInput : receivedInput).focus();
  });

  bindStyledSelects(overlay);
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

    const online = isOnline();
    const received = online ? total : cashValue();
    const ref = referenceInput.value.trim();
    const notes = overlay.querySelector("#saleNotes").value.trim();
    const methodName = methodSelect.value || "Cash";
    saving = true;
    confirmButton.disabled = true;
    confirmButton.textContent = "Saving…";
    error.classList.add("hidden");

    try {
      const sale = await finalizeSale({ method: methodName, online, received, ref, notes, cashier, date });
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
        method: methodName,
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

  setTimeout(() => receivedInput.focus({ preventScroll: true }), 50);
}

function renderSuccessReceipt(overlay, receipt) {
  overlay.querySelector(".modal-head").innerHTML = `
    <div>
      <h3 id="checkoutTitle">Sale Completed</h3>
      <p class="modal-caption">Payment was saved successfully.</p>
    </div>
    <button class="modal-close checkout-close" id="closeCheckout" type="button" aria-label="Close receipt">×</button>`;
  overlay.querySelector("#checkoutContent").innerHTML = `
    <div class="checkout-success-banner" role="status">Payment confirmed successfully.</div>
    <div class="checkout-receipt-box">
      ${renderReceipt(receipt, false)}
    </div>`;
  overlay.querySelector(".checkout-actions").innerHTML = `
    <button class="ghost-btn" id="printReceiptBtn" type="button">Print Receipt</button>
    <button class="primary-btn" id="doneCheckoutBtn" type="button">Done</button>`;
  overlay.querySelector("#closeCheckout").addEventListener("click", closeCheckoutModal);
  overlay.querySelector("#doneCheckoutBtn").addEventListener("click", closeCheckoutModal);
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

  const newTx = {
    id: Number(result.order_id) || Date.now(),
    type: "SALE",
    name: saleItems.map(i => i.qty > 1 ? `${i.name} (x${i.qty})` : i.name).join(", "),
    amount: saleTotal,
    qty: saleItems.reduce((s, i) => s + i.qty, 0),
    timestamp: Date.now(),
    date: date || new Date().toISOString(),
    items: saleItems,
    notes: notes || ""
  };
  if (!state.transactions.some(t => Number(t.id) === Number(newTx.id))) {
    state.transactions.unshift(newTx);
  }

  // The sale is saved: empty the cart now (so it is clean even if the modal is closed with X)
  state.cart = [];
  persist();
  try {
    await loadDashboardData();
    updateStats();
  } catch (refreshError) {
    toast(`Sale saved, but dashboard refresh failed: ${refreshError.message}`);
  }
  state.cart = [];          // loadDashboardData may re-read cached state — keep it empty
  persist();
  setActiveDashTab("sell");
  renderPage("dashboard");  // repaints the Sell tab behind the modal: cart is empty, stock is updated
  toast("Sale completed successfully.");
  return {
    order_id: Number(result.order_id),
    total: saleTotal,
    items: saleItems,
    cashier,
    date
  };
}