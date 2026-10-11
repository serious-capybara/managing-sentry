/* ============================================================
 * modals/dialogs.js — Reusable dialog modals.
 * askYesNo() replaces window.confirm.
 * showInfoModal() replaces window.alert.
 * ============================================================ */

import { escapeHtml } from "../utils.js";

/**
 * Custom Promise-based Yes / No confirmation dialog.
 * @param {string} message
 * @param {object} options
 * @returns {Promise<boolean>}
 */
export function askYesNo(message, { yesText = "Yes", noText = "No", title = "Confirm" } = {}) {
  return new Promise(resolve => {
    const existing = document.getElementById("yesNoModal");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.id = "yesNoModal";
    overlay.innerHTML = `
      <div class="modal modal-sm">
        <div class="modal-head"><h3>${escapeHtml(title)}</h3></div>
        <div class="modal-body"><p class="yn-msg">${escapeHtml(message)}</p></div>
        <div class="modal-foot">
          <button class="ghost-btn" id="ynNo" type="button">${escapeHtml(noText)}</button>
          <button class="primary-btn" id="ynYes" type="button">${escapeHtml(yesText)}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const done = val => {
      overlay.remove();
      resolve(val);
    };

    document.getElementById("ynYes").addEventListener("click", () => done(true));
    document.getElementById("ynNo").addEventListener("click", () => done(false));
    overlay.addEventListener("click", e => {
      if (e.target === overlay) done(false);
    });
  });
}

/**
 * Styled information / alert dialog.
 * @param {string} title
 * @param {string} subtitle
 * @param {string} message
 * @param {boolean} positive
 */
export function showInfoModal(title, subtitle, message, positive) {
  const existing = document.getElementById("infoModal");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "infoModal";
  overlay.innerHTML = `
    <div class="modal modal-sm">
      <div class="modal-head">
        <h3>${escapeHtml(title)}</h3>
        <button class="modal-close" id="infoClose" type="button">×</button>
      </div>
      <div class="modal-body">
        ${subtitle ? `<p class="info-sub">${escapeHtml(subtitle)}</p>` : ""}
        <p class="yn-msg info-msg ${positive ? "pos" : "neg"}">${escapeHtml(message)}</p>
      </div>
      <div class="modal-foot"><button class="primary-btn" id="infoOk" type="button">Close</button></div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  document.getElementById("infoClose").addEventListener("click", close);
  document.getElementById("infoOk").addEventListener("click", close);
  overlay.addEventListener("click", e => {
    if (e.target === overlay) close();
  });
}
