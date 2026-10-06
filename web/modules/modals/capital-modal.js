/* ============================================================
 * modals/capital-modal.js — Set Capital floating modal dialog.
 * Uses a validated text field without spinner arrows and alerts
 * if non-numeric characters are entered.
 * ============================================================ */

import { state } from "../state.js";
import { money, toast } from "../utils.js";
import { apiRequest } from "../api.js";
import { updateStats } from "../stock-logic.js";
import { renderPage, currentPage } from "../router.js";

/**
 * Open Set Capital floating modal dialog.
 */
export function openSetCapitalModal() {
  const existing = document.getElementById("setCapitalModal");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "setCapitalModal";
  overlay.innerHTML = `
    <div class="modal modal-sm">
      <div class="modal-head">
        <div>
          <h3>Set Capital</h3>
          <p class="modal-caption">Update your business starting capital amount.</p>
        </div>
        <button class="modal-close" id="closeCapitalModal" type="button">×</button>
      </div>
      <form id="setCapitalForm">
        <div class="modal-body">
          <div class="form-group">
            <label for="capitalInput">Starting Capital (₱)</label>
            <input id="capitalInput" name="capital" type="text" inputmode="decimal" value="${Number(state.capital || 0).toFixed(2)}" required placeholder="e.g. 20000.00" autocomplete="off">
          </div>
        </div>
        <div class="modal-foot">
          <button class="ghost-btn" id="cancelCapitalModal" type="button">Cancel</button>
          <button class="primary-btn" id="confirmCapitalModal" type="submit">
            <img class="btn-icon" src="src/icon/white/set-capital.svg" alt=""> Save Capital
          </button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  document.getElementById("closeCapitalModal").addEventListener("click", close);
  document.getElementById("cancelCapitalModal").addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });

  const input = document.getElementById("capitalInput");

  // Real-time numeric validation alert
  input.addEventListener("input", () => {
    const raw = input.value;
    if (/[^\d.]/.test(raw)) {
      toast("Invalid character detected. Only numbers (0-9) and a decimal point are allowed.");
      input.value = raw.replace(/[^\d.]/g, "");
    }
  });

  document.getElementById("setCapitalForm").addEventListener("submit", async e => {
    e.preventDefault();
    const rawVal = input.value.trim();
    const value = Number(rawVal);

    if (!rawVal || isNaN(value) || value < 0 || !/^\d+(\.\d+)?$/.test(rawVal)) {
      return toast("Invalid input. Please enter a valid number (e.g. 20000.00).");
    }

    const saveBtn = document.getElementById("confirmCapitalModal");
    saveBtn.disabled = true;

    try {
      const result = await apiRequest("capital.php", {
        method: "POST",
        body: JSON.stringify({ capital: value })
      });
      state.capital = Number(result.capital);
      updateStats();
      close();
      toast(`Capital updated to ${money(state.capital)}.`);
      renderPage(currentPage || "dashboard");
    } catch (error) {
      toast(`Could not save capital: ${error.message}`);
      saveBtn.disabled = false;
    }
  });

  setTimeout(() => {
    input.focus();
    input.select();
  }, 50);
}
