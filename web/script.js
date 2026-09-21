const defaultState = {
  capital: 20000,
  salesToday: 0,
  totalSales: 0,
  profit: 0,
  cart: [],
  products: [],
  transactions: []
};

const state = JSON.parse(localStorage.getItem("inventorySuperAdmin") || "null") || structuredClone(defaultState);

/* Currently active dashboard tab (expiring | sell | checkout) */
let activeDashTab = "expiring";

const pages = {
  dashboard: "Dashboard",
  products: "Products",
  "low-stock": "Low Stock Alert",
  "add-product": "Add Product",
  "stock-in": "Stock In",
  "stock-out": "Stock Out",
  stocks: "Stocks",
  "price-checker": "Price Checker",
  transactions: "History",
  reports: "Reports"
};

const loginScreen = document.getElementById("loginScreen");
const app = document.getElementById("app");
const pageContent = document.getElementById("pageContent");
const pageTitle = document.getElementById("pageTitle");

/* LOGIN - KEPT */
document.getElementById("loginForm").addEventListener("submit", e => {
  e.preventDefault();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const message = document.getElementById("loginMessage");

  if (username === "admin" && password === "admin123") {
    message.textContent = "";
    loginScreen.classList.add("hidden");
    app.classList.remove("hidden");
    renderPage("dashboard");
  } else {
    message.textContent = "Invalid username or password.";
  }
});

document.getElementById("showPassword").addEventListener("click", e => {
  const input = document.getElementById("password");
  input.type = input.type === "password" ? "text" : "password";
  e.target.textContent = input.type === "password" ? "Show" : "Hide";
});

document.querySelectorAll(".nav-item[data-page]").forEach(btn => {
  btn.addEventListener("click", () => renderPage(btn.dataset.page));
});

document.querySelectorAll(".nav-sub[data-page]").forEach(btn => {
  btn.addEventListener("click", () => renderPage(btn.dataset.page));
});

document.querySelectorAll(".nav-parent").forEach(btn => {
  btn.addEventListener("click", () => btn.closest(".nav-group").classList.toggle("open"));
});

/* LOGOUT - KEPT */
document.getElementById("logoutBtn").addEventListener("click", () => {
  app.classList.add("hidden");
  loginScreen.classList.remove("hidden");
  document.getElementById("loginForm").reset();
});

document.getElementById("setCapitalBtn").addEventListener("click", () => {
  const value = prompt("Enter your new capital amount:", state.capital);
  if (value !== null && !isNaN(value) && Number(value) >= 0) {
    state.capital = Number(value);
    persist();
    updateStats();
    toast("Capital updated successfully.");
  }
});

document.getElementById("saveDataBtn").addEventListener("click", () => {
  persist();
  toast("Data saved to this browser.");
});

document.getElementById("resetDataBtn").addEventListener("click", () => {
  if (!confirm("Reset all saved inventory, sales, and transaction data?")) return;
  Object.assign(state, structuredClone(defaultState));
  persist();
  renderPage("dashboard");
  toast("All data has been reset.");
});

function persist() {
  localStorage.setItem("inventorySuperAdmin", JSON.stringify(state));
}

function money(value) {
  return "₱" + Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/*
 * Low-stock rule:
 * - The baseline is the total stock immediately after the most recent Stock In.
 * - The alert threshold is 10% of that baseline, rounded up to a whole unit.
 * Example: 60 stocked in -> threshold 6. If 6 remain and 12 are stocked in,
 * the new baseline becomes 18 -> threshold 2.
 * This avoids recalculating from the depleted quantity after every sale.
 */
function ensureStockBaseline(product) {
  const current = Math.max(0, Number(product.stock || 0));
  if (!Number.isFinite(Number(product.stockBaseline)) || Number(product.stockBaseline) <= 0) {
    product.stockBaseline = current;
  }
  return Math.max(0, Number(product.stockBaseline || 0));
}

function lowStockThreshold(product) {
  const baseline = ensureStockBaseline(product);
  return baseline > 0 ? Math.max(1, Math.ceil(baseline * 0.10)) : 0;
}

function isLowStock(product) {
  const stock = Math.max(0, Number(product.stock || 0));
  const threshold = lowStockThreshold(product);
  return threshold > 0 && stock <= threshold;
}

function lowStockLabel(product) {
  return `Alert at ${lowStockThreshold(product)} units (10% of ${ensureStockBaseline(product)})`;
}

function updateStats() {
  const capital = document.getElementById("capitalValue");
  const salesToday = document.getElementById("salesToday");
  const totalSales = document.getElementById("totalSales");
  const profit = document.getElementById("profitEarned");

  if (capital) capital.textContent = money(state.capital);
  if (salesToday) salesToday.textContent = money(state.salesToday);
  if (totalSales) totalSales.textContent = money(state.totalSales);
  if (profit) profit.textContent = money(state.profit);
  updateLowStockIndicator();
}

function updateLowStockIndicator() {
  const hasLowStock = state.products.some(isLowStock);
  const dot = document.getElementById("sidebarLowStockDot");
  const lowDot = document.getElementById("sidebarLowStockAlertDot");
  if (dot) dot.classList.toggle("hidden", !hasLowStock);
  if (lowDot) lowDot.classList.toggle("hidden", !hasLowStock);
}

function renderPage(page) {
  document.querySelectorAll(".nav-item, .nav-sub").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.page === page);
  });

  const subPages = ["products", "add-product", "stock-in", "stock-out"];
  const navGroup = document.querySelector(".nav-group");
  if (navGroup) {
    const parentActive = subPages.includes(page);
    navGroup.classList.toggle("open", parentActive || navGroup.classList.contains("open"));
    navGroup.querySelector(".nav-parent").classList.toggle("active", parentActive);
  }

  pageTitle.textContent = pages[page] || "Dashboard";
  updateStats();

  const renderer = {
    dashboard: renderDashboard,
    products: renderProducts,
    stocks: renderStocks,
    "low-stock": renderLowStock,
    "add-product": renderAddProduct,
    "stock-in": renderStockIn,
    "stock-out": renderStockOut,
    "price-checker": renderPriceChecker,
    transactions: renderTransactions,
    reports: renderReports
  }[page];

  pageContent.innerHTML = renderer ? renderer() : renderDashboard();
  bindPageEvents(page);
}

/* Dashboard-only stats: these cards intentionally live inside the Dashboard page. */
function dashboardStats() {
  return `
    <div class="stats-grid dashboard-only-stats">
      <div class="stat-card">
        <div class="stat-icon purple">₱</div>
        <div><span>Capital</span><strong id="capitalValue">${money(state.capital)}</strong></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">＄</div>
        <div><span>Sales</span><strong id="salesToday">${money(state.salesToday)}</strong></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon orange">⌁</div>
        <div><span>Total Sales</span><strong id="totalSales">${money(state.totalSales)}</strong></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon teal">▥</div>
        <div><span>Profit</span><strong id="profitEarned">${money(state.profit)}</strong></div>
      </div>
    </div>`;
}

/* DASHBOARD - follows the wireframe while retaining the existing tabs */
function renderDashboard() {
  return `
    ${dashboardStats()}
    <div class="dashboard-toolbar">
      <div class="toolbar-left">
        <span class="toolbar-label">Sort:</span>
        <select class="compact-select" id="dashboardSort">
          <option value="selling">High Selling</option>
          <option value="name">By Name</option>
          <option value="stock">Low Stock</option>
        </select>
      </div>
      <div class="toolbar-right">
        <input class="compact-input" id="dashboardSearch" placeholder="Search Products">
      </div>
    </div>

    <div class="wire-table-wrap">
      <table>
        <thead><tr>
          <th>ID</th><th>Name</th><th>Category</th><th>Base</th><th>SRP</th><th>Stock</th><th>Sold</th><th>Est. Profit</th><th>Expiration</th>
        </tr></thead>
        <tbody id="dashboardRows">${dashboardRows()}</tbody>
      </table>
    </div>

    <!-- Existing Expiring Soon / Selling / Checkout tabs are intentionally kept -->
    <div class="dashboard-tabs">
      <button class="tab-btn ${activeDashTab === "expiring" ? "active" : ""}" data-tab="expiring">▣ &nbsp; Expiring Soon</button>
      <button class="tab-btn ${activeDashTab === "sell" ? "active" : ""}" data-tab="sell">□ &nbsp; Pick Items to Sell <span class="cart-pill" id="cartPill">${cartCount()}</span></button>
      <button class="tab-btn ${activeDashTab === "checkout" ? "active" : ""}" data-tab="checkout">□ &nbsp; Cart & Checkout</button>
    </div>
    <div id="dashboardTab">${dashTabHtml(activeDashTab)}</div>
  `;
}

