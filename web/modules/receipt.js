import { money, escapeHtml } from "./utils.js";

export const STORE_NAME = "Alekos' Corner General Merchandise";
export const STORE_ADDRESS = "Cebu, Philippines";
export const STORE_TEL = "+63 9123456789";

export function renderReceipt(receipt, pending = false) {
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
            <div class="receipt-item-description">${Number(item.qty)}x ${escapeHtml(item.name)} @ ${money(item.price)}</div>
            <strong>${money(item.price * item.qty)}</strong>
          </div>`).join("")}
      </div>
      <div class="receipt-divider"></div>
      <div class="receipt-totals">
        <div><span>Subtotal</span><strong>${money(receipt.subtotal)}</strong></div>
        <div class="receipt-total"><span>Total</span><strong>${money(receipt.total)}</strong></div>
        <div><span>Cash</span><strong>${money(receipt.received)}</strong></div>
        <div><span>Change Due</span><strong>${money(receipt.change)}</strong></div>
        <div><span>Payment</span><strong>${escapeHtml(receipt.method)}${receipt.ref ? ` · ${escapeHtml(receipt.ref)}` : ""}</strong></div>
      </div>
      ${receipt.notes ? `<div class="receipt-divider"></div><p class="receipt-notes">Notes: ${escapeHtml(receipt.notes)}</p>` : ""}
      <div class="receipt-divider"></div>
      <footer class="receipt-footer"><strong>THANK YOU!</strong><span>Please come again.</span></footer>
    </section>`;
}
