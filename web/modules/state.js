/* ============================================================
 * state.js — Application state, default values, persistence, and session management.
 * Handles 7-day session persistence across browser refreshes and reloads.
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

/* ============================================================
 * SESSION & ROUTE PERSISTENCE (7-DAY EXPIRATION)
 * ============================================================ */
const SESSION_KEY = "sentrySession";
const ACTIVE_PAGE_KEY = "sentryActivePage";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Save logged-in user session for 7 days.
 * @param {string} username
 */
export function saveSession(username = "admin") {
  const session = {
    username,
    loginTime: Date.now(),
    expiryTime: Date.now() + SEVEN_DAYS_MS
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

/**
 * Get saved session if valid, or clear and return null if expired (>= 7 days).
 * @returns {object|null}
 */
export function getSession() {
  try {
    const data = localStorage.getItem(SESSION_KEY);
    if (!data) return null;
    const session = JSON.parse(data);
    if (!session || !session.expiryTime) return null;
    if (Date.now() >= session.expiryTime) {
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
 * Check if active session exists and is within the 7-day window.
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