function cartCount() {
  return state.cart.reduce((s, i) => s + i.qty, 0);
}

function dashTabHtml(tab) {
  if (tab === "sell") return renderSellTab();
  if (tab === "checkout") return renderCheckoutTab();
  return expiringPanel() + lowStockPanel();
}

function dashboardRows(products = state.products) {
  if (!products.length) return `<tr><td colspan="9" class="table-empty">No products yet. Add a product from the Products menu.</td></tr>`;
  return products.map((p, index) => {
    const sold = Number(p.sold || 0);
    const estProfit = (Number(p.price) - Number(p.cost)) * sold;
    return `<tr>
      <td>${index + 1}</td><td><strong>${escapeHtml(p.name)}</strong></td><td>${escapeHtml(p.category)}</td>
      <td>${money(p.cost)}</td><td>${money(p.price)}</td><td>${p.stock}</td><td>${sold}</td>
      <td>${money(estProfit)}</td><td>${p.expiry || "—"}</td>
    </tr>`;
  }).join("");
}

function sortProducts(list, mode) {
  const copy = [...list];
  if (mode === "name") return copy.sort((a,b) => a.name.localeCompare(b.name));
  if (mode === "stock") return copy.sort((a,b) => a.stock - b.stock);
  return copy.sort((a,b) => Number(b.sold || 0) - Number(a.sold || 0));
}

function expiringPanel() {
  const now = new Date();
  const soon = state.products.filter(p => {
    if (!p.expiry) return false;
    const days = Math.ceil((new Date(p.expiry) - now) / 86400000);
    return days <= 7;
  });

  return `
    <div class="panel">
      <div class="panel-title">▣ &nbsp; Expiring Soon / Expired (within 7 days)</div>
      <div class="panel-body">
        ${soon.length ? `<div class="product-grid">${soon.map(productMini).join("")}</div>` : `<p class="empty">✓ No expiring items within the next 7 days.</p>`}
      </div>
    </div>`;
}

function lowStockPanel() {
  const low = state.products.filter(isLowStock);
  return `
    <div class="panel">
      <div class="panel-title">▣ &nbsp; Low Stock Alerts ${low.length ? `<span class="alert-dot"></span>` : ""}</div>
      <div class="panel-body">
        ${low.length ? `<div class="product-grid">${low.map(productMini).join("")}</div>` : `<p class="empty">✓ No low stock items right now.</p>`}
      </div>
    </div>`;
}

function productMini(p) {
  const inCart = state.cart.find(c => c.id === p.id)?.qty || 0;
  const available = Math.max(0, p.stock - inCart);
  const disabled = available <= 0 ? "disabled" : "";
  return `<div class="product-card ${available <= 0 ? "out" : ""}">
    <h4>${escapeHtml(p.name)}</h4><p>${escapeHtml(p.category)} • <span class="stock-count">${available} in stock</span></p>
    <div class="product-price">${money(p.price)}</div>
    <div class="add-row">
      <input class="qty-input" type="number" min="1" max="${available}" value="1" data-qty="${p.id}" ${disabled}>
      <button data-add="${p.id}" ${disabled}>${available <= 0 ? "No Stock" : "Add to Cart"}</button>
    </div>
  </div>`;
}

/* PRODUCTS */
function renderProducts() {
  return `
    <div class="page-toolbar">
      <div class="toolbar-left"><div><h3>Products (${state.products.length} Total)</h3><p>Manage your inventory catalog.</p></div></div>
      <div class="toolbar-right">
        <span class="toolbar-label">Sort:</span>
        <select class="compact-select" id="productSort"><option value="selling">High Selling</option><option value="name">By Name</option><option value="stock">Low Stock</option></select>
        <button class="wire-btn" data-go="add-product">Add New Product</button>
        <button class="wire-btn" id="removeProductBtn">Remove Product</button>
      </div>
    </div>
    <div class="wire-table-wrap">
      <table>
        <thead><tr><th>ID</th><th>Name</th><th>Category</th><th>Base</th><th>SRP</th><th>Stock</th></tr></thead>
        <tbody id="productRows">${productRows()}</tbody>
      </table>
    </div>`;
}

function productRows(products = state.products) {
  if (!products.length) return `<tr><td colspan="6" class="table-empty">No products available.</td></tr>`;
  return products.map((p,index) => `<tr>
    <td>${index + 1}</td><td><strong>${escapeHtml(p.name)}</strong></td><td>${escapeHtml(p.category)}</td>
    <td>${money(p.cost)}</td><td>${money(p.price)}</td><td>${p.stock}</td>
  </tr>`).join("");
}

/* EXPIRATION BATCHES - each Stock In keeps its own expiry and quantity. */
function ensureExpiryBatches(product) {
  if (!Array.isArray(product.expiryBatches)) product.expiryBatches = [];
  /* Migrate the older single-expiry field into a batch when possible. */
  if (!product.expiryBatches.length && product.expiry && Number(product.stock || 0) > 0) {
    product.expiryBatches.push({ expiry: product.expiry, qty: Number(product.stock || 0), addedAt: new Date().toISOString() });
  }
  return product.expiryBatches;
}

function expiryDateInfo(dateStr) {
  if (!dateStr) return { state: "none", label: "No Expiry", days: null };
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const expiry = new Date(`${dateStr}T23:59:59`);
  if (Number.isNaN(expiry.getTime())) return { state: "none", label: "No Expiry", days: null };
  const days = Math.ceil((expiry - today) / 86400000);
  if (days < 0) return { state: "expired", label: "Expired", days };
  if (days <= 7) return { state: "soon", label: `${days} day${days === 1 ? "" : "s"} left`, days };
  return { state: "safe", label: `${days} days left`, days };
}

function activeExpiryBatches(product) {
  return ensureExpiryBatches(product).filter(b => Number(b.qty || 0) > 0 && b.expiry);
}

function earliestExpiry(product) {
  const batches = activeExpiryBatches(product).sort((a,b) => String(a.expiry).localeCompare(String(b.expiry)));
  return batches[0] || null;
}

/* Remove sold/stocked-out units from the actual expiry batches.
   Earlier-expiring batches are consumed first. A batch is deleted once
   all of its units have been sold/removed, so the UI immediately focuses
   on the next remaining expiration date. */
function consumeExpiryBatches(product, qty) {
  let remaining = Math.max(0, Number(qty || 0));
  ensureExpiryBatches(product);

  product.expiryBatches.sort((a,b) => {
    if (!a.expiry && b.expiry) return 1;
    if (a.expiry && !b.expiry) return -1;
    return String(a.expiry || "").localeCompare(String(b.expiry || ""));
  });

  for (const batch of product.expiryBatches) {
    if (remaining <= 0) break;
    const available = Math.max(0, Number(batch.qty || 0));
    if (!available) continue;
    const take = Math.min(available, remaining);
    batch.qty = available - take;
    remaining -= take;
  }

  /* A fully sold batch no longer exists in inventory. */
  product.expiryBatches = product.expiryBatches.filter(b => Number(b.qty || 0) > 0);

  /* The product's main expiry always follows the next active batch. */
  const earliest = earliestExpiry(product);
  product.expiry = earliest ? earliest.expiry : "";
}

