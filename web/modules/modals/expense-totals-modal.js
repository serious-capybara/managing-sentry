import { state } from "../state.js";
import { apiRequest } from "../api.js";
import { toast } from "../utils.js";
import { updateStats } from "../stock-logic.js";

export function openExpenseTotalsModal() {
  document.getElementById("expenseTotalsModal")?.remove();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "expenseTotalsModal";
  overlay.innerHTML = `
    <div class="modal modal-sm">
      <div class="modal-head">
        <div>
          <h3>Set Expense Totals</h3>
          <p class="modal-caption">These totals are applied to every selected sales period.</p>
        </div>
        <button class="modal-close" id="closeExpenseTotalsModal" type="button" aria-label="Close">×</button>
      </div>
      <form id="expenseTotalsForm">
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group full">
              <label for="operatingExpensesInput">Operating Expenses (₱)</label>
              <input id="operatingExpensesInput" name="operating_expenses" type="number" min="0" max="9999999999.99" step="0.01" value="${inputAmount(state.operatingExpenses)}" required>
            </div>
            <div class="form-group full">
              <label for="interestInput">Interest (₱)</label>
              <input id="interestInput" name="interest" type="number" min="0" max="9999999999.99" step="0.01" value="${inputAmount(state.interest)}" required>
            </div>
            <div class="form-group full">
              <label for="taxesInput">Taxes (₱)</label>
              <input id="taxesInput" name="taxes" type="number" min="0" max="9999999999.99" step="0.01" value="${inputAmount(state.taxes)}" required>
            </div>
            <p id="expenseTotalsError" class="expense-form-message hidden" role="alert"></p>
          </div>
        </div>
        <div class="modal-foot">
          <button class="ghost-btn" id="cancelExpenseTotalsModal" type="button">Cancel</button>
          <button class="primary-btn" id="saveExpenseTotalsBtn" type="submit">Save Totals</button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector("#closeExpenseTotalsModal").addEventListener("click", close);
  overlay.querySelector("#cancelExpenseTotalsModal").addEventListener("click", close);
  overlay.addEventListener("click", event => {
    if (event.target === overlay) close();
  });

  overlay.querySelector("#expenseTotalsForm").addEventListener("submit", async event => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const values = Object.fromEntries(["operating_expenses", "interest", "taxes"].map(key => [
      key,
      Number(formData.get(key))
    ]));
    const errorMessage = overlay.querySelector("#expenseTotalsError");
    const saveButton = overlay.querySelector("#saveExpenseTotalsBtn");

    if (Object.values(values).some(value => !Number.isFinite(value) || value < 0 || value > 9999999999.99)) {
      errorMessage.textContent = "Enter valid non-negative amounts for all three fields.";
      errorMessage.classList.remove("hidden");
      return;
    }

    saveButton.disabled = true;
    errorMessage.classList.add("hidden");
    try {
      await apiRequest("capital.php", {
        method: "POST",
        body: JSON.stringify({ action: "save_expense_totals", ...values })
      });
      state.operatingExpenses = values.operating_expenses;
      state.interest = values.interest;
      state.taxes = values.taxes;
      updateStats();
      close();
      toast("Expense totals saved.");
    } catch (error) {
      errorMessage.textContent = `Could not save expense totals: ${error.message}`;
      errorMessage.classList.remove("hidden");
      saveButton.disabled = false;
    }
  });

  setTimeout(() => overlay.querySelector("#operatingExpensesInput")?.focus(), 50);
}

function inputAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount.toFixed(2) : "0.00";
}
