/* ============================================================
 * modals/expiration-modal.js — Expiration details popup modal.
 * Shows detailed batch breakdown for any product.
 * ============================================================ */

import { state } from "../state.js";
import { escapeHtml } from "../utils.js";
import { activeExpiryBatches, expiryDateInfo } from "../stock-logic.js";

export function openExpirationModal(productId) {
  const product = state.products.find(p => p.id === Number(productId));
  if (!product) return;

  const existing = document.getElementById("expirationModal");
  if (existing) existing.remove();

  const batches = activeExpiryBatches(product).sort((a, b) =>
    String(a.expiry).localeCompare(String(b.expiry))
  );

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "expirationModal";
  overlay.innerHTML = `
    <div class="modal expiration-modal">
      <div class="modal-head">
        <div>
          <h3>Expiration Details</h3>
          <p class="modal-caption">${escapeHtml(product.name)} • ${product.stock} units currently in stock</p>
        </div>
        <button class="modal-close" id="closeExpirationModal" type="button">×</button>
      </div>
      <div class="modal-body">
        ${batches.length ? `
          <div class="expiration-list">
            ${batches.map((b, i) => {
              const info = expiryDateInfo(b.expiry);
              return `<div class="expiration-row">
                <div><strong>Batch ${i + 1}</strong><span>${escapeHtml(b.expiry)}</span></div>
                <div><strong>${Number(b.qty || 0)} unit${Number(b.qty || 0) === 1 ? "" : "s"}</strong><span class="expiry-status ${info.state}">${info.label}</span></div>
              </div>`;
            }).join("")}
          </div>` : `
          <div class="expiration-empty">
            <strong>No expiry</strong>
            <p>This product has no expiration date recorded for its current stock.</p>
          </div>`}
      </div>
      <div class="modal-foot">
        <button class="primary-btn" id="expirationOk" type="button">Close</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  document.getElementById("closeExpirationModal").addEventListener("click", close);
  document.getElementById("expirationOk").addEventListener("click", close);
  overlay.addEventListener("click", e => {
    if (e.target === overlay) close();
  });
}