function expiryButton(product) {
  const batch = earliestExpiry(product);
  if (!batch) return `<button type="button" class="expiry-btn expiry-none" data-expiry-product="${product.id}">No Expiry</button>`;
  const info = expiryDateInfo(batch.expiry);
  const date = escapeHtml(batch.expiry);
  return `<button type="button" class="expiry-btn expiry-${info.state}" data-expiry-product="${product.id}" title="Click to view all expiration batches">${date}<span>${info.label}</span></button>`;
}

function openExpirationModal(productId) {
  const product = state.products.find(p => p.id === Number(productId));
  if (!product) return;
  const existing = document.getElementById("expirationModal");
  if (existing) existing.remove();
  const batches = activeExpiryBatches(product).sort((a,b) => String(a.expiry).localeCompare(String(b.expiry)));
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "expirationModal";
  overlay.innerHTML = `
    <div class="modal expiration-modal">
      <div class="modal-head">
        <div><h3>Expiration Details</h3><p class="modal-caption">${escapeHtml(product.name)} • ${product.stock} units currently in stock</p></div>
        <button class="modal-close" id="closeExpirationModal" type="button">×</button>
      </div>
      <div class="modal-body">
        ${batches.length ? `<div class="expiration-list">${batches.map((b,i) => {
          const info = expiryDateInfo(b.expiry);
          return `<div class="expiration-row">
            <div><strong>Batch ${i + 1}</strong><span>${escapeHtml(b.expiry)}</span></div>
            <div><strong>${Number(b.qty || 0)} unit${Number(b.qty || 0) === 1 ? "" : "s"}</strong><span class="expiry-status ${info.state}">${info.label}</span></div>
          </div>`;
        }).join("")}</div>` : `<div class="expiration-empty"><strong>No expiry</strong><p>This product has no expiration date recorded for its current stock.</p></div>`}
      </div>
      <div class="modal-foot"><button class="primary-btn" id="expirationOk" type="button">Close</button></div>
    </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  document.getElementById("closeExpirationModal").addEventListener("click", close);
  document.getElementById("expirationOk").addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
}

/* STOCKS - new page based on the wireframe, while Stock In/Out remain in the expandable submenu */
function renderStocks() {
  const low = state.products.filter(isLowStock);
  return `
    <div class="page-toolbar">
      <div class="toolbar-left"><div><h3>Stocks</h3><p>Monitor and update current inventory quantities.</p></div></div>
      <div class="toolbar-right">
        <span class="toolbar-label">Sort:</span>
        <select class="compact-select" id="stockSort"><option value="name">By Name</option><option value="stock">Low Stock</option><option value="selling">High Selling</option></select>
        <button class="wire-btn" data-go="stock-in">Add Stock</button>
        <button class="wire-btn" data-go="stock-out">Remove Stock</button>
      </div>
    </div>
    <div class="wire-table-wrap">
      <table>
        <thead><tr><th>ID</th><th>Name</th><th>Category</th><th>Base</th><th>SRP</th><th>Stock</th><th>Expiration</th></tr></thead>
        <tbody id="stockRows">${stockRows()}</tbody>
      </table>
    </div>
    <div class="panel" style="margin-top:7px">
      <div class="panel-title">Low On Stock ${low.length ? `<span class="alert-dot"></span>` : ""}</div>
      <div class="panel-body">
        <div class="wire-table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Name</th><th>Category</th><th>Base</th><th>SRP</th><th>Stock</th><th>Expiration</th></tr></thead>
            <tbody>${stockRows(low)}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function stockRows(products = state.products) {
  if (!products.length) return `<tr><td colspan="7" class="table-empty">No products available.</td></tr>`;
  return products.map((p,index) => `<tr>
    <td>${index + 1}</td><td><strong>${escapeHtml(p.name)}</strong></td><td>${escapeHtml(p.category)}</td>
    <td>${money(p.cost)}</td><td>${money(p.price)}</td><td>${p.stock}</td><td>${expiryButton(p)}</td>
  </tr>`).join("");
}

function renderLowStock() {
  const low = state.products.filter(isLowStock);
  return `<div class="page-head"><div><h3>Low Stock Alert</h3><p>Products that need replenishment.</p></div></div>
    <div class="wire-table-wrap"><table><thead><tr><th>ID</th><th>Product</th><th>Category</th><th>Current Stock</th><th>Action</th></tr></thead>
    <tbody>${low.length ? low.map((p,i) => `<tr><td>${i+1}</td><td><strong>${escapeHtml(p.name)}</strong></td><td>${escapeHtml(p.category)}</td><td><span class="badge red">${p.stock} units</span><br><small>${lowStockLabel(p)}</small></td><td><button class="action-btn" data-go="stock-in">Stock In</button></td></tr>`).join("") : `<tr><td colspan="5" class="table-empty">No low-stock products right now.</td></tr>`}</tbody></table></div>`;
}

function renderAddProduct() {
  return `<div class="page-head"><div><h3>Add Product</h3><p>Create a new item in your inventory.</p></div></div>
    <div class="card form-card"><form id="addProductForm"><div class="form-grid">
      <div class="form-group"><label>Product Name</label><input name="name" required placeholder="e.g. Mineral Water"></div>
      <div class="form-group"><label>Category</label><input name="category" required placeholder="e.g. Beverage"></div>
      <div class="form-group"><label>Selling Price (SRP)</label><input name="price" type="number" min="0" step=".01" required></div>
      <div class="form-group"><label>Cost Price (Base)</label><input name="cost" type="number" min="0" step=".01" required></div>
      <div class="form-group"><label>Initial Stock</label><input name="stock" type="number" min="0" required></div>
      <div class="form-group"><label>Expiry Date Available?</label><select name="hasExpiry" id="hasExpiry"><option value="no">No Expiration</option><option value="yes">Yes</option></select></div>
      <div class="form-group" id="expiryWrap" style="display:none"><label>Expiry Date</label><input name="expiry" type="date"></div>
      <div class="form-group full"><label>Description</label><textarea name="description" placeholder="Optional product notes"></textarea></div>
    </div><button class="action-btn" style="margin-top:20px">Save Product</button></form></div>`;
}

function stockForm(type) {
  const isIn = type === "In";
  return `<div class="page-head"><div><h3>Stock ${type}</h3><p>Record ${type.toLowerCase()} movement for your products.</p></div></div>
    <div class="card form-card"><form id="stockForm"><div class="form-grid">
      <div class="form-group full"><label>Product</label><select name="product">${state.products.map(p => `<option value="${p.id}">${escapeHtml(p.name)} — ${p.stock} units</option>`).join("")}</select></div>
      <div class="form-group"><label>Quantity</label><input name="qty" type="number" min="1" required></div>
      <div class="form-group"><label>Reference / Supplier</label><input name="ref" placeholder="Optional"></div>
      ${isIn ? `
      <div class="form-group"><label>Expiry Date Available?</label><select name="hasExpiry" id="hasExpiry"><option value="no">No Expiration</option><option value="yes">Yes</option></select></div>
      <div class="form-group" id="expiryWrap" style="display:none"><label>Expiry Date</label><input name="expiry" type="date"></div>` : ""}
      <div class="form-group full"><label>Notes</label><textarea name="notes"></textarea></div>
    </div><button class="action-btn" style="margin-top:20px">Record Stock ${type}</button></form></div>`;
}

function renderStockIn() { return stockForm("In"); }
function renderStockOut() { return stockForm("Out"); }

/* PRICE CHECKER - directory first, existing price-result design only after a search */
function renderPriceChecker() {
  return `<div class="page-head">
      <div><h3>Price Checker</h3><p>Browse products or search to check a price.</p></div>
    </div>

    <div class="price-checker-new">
      <div class="price-checker-toolbar">
        <select class="price-sort-select" id="priceSort" aria-label="Sort products">
          <option value="alphabetical">Alphabetical Order</option>
          <option value="category">Category</option>
        </select>
        <div class="price-search-wrap">
          <span>⌕</span>
          <input id="priceSearch" placeholder="Search product..." autocomplete="off">
        </div>
      </div>

      <div id="priceDirectory" class="price-directory">
        ${priceDirectoryRows()}
      </div>

      <div id="priceSearchResult" class="price-search-result hidden">
        <div class="price-checker"><div class="card form-card" style="max-width:none">
          <div class="form-group"><label>Search Product</label><input id="priceSearchEcho" placeholder="Type a product name..." autocomplete="off"></div>
        </div>
        <div class="price-result">
          <span>SELECTED PRODUCT</span>
          <h2 id="checkedName">Choose a product</h2>
          <div class="price" id="checkedPrice">₱0.00</div>
          <p id="checkedStock">Stock: —</p>
        </div></div>
        <div id="priceMatchList" class="price-match-list"></div>
      </div>
    </div>`;
}

function priceDirectoryRows(mode = "alphabetical") {
  if (!state.products.length) return `<p class="empty price-empty">No products available. Add products first.</p>`;

  const products = [...state.products];
  if (mode === "category") {
    products.sort((a,b) => {
      const categoryCompare = String(a.category || "").localeCompare(String(b.category || ""));
      return categoryCompare || a.name.localeCompare(b.name);
    });

    let currentCategory = null;
    return products.map(p => {
      const category = p.category || "Uncategorized";
      const header = category !== currentCategory
        ? `<div class="price-group-header">${escapeHtml(category)}</div>`
        : "";
      currentCategory = category;
      return header + priceDirectoryItem(p);
    }).join("");
  }

  products.sort((a,b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  let currentLetter = null;
  return products.map(p => {
    const letter = (p.name || "#").trim().charAt(0).toUpperCase() || "#";
    const header = letter !== currentLetter
      ? `<div class="price-group-header">${escapeHtml(letter)}</div>`
      : "";
    currentLetter = letter;
    return header + priceDirectoryItem(p);
  }).join("");
}

function priceDirectoryItem(p) {
  return `<button type="button" class="price-directory-item" data-price-product="${p.id}">
    <span class="price-product-name">${escapeHtml(p.name)}</span>
    <span class="price-product-price">${money(p.price)}</span>
  </button>`;
}

function priceMatchRows(matches) {
  if (!matches.length) return `<p class="empty price-empty">No matching product found.</p>`;
  return matches.map(p => `<button type="button" class="price-match" data-price-product="${p.id}">
    <span>${escapeHtml(p.name)}</span><strong>${money(p.price)}</strong>
  </button>`).join("");
}

/* HISTORY - adapted to wireframe but functionality kept */
function renderTransactions() {
  return `<div class="page-toolbar">
      <div class="toolbar-left"><div><h3>History</h3><p>Sales and inventory movements.</p></div></div>
      <div class="toolbar-right">
        <span class="toolbar-label">Sort:</span>
        <select class="compact-select" id="historySort"><option value="sales">Sales / Profit</option><option value="date">Newest First</option><option value="name">By Product</option></select>
        <input id="transactionSearch" class="compact-input" placeholder="Search">
        <button class="wire-btn" id="selectRangeBtn">Select Range</button>
        <button class="wire-btn" id="printHistoryBtn">Print</button>
      </div>
    </div>
    <div class="wire-table-wrap"><table><thead><tr><th>ID</th><th>Time Stamp</th><th>Order</th><th>Quantity</th><th>Sales</th><th>Status</th><th>Notes</th></tr></thead>
    <tbody id="transactionRows">${transactionRows()}</tbody></table></div>`;
}

function transactionRows(list = state.transactions.slice().reverse()) {
  if (!list.length) return `<tr><td colspan="7" class="table-empty">No transactions recorded yet.</td></tr>`;
  return list.map((t,index) => {
    const hasNotes = !!(t.notes && String(t.notes).trim());
    return `<tr>
    <td>${index + 1}</td><td>${escapeHtml(t.date)}</td><td>${escapeHtml(t.name)}</td><td>${t.qty}</td><td>${money(t.amount)}</td>
    <td><span class="badge ${t.type === "SALE" ? "green" : "orange"}">${escapeHtml(t.type)}</span></td>
    <td><button class="notes-btn ${hasNotes ? "has" : "none"}" data-notes-idx="${state.transactions.indexOf(t)}">${hasNotes ? "Notes" : "Notes Unavailable"}</button></td>
  </tr>`;
  }).join("");
}

function reportMoney(value) {
  return money(value);
}

function getExpiryStats() {
  const now = new Date();
  const soonLimit = new Date(now);
  soonLimit.setDate(soonLimit.getDate() + 7);
  let expired = 0;
  let expiringSoon = 0;

  state.products.forEach(p => {
    if (!p.expiry) return;
    const expiry = new Date(`${p.expiry}T23:59:59`);
    if (Number.isNaN(expiry.getTime())) return;
    if (expiry < now) expired++;
    else if (expiry <= soonLimit) expiringSoon++;
  });
  return { expired, expiringSoon };
}

function inventoryReportData() {
  const tieUp = state.products.reduce((sum, p) => sum + Number(p.cost || 0) * Number(p.stock || 0), 0);
  const retail = state.products.reduce((sum, p) => sum + Number(p.price || 0) * Number(p.stock || 0), 0);
  const units = state.products.reduce((sum, p) => sum + Number(p.stock || 0), 0);
  const expiry = getExpiryStats();
  const products = [...state.products].sort((a, b) =>
    (Number(b.price || 0) * Number(b.stock || 0)) - (Number(a.price || 0) * Number(a.stock || 0))
  );
  return { tieUp, retail, potentialProfit: retail - tieUp, units, expiry, products };
}

function salesReportRows() {
  const sales = state.transactions.filter(t => t.type === "SALE");
  if (!sales.length) return `<tr><td colspan="9" class="table-empty">No sales recorded yet.</td></tr>`;

  return sales.map((t, index) => {
    const qty = Number(t.qty || 0);
    const product = state.products.find(p => p.name === t.name);
    // Sale records keep the amount at the time of sale. For historical profit,
    // use the product cost only when a legacy record does not contain its cost.
    const baseUnit = t.costPerUnit != null ? Number(t.costPerUnit) : Number(product?.cost || 0);
    const srpTotal = Number(t.amount || 0);
    const baseTotal = baseUnit * qty;
    const profit = srpTotal - baseTotal;
    const srpUnit = qty ? srpTotal / qty : 0;
    return `<tr>
      <td>${escapeHtml(t.date || "—")}</td>
      <td>${index + 1}</td>
      <td>${escapeHtml(t.name || "—")}</td>
      <td>${qty}</td>
      <td>${reportMoney(srpUnit)}</td>
      <td>${reportMoney(baseUnit)}</td>
      <td>${reportMoney(srpTotal)}</td>
      <td>${reportMoney(baseTotal)}</td>
      <td>${reportMoney(profit)}</td>
    </tr>`;
  }).join("");
}

function renderInventoryCapitalReport() {
  const d = inventoryReportData();
  return `<div class="report-section report-print-section" id="inventoryCapitalReport">
    <div class="report-section-head">
      <div><h3>Inventory &amp; Capital Report</h3><p>Current inventory value and capital position.</p></div>
      <button class="wire-btn report-print-btn" data-report-print="inventory">Print</button>
    </div>

    <div class="report-paper">
      <div class="report-print-title">INVENTORY &amp; CAPITAL REPORT</div>
      <div class="report-rule">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>

      <div class="report-summary-lines">
        <div><span>💰 STARTING CAPITAL:</span><strong>${reportMoney(state.capital)}</strong></div>
        <div><span>📦 TIE-UP CAPITAL (Base):</span><strong>${reportMoney(d.tieUp)}</strong></div>
        <div><span>🛒 RETAIL VALUE (SRP):</span><strong>${reportMoney(d.retail)}</strong></div>
        <div><span>✨ POTENTIAL PROFIT:</span><strong>${reportMoney(d.potentialProfit)}</strong></div>
      </div>

      <div class="report-inline-stats">
        <span>🧮 TOTAL PRODUCTS: <strong>${state.products.length}</strong></span>
        <span>TOTAL UNITS IN STOCK: <strong>${d.units}</strong></span>
      </div>
      <div class="report-inline-stats">
        <span>🚨 EXPIRED ITEMS: <strong>${d.expiry.expired}</strong></span>
        <span>EXPIRING SOON (7d): <strong>${d.expiry.expiringSoon}</strong></span>
      </div>

      <div class="report-rule">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
      <div class="report-print-subtitle">PER-PRODUCT BREAKDOWN (sorted by SRP value of stock on hand)</div>
      <div class="report-rule thin">────────────────────────────────────────────────────────────────────────────────</div>
      <div class="report-table-wrap">
        <table class="report-table inventory-report-table">
          <thead><tr><th>ID</th><th>NAME</th><th>STOCK</th><th>BASE VAL</th><th>SRP VAL</th></tr></thead>
          <tbody>${d.products.length ? d.products.map((p, i) => `<tr>
            <td>${i + 1}</td><td>${escapeHtml(p.name)}</td><td>${Number(p.stock || 0)}</td>
            <td>${reportMoney(Number(p.cost || 0) * Number(p.stock || 0))}</td>
            <td>${reportMoney(Number(p.price || 0) * Number(p.stock || 0))}</td>
          </tr>`).join("") : `<tr><td colspan="5" class="table-empty">No products available.</td></tr>`}</tbody>
        </table>
      </div>
      <div class="report-rule thin">────────────────────────────────────────────────────────────────────────────────</div>
    </div>
  </div>`;
}

function renderSalesProfitReport() {
  const sales = state.transactions.filter(t => t.type === "SALE");
  const stockIn = state.transactions.filter(t => t.type === "STOCK IN");
  const stockOut = state.transactions.filter(t => t.type === "STOCK OUT");
  const productAdds = state.products.length;
  const productDeletes = state.transactions.filter(t => t.type === "PRODUCT DELETE").length;
  const priceChanges = state.transactions.filter(t => t.type === "PRICE CHANGE").length;
  const stockInCost = stockIn.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalSales = sales.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const cogs = sales.reduce((sum, t) => {
    const qty = Number(t.qty || 0);
    const product = state.products.find(p => p.name === t.name);
    return sum + (t.costPerUnit != null ? Number(t.costPerUnit) : Number(product?.cost || 0)) * qty;
  }, 0);
  const grossProfit = totalSales - cogs;

  return `<div class="report-section report-print-section" id="salesProfitReport">
    <div class="report-section-head">
      <div><h3>Sales, Profit &amp; Transaction Summary</h3><p>Sales history, costs and gross profit.</p></div>
      <button class="wire-btn report-print-btn" data-report-print="sales">Print</button>
    </div>

    <div class="report-paper">
      <div class="report-print-title">SALES, PROFIT &amp; TRANSACTION SUMMARY</div>
      <div class="report-rule">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
      <div class="report-summary-lines">
        <div><span>💰 STARTING CAPITAL:</span><strong>${reportMoney(state.capital)}</strong></div>
        <div><span>📦 TOTAL STOCK-IN COSTS:</span><strong>${reportMoney(stockInCost)}</strong><em>(${stockIn.length} purchase transactions)</em></div>
        <div><span>🛒 TOTAL SALES (REVENUE):</span><strong>${reportMoney(totalSales)}</strong><em>(${sales.length} sale transactions)</em></div>
        <div><span>COST OF GOODS SOLD:</span><strong>${reportMoney(cogs)}</strong></div>
        <div><span>GROSS PROFIT FROM SALES:</span><strong>${reportMoney(grossProfit)}</strong></div>
      </div>

      <div class="report-print-subtitle">── ALL TRANSACTIONS ──</div>
      <div class="transaction-count-grid">
        <span>Stock-IN: <strong>${stockIn.length}</strong></span>
        <span>Stock-OUT: <strong>${stockOut.length}</strong></span>
        <span>SOLD: <strong>${sales.length}</strong></span>
        <span>Products Add: <strong>${productAdds}</strong></span>
        <span>Products Del: <strong>${productDeletes}</strong></span>
        <span>Price Changes: <strong>${priceChanges}</strong></span>
        <span>TOTAL LOGS: <strong>${state.transactions.length}</strong> entries</span>
      </div>

      <div class="report-rule">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
      <div class="report-print-subtitle">DETAILED SALES BREAKDOWN (prices at time of sale — not current)</div>
      <div class="report-rule thin">────────────────────────────────────────────────────────────────────────────────</div>
      <div class="report-table-wrap">
        <table class="report-table sales-report-table">
          <thead><tr><th>DATE/TIME</th><th>ID</th><th>ITEM</th><th>QTY</th><th>SRP/UNT</th><th>BASE/UNT</th><th>SRP TOT</th><th>BASE TOT</th><th>PROFIT</th></tr></thead>
          <tbody>${salesReportRows()}</tbody>
          <tfoot><tr><td colspan="6">RUNNING TOTALS:</td><td>${reportMoney(totalSales)}</td><td>${reportMoney(cogs)}</td><td>${reportMoney(grossProfit)}</td></tr></tfoot>
        </table>
      </div>
      <div class="report-rule">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
    </div>
  </div>`;
}

function renderReports() {
  return `<div class="page-head"><div><h3>Reports</h3><p>Inventory, capital, sales and profit reports.</p></div></div>
    <div class="report-tabs">
      <button class="report-tab active" data-report-tab="inventory">Inventory &amp; Capital</button>
      <button class="report-tab" data-report-tab="sales">Sales &amp; Profit</button>
    </div>
    <div id="reportTabContent">${renderInventoryCapitalReport()}</div>`;
}

function renderSellTab() {
  return `<div class="panel"><div class="panel-title">□ &nbsp; Pick Items to Sell</div><div class="panel-body"><div class="product-grid">${state.products.filter(p => p.stock > 0).map(productMini).join("") || `<p class="empty">No products are currently in stock.</p>`}</div></div></div>`;
}

function renderCheckoutTab() {
  const total = state.cart.reduce((sum,i) => sum + i.price * i.qty, 0);
  return `<div class="cart-layout"><div class="panel"><div class="panel-title">□ &nbsp; Cart Items</div><div class="panel-body">
    ${state.cart.length ? state.cart.map(i => `
      <div class="cart-row cart-item">
        <div class="cart-item-info">
          <strong>${escapeHtml(i.name)}</strong>
          <span class="cart-unit">${money(i.price)} each</span>
          <div class="cart-qty-controls">
            <button class="qty-btn" data-cart-remove-step="${i.id}">−</button>
            <input type="number" class="qty-input small" value="${i.qty}" min="1" data-cart-qty data-cart-id="${i.id}">
            <button class="qty-btn" data-cart-add-step="${i.id}">+</button>
          </div>
        </div>
        <div class="cart-item-right">
          <strong>${money(i.price*i.qty)}</strong>
          <button class="remove-btn" data-cart-remove="${i.id}">Remove</button>
        </div>
      </div>`).join("") : `<p class="empty">Your cart is empty.</p>`}
  </div></div><div class="checkout-box"><h3>Checkout Summary</h3><div class="cart-row"><span>Items</span><strong>${cartCount()}</strong></div><div class="checkout-total"><span>Total</span><span>${money(total)}</span></div><button class="primary-btn" id="checkoutBtn" ${state.cart.length ? "" : "disabled"}>Proceed to Payment</button></div></div>`;
}

function bindPageEvents(page) {
  pageContent.querySelectorAll("[data-go]").forEach(btn => btn.addEventListener("click", () => renderPage(btn.dataset.go)));
  pageContent.querySelectorAll("[data-add]").forEach(btn => btn.addEventListener("click", () => addToCart(Number(btn.dataset.add))));

  if (page === "dashboard") {
    const updateDashboard = () => {
      const q = (document.getElementById("dashboardSearch")?.value || "").toLowerCase();
      const mode = document.getElementById("dashboardSort")?.value || "selling";
      let list = state.products.filter(p => `${p.name} ${p.category}`.toLowerCase().includes(q));
      document.getElementById("dashboardRows").innerHTML = dashboardRows(sortProducts(list, mode));
    };
    document.getElementById("dashboardSearch").addEventListener("input", updateDashboard);
    document.getElementById("dashboardSort").addEventListener("change", updateDashboard);

    pageContent.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        pageContent.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeDashTab = btn.dataset.tab;
        renderActiveTab();
      });
    });

    /* Bind actions for whatever tab is shown on first render */
    renderActiveTab();
  }

  if (page === "products") {
    const updateProducts = () => {
      document.getElementById("productRows").innerHTML = productRows(sortProducts(state.products, document.getElementById("productSort").value));
    };
    document.getElementById("productSort").addEventListener("change", updateProducts);
    document.getElementById("removeProductBtn").addEventListener("click", openRemoveProductModal);
  }

  if (page === "stocks") {
    document.getElementById("stockSort").addEventListener("change", e => {
      document.getElementById("stockRows").innerHTML = stockRows(sortProducts(state.products, e.target.value));
    });
    document.getElementById("pageContent").addEventListener("click", e => {
      const btn = e.target.closest("[data-expiry-product]");
      if (btn) openExpirationModal(btn.dataset.expiryProduct);
    });
  }

  if (page === "add-product") {
    const hasExpiry = document.getElementById("hasExpiry");
    const expiryWrap = document.getElementById("expiryWrap");
    const expiryInput = expiryWrap.querySelector("input[name='expiry']");
    const syncExpiry = () => {
      const on = hasExpiry.value === "yes";
      expiryWrap.style.display = on ? "" : "none";
      expiryInput.required = on;
      if (!on) expiryInput.value = "";
    };
    hasExpiry.addEventListener("change", syncExpiry);
    syncExpiry();

    document.getElementById("addProductForm").addEventListener("submit", e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const initialStock = Math.max(0, Number(f.get("stock")));
      const newProduct = {
        id: Date.now(), name: f.get("name"), category: f.get("category"), price: Number(f.get("price")),
        cost: Number(f.get("cost")), stock: initialStock, stockBaseline: initialStock,
        expiry: f.get("hasExpiry") === "yes" ? f.get("expiry") : "", expiryBatches: f.get("hasExpiry") === "yes" && f.get("expiry") ? [{ expiry: f.get("expiry"), qty: initialStock, addedAt: new Date().toISOString() }] : [], sold: 0
      };
      state.products.push(newProduct);
      state.transactions.push({
        date: new Date().toLocaleString(), type: "PRODUCT ADD", name: newProduct.name,
        qty: newProduct.stock, amount: Number(newProduct.cost || 0) * Number(newProduct.stock || 0), notes: "Product added to inventory."
      });
      persist(); updateStats(); toast("Product added successfully."); renderPage("products");
    });
  }

  if (page === "stock-in" || page === "stock-out") {
    if (page === "stock-in") {
      const hasExpiry = document.getElementById("hasExpiry");
      const expiryWrap = document.getElementById("expiryWrap");
      const expiryInput = expiryWrap.querySelector("input[name='expiry']");
      const syncExpiry = () => {
        const on = hasExpiry.value === "yes";
        expiryWrap.style.display = on ? "" : "none";
        expiryInput.required = on;
        if (!on) expiryInput.value = "";
      };
      hasExpiry.addEventListener("change", syncExpiry);
      syncExpiry();
    }

    document.getElementById("stockForm").addEventListener("submit", e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const product = state.products.find(p => p.id === Number(f.get("product")));
      const qty = Number(f.get("qty"));
      if (!product) return toast("Please add a product first.");
      if (page === "stock-in") {
        product.stock += qty;
        /* Replenishment creates a new 10% baseline from the resulting stock. */
        product.stockBaseline = product.stock;
        ensureExpiryBatches(product);
        if (f.get("hasExpiry") === "yes" && f.get("expiry")) {
          const expiry = f.get("expiry");
          const same = product.expiryBatches.find(b => b.expiry === expiry);
          if (same) same.qty = Number(same.qty || 0) + qty;
          else product.expiryBatches.push({ expiry, qty, addedAt: new Date().toISOString() });
          product.expiry = expiry;
        }
      } else {
        /* Stock Out follows the same expiry-batch rules as a sale. */
        consumeExpiryBatches(product, qty);
        product.stock = Math.max(0, product.stock - qty);
      }
      const notes = (f.get("notes") || "").trim();
      state.transactions.push({date:new Date().toLocaleString(), type:page === "stock-in" ? "STOCK IN" : "STOCK OUT", name:product.name, qty, amount: page === "stock-in" ? Number(product.cost || 0) * qty : 0, costPerUnit: Number(product.cost || 0), notes});
      persist(); updateStats(); toast(`Stock ${page === "stock-in" ? "in" : "out"} recorded.`); renderPage(page);
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

    const selectProduct = id => {
      const p = state.products.find(x => x.id === Number(id));
      if (!p) return;
      name.textContent = p.name;
      price.textContent = money(p.price);
      stock.textContent = `Stock: ${p.stock} units`;
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
        .sort((a,b) => a.name.localeCompare(b.name));

      if (matches.length) selectProduct(matches[0].id);
      else {
        name.textContent = "No product found";
        price.textContent = "₱0.00";
        stock.textContent = "Stock: —";
      }
      matchList.innerHTML = priceMatchRows(matches);
      matchList.querySelectorAll("[data-price-product]").forEach(btn => {
        btn.addEventListener("click", () => selectProduct(btn.dataset.priceProduct));
      });
    };

    const refreshDirectory = () => {
      directory.innerHTML = priceDirectoryRows(sort.value);
      directory.querySelectorAll("[data-price-product]").forEach(btn => {
        btn.addEventListener("click", () => {
          input.value = state.products.find(p => p.id === Number(btn.dataset.priceProduct))?.name || "";
          showSearch();
        });
      });
    };

    input.addEventListener("input", showSearch);
    sort.addEventListener("change", refreshDirectory);

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
      const q = document.getElementById("transactionSearch").value.toLowerCase();
      let list = state.transactions.filter(t => `${t.name} ${t.type} ${t.date}`.toLowerCase().includes(q));
      const mode = document.getElementById("historySort").value;
      if (mode === "name") list.sort((a,b) => a.name.localeCompare(b.name));
      if (mode === "sales") list.sort((a,b) => Number(b.amount) - Number(a.amount));
      if (mode === "date") list.reverse();
      document.getElementById("transactionRows").innerHTML = transactionRows(list);
      bindNotes();
    };
    document.getElementById("transactionSearch").addEventListener("input", updateHistory);
    document.getElementById("historySort").addEventListener("change", updateHistory);
    document.getElementById("selectRangeBtn").addEventListener("click", () => toast("Date range selector can be connected here."));
    document.getElementById("printHistoryBtn").addEventListener("click", () => window.print());
    bindNotes();
  }
  if (page === "reports") {
    const content = document.getElementById("reportTabContent");
    document.querySelectorAll("[data-report-tab]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-report-tab]").forEach(b => b.classList.toggle("active", b === btn));
        content.innerHTML = btn.dataset.reportTab === "sales" ? renderSalesProfitReport() : renderInventoryCapitalReport();
        bindReportPrint();
      });
    });
    const bindReportPrint = () => {
      document.querySelectorAll("[data-report-print]").forEach(btn => {
        btn.addEventListener("click", () => {
          document.body.dataset.printReport = btn.dataset.reportPrint;
          window.print();
          setTimeout(() => delete document.body.dataset.printReport, 0);
        });
      });
    };
    bindReportPrint();
  }

}

