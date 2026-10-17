// receipt printing

import { renderReceipt } from "./receipt.js";

// fills #printArea with the receipt and opens the print dialog
export function printReceipt(data) {
  const area = document.getElementById("printArea");
  if (!area) return;

  area.innerHTML = `<div class="receipt-print">${renderReceipt(data)}</div>`;

  window.addEventListener("afterprint", () => document.body.classList.remove("printing-receipt"), { once: true });
  document.body.classList.add("printing-receipt");
  window.print();
}
