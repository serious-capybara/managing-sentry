/* ============================================================
 * print.js — Receipt printing renderer.
 * Formats sales receipt and triggers browser window.print().
 * ============================================================ */

import { money, escapeHtml } from "./utils.js";

/**
 * Render printable receipt in #printArea and trigger browser print dialog.
 * @param {object} data
 */
export function printReceipt(data) {
  const area = document.getElementById("printArea");
  if (!area) return;

  area.innerHTML = `
    <div class="receipt-print">
      <h2>Managing Sentry</h2>
      <p class="rp-sub">Super Admin • POS</p>
      <div class="rp-line"></div>
      <p>Date: ${escapeHtml(data.date)}</p>
      <p>Payment: ${escapeHtml(data.method)}${data.ref ? ` (Ref: ${escapeHtml(data.ref)})` : ""}</p>
      <div class="rp-line"></div>
      ${data.items.map(i => `
        <div class="rp-row">
          <span>${escapeHtml(i.name)} × ${i.qty}</span>
          <span>${money(i.price * i.qty)}</span>
        </div>
      `).join("")}
      <div class="rp-line"></div>
      <div class="rp-row rp-total"><span>TOTAL</span><span>${money(data.total)}</span></div>
      <div class="rp-row"><span>Amount Received</span><span>${money(data.received)}</span></div>
      <div class="rp-row"><span>Change</span><span>${money(data.change)}</span></div>
      ${data.notes ? `<div class="rp-line"></div><p class="rp-notes">Notes: ${escapeHtml(data.notes)}</p>` : ""}
      <div class="rp-line"></div>
      <p class="rp-thanks">Thank you for your purchase!</p>
    </div>`;

  document.body.classList.add("printing-receipt");
  window.print();
  document.body.classList.remove("printing-receipt");
}
