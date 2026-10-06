/* ============================================================
 * state.js — Application state, default values, and persistence.
 * ============================================================ */

export const defaultState = {
  capital: 20000,
  salesToday: 0,
  totalSales: 0,
  profit: 0,
  cart: [],
  products: [],
  transactions: []
};

const savedState = JSON.parse(localStorage.getItem("inventorySuperAdmin") || "null");

/** Shared reactive state object used across all modules. */
export const state = { ...structuredClone(defaultState), ...(savedState || {}) };

/** Persist cart to localStorage so it survives page reloads. */
export function persist() {
  localStorage.setItem("inventorySuperAdmin", JSON.stringify({ cart: state.cart }));
}
