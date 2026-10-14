// app start: restores the saved session and shows the first page

import { state, persist, isSessionValid, getActivePage, clearSession } from "./modules/state.js";
import { loadDashboardData } from "./modules/data-loader.js";
import { startLiveSync } from "./modules/live-sync.js";
import { kickSaleQueue } from "./modules/sale-queue.js";
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

// login, menu and button events
bindSidebarEvents();

// on start or refresh: restore the session
async function initSession() {
  if (isSessionValid()) {
    setAuthView(true);

    try {
      await loadDashboardData();
    } catch (err) {
      console.warn("Could not sync backend data on reload:", err);
    }

    // go back to the last page
    renderPage(getActivePage());
    kickSaleQueue();      // send any sale that was still waiting when the page closed
    startLiveSync();
  } else {
    // session over (1 hour) or never signed in
    clearSession();
    setAuthView(false);
  }

  // stock baseline and expiry batch check
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

// sign out after 1 hour even if the tab stays open
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