/* Re-render the currently visible dashboard tab and rebind its actions */
function renderActiveTab() {
  const target = document.getElementById("dashboardTab");
  if (!target) return;
  target.innerHTML = dashTabHtml(activeDashTab);
  bindTabActions(target);
  updateCartPill();
}

function updateCartPill() {
  const pill = document.getElementById("cartPill");
  if (pill) pill.textContent = cartCount();
}

function bindTabActions(target) {
  target.querySelectorAll("[data-add]").forEach(b => b.addEventListener("click", () => addToCart(Number(b.dataset.add))));
  target.querySelectorAll("[data-cart-qty]").forEach(inp => inp.addEventListener("change", () => updateCartQty(Number(inp.dataset.cartId), Number(inp.value))));
  target.querySelectorAll("[data-cart-add-step]").forEach(b => b.addEventListener("click", () => stepCartQty(Number(b.dataset.cartAddStep), 1)));
  target.querySelectorAll("[data-cart-remove-step]").forEach(b => b.addEventListener("click", () => stepCartQty(Number(b.dataset.cartRemoveStep), -1)));
  target.querySelectorAll("[data-cart-remove]").forEach(b => b.addEventListener("click", () => removeFromCart(Number(b.dataset.cartRemove))));
  const checkout = target.querySelector("#checkoutBtn");
  if (checkout) checkout.addEventListener("click", openCheckoutModal);
}

