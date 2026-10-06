/* ============================================================
 * script.js — Main application orchestrator for Managing Sentry.
 * Imports and coordinates all modularized features:
 * - modules/api.js: Centralised backend communication
 * - modules/state.js: Application state & persistence
 * - modules/utils.js: Pure helpers (money, escapeHtml, toast)
 * - modules/stock-logic.js: Stock tracking & expiration rules
 * - modules/data-loader.js: Data fetching from API
 * - modules/cart.js: Cart state & sell interface
 * - modules/router.js: SPA routing and page renderers
 * - modules/print.js: Receipt printing
 * - modules/pages/: Page view renderers
 * - modules/modals/: Floating dialogs & modals
 * - modules/events/: DOM event listeners
 * ============================================================ */

import { state, persist } from "./modules/state.js";
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

// Initial baseline and batch integrity check for existing state
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

// Render default landing view if app is already active/authenticated
if (!document.getElementById("app")?.classList.contains("hidden")) {
  renderPage("dashboard");
}
