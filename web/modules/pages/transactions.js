/* ============================================================
 * pages/transactions.js — Transaction history (sales + stock
 * movements) page renderer and row builder.
 * ============================================================ */

import { state }             from "../state.js";
import { money, escapeHtml } from "../utils.js";

export function renderTransactions() {
  return `<div class="page-toolbar">
      <div class="toolbar-left"><div><h3>History</h3><p>Sales and inventory movements.</p></div></div>
      <div class="toolbar-right">
        <span class="toolbar-label">Sort:</span>
        <select class="compact-select" id="historySort">
          <option value="sales">Sales / Profit</option>
          <option value="date">Newest First</option>
          <option value="name">By Product</option>
        </select>
        <input id="transactionSearch" class="compact-input" placeholder="Search">
        <button class="wire-btn" id="selectRangeBtn">Select Range</button>
        <button class="wire-btn" id="printHistoryBtn">Print</button>
      </div>
    </div>
    <div class="wire-table-wrap"><table><thead><tr><th>ID</th><th>Time Stamp</th><th>Order</th><th>Quantity</th><th>Sales</th><th>Status</th><th>Notes</th></tr></thead>
    <tbody id="transactionRows">${transactionRows()}</tbody></table></div>`;
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
