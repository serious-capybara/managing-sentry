// checkout pop-up: takes the payment, saves the sale and shows the receipt

import { state, getSession, persist } from "../state.js";
import { money, amount2, toast } from "../utils.js";
import { updateStats, consumeExpiryBatches } from "../stock-logic.js";
import { enqueueSale, watchSale } from "../sale-queue.js";
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
    changeDue.textContent = amount2(change);
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
      // The sale is recorded on screen at once and sent to the server in the background.
      const sale = finalizeSale({ method: methodName, online, received, ref, notes, cashier, date });
      saving = false;
      const receipt = {
        orderId: null,
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
      };
      renderSuccessReceipt(overlay, receipt);
      watchSale(sale.token, {
        saved(orderId) {
          receipt.orderId = orderId;
          const idCell = document.querySelector("[data-receipt-order]");
          if (idCell && document.getElementById("checkoutModal")) idCell.textContent = String(orderId);
          const caption = document.getElementById("checkoutCaption");
          if (caption) caption.textContent = "Saved to the server.";
        },
        failed(message) {
          const banner = document.querySelector("#checkoutModal .checkout-success-banner");
          if (banner) {
            banner.textContent = `This sale could not be saved (${message}) and was cancelled.`;
            banner.style.background = "#FEE2E2";
            banner.style.color = "#B91C1C";
          }
          const caption = document.getElementById("checkoutCaption");
          if (caption) caption.textContent = "Sale cancelled.";
        }
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
      <p class="modal-caption" id="checkoutCaption">Saving to the server in the background — you can start the next sale.</p>
    </div>
    <button class="modal-close checkout-close" id="closeCheckout" type="button" aria-label="Close receipt">×</button>`;
  overlay.querySelector("#checkoutContent").innerHTML = `
    <div class="checkout-success-banner" role="status">Payment recorded.</div>
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

// record the sale on screen right now and hand it to the background queue
export function finalizeSale({ method, online, received, ref, notes, cashier, date }) {
  const saleItems = state.cart.map(item => ({ ...item }));
  const roundMoney = value => Math.round(value * 100) / 100;
  const total = roundMoney(saleItems.reduce((sum, item) => sum + roundMoney(Number(item.price) * item.qty), 0));

  // A short reference stored with the sale lets the queue make sure it is never saved twice.
  const token = `web-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const serverNotes = `${notes ? `${notes} ` : ""}[${token}]`;

  // Expected order number (replaced by the real one as soon as the server confirms)
  const lastOrderId = state.transactions
    .filter(t => t.type === "SALE")
    .reduce((max, t) => Math.max(max, Number(t.order_id ?? t.id) || 0), 0);

  const newTx = {
    id: lastOrderId + 1,
    order_id: lastOrderId + 1,
    type: "SALE",
    name: saleItems.map(i => i.qty > 1 ? `${i.name} (x${i.qty})` : i.name).join(", "),
    amount: total,
    qty: saleItems.reduce((s, i) => s + i.qty, 0),
    timestamp: Date.now(),
    date: date || new Date().toISOString(),
    items: saleItems,
    notes: notes || "",
    saleToken: token,
    pending: true
  };
  state.transactions.unshift(newTx);

  // Update stock, sold counts and capital on screen
  saleItems.forEach(item => {
    const product = state.products.find(p => p.id === Number(item.id));
    if (!product) return;
    product.stock = Math.max(0, Number(product.stock || 0) - item.qty);
    product.sold = Number(product.sold || 0) + item.qty;
    if (product.soldRevenue != null) product.soldRevenue = Number(product.soldRevenue) + Number(item.price) * item.qty;
    if (product.soldCogs != null) product.soldCogs = Number(product.soldCogs) + Number(item.cost || product.cost || 0) * item.qty;
    consumeExpiryBatches(product, item.qty);
  });
  state.capital = Number(state.capital || 0) + total;

  state.cart = [];
  persist();
  setActiveDashTab("sell");
  updateStats();

  enqueueSale({
    token,
    total,
    body: {
      items: saleItems.map(item => ({ product_id: item.id, quantity: item.qty })),
      method,
      reference: online ? ref : "",
      notes: serverNotes,
      amount_received: received
    }
  });

  // Repaint the Sell tab behind the pop-up (empty cart, new stock) after the receipt shows.
  requestAnimationFrame(() => setTimeout(() => renderPage("dashboard"), 0));
  toast("Sale recorded.");
  return { order_id: null, token, total, items: saleItems, cashier, date };
}
