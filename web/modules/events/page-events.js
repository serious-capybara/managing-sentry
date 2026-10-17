// event bindings for every page (inputs, sorting, tabs, buttons, sheets)

import { state } from "../state.js";
import { toast, money, escapeHtml } from "../utils.js";
import { apiRequest } from "../api.js";
import { loadDashboardData } from "../data-loader.js";
import { isLowStock, updateStats } from "../stock-logic.js";
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
import { openRemoveProductModal, deleteProductById } from "../modals/remove-product-modal.js";
import { openStockInModal, openStockOutModal } from "../modals/stock-modal.js";
import { openExpirationModal } from "../modals/expiration-modal.js";
import { showInfoModal, askYesNo } from "../modals/dialogs.js";
import { dashboardRows, sortProducts, dashTabHtml, setActiveProfitType } from "../pages/dashboard.js";
import { productRows } from "../pages/products.js";
import { stockRows } from "../pages/stocks.js";
import { priceMatchRows, priceDirectoryRows } from "../pages/price-checker.js";
import { transactionRows, renderHistoryPrintReport, filterHistory, historyBanner } from "../pages/transactions.js";
import { renderSalesProfitReport, renderInventoryCapitalReport, renderInventoryCapitalPrintReport, renderSalesProfitPrintReport, activeReportTab, activeReportRange, setActiveReportTab, setActiveReportRange, setActiveSalesView } from "../pages/reports.js";
import { bindStyledSelects } from "../styled-select.js";
import { openExpenseTotalsModal } from "../modals/expense-totals-modal.js";
import { createSheet, isPhone } from "../mobile-sheet.js";
import { openHistoryReceipt } from "../modals/history-receipt-modal.js";
import { hasMoreHistory, loadMoreHistory, loadAllHistory } from "../data-loader.js";

const HISTORY_PAGE = 100;

// phone bottom sheets, rebuilt each time the page renders
let dashSheet = null;
let stocksSheet = null;

// let cart.js redraw the tab after cart changes
registerRenderActiveTab(renderActiveTab);

export function updateCartPill() {
  const pill = document.getElementById("cartPill");
  if (pill) pill.textContent = cartCount();
}

