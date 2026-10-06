/* ============================================================
 * router.js — SPA page routing and layout switching.
 * Coordinates rendering the selected page and binding its handlers.
 * ============================================================ */

import { updateStats } from "./stock-logic.js";
import { openAddProductModal } from "./modals/add-product-modal.js";
import { renderDashboard } from "./pages/dashboard.js";
import { renderProducts } from "./pages/products.js";
import { renderStocks, renderLowStock, renderStockIn, renderStockOut } from "./pages/stocks.js";
import { renderPriceChecker } from "./pages/price-checker.js";
import { renderTransactions } from "./pages/transactions.js";
import { renderReports } from "./pages/reports.js";
import { bindPageEvents } from "./events/page-events.js";

export const pages = {
  dashboard: "Dashboard",
  products: "Products",
  "low-stock": "Low Stock Alert",
  "stock-in": "Stock In",
  "stock-out": "Stock Out",
  stocks: "Stocks",
  "price-checker": "Price Checker",
  transactions: "History",
  reports: "Reports"
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

  currentPage = page;

  document.querySelectorAll(".nav-item, .nav-sub").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.page === page);
  });

  const subPages = ["products", "stock-in", "stock-out"];
  const navGroup = document.querySelector(".nav-group");
  if (navGroup) {
    const parentActive = subPages.includes(page);
    navGroup.classList.toggle("open", parentActive || navGroup.classList.contains("open"));
    const parent = navGroup.querySelector(".nav-parent");
    if (parent) parent.classList.toggle("active", parentActive);
  }

  const pageTitle = document.getElementById("pageTitle");
  if (pageTitle) {
    pageTitle.textContent = pages[page] || "Dashboard";
  }

  const pageContent = document.getElementById("pageContent");
  if (!pageContent) return;

  pageContent.classList.toggle("dashboard-sell-mode", page === "dashboard" && activeDashTab === "sell");
  const main = pageContent.closest(".main");
  if (main) main.classList.toggle("sell-view-mode", page === "dashboard" && activeDashTab === "sell");

  updateStats();

  const renderer = {
    dashboard: renderDashboard,
    products: renderProducts,
    stocks: renderStocks,
    "low-stock": renderLowStock,
    "stock-in": renderStockIn,
    "stock-out": renderStockOut,
    "price-checker": renderPriceChecker,
    transactions: renderTransactions,
    reports: renderReports
  }[page];

  pageContent.innerHTML = renderer ? renderer() : renderDashboard();
  bindPageEvents(page);
}