function addToCart(id) {
  const p = state.products.find(x => x.id === id);
  if (!p) return;
  const inCart = state.cart.find(c => c.id === id)?.qty || 0;
  const available = p.stock - inCart;
  if (available <= 0) return toast("This product is out of stock.");

  const input = document.querySelector(`[data-qty="${id}"]`);
  let qty = input ? Math.max(1, Math.floor(Number(input.value) || 1)) : 1;
  if (qty > available) {
    qty = available;
    toast(`Only ${available} in stock — added ${available}.`);
  }

  const existing = state.cart.find(x => x.id === id);
  if (existing) existing.qty += qty;
  else state.cart.push({ id: p.id, name: p.name, price: Number(p.price), cost: Number(p.cost), qty });

  persist();
  if (qty <= available) toast(`${qty} × ${p.name} added to cart.`);
  renderActiveTab();
}

function updateCartQty(id, qty) {
  const item = state.cart.find(c => c.id === id);
  const p = state.products.find(x => x.id === id);
  if (!item || !p) return;
  qty = Math.max(1, Math.floor(Number(qty) || 1));
  if (qty > p.stock) { qty = p.stock; toast(`Only ${p.stock} in stock.`); }
  item.qty = qty;
  persist();
  renderActiveTab();
}

function stepCartQty(id, delta) {
  const item = state.cart.find(c => c.id === id);
  const p = state.products.find(x => x.id === id);
  if (!item || !p) return;
  const next = item.qty + delta;
  if (next <= 0) return removeFromCart(id);
  if (next > p.stock) return toast(`Only ${p.stock} in stock.`);
  item.qty = next;
  persist();
  renderActiveTab();
}

