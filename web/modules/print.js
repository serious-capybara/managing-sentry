/* ============================================================
 * print.js — Receipt printing renderer.
 * Formats sales receipt and triggers browser window.print().
 * ============================================================ */

import { renderReceipt } from "./receipt.js";

/**
 * Render printable receipt in #printArea and trigger browser print dialog.
 * @param {object} data
 */
export function printReceipt(data) {
  const area = document.getElementById("printArea");
  if (!area) return;

  area.innerHTML = `<div class="receipt-print">${renderReceipt(data)}</div>`;

  window.addEventListener("afterprint", () => document.body.classList.remove("printing-receipt"), { once: true });
  document.body.classList.add("printing-receipt");
  window.print();
}
