import { money, escapeHtml } from "./utils.js";

export const STORE_NAME = "Alekos' Corner General Merchandise";
export const STORE_ADDRESS = "Cebu, Philippines";
export const STORE_TEL = "+63 9123456789";

/** "10/12/2026, 3:50:44 PM" — the date format used on the receipt. */
export function receiptDate(value = new Date()) {
  return new Date(value).toLocaleString("en-US");
}

/**
 * Render the receipt card.
 * @param {object} receipt
 * @param {boolean} pending  true while checking out (Order ID not assigned yet)
 * @param {boolean} live     adds ids so the checkout modal can update Cash / Change / Payment as you type
 */
export function renderReceipt(receipt, pending = false, live = false) {
  const id = name => (live ? ` id="${name}"` : "");
  return `
    <section class="checkout-receipt" aria-label="Receipt">
      <header class="receipt-header">
        <h4>${STORE_NAME}</h4>
        <p>${STORE_ADDRESS}</p>
        <p>Tel: ${STORE_TEL}</p>
      </header>
      <div class="receipt-divider"></div>
      <dl class="receipt-info">
        <div><dt>Order ID</dt><dd>${pending ? "Will be assigned" : escapeHtml(receipt.orderId)}</dd></div>
        <div><dt>Date</dt><dd>${escapeHtml(receipt.date)}</dd></div>
        <div><dt>Cashier</dt><dd>${escapeHtml(receipt.cashier)}</dd></div>
      </dl>
      <div class="receipt-divider"></div>
      <div class="receipt-items">
        ${receipt.items.map(item => `
          <div class="receipt-item">
            <div class="receipt-item-description">${Number(item.qty)}× ${escapeHtml(item.name)} @ ${money(item.price)}</div>
            <strong>${money(item.price * item.qty)}</strong>
          </div>`).join("")}
      </div>
      <div class="receipt-divider"></div>
      <div class="receipt-totals">
        <div class="receipt-subtotal"><span>Subtotal</span><strong>${money(receipt.subtotal)}</strong></div>
        <div class="receipt-total"><span>Total</span><strong>${money(receipt.total)}</strong></div>
        <div><span>Cash</span><strong${id("receiptCash")}>${money(receipt.received)}</strong></div>
        <div><span>Change Due</span><strong${id("receiptChange")}>${money(receipt.change)}</strong></div>
        <div><span>Payment</span><strong${id("receiptPayment")}>${escapeHtml(receipt.method)}${receipt.ref ? ` · ${escapeHtml(receipt.ref)}` : ""}</strong></div>
      </div>
      ${receipt.notes ? `<div class="receipt-divider"></div><p class="receipt-notes">Notes: ${escapeHtml(receipt.notes)}</p>` : ""}
      <div class="receipt-divider"></div>
      <footer class="receipt-footer"><strong>THANK YOU!</strong><span>Please come again.</span></footer>
    </section>`;
}
