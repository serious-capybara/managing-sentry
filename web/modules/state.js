/* ============================================================
 * state.js — Application state, default values, persistence, and session management.
 * Handles 1-hour session persistence across browser refreshes and reloads.
 * ============================================================ */

export const defaultState = {
  capital: 0,
  salesToday: 0,
  totalSales: 0,
  profit: 0,
  operatingExpenses: 0,
  interest: 0,
  taxes: 0,
  cart: [],
  products: [],
  transactions: []
};

const savedState = JSON.parse(localStorage.getItem("inventorySuperAdmin") || "null");

/** Shared reactive state object used across all modules. */
export const state = { ...structuredClone(defaultState), ...(savedState || {}) };

/** Persist cart, products, transactions and financial settings to localStorage so they survive page reloads. */
export function persist() {
  localStorage.setItem("inventorySuperAdmin", JSON.stringify({
    cart: state.cart,
    products: state.products,
    transactions: state.transactions,
    capital: state.capital,
    operatingExpenses: state.operatingExpenses,
    interest: state.interest,
    taxes: state.taxes
  }));
}

/* ============================================================
 * SESSION & ROUTE PERSISTENCE (1-HOUR EXPIRATION)
 * ============================================================ */
const SESSION_KEY = "sentrySession";
const ACTIVE_PAGE_KEY = "sentryActivePage";
const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Save logged-in user session; it is valid for one hour from this login.
 * @param {string} username
 * @param {string} fullName
 */
export function saveSession(username = "admin", fullName = username) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    username,
    fullName,
    loginTime: Date.now()
  }));
}

/**
 * Get saved session if it is less than an hour old, else clear it and return null.
 * @returns {object|null}
 */
export function getSession() {
  try {
    const data = localStorage.getItem(SESSION_KEY);
    if (!data) return null;
    const session = JSON.parse(data);
    if (!session?.loginTime || Date.now() - session.loginTime >= ONE_HOUR_MS) {
      clearSession();
      return null;
    }
    return session;
  } catch (e) {
    clearSession();
    return null;
  }
}

/** Clear session from localStorage on logout or expiration. */
export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

/**
 * Check if active session exists and is within the 1-hour window.
 * @returns {boolean}
 */
export function isSessionValid() {
  return getSession() !== null;
}

/** Save currently active page view for stateful page reloads. */
export function saveActivePage(page) {
  if (page && page !== "add-product") {
    localStorage.setItem(ACTIVE_PAGE_KEY, page);
  }
}

/** Get saved active page or default to 'dashboard'. */
export function getActivePage() {
  return localStorage.getItem(ACTIVE_PAGE_KEY) || "dashboard";
}
