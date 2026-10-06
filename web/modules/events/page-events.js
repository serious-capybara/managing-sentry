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
import { openExpirationModal } from "../modals/expiration-modal.js";
import { showInfoModal } from "../modals/dialogs.js";
import { dashboardRows, sortProducts, dashTabHtml } from "../pages/dashboard.js";
import { productRows } from "../pages/products.js";
import { stockRows } from "../pages/stocks.js";
import { priceMatchRows, priceDirectoryRows } from "../pages/price-checker.js";
import { transactionRows } from "../pages/transactions.js";
import { renderSalesProfitReport, renderInventoryCapitalReport } from "../pages/reports.js";

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
    btn.addEventListener("click", () => renderPage(btn.dataset.go))
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

    pageContent.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        pageContent.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        setActiveDashTab(btn.dataset.tab);
        renderActiveTab();
      });
    });

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
    document.getElementById("stockSort")?.addEventListener("change", e => {
      const rowsEl = document.getElementById("stockRows");
      if (rowsEl) rowsEl.innerHTML = stockRows(sortProducts(state.products, e.target.value));
    });
    pageContent.addEventListener("click", e => {
      const btn = e.target.closest("[data-expiry-product]");
      if (btn) openExpirationModal(btn.dataset.expiryProduct);
    });
  }

  if (page === "add-product") {
    const hasExpiry = document.getElementById("hasExpiry");
    const expiryWrap = document.getElementById("expiryWrap");
    if (hasExpiry && expiryWrap) {
      const expiryInput = expiryWrap.querySelector("input[name='expiry']");
      const syncExpiry = () => {
        const on = hasExpiry.value === "yes";
        expiryWrap.style.display = on ? "" : "none";
        if (expiryInput) {
          expiryInput.required = on;
          if (!on) expiryInput.value = "";
        }
      };
      hasExpiry.addEventListener("change", syncExpiry);
      syncExpiry();
    }

    document.getElementById("addProductForm")?.addEventListener("submit", async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      try {
        await apiRequest("products.php?action=add", {
          method: "POST",
          body: JSON.stringify({
            name: f.get("name"),
            category: f.get("category"),
            price: Number(f.get("price")),
            cost: Number(f.get("cost")),
            stock: Number(f.get("stock")),
            expiry: f.get("hasExpiry") === "yes" ? f.get("expiry") : "",
            description: f.get("description")
          })
        });
        await loadDashboardData();
        updateStats();
        toast("Product added successfully.");
        renderPage("products");
      } catch (error) {
        toast(`Could not add product: ${error.message}`);
      }
    });
  }

  if (page === "stock-in" || page === "stock-out") {
    if (page === "stock-in") {
      const hasExpiry = document.getElementById("hasExpiry");
      const expiryWrap = document.getElementById("expiryWrap");
      if (hasExpiry && expiryWrap) {
        const expiryInput = expiryWrap.querySelector("input[name='expiry']");
        const syncExpiry = () => {
          const on = hasExpiry.value === "yes";
          expiryWrap.style.display = on ? "" : "none";
          if (expiryInput) {
            expiryInput.required = on;
            if (!on) expiryInput.value = "";
          }
        };
        hasExpiry.addEventListener("change", syncExpiry);
        syncExpiry();
      }
    }

    document.getElementById("stockForm")?.addEventListener("submit", async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const product = state.products.find(p => p.id === Number(f.get("product")));
      const qty = Number(f.get("qty"));
      if (!product) return toast("Please add a product first.");
      try {
        await apiRequest("products.php?action=stock", {
          method: "POST",
          body: JSON.stringify({
            product_id: product.id,
            quantity: qty,
            type: page === "stock-in" ? "STOCK IN" : "STOCK OUT",
            reference: f.get("ref"),
            notes: f.get("notes"),
            expiry: page === "stock-in" && f.get("hasExpiry") === "yes" ? f.get("expiry") : ""
          })
        });
        await loadDashboardData();
        updateStats();
        toast(`Stock ${page === "stock-in" ? "in" : "out"} recorded.`);
        renderPage(page);
      } catch (error) {
        toast(`Could not update stock: ${error.message}`);
      }
    });
  }

  if (page === "price-checker") {
    const input = document.getElementById("priceSearch");
    const sort = document.getElementById("priceSort");
    const directory = document.getElementById("priceDirectory");
    const result = document.getElementById("priceSearchResult");
    const echo = document.getElementById("priceSearchEcho");
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
      if (echo) echo.value = input.value;

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
      let list = state.transactions.filter(t => `${t.name} ${t.type} ${t.date}`.toLowerCase().includes(q));
      const mode = document.getElementById("historySort")?.value || "sales";
      if (mode === "name") list.sort((a, b) => a.name.localeCompare(b.name));
      if (mode === "sales") list.sort((a, b) => Number(b.amount) - Number(a.amount));
      if (mode === "date") list.sort((a, b) => b.timestamp - a.timestamp);
      const rowsEl = document.getElementById("transactionRows");
      if (rowsEl) rowsEl.innerHTML = transactionRows(list);
      bindNotes();
    };

    document.getElementById("transactionSearch")?.addEventListener("input", updateHistory);
    document.getElementById("historySort")?.addEventListener("change", updateHistory);
    document.getElementById("selectRangeBtn")?.addEventListener("click", () => toast("Date range selector can be connected here."));
    document.getElementById("printHistoryBtn")?.addEventListener("click", () => window.print());
    bindNotes();
  }

  if (page === "reports") {
    const content = document.getElementById("reportTabContent");
    const bindReportPrint = () => {
      document.querySelectorAll("[data-report-print]").forEach(btn => {
        btn.addEventListener("click", () => {
          document.body.dataset.printReport = btn.dataset.reportPrint;
          window.print();
          setTimeout(() => delete document.body.dataset.printReport, 0);
        });
      });
    };

    document.querySelectorAll("[data-report-tab]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-report-tab]").forEach(b => b.classList.toggle("active", b === btn));
        if (content) {
          content.innerHTML = btn.dataset.reportTab === "sales" ? renderSalesProfitReport() : renderInventoryCapitalReport();
          bindReportPrint();
        }
      });
    });

    bindReportPrint();
  }
}
