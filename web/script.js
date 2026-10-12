/* ============================================================
 * script.js — Main application orchestrator for Managing Sentry.
 * Coordinates the 1-hour session: restores it on reload and signs
 * the user out once an hour has passed since the last login.
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
import { setAuthView } from "./modules/api.js";
import { toast } from "./modules/utils.js";

// Initialize application event listeners (login, nav, actions)
bindSidebarEvents();

/**
 * Initialize application session state on startup / page refresh.
 * Keeps the signed-in user in the app while the session is inside its
 * 1-hour window, and only shows the login screen once it lapses.
 */
async function initSession() {
  if (isSessionValid()) {
    setAuthView(true);

    try {
      await loadDashboardData();
    } catch (err) {
      console.warn("Could not sync backend data on reload:", err);
    }

    // Restore the user's active page view (or default to dashboard)
    renderPage(getActivePage());
  } else {
    // Session expired (>= 1 hour) or never signed in
    clearSession();
    setAuthView(false);
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

  watchSessionExpiry();
}

/**
 * Sign the user out when the saved session passes 1 hour after login,
 * even if the tab is left open.
 */
function watchSessionExpiry() {
  setInterval(() => {
    if (isSessionValid()) return;
    // Already signed out, or sitting on the login screen — nothing to do.
    if (document.getElementById("app")?.classList.contains("hidden")) return;
    clearSession();
    setAuthView(false);
    toast("Session expired an hour after login. Please sign in again.");
  }, 20000);
}

initSession();
