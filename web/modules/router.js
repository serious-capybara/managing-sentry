/* ============================================================
 * router.js — SPA page routing and layout switching.
 * Coordinates rendering the selected page and binding its handlers.
 * ============================================================ */

import { saveActivePage } from "./state.js";
import { updateStats } from "./stock-logic.js";
import { openAddProductModal } from "./modals/add-product-modal.js";
import { openStockInModal, openStockOutModal } from "./modals/stock-modal.js";
import { renderDashboard } from "./pages/dashboard.js";
import { renderProducts } from "./pages/products.js";
import { renderStocks, renderLowStock } from "./pages/stocks.js";
import { renderPriceChecker } from "./pages/price-checker.js";
import { renderTransactions } from "./pages/transactions.js";
import { renderReports } from "./pages/reports.js";
import { bindPageEvents } from "./events/page-events.js";

export const pages = {
  dashboard: "Dashboard",
  products: "Products",
  stocks: "Stocks",
  "low-stock": "Low Stock Alert",
  "price-checker": "Price Checker",
  transactions: "History",
  reports: "Reports"
};

export const pageDescriptions = {
  dashboard: "Everything you need to monitor products, stock, sales and transactions in one place.",
  products: "Manage your inventory catalog.",
  stocks: "Monitor and update current inventory quantities.",
  "low-stock": "Products that need replenishment.",
  "price-checker": "Browse products or search to check a price.",
  transactions: "Sales and inventory movements history.",
  reports: "Inventory, capital, sales and profit reports."
};

export let currentPage = "dashboard";
export let activeDashTab = "expiring";

export function setActiveDashTab(tab) {
  activeDashTab = tab;
}

export function renderPage(page) {
  if (page === "add-product") {
    renderPage("products");
    openAddProductModal();
    return;
  }

  if (page === "stock-in") {
    renderPage("stocks");
    openStockInModal();
    return;
  }

  if (page === "stock-out") {
    renderPage("stocks");
    openStockOutModal();
    return;
  }

  currentPage = page;
  saveActivePage(page);

  document.querySelectorAll(".nav-item, .nav-sub").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.page === page);
  });

  const pageTitle = document.getElementById("pageTitle");
  if (pageTitle) {
    pageTitle.textContent = pages[page] || "Dashboard";
  }

  const pageTooltip = document.getElementById("pageTooltip");
  if (pageTooltip) {
    pageTooltip.setAttribute("data-tooltip", pageDescriptions[page] || "");
  }

  const pageContent = document.getElementById("pageContent");
  if (!pageContent) return;

  pageContent.classList.toggle("dashboard-sell-mode", page === "dashboard" && activeDashTab === "sell");
  const main = pageContent.closest(".main");
  if (main) {
    main.classList.toggle("dashboard-view-mode", page === "dashboard");
    main.classList.toggle("products-view-mode", page === "products");
    main.classList.toggle("stocks-view-mode", page === "stocks");
    main.classList.toggle("low-stock-view-mode", page === "low-stock");
    main.classList.toggle("price-checker-view-mode", page === "price-checker");
    main.classList.toggle("transactions-view-mode", page === "transactions");
    main.classList.toggle("reports-view-mode", page === "reports");
    main.classList.toggle("sell-view-mode", page === "dashboard" && activeDashTab === "sell");
  }

  updateStats();

  const renderer = {
    dashboard: renderDashboard,
    products: renderProducts,
    stocks: renderStocks,
    "low-stock": renderLowStock,
    "price-checker": renderPriceChecker,
    transactions: renderTransactions,
    reports: renderReports
  }[page];

  pageContent.innerHTML = renderer ? renderer() : renderDashboard();
  bindPageEvents(page);
}
