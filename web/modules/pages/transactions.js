/* ============================================================
 * pages/transactions.js — Transaction history (sales + stock
 * movements) page renderer and row builder.
 * ============================================================ */

import { state }             from "../state.js";
import { money, escapeHtml } from "../utils.js";

export function renderTransactions() {
  return `<div class="transactions-overview">
    <div class="page-toolbar">
      <div class="toolbar-left">
        <div class="toolbar-sort-wrap">
          <span class="toolbar-label"><img class="inline-icon" src="src/icon/dark/sort-filter.svg" alt=""> View / Sort:</span>
          <select class="compact-select" id="historySort">
            <option value="date" selected>Newest First</option>
            <option value="name">By Product Name</option>
            <option value="SALE">Sales Only</option>
            <option value="STOCK_IN">Stock In Only (Restock)</option>
            <option value="STOCK_OUT">Stock Out Only</option>
            <option value="sales">Highest Sales Amount</option>
          </select>
        </div>
      </div>
      <div class="toolbar-right">
        <input id="transactionSearch" class="compact-input" placeholder="Search transactions...">
        <button class="wire-btn" id="printHistoryBtn"><img class="btn-icon" src="src/icon/dark/reports.svg" alt=""> Print History</button>
      </div>
    </div>
    <div class="wire-table-wrap transactions-table-card">
      <div class="transactions-table-scroll">
        <table class="transactions-inventory-table">
          <thead><tr><th>ID</th><th>Time Stamp</th><th>Order</th><th>Quantity</th><th>Sales</th><th>Status</th><th>Notes</th></tr></thead>
          <tbody id="transactionRows">${transactionRows()}</tbody>
        </table>
      </div>
    </div>
  </div>`;
}

export function transactionRows(list = state.transactions.slice().reverse()) {
  if (!list.length) {
    return `<tr><td colspan="7" class="table-empty">No transactions recorded yet.</td></tr>`;
  }
  return list.map((t, i) => {
    const hasNotes = !!(t.notes && String(t.notes).trim());
    return `<tr>
    <td>${i + 1}</td><td>${escapeHtml(t.date)}</td><td>${escapeHtml(t.name)}</td><td>${t.qty}</td><td>${money(t.amount)}</td>
    <td><span class="badge ${t.type === "SALE" ? "green" : "orange"}">${escapeHtml(t.type)}</span></td>
    <td><button class="notes-btn ${hasNotes ? "has" : "none"}" data-notes-idx="${state.transactions.indexOf(t)}">${hasNotes ? "Notes" : "Notes Unavailable"}</button></td>
  </tr>`;
  }).join("");
}