function removeFromCart(id) {
  state.cart = state.cart.filter(c => c.id !== id);
  persist();
  renderActiveTab();
}

/* PAYMENT METHODS */
const PAYMENT_METHODS = [
  { value: "Cash", online: false },
  { value: "GCash", online: true },
  { value: "Maya", online: true },
  { value: "Gotyme", online: true },
  { value: "Bank Transfer", online: true }
];

function openCheckoutModal() {
  if (!state.cart.length) return;
  closeCheckoutModal();

  const total = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "checkoutModal";
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-head">
        <h3>Payment &amp; Checkout</h3>
        <button class="modal-close" id="closeCheckout" type="button">×</button>
      </div>
      <div class="modal-body">
        <div class="receipt">
          <div class="receipt-head">
            <strong>Managing Sentry</strong>
            <span>Sales Receipt</span>
          </div>
          <div class="receipt-items">
            ${state.cart.map(i => `
              <div class="receipt-item">
                <span>${escapeHtml(i.name)} × ${i.qty}</span>
                <span>${money(i.price * i.qty)}</span>
              </div>`).join("")}
          </div>
          <div class="receipt-grand">
            <span>Total Amount</span><strong id="receiptTotal">${money(total)}</strong>
          </div>
        </div>

        <div class="field-label">Payment Method</div>
        <div class="payment-options">
          ${PAYMENT_METHODS.map((m, idx) => `
            <label class="pay-opt">
              <input type="radio" name="payMethod" value="${m.value}" data-online="${m.online}" ${idx === 0 ? "checked" : ""}>
              <span>${m.value}</span>
            </label>`).join("")}
        </div>

        <div class="pay-grid">
          <div class="form-group">
            <label>Amount Received</label>
            <input id="amountReceived" type="number" min="0" step="0.01" value="${total.toFixed(2)}">
          </div>
          <div class="form-group">
            <label>Change</label>
            <div class="change-box" id="changeAmount">${money(0)}</div>
          </div>
        </div>

        <div class="form-group" id="refWrap" style="display:none">
          <label>Reference Number</label>
          <input id="refNumber" type="text" placeholder="Enter payment reference number">
        </div>

        <div class="form-group">
          <label>Notes (optional)</label>
          <textarea id="saleNotes" placeholder="Add a note for this sale"></textarea>
        </div>
      </div>
      <div class="modal-foot">
        <button class="ghost-btn" id="cancelCheckout" type="button">Cancel</button>
        <button class="primary-btn" id="confirmCheckout" type="button">Confirm &amp; Complete Sale</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const receivedInput = document.getElementById("amountReceived");
  const changeBox = document.getElementById("changeAmount");
  const refWrap = document.getElementById("refWrap");

  const refreshChange = () => {
    const received = Number(receivedInput.value) || 0;
    const change = Math.max(0, received - total);
    changeBox.textContent = money(change);
    changeBox.classList.toggle("due", received < total);
    if (received < total) changeBox.textContent = money(total - received) + " due";
  };

  const selectedMethod = () => overlay.querySelector('input[name="payMethod"]:checked');

  const refreshMethod = () => {
    const m = selectedMethod();
    const online = m && m.dataset.online === "true";
    refWrap.style.display = online ? "" : "none";
  };

  overlay.querySelectorAll('input[name="payMethod"]').forEach(r => r.addEventListener("change", refreshMethod));
  receivedInput.addEventListener("input", refreshChange);
  refreshMethod();
  refreshChange();

  document.getElementById("closeCheckout").addEventListener("click", closeCheckoutModal);
  document.getElementById("cancelCheckout").addEventListener("click", closeCheckoutModal);
  overlay.addEventListener("click", e => { if (e.target === overlay) closeCheckoutModal(); });
  document.getElementById("confirmCheckout").addEventListener("click", () => {
    const m = selectedMethod();
    const method = m ? m.value : "Cash";
    const online = m && m.dataset.online === "true";
    const received = Number(receivedInput.value) || 0;
    const ref = document.getElementById("refNumber").value.trim();
    const notes = document.getElementById("saleNotes").value.trim();

    if (online && !ref) return toast("Please enter the payment reference number.");
    if (!online && received < total) return toast("Amount received is less than the total.");

    finalizeSale({ method, online, received, ref, notes, total });
  });
}

