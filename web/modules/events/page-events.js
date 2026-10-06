/* ============================================================
 * events/page-events.js — DOM event bindings for each page view.
 * Handles inputs, sort selectors, tab buttons, modals, and actions.
 * ============================================================ */

import { state } from "../state.js";
import { toast, money } from "../utils.js";
import { apiRequest } from "../api.js";
import { loadDashboardData } from "../data-loader.js";
import { updateStats } from "../stock-logic.js";
import { renderPage, activeDashTab, setActiveDashTab } from "../router.js";
import {
  addToCart,
  updateCartQty,
  stepCartQty,
  removeFromCart,
  clearSellCart,
  cartCount,
  sellProductRows,
  registerRenderActiveTab
} from "../cart.js";
import { openCheckoutModal } from "../modals/checkout-modal.js";
import { openAddProductModal } from "../modals/add-product-modal.js";
import { openRemoveProductModal } from "../modals/remove-product-modal.js";
import { openStockInModal, openStockOutModal } from "../modals/stock-modal.js";
import { openExpirationModal } from "../modals/expiration-modal.js";
import { showInfoModal } from "../modals/dialogs.js";
import { dashboardRows, sortProducts, dashTabHtml, setActiveProfitType } from "../pages/dashboard.js";
import { productRows } from "../pages/products.js";
import { stockRows } from "../pages/stocks.js";
import { priceMatchRows, priceDirectoryRows } from "../pages/price-checker.js";
import { transactionRows } from "../pages/transactions.js";
import { renderSalesProfitReport, renderInventoryCapitalReport, activeReportTab, activeReportRange, setActiveReportTab, setActiveReportRange } from "../pages/reports.js";

// Hook renderActiveTab into cart.js operations
registerRenderActiveTab(renderActiveTab);

export function updateCartPill() {
  const pill = document.getElementById("cartPill");
  if (pill) pill.textContent = cartCount();
}

/**
 * Re-render the active tab on the dashboard (expiring or sell) and bind its controls.
 */
export function renderActiveTab() {
  const target = document.getElementById("dashboardTab");
  const pageContent = document.getElementById("pageContent");
  if (!target || !pageContent) return;

  pageContent.classList.toggle("dashboard-sell-mode", activeDashTab === "sell");
  const main = pageContent.closest(".main");
  if (main) main.classList.toggle("sell-view-mode", activeDashTab === "sell");

  // Dynamically update dashboard tab button active state and icon sources
  pageContent.querySelectorAll(".tab-btn[data-tab]").forEach(btn => {
    const isActive = btn.dataset.tab === activeDashTab;
    btn.classList.toggle("active", isActive);
    const icon = btn.querySelector(".tab-icon");
    if (icon) {
      if (btn.dataset.tab === "expiring") {
        icon.src = isActive ? "src/icon/white/low-stock-alert.svg" : "src/icon/dark/low-stock-alert.svg";
      } else if (btn.dataset.tab === "sell") {
        icon.src = isActive ? "src/icon/white/cart.svg" : "src/icon/dark/cart.svg";
      }
    }
  });

  target.innerHTML = dashTabHtml(activeDashTab);
  bindTabActions(target);
  updateCartPill();
}

/**
 * Bind sell tab interactions (add, step qty, delete, checkout, clear, search).
 * @param {HTMLElement} target
 */