// marks the active tab button (on phones only while its sheet is open)
function paintDashTabs(pageContent) {
  const sheetOn = !isPhone() || !!dashSheet?.isOpen();
  pageContent.querySelectorAll(".tab-btn[data-tab]").forEach(btn => {
    const isActive = btn.dataset.tab === activeDashTab && sheetOn;
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
}

// redraws the current dashboard tab (expiring or sell) and wires it up
export function renderActiveTab() {
  const target = document.getElementById("dashboardTab");
  const pageContent = document.getElementById("pageContent");
  if (!target || !pageContent) return;

  pageContent.classList.toggle("dashboard-sell-mode", activeDashTab === "sell");
  const main = pageContent.closest(".main");
  if (main) main.classList.toggle("sell-view-mode", activeDashTab === "sell");

  paintDashTabs(pageContent);

  const prevSearch = target.querySelector("#sellSearch")?.value || "";
  const prevSort = target.querySelector("#sellSort")?.value || "";

  target.innerHTML = dashTabHtml(activeDashTab);
  bindTabActions(target);
  bindStyledSelects(target);
  updateCartPill();

  if (activeDashTab === "sell") {
    const searchEl = target.querySelector("#sellSearch");
    const sortEl = target.querySelector("#sellSort");
    if (searchEl && prevSearch) {
      searchEl.value = prevSearch;
    }
    if (sortEl && prevSort) {
      sortEl.value = prevSort;
      sortEl.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
}

// buttons and search inside the sell tab
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

  target.querySelectorAll("[data-confirm-expired-removal]").forEach(b => {
    b.addEventListener("click", async () => {
      const prodId = Number(b.dataset.confirmExpiredRemoval);
      const product = state.products.find(p => p.id === prodId);
      if (!product) return;
      const confirmed = await askYesNo(`Confirm removal/disposal of expired stock for "${product.name}"?`, {
        title: "Confirm Expired Disposal",
        yesText: "Confirm & Dispose",
        noText: "Cancel"
      });
      if (!confirmed) return;
      if (Number(product.stock || 0) > 0) {
        const { moveStockInBackground } = await import("../optimistic.js");
        moveStockInBackground(product, "STOCK OUT", Number(product.stock), { userNote: "Confirmed disposal of expired stock batch" });
      } else {
        product.expiry = "";
        product.expiration_date = null;
        product.expiryBatches = [];
        const { updateProductInBackground } = await import("../optimistic.js");
        updateProductInBackground(product, {
          name: product.name,
          category: product.category,
          stock: 0,
          price: product.price,
          cost: product.cost,
          alertLevel: product.lowStockAlertLevel || 20,
          expiry: "",
          notes: "Cleared expired batch with 0 stock"
        });
      }
      toast(`Disposed expired batch for ${product.name}.`);
      renderPage("dashboard");
    });
  });

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
    refreshSellProducts();
  }
}

// wires up whichever page was just rendered
export function bindPageEvents(page) {
  document.body.classList.remove("m-sheet-open");
  const pageContent = document.getElementById("pageContent");
  if (!pageContent) return;
  bindStyledSelects(pageContent);
  initOrderHoverTooltip();

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
    updateStats();

    const updateDashboard = () => {
      const q = (document.getElementById("dashboardSearch")?.value || "").toLowerCase();
      const mode = document.getElementById("dashboardSort")?.value || "selling";
      let list = state.products.filter(p => `${p.name} ${p.category}`.toLowerCase().includes(q));
      const rowsEl = document.getElementById("dashboardRows");
      if (rowsEl) rowsEl.innerHTML = dashboardRows(sortProducts(list, mode));
    };

    document.getElementById("dashboardSearch")?.addEventListener("input", updateDashboard);
    document.getElementById("dashboardSort")?.addEventListener("change", updateDashboard);
    updateDashboard();

    document.getElementById("setExpenseTotalsBtn")?.addEventListener("click", () => openExpenseTotalsModal());
    // phone: the tab body opens as a bottom sheet (expiring = 50/90%, pick items = 90%)
    const dashBody = document.getElementById("dashboardTabBody");
    const dashBottom = document.getElementById("dashboardBottomSection");
    dashSheet = (dashBody && dashBottom)
      ? createSheet({
          sheet: dashBody,
          handle: document.getElementById("dashSheetHandle"),
          host: dashBottom,
          onChange: () => paintDashTabs(pageContent)
        })
      : null;
    if (isPhone() && dashBottom) {
      dashBottom.classList.remove("collapsed-section");
      localStorage.setItem("sentryDashSectionCollapsed", "false");
    }
    pageContent.querySelector("[data-sheet-collapse]")?.addEventListener("click", () => dashSheet?.close());

    pageContent.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const previousTab = activeDashTab;
        setActiveDashTab(btn.dataset.tab);

        if (isPhone() && dashSheet) {
          if (dashSheet.isOpen() && previousTab === btn.dataset.tab) {
            dashSheet.close();
          } else {
            dashBody.classList.toggle("is-sell", btn.dataset.tab === "sell");
            dashSheet.open({ locked: btn.dataset.tab === "sell" });
            // build the content next frame so the sheet opens without waiting
            requestAnimationFrame(() => setTimeout(renderActiveTab, 0));
          }
          paintDashTabs(pageContent);
          return;
        }

        // open the bottom section if it was collapsed
        const bottomSection = document.getElementById("dashboardBottomSection");
        const toggleIcon = document.getElementById("dashboardToggleIcon");
        if (bottomSection && bottomSection.classList.contains("collapsed-section")) {
          bottomSection.classList.remove("collapsed-section");
          if (toggleIcon) toggleIcon.src = "src/icon/dark/dropdown-close-expand.svg";
          localStorage.setItem("sentryDashSectionCollapsed", "false");
        }

        // highlight first, swap the content next frame
        paintDashTabs(pageContent);
        requestAnimationFrame(() => setTimeout(renderActiveTab, 0));
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
      } else {
        bottomSection.classList.remove("collapsed-section");
        toggleIcon.src = "src/icon/dark/dropdown-close-expand.svg";
      }

      toggleBtn.addEventListener("click", () => {
        const collapsed = bottomSection.classList.toggle("collapsed-section");
        toggleIcon.src = collapsed
          ? "src/icon/dark/dropdown-open-expand.svg"
          : "src/icon/dark/dropdown-close-expand.svg";
        localStorage.setItem("sentryDashSectionCollapsed", collapsed ? "true" : "false");
      });
    }

    const dashResizer = document.getElementById("dashboardResizerBar");
    if (dashResizer && bottomSection) {
      const getMaxDashPanelHeight = () => {
        const container = bottomSection.parentElement;
        const containerHeight = (container && container.getBoundingClientRect().height > 300)
          ? container.getBoundingClientRect().height
          : (window.innerHeight || 800);
        // keep 420px for the cards, toolbar and about 4 table rows
        return Math.max(180, containerHeight - 420);
      };

      const savedHeight = localStorage.getItem("sentryDashPanelHeight");
      const numHeight = Number(savedHeight);
      // rough value, the exact limit only matters while dragging
      const maxAllowed = Math.max(180, (window.innerHeight || 800) - 64 - 420);
      const initialHeight = (savedHeight && !isNaN(numHeight) && numHeight >= 180)
        ? Math.min(numHeight, maxAllowed)
        : Math.min(320, maxAllowed);

      // tablet and phone size this section in CSS (30% / 15%)
      if (window.innerWidth > 1024) {
        bottomSection.style.height = `${initialHeight}px`;
        bottomSection.style.flex = "0 0 auto";
      }

      let startY = 0;
      let startHeight = 0;

      const onMouseMove = e => {
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const deltaY = startY - clientY;
        const maxAllowedHeight = getMaxDashPanelHeight();
        const newHeight = Math.max(180, Math.min(maxAllowedHeight, startHeight + deltaY));
        bottomSection.style.height = `${newHeight}px`;
        bottomSection.style.flex = "0 0 auto";
        dashResizer.classList.add("dragging");
      };

      const onMouseUp = () => {
        dashResizer.classList.remove("dragging");
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.removeEventListener("touchmove", onMouseMove);
        document.removeEventListener("touchend", onMouseUp);
        const finalHeight = parseInt(bottomSection.style.height, 10);
        if (finalHeight && finalHeight >= 180) {
          localStorage.setItem("sentryDashPanelHeight", finalHeight);
        }
      };

      const onMouseDown = e => {
        e.preventDefault();
        startY = e.touches ? e.touches[0].clientY : e.clientY;
        startHeight = bottomSection.getBoundingClientRect().height;
        document.body.style.userSelect = "none";
        document.body.style.cursor = "ns-resize";

        document.addEventListener("mousemove", onMouseMove, { passive: false });
        document.addEventListener("mouseup", onMouseUp);
        document.addEventListener("touchmove", onMouseMove, { passive: false });
        document.addEventListener("touchend", onMouseUp);
      };

      dashResizer.addEventListener("mousedown", onMouseDown);
      dashResizer.addEventListener("touchstart", onMouseDown, { passive: false });
    }

    renderActiveTab();
  }

  if (page === "products") {
    const updateProducts = () => {
      const sortVal = document.getElementById("productSort")?.value || "name";
      const rowsEl = document.getElementById("productRows");
      if (rowsEl) rowsEl.innerHTML = productRows(sortProducts(state.products, sortVal));
    };
    document.getElementById("productSort")?.addEventListener("change", updateProducts);
    updateProducts();
    document.getElementById("addProductBtn")?.addEventListener("click", () => openAddProductModal());
    document.getElementById("removeProductBtn")?.addEventListener("click", () => openRemoveProductModal());
  }

  if (page === "stocks") {
    const lowBody = document.getElementById("stocksLowBody");
    const lowHost = document.getElementById("stocksLowPanel");
    stocksSheet = (lowBody && lowHost)
      ? createSheet({ sheet: lowBody, handle: document.getElementById("stocksSheetHandle"), host: lowHost })
      : null;
    if (isPhone() && lowHost) {
      lowHost.classList.remove("stocks-collapsed");
      localStorage.setItem("sentryStockSectionCollapsed", "false");
    }
    document.getElementById("stocksLowTab")?.addEventListener("click", () => {
      if (isPhone()) stocksSheet?.toggle();
    });

    const toggleBtn = document.getElementById("stocksSectionToggle");
    const lowPanel = document.getElementById("stocksLowPanel");
    const toggleIcon = document.getElementById("stocksToggleIcon");

    if (toggleBtn && lowPanel && toggleIcon) {
      const isCollapsed = localStorage.getItem("sentryStockSectionCollapsed") === "true";
      if (isCollapsed) {
        lowPanel.classList.add("stocks-collapsed");
        toggleIcon.src = "src/icon/dark/dropdown-open-expand.svg";
      } else {
        lowPanel.classList.remove("stocks-collapsed");
        toggleIcon.src = "src/icon/dark/dropdown-close-expand.svg";
      }

      toggleBtn.addEventListener("click", () => {
        const collapsed = lowPanel.classList.toggle("stocks-collapsed");
        toggleIcon.src = collapsed
          ? "src/icon/dark/dropdown-open-expand.svg"
          : "src/icon/dark/dropdown-close-expand.svg";
        localStorage.setItem("sentryStockSectionCollapsed", collapsed ? "true" : "false");
      });
    }

    const resizer = document.getElementById("stocksResizerBar");
    if (resizer && lowPanel) {
      const getMaxLowPanelHeight = () => {
        const container = lowPanel.closest(".stocks-overview") || lowPanel.parentElement;
        const containerHeight = (container && container.getBoundingClientRect().height > 300)
          ? container.getBoundingClientRect().height
          : (window.innerHeight || 800);
        return Math.max(180, containerHeight - 150);
      };

      const savedHeight = localStorage.getItem("sentryStocksLowPanelHeight");
      const numHeight = Number(savedHeight);
      const maxAllowed = Math.max(180, (window.innerHeight || 800) - 64 - 150);
      const initialHeight = (savedHeight && !isNaN(numHeight) && numHeight >= 180)
        ? Math.min(numHeight, maxAllowed)
        : Math.min(320, maxAllowed);

      if (window.innerWidth > 1024) {
        lowPanel.style.height = `${initialHeight}px`;
        lowPanel.style.flex = "0 0 auto";
      }

      let startY = 0;
      let startHeight = 0;

      const onMouseMove = e => {
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const deltaY = startY - clientY;
        const maxAllowedHeight = getMaxLowPanelHeight();
        const newHeight = Math.max(180, Math.min(maxAllowedHeight, startHeight + deltaY));
        lowPanel.style.height = `${newHeight}px`;
        lowPanel.style.flex = "0 0 auto";
        resizer.classList.add("dragging");
      };

      const onMouseUp = () => {
        resizer.classList.remove("dragging");
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.removeEventListener("touchmove", onMouseMove);
        document.removeEventListener("touchend", onMouseUp);
        const finalHeight = parseInt(lowPanel.style.height, 10);
        if (finalHeight && finalHeight >= 250) {
          localStorage.setItem("sentryStocksLowPanelHeight", finalHeight);
        }
      };

      const onMouseDown = e => {
        e.preventDefault();
        startY = e.touches ? e.touches[0].clientY : e.clientY;
        startHeight = lowPanel.getBoundingClientRect().height;
        document.body.style.userSelect = "none";
        document.body.style.cursor = "ns-resize";

        document.addEventListener("mousemove", onMouseMove, { passive: false });
        document.addEventListener("mouseup", onMouseUp);
        document.addEventListener("touchmove", onMouseMove, { passive: false });
        document.addEventListener("touchend", onMouseUp);
      };

      resizer.addEventListener("mousedown", onMouseDown);
      resizer.addEventListener("touchstart", onMouseDown, { passive: false });
    }

    const updateStocks = () => {
      const stockSort = document.getElementById("stockSort");
      const mode = stockSort ? stockSort.value : "name";
      const sortedProducts = sortProducts(state.products, mode);
      const rowsEl = document.getElementById("stockRows");
      if (rowsEl) rowsEl.innerHTML = stockRows(sortedProducts);
      const lowRowsEl = document.getElementById("stockLowRows");
      if (lowRowsEl) lowRowsEl.innerHTML = stockRows(sortedProducts.filter(isLowStock));
    };

    document.getElementById("stockSort")?.addEventListener("change", updateStocks);
    updateStocks();

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
    refreshDirectory();
  }

  if (page === "transactions") {
    initOrderHoverTooltip();

    const bindNotes = () => {};   // clicks are handled once, below (event delegation)

    document.getElementById("transactionRows")?.addEventListener("click", event => {
      const receiptLink = event.target.closest("[data-receipt-idx]");
      if (receiptLink) {
        const sale = state.transactions[Number(receiptLink.dataset.receiptIdx)];
        if (sale) openHistoryReceipt(sale);
        return;
      }
      const noteLink = event.target.closest("[data-notes-idx]");
      const t = noteLink && state.transactions[Number(noteLink.dataset.notesIdx)];
      if (t?.notes) showInfoModal(`Notes — ${t.name}`, `${t.type} • ${t.date}`, t.notes, true);
    });

    let activeFilteredTransactions = [...state.transactions];

    const updateHistory = () => {
      const query = document.getElementById("transactionSearch")?.value || "";
      const mode = document.getElementById("historySort")?.value || "newest";
      const list = filterHistory(state.transactions, mode, query);

      activeFilteredTransactions = list;
      // Searching and "Oldest" must look at every row, so fetch the rest first.
      if ((mode === "oldest" || query.trim()) && hasMoreHistory()) {
        loadAllHistory().then(() => { if (document.getElementById("transactionRows")) updateHistory(); });
      }
      const rowsEl = document.getElementById("transactionRows");
      shownRows = HISTORY_PAGE;
      if (rowsEl) rowsEl.innerHTML = transactionRows(list.slice(0, shownRows), mode);
      bindNotes();
    };

    // Show 100 rows at first; the next 100 are added as the user scrolls to the bottom.
    let shownRows = HISTORY_PAGE;
    let fetchingMore = false;
    document.querySelector(".transactions-table-scroll")?.addEventListener("scroll", async event => {
      const box = event.currentTarget;
      if (box.scrollTop + box.clientHeight < box.scrollHeight - 160 || fetchingMore) return;
      const mode = document.getElementById("historySort")?.value || "newest";
      const query = document.getElementById("transactionSearch")?.value || "";

      // Reached the end of what is loaded: ask the server for the next 100 rows.
      if (shownRows >= activeFilteredTransactions.length && hasMoreHistory()) {
        fetchingMore = true;
        try {
          await loadMoreHistory(HISTORY_PAGE);
          activeFilteredTransactions = filterHistory(state.transactions, mode, query);
        } catch { /* try again on the next scroll */ }
        fetchingMore = false;
      }
      if (shownRows >= activeFilteredTransactions.length) return;
      const next = activeFilteredTransactions.slice(shownRows, shownRows + HISTORY_PAGE);
      shownRows += next.length;
      document.getElementById("transactionRows")?.insertAdjacentHTML("beforeend", transactionRows(next, mode));
    }, { passive: true });
    window.addEventListener("data-fully-loaded", () => {
      if (document.getElementById("transactionRows")) updateHistory();
    }, { once: true });

    document.getElementById("transactionSearch")?.addEventListener("input", updateHistory);
    document.getElementById("historySort")?.addEventListener("change", updateHistory);
    updateHistory();

    // refresh sales and stock movements whenever History opens
    const refreshHistory = () => loadDashboardData().then(() => {
      if (!document.getElementById("transactionRows")) return;
      const banner = document.getElementById("historyBanner");
      if (banner) {
        banner.outerHTML = historyBanner();
        document.getElementById("retryHistoryBtn")?.addEventListener("click", refreshHistory);
      }
      updateHistory();
    }).catch(() => {});
    document.getElementById("retryHistoryBtn")?.addEventListener("click", refreshHistory);
    refreshHistory();

    document.getElementById("printHistoryBtn")?.addEventListener("click", () => {
      const area = document.getElementById("printArea");
      if (!area) return;

      area.innerHTML = renderHistoryPrintReport(activeFilteredTransactions, document.getElementById("historySort")?.value || "newest");

      const cleanup = () => {
        document.body.classList.remove("printing-history");
        delete document.body.dataset.printHistory;
      };

      window.addEventListener("afterprint", cleanup, { once: true });
      document.body.classList.add("printing-history");
      document.body.dataset.printHistory = "true";

      window.print();
    });
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

      // Detailed Breakdown / Price Changes switch
      content.querySelectorAll("[data-sales-view]").forEach(btn => {
        btn.addEventListener("click", () => {
          setActiveSalesView(btn.dataset.salesView);
          updateReportView();
        });
      });
    };

    document.querySelectorAll("[data-report-tab]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-report-tab]").forEach(b => b.classList.toggle("active", b === btn));
        setActiveReportTab(btn.dataset.reportTab);
        updateReportView();
      });
    });

    rangeSelect?.addEventListener("change", updateReportView);

    // reports always use fresh data
    loadDashboardData().then(() => {
      if (document.getElementById("reportTabContent")) updateReportView();
    }).catch(() => {});

    printBtn?.addEventListener("click", () => {
      const area = document.getElementById("printArea");
      if (!area) return;

      if (activeReportTab === "inventory") {
        area.innerHTML = renderInventoryCapitalPrintReport(activeReportRange);
      } else {
        area.innerHTML = renderSalesProfitPrintReport(activeReportRange);
      }

      const cleanup = () => {
        document.body.classList.remove("printing-report");
        delete document.body.dataset.printReport;
      };

      window.addEventListener("afterprint", cleanup, { once: true });
      document.body.classList.add("printing-report");
      document.body.dataset.printReport = activeReportTab;

      window.print();
    });
  }
}