function closeCheckoutModal() {
  const existing = document.getElementById("checkoutModal");
  if (existing) existing.remove();
}

function finalizeSale({ method, online, received, ref, notes, total }) {
  const profit = state.cart.reduce((s, i) => s + (i.price - i.cost) * i.qty, 0);
  const change = Math.max(0, received - total);
  const date = new Date().toLocaleString();
  const saleItems = state.cart.map(i => ({ ...i }));

  state.cart.forEach(i => {
    const p = state.products.find(x => x.id === i.id);
    if (!p) return;
    /* A completed sale removes units from the earliest expiry batch first.
       When a batch reaches zero, it is removed and the next expiry becomes
       the active one in the Stocks expiration button/modal. */
    consumeExpiryBatches(p, i.qty);
    p.stock = Math.max(0, p.stock - i.qty);
    p.sold = Number(p.sold || 0) + i.qty;
    state.transactions.push({ date, type: "SALE", name: i.name, qty: i.qty, amount: i.price * i.qty, costPerUnit: i.cost, method, ref: online ? ref : "", notes });
  });

  state.salesToday += total;
  state.totalSales += total;
  state.profit += profit;
  state.cart = [];
  persist();
  updateStats();

  closeCheckoutModal();
  activeDashTab = "sell";
  renderPage("dashboard");
  toast("Sale completed successfully.");

  askYesNo("Sale completed! Do you want to print the receipt?", { title: "Print Receipt", yesText: "Yes", noText: "No" })
    .then(yes => {
      if (yes) printReceipt({ items: saleItems, total, method, ref: online ? ref : "", received, change, notes, date });
    });
}