export function bindTabActions(target) {
  target.querySelectorAll("[data-add]").forEach(b =>
    b.addEventListener("click", () => addToCart(Number(b.dataset.add)))
  );
  target.querySelectorAll("[data-cart-qty]").forEach(inp =>
    inp.addEventListener("change", () => updateCartQty(Number(inp.dataset.cartId), Number(inp.value)))
  );
  target.querySelectorAll("[data-cart-add-step]").forEach(b =>
    b.addEventListener("click", () => stepCartQty(Number(b.dataset.cartAddStep), 1))
  );
  target.querySelectorAll("[data-cart-remove-step]").forEach(b =>
    b.addEventListener("click", () => stepCartQty(Number(b.dataset.cartRemoveStep), -1))
  );
  target.querySelectorAll("[data-cart-remove]").forEach(b =>
    b.addEventListener("click", () => removeFromCart(Number(b.dataset.cartRemove)))
  );

  const sellCheckout = target.querySelector("#sellCheckoutBtn");
  if (sellCheckout) sellCheckout.addEventListener("click", openCheckoutModal);

  const clearCart = target.querySelector("#clearCartBtn");
  if (clearCart) clearCart.addEventListener("click", clearSellCart);

  const sellSearch = target.querySelector("#sellSearch");
  const sellSort = target.querySelector("#sellSort");
  if (sellSearch && sellSort) {
    const refreshSellProducts = () => {
      const query = sellSearch.value.trim().toLowerCase();
      let products = state.products.filter(product =>
        product.stock > 0 && `${product.name} ${product.category}`.toLowerCase().includes(query)
      );
      if (sellSort.value === "price") products.sort((a, b) => a.price - b.price);
      else if (sellSort.value === "stock") products.sort((a, b) => a.stock - b.stock);
      else products.sort((a, b) => a.name.localeCompare(b.name));

      const rowsEl = target.querySelector("#sellProductRows");
      if (rowsEl) {
        rowsEl.innerHTML = sellProductRows(products);
        rowsEl.querySelectorAll("[data-add]").forEach(button =>
          button.addEventListener("click", () => addToCart(Number(button.dataset.add)))
        );
      }
    };
    sellSearch.addEventListener("input", refreshSellProducts);
    sellSort.addEventListener("change", refreshSellProducts);
  }
}

/**
 * Bind interactive events for any rendered page.
 * @param {string} page
 */