document.addEventListener("change", event => {
  if (!(event.target instanceof HTMLSelectElement) || event.target.id !== "profitMetricSelect") return;
  setActiveProfitType(event.target.value);
  updateStats();
});

// tooltip that lists every item of a multi-item order
function getOrderItemsFromCell(cell) {
  if (!cell) return [];
  const raw = cell.dataset.orderItems;
  if (!raw) return [];
  try {
    const decoded = decodeURIComponent(raw);
    const parsed = JSON.parse(decoded);
    if (Array.isArray(parsed)) return parsed.map(s => String(s).trim()).filter(Boolean);
  } catch (e1) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(s => String(s).trim()).filter(Boolean);
    } catch (e2) {
      if (typeof raw === "string") {
        return raw.split(",").map(s => s.trim()).filter(Boolean);
      }
    }
  }
  return [];
}

function getOrCreateTooltip() {
  let tt = document.getElementById("orderItemsTooltip");
  if (!tt) {
    tt = document.createElement("div");
    tt.id = "orderItemsTooltip";
    tt.className = "order-items-tooltip";
    tt.style.cssText = "position: fixed; display: none; z-index: 99999; pointer-events: none;";
    document.body.appendChild(tt);
  }
  return tt;
}

function positionTooltip(e, tt) {
  if (!tt) return;
  const cursorX = e.clientX;
  const cursorY = e.clientY;

  const boxWidth = tt.offsetWidth || 260;
  const boxHeight = tt.offsetHeight || 120;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let targetLeft = cursorX + 14;
  let targetTop = cursorY + 14;

  if (targetLeft + boxWidth > viewportWidth - 12) {
    targetLeft = Math.max(12, cursorX - boxWidth - 14);
  }
  if (targetTop + boxHeight > viewportHeight - 12) {
    targetTop = Math.max(12, cursorY - boxHeight - 14);
  }

  tt.style.left = `${targetLeft}px`;
  tt.style.top = `${targetTop}px`;
}