/* Product removal dialog: choose a product instead of typing its name. */
function openRemoveProductModal() {
  const existing = document.getElementById("removeProductModal");
  if (existing) existing.remove();

  if (!state.products.length) {
    toast("There are no products to remove.");
    return;
  }

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "removeProductModal";
  overlay.innerHTML = `
    <div class="modal remove-product-modal">
      <div class="modal-head">
        <div>
          <h3>Remove Product</h3>
          <p class="modal-caption">Choose a product to remove from your inventory.</p>
        </div>
        <button class="modal-close" id="closeRemoveProduct" type="button">×</button>
      </div>
      <div class="modal-body">
        <div class="remove-search-wrap">
          <span>⌕</span>
          <input id="removeProductSearch" type="search" placeholder="Search products..." autocomplete="off">
        </div>
        <div class="remove-product-list" id="removeProductList">
          ${removeProductOptions()}
        </div>
      </div>
      <div class="modal-foot remove-modal-foot">
        <button class="ghost-btn" id="cancelRemoveProduct" type="button">Cancel</button>
        <button class="primary-btn" id="confirmRemoveProduct" type="button" disabled>Remove Product</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  let selectedId = null;
  const search = document.getElementById("removeProductSearch");
  const list = document.getElementById("removeProductList");
  const confirmBtn = document.getElementById("confirmRemoveProduct");

  const renderOptions = () => {
    const query = search.value.trim().toLowerCase();
    const filtered = state.products
      .filter(p => `${p.name} ${p.category}`.toLowerCase().includes(query))
      .sort((a,b) => a.name.localeCompare(b.name));
    list.innerHTML = filtered.length
      ? removeProductOptions(filtered, selectedId)
      : `<div class="remove-empty">No matching products found.</div>`;

    list.querySelectorAll(".remove-product-option").forEach(btn => {
      btn.addEventListener("click", () => {
        selectedId = Number(btn.dataset.id);
        list.querySelectorAll(".remove-product-option").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        confirmBtn.disabled = false;
      });
    });
  };

  search.addEventListener("input", renderOptions);
  document.getElementById("closeRemoveProduct").addEventListener("click", () => overlay.remove());
  document.getElementById("cancelRemoveProduct").addEventListener("click", () => overlay.remove());
  confirmBtn.addEventListener("click", async () => {
    if (selectedId === null) return;
    const index = state.products.findIndex(p => p.id === selectedId);
    if (index === -1) return;
    const product = state.products[index];
    const confirmed = await askYesNo(`Remove "${product.name}" from your inventory?`, {
      title: "Confirm Removal",
      yesText: "Remove",
      noText: "Cancel"
    });
    if (!confirmed) return;
    state.products.splice(index, 1);
    state.transactions.push({
      date: new Date().toLocaleString(), type: "PRODUCT DELETE", name: product.name,
      qty: product.stock, amount: Number(product.cost || 0) * Number(product.stock || 0), notes: "Product removed from inventory."
    });
    persist();
    overlay.remove();
    updateStats();
    renderPage("products");
    toast(`${product.name} removed.`);
  });

  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
  renderOptions();
  search.focus();
}

function removeProductOptions(products = state.products, selectedId = null) {
  return products
    .slice()
    .sort((a,b) => a.name.localeCompare(b.name))
    .map(p => `
      <button type="button" class="remove-product-option ${Number(p.id) === Number(selectedId) ? "selected" : ""}" data-id="${p.id}">
        <span class="remove-product-main">
          <strong>${escapeHtml(p.name)}</strong>
          <small>${escapeHtml(p.category || "Uncategorized")} • ${p.stock} in stock</small>
        </span>
        <span class="remove-product-price">${money(p.price)}</span>
      </button>`).join("");
}

/* Custom Yes / No dialog (replaces confirm's OK / Cancel) */
function askYesNo(message, { yesText = "Yes", noText = "No", title = "Confirm" } = {}) {
  return new Promise(resolve => {
    const existing = document.getElementById("yesNoModal");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.id = "yesNoModal";
    overlay.innerHTML = `
      <div class="modal modal-sm">
        <div class="modal-head"><h3>${escapeHtml(title)}</h3></div>
        <div class="modal-body"><p class="yn-msg">${escapeHtml(message)}</p></div>
        <div class="modal-foot">
          <button class="ghost-btn" id="ynNo" type="button">${escapeHtml(noText)}</button>
          <button class="primary-btn" id="ynYes" type="button">${escapeHtml(yesText)}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const done = val => { overlay.remove(); resolve(val); };
    document.getElementById("ynYes").addEventListener("click", () => done(true));
    document.getElementById("ynNo").addEventListener("click", () => done(false));
    overlay.addEventListener("click", e => { if (e.target === overlay) done(false); });
  });
}

/* Styled information dialog (replaces native alert) */
function showInfoModal(title, subtitle, message, positive) {
  const existing = document.getElementById("infoModal");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "infoModal";
  overlay.innerHTML = `
    <div class="modal modal-sm">
      <div class="modal-head">
        <h3>${escapeHtml(title)}</h3>
        <button class="modal-close" id="infoClose" type="button">×</button>
      </div>
      <div class="modal-body">
        ${subtitle ? `<p class="info-sub">${escapeHtml(subtitle)}</p>` : ""}
        <p class="yn-msg info-msg ${positive ? "pos" : "neg"}">${escapeHtml(message)}</p>
      </div>
      <div class="modal-foot"><button class="primary-btn" id="infoOk" type="button">Close</button></div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  document.getElementById("infoClose").addEventListener("click", close);
  document.getElementById("infoOk").addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
}

function printReceipt(data) {
  const area = document.getElementById("printArea");
  if (!area) return;
  area.innerHTML = `
    <div class="receipt-print">
      <h2>Managing Sentry</h2>
      <p class="rp-sub">Super Admin • POS</p>
      <div class="rp-line"></div>
      <p>Date: ${escapeHtml(data.date)}</p>
      <p>Payment: ${escapeHtml(data.method)}${data.ref ? ` (Ref: ${escapeHtml(data.ref)})` : ""}</p>
      <div class="rp-line"></div>
      ${data.items.map(i => `<div class="rp-row"><span>${escapeHtml(i.name)} × ${i.qty}</span><span>${money(i.price * i.qty)}</span></div>`).join("")}
      <div class="rp-line"></div>
      <div class="rp-row rp-total"><span>TOTAL</span><span>${money(data.total)}</span></div>
      <div class="rp-row"><span>Amount Received</span><span>${money(data.received)}</span></div>
      <div class="rp-row"><span>Change</span><span>${money(data.change)}</span></div>
      ${data.notes ? `<div class="rp-line"></div><p class="rp-notes">Notes: ${escapeHtml(data.notes)}</p>` : ""}
      <div class="rp-line"></div>
      <p class="rp-thanks">Thank you for your purchase!</p>
    </div>`;
  document.body.classList.add("printing-receipt");
  window.print();
  document.body.classList.remove("printing-receipt");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[ch]));
}

function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2400);
}

/* Backward-compatible migration for products created before stockBaseline existed. */
state.products.forEach(p => { ensureStockBaseline(p); ensureExpiryBatches(p); const earliest = earliestExpiry(p); p.expiry = earliest ? earliest.expiry : (p.expiry || ""); });
persist();
updateStats();