export function bindPageEvents(page) {
  const pageContent = document.getElementById("pageContent");
  if (!pageContent) return;

  pageContent.querySelectorAll("[data-go]").forEach(btn =>
    btn.addEventListener("click", () => {
      const target = btn.dataset.go;
      if (target === "stock-in") {
        openStockInModal();
      } else if (target === "stock-out") {
        openStockOutModal();
      } else {
        renderPage(target);
      }
    })
  );
  pageContent.querySelectorAll("[data-add]").forEach(btn =>
    btn.addEventListener("click", () => addToCart(Number(btn.dataset.add)))
  );

  if (page === "dashboard") {
    const updateDashboard = () => {
      const q = (document.getElementById("dashboardSearch")?.value || "").toLowerCase();
      const mode = document.getElementById("dashboardSort")?.value || "selling";
      let list = state.products.filter(p => `${p.name} ${p.category}`.toLowerCase().includes(q));
      const rowsEl = document.getElementById("dashboardRows");
      if (rowsEl) rowsEl.innerHTML = dashboardRows(sortProducts(list, mode));
    };

    document.getElementById("dashboardSearch")?.addEventListener("input", updateDashboard);
    document.getElementById("dashboardSort")?.addEventListener("change", updateDashboard);
    document.getElementById("profitTypeSelect")?.addEventListener("change", e => {
      setActiveProfitType(e.target.value);
      updateStats();
    });

    pageContent.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        setActiveDashTab(btn.dataset.tab);

        // Auto-expand bottom section if currently collapsed when a tab is clicked
        const bottomSection = document.getElementById("dashboardBottomSection");
        const toggleIcon = document.getElementById("dashboardToggleIcon");
        if (bottomSection && bottomSection.classList.contains("collapsed-section")) {
          bottomSection.classList.remove("collapsed-section");
          if (toggleIcon) toggleIcon.src = "src/icon/dark/dropdown-close-expand.svg";
          localStorage.setItem("sentryDashSectionCollapsed", "false");
        }

        renderActiveTab();
      });
    });

    const toggleBtn = document.getElementById("dashboardSectionToggle");
    const bottomSection = document.getElementById("dashboardBottomSection");
    const toggleIcon = document.getElementById("dashboardToggleIcon");

    if (toggleBtn && bottomSection && toggleIcon) {
      const isCollapsed = localStorage.getItem("sentryDashSectionCollapsed") === "true";
      if (isCollapsed) {
        bottomSection.classList.add("collapsed-section");
        toggleIcon.src = "src/icon/dark/dropdown-open-expand.svg";
      }

      toggleBtn.addEventListener("click", () => {
        const collapsed = bottomSection.classList.toggle("collapsed-section");
        toggleIcon.src = collapsed
          ? "src/icon/dark/dropdown-open-expand.svg"
          : "src/icon/dark/dropdown-close-expand.svg";
        localStorage.setItem("sentryDashSectionCollapsed", collapsed ? "true" : "false");
      });
    }

    renderActiveTab();
  }

  if (page === "products") {
    const updateProducts = () => {
      const sortVal = document.getElementById("productSort")?.value || "selling";
      const rowsEl = document.getElementById("productRows");
      if (rowsEl) rowsEl.innerHTML = productRows(sortProducts(state.products, sortVal));
    };
    document.getElementById("productSort")?.addEventListener("change", updateProducts);
    document.getElementById("addProductBtn")?.addEventListener("click", openAddProductModal);
    document.getElementById("removeProductBtn")?.addEventListener("click", openRemoveProductModal);
  }

  if (page === "stocks") {
    const toggleBtn = document.getElementById("stocksSectionToggle");
    const lowPanel = document.getElementById("stocksLowPanel");
    const toggleIcon = document.getElementById("stocksToggleIcon");

    if (toggleBtn && lowPanel && toggleIcon) {
      const isCollapsed = localStorage.getItem("sentryStockSectionCollapsed") === "true";
      if (isCollapsed) {
        lowPanel.classList.add("collapsed-section");
        toggleIcon.src = "src/icon/dark/dropdown-open-expand.svg";
      }

      toggleBtn.addEventListener("click", () => {
        const collapsed = lowPanel.classList.toggle("collapsed-section");
        toggleIcon.src = collapsed
          ? "src/icon/dark/dropdown-open-expand.svg"
          : "src/icon/dark/dropdown-close-expand.svg";
        localStorage.setItem("sentryStockSectionCollapsed", collapsed ? "true" : "false");
      });
    }

    document.getElementById("stockSort")?.addEventListener("change", e => {
      const rowsEl = document.getElementById("stockRows");
      if (rowsEl) rowsEl.innerHTML = stockRows(sortProducts(state.products, e.target.value));
      const lowRowsEl = document.getElementById("stockLowRows");
      if (lowRowsEl) lowRowsEl.innerHTML = stockRows(sortProducts(state.products.filter(isLowStock), e.target.value));
    });
    pageContent.addEventListener("click", e => {
      const btn = e.target.closest("[data-expiry-product]");
      if (btn) openExpirationModal(btn.dataset.expiryProduct);
    });
  }

  if (page === "price-checker") {
    const input = document.getElementById("priceSearch");
    const sort = document.getElementById("priceSort");
    const directory = document.getElementById("priceDirectory");
    const result = document.getElementById("priceSearchResult");
    const name = document.getElementById("checkedName");
    const price = document.getElementById("checkedPrice");
    const stock = document.getElementById("checkedStock");
    const matchList = document.getElementById("priceMatchList");

    if (!input || !directory || !result) return;

    const selectProduct = id => {
      const p = state.products.find(x => x.id === Number(id));
      if (!p) return;
      if (name) name.textContent = p.name;
      if (price) price.textContent = money(p.price);
      if (stock) stock.textContent = `Stock: ${p.stock} units`;
    };

    const showSearch = () => {
      const q = input.value.trim().toLowerCase();
      if (!q) {
        directory.classList.remove("hidden");
        result.classList.add("hidden");
        return;
      }

      directory.classList.add("hidden");
      result.classList.remove("hidden");

      const matches = state.products
        .filter(p => `${p.name} ${p.category}`.toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name));

      if (matches.length) selectProduct(matches[0].id);
      else {
        if (name) name.textContent = "No product found";
        if (price) price.textContent = "₱0.00";
        if (stock) stock.textContent = "Stock: —";
      }
      if (matchList) {
        matchList.innerHTML = priceMatchRows(matches);
        matchList.querySelectorAll("[data-price-product]").forEach(btn => {
          btn.addEventListener("click", () => selectProduct(btn.dataset.priceProduct));
        });
      }
    };

    const refreshDirectory = () => {
      directory.innerHTML = priceDirectoryRows(sort?.value || "alphabetical");
      directory.querySelectorAll("[data-price-product]").forEach(btn => {
        btn.addEventListener("click", () => {
          input.value = state.products.find(p => p.id === Number(btn.dataset.priceProduct))?.name || "";
          showSearch();
        });
      });
    };

    input.addEventListener("input", showSearch);
    if (sort) sort.addEventListener("change", refreshDirectory);

    if (echo) {
      echo.addEventListener("input", () => {
        input.value = echo.value;
        showSearch();
      });
    }

    refreshDirectory();
  }

  if (page === "transactions") {
    const bindNotes = () => {
      document.querySelectorAll("#transactionRows .notes-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const t = state.transactions[Number(btn.dataset.notesIdx)];
          if (!t) return;
          const has = t.notes && String(t.notes).trim();
          if (has) showInfoModal(`Notes — ${t.name}`, `${t.type} • ${t.date}`, t.notes, true);
          else showInfoModal("Notes Unavailable", `${t.type} • ${t.date}`, `No notes were added to this ${String(t.type).toLowerCase()} transaction.`, false);
        });
      });
    };
    const updateHistory = () => {
      const q = (document.getElementById("transactionSearch")?.value || "").toLowerCase();
      const mode = document.getElementById("historySort")?.value || "date";

      let list = [...state.transactions];

      if (q) {
        list = list.filter(t => `${t.name} ${t.type} ${t.date} ${t.notes || ""}`.toLowerCase().includes(q));
      }

      if (mode === "SALE") {
        list = list.filter(t => t.type === "SALE" || t.type === "sale");
        list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      } else if (mode === "STOCK_IN" || mode === "STOCK IN") {
        list = list.filter(t => t.type === "STOCK IN" || t.type === "STOCK_IN" || t.type === "stock_in");
        list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      } else if (mode === "STOCK_OUT" || mode === "STOCK OUT") {
        list = list.filter(t => t.type === "STOCK OUT" || t.type === "STOCK_OUT" || t.type === "stock_out");
        list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      } else if (mode === "name") {
        list.sort((a, b) => a.name.localeCompare(b.name));
      } else if (mode === "sales") {
        list.sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
      } else {
        // Default "date": Newest First
        list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      }

      const rowsEl = document.getElementById("transactionRows");
      if (rowsEl) rowsEl.innerHTML = transactionRows(list);
      bindNotes();
    };

    document.getElementById("transactionSearch")?.addEventListener("input", updateHistory);
    document.getElementById("historySort")?.addEventListener("change", updateHistory);
    document.getElementById("printHistoryBtn")?.addEventListener("click", () => {
      document.body.dataset.printHistory = "true";
      window.print();
      setTimeout(() => delete document.body.dataset.printHistory, 0);
    });
    bindNotes();
  }

  if (page === "reports") {
    const content = document.getElementById("reportTabContent");
    const printBtn = document.getElementById("topReportPrintBtn");
    const rangeSelect = document.getElementById("reportDateRange");

    const updateReportView = () => {
      if (!content) return;
      if (rangeSelect) setActiveReportRange(rangeSelect.value);

      content.innerHTML = activeReportTab === "sales"
        ? renderSalesProfitReport(activeReportRange)
        : renderInventoryCapitalReport(activeReportRange);

      if (printBtn) printBtn.dataset.reportPrint = activeReportTab;
    };

    document.querySelectorAll("[data-report-tab]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-report-tab]").forEach(b => b.classList.toggle("active", b === btn));
        setActiveReportTab(btn.dataset.reportTab);
        updateReportView();
      });
    });

    rangeSelect?.addEventListener("change", updateReportView);

    printBtn?.addEventListener("click", () => {
      document.body.dataset.printReport = activeReportTab;
      window.print();
      setTimeout(() => delete document.body.dataset.printReport, 0);
    });
  }
}