function showTooltipForCell(e, cell) {
  const items = getOrderItemsFromCell(cell);
  if (!items || items.length <= 1) return;

  const tt = getOrCreateTooltip();
  tt.innerHTML = `
    <div class="tooltip-title">ITEMS IN ORDER (${items.length})</div>
    <ul class="tooltip-list">
      ${items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>
  `;
  tt.style.display = "block";
  positionTooltip(e, tt);
}

let hoverTimer = null;
let currentHoverCell = null;
let lastMouseEvent = null;

function cancelHoverTimer() {
  if (hoverTimer) {
    clearTimeout(hoverTimer);
    hoverTimer = null;
  }
}

function hideTooltip() {
  cancelHoverTimer();
  currentHoverCell = null;
  lastMouseEvent = null;
  const tt = document.getElementById("orderItemsTooltip");
  if (tt) tt.style.display = "none";
}

function startHoverTimer(e, cell) {
  const items = getOrderItemsFromCell(cell);
  if (!items || items.length <= 1) {
    hideTooltip();
    return;
  }

  lastMouseEvent = e;
  if (currentHoverCell === cell) {
    return;
  }

  cancelHoverTimer();
  currentHoverCell = cell;

  hoverTimer = setTimeout(() => {
    hoverTimer = null;
    if (currentHoverCell === cell && lastMouseEvent) {
      showTooltipForCell(lastMouseEvent, cell);
    }
  }, 1000);
}

export function initOrderHoverTooltip() {
  if (window._orderHoverDelegated) return;
  window._orderHoverDelegated = true;

  document.addEventListener("mouseover", e => {
    const cell = e.target.closest(".order-hover-cell");
    if (!cell) return;
    startHoverTimer(e, cell);
  });

  document.addEventListener("mousemove", e => {
    const cell = e.target.closest(".order-hover-cell");
    const tt = document.getElementById("orderItemsTooltip");
    if (cell) {
      const items = getOrderItemsFromCell(cell);
      if (!items || items.length <= 1) {
        hideTooltip();
        return;
      }
      lastMouseEvent = e;
      if (tt && tt.style.display === "block" && currentHoverCell === cell) {
        positionTooltip(e, tt);
      } else {
        startHoverTimer(e, cell);
      }
    } else {
      hideTooltip();
    }
  });

  document.addEventListener("mouseout", e => {
    const cell = e.target.closest(".order-hover-cell");
    if (!cell) return;
    if (!e.relatedTarget || !cell.contains(e.relatedTarget)) {
      hideTooltip();
    }
  });
}
