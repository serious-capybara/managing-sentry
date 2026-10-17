import { escapeHtml } from "../utils.js";
import { renderReceipt } from "../receipt.js";
import { printReceipt } from "../print.js";

/** Show the receipt of a past sale (opened from History → "Receipt"). */
export function openHistoryReceipt(t) {
  const notes = String(t.notes || "");
  const method = (notes.match(/Payment:\s*([^.]+)\./) || [])[1]?.trim() || "Cash";
  const ref = (notes.match(/Ref:\s*([^.]+)\./) || [])[1]?.trim() || "";
  const userNotes = notes.replace(/^By .*(\r?\n|$)/m, "").replace(/Payment:\s*[^.]+\.\s*/, "").replace(/Ref:\s*[^.]+\.\s*/, "").trim();
  const total = Number(t.amount || 0);

  const receipt = {
    orderId: t.order_id ?? t.id,
    date: t.date,
    cashier: t.cashier || "—",
    items: (t.items || []).map(i => ({ name: i.name, qty: i.qty, price: i.price, total: i.subtotal ?? i.price * i.qty })),
    subtotal: total,
    total,
    received: Number(t.amount_received || total),
    change: Number(t.change_given || 0),
    method,
    ref,
    notes: userNotes
  };

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal checkout-modal" role="dialog" aria-modal="true">
      <div class="modal-head">
        <div><h3>Receipt</h3><p class="modal-caption">Order ${escapeHtml(receipt.orderId)}</p></div>
        <button type="button" class="modal-close" aria-label="Close">×</button>
      </div>
      <div class="modal-body">${renderReceipt(receipt)}</div>
      <div class="modal-foot">
        <button type="button" class="ghost-btn" data-close>Close</button>
        <button type="button" class="primary-btn" data-print>Print Receipt</button>
      </div>
    </div>`;
  const close = () => overlay.remove();
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
  overlay.querySelector(".modal-close").addEventListener("click", close);
  overlay.querySelector("[data-close]").addEventListener("click", close);
  overlay.querySelector("[data-print]").addEventListener("click", () => printReceipt(receipt));
  document.body.appendChild(overlay);
}
