/* ============================================================
 * script.js — Main application orchestrator for Managing Sentry.
 * Coordinates 7-day session auto-restoration on page reloads/refreshes.
 * ============================================================ */

import { state, persist, isSessionValid, getActivePage, clearSession } from "./modules/state.js";
import { loadDashboardData } from "./modules/data-loader.js";
import {
  ensureStockBaseline,
  ensureExpiryBatches,
  earliestExpiry,
  updateStats
} from "./modules/stock-logic.js";
import { bindSidebarEvents } from "./modules/events/sidebar-events.js";
import { renderPage } from "./modules/router.js";

// Initialize application event listeners (login, nav, actions)
bindSidebarEvents();

/**
 * Initialize application session state on startup / page refresh.
 * Automatically restores active session if within 7-day window.
 */
async function initSession() {
  const loginScreen = document.getElementById("loginScreen");
  const app = document.getElementById("app");

  if (isSessionValid()) {
    // Show main app and hide login screen immediately for smooth refresh
    if (loginScreen) loginScreen.classList.add("hidden");
    if (app) app.classList.remove("hidden");

    try {
      await loadDashboardData();
    } catch (err) {
      console.warn("Could not sync backend data on reload:", err);
    }

    // Restore the user's active page view (or default to dashboard)
    renderPage(getActivePage());
  } else {
    // Session expired (>= 7 days) or not logged in
    clearSession();
    if (app) app.classList.add("hidden");
    if (loginScreen) loginScreen.classList.remove("hidden");
  }

  // Stock baseline & batch integrity check
  if (Array.isArray(state.products)) {
    state.products.forEach(p => {
      ensureStockBaseline(p);
      ensureExpiryBatches(p);
      const earliest = earliestExpiry(p);
      p.expiry = earliest ? earliest.expiry : (p.expiry || "");
    });
    persist();
    updateStats();
  }
}

initSession();
