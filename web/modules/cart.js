/* ============================================================
 * cart.js — Cart state management and the Sell tab HTML renderer.
 * Handles adding, removing, and quantity-stepping cart items, and
 * the sell-tab grid of available products.
 * ============================================================ */

import { state, persist } from "./state.js";
import { money, escapeHtml, toast } from "./utils.js";
import { askYesNo } from "./modals/dialogs.js";

// ---------------------------------------------------------------------------
// Cart helpers
// ---------------------------------------------------------------------------

export function cartTotal() {
  return state.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

export function cartCount() {
  return state.cart.reduce((s, i) => s + i.qty, 0);
}

export function addToCart(id) {
  const p = state.products.find(x => x.id === id);
  if (!p) return;
  const inCart    = state.cart.find(c => c.id === id)?.qty || 0;
  const available = p.stock - inCart;
  if (available <= 0) return toast("This product is out of stock.");

  const existing = state.cart.find(x => x.id === id);
  if (existing) existing.qty += 1;
  else state.cart.push({ id: p.id, name: p.name, price: Number(p.price), cost: Number(p.cost), qty: 1 });

  persist();
  toast(`Added ${p.name} to cart.`);
  renderActiveTab();
}

export function updateCartQty(id, qty) {
  const item = state.cart.find(c => c.id === id);
  const p    = state.products.find(x => x.id === id);
  if (!item || !p) return;
  qty = Math.max(1, Math.floor(Number(qty) || 1));
  if (qty > p.stock) { qty = p.stock; toast(`Only ${p.stock} in stock.`); }
  item.qty = qty;
  persist();
  renderActiveTab();
}

export function stepCartQty(id, delta) {
  const item = state.cart.find(c => c.id === id);
  const p    = state.products.find(x => x.id === id);
  if (!item || !p) return;
  const next = item.qty + delta;
  if (next <= 0) return removeFromCart(id);
  if (next > p.stock) return toast(`Only ${p.stock} in stock.`);
  item.qty = next;
  persist();
  renderActiveTab();
}

export function removeFromCart(id) {
  state.cart = state.cart.filter(c => c.id !== id);
  persist();
  renderActiveTab();
}

export async function clearSellCart() {
  if (!state.cart.length) return;
  const confirmed = await askYesNo("Are you sure you want to remove all items from the cart?", {
    title: "Clean Cart",
    yesText: "Clean Cart",
    noText: "Cancel"
  });
  if (!confirmed) return;
  state.cart = [];
  persist();
  renderActiveTab();
  toast("Cart cleared.");
}

// ---------------------------------------------------------------------------
// Sell tab renderers
// ---------------------------------------------------------------------------

export function renderSellTab() {
  const availableCount = state.products.filter(p => p.stock > 0).length;
  return `<div class="sell-workspace">
    <section class="panel sell-panel">
      <div class="sell-panel-header">
        <div class="sell-panel-title-group">
          <div class="sell-header-icon-badge">
            <img class="panel-icon" src="src/icon/dark/cart.svg" alt="">
          </div>
          <div>
            <div class="sell-panel-heading">Pick Items to Sell</div>
            <div class="sell-panel-subheading">Select products to add to current transaction</div>
          </div>
        </div>
        <div class="sell-badge-pill" id="sellItemsCount">${availableCount} Products Available</div>
      </div>
      <div class="sell-toolbar">
        <div class="toolbar-left">
          <div class="toolbar-sort-wrap">
            <span class="toolbar-label"><img class="inline-icon" src="src/icon/dark/sort-filter.svg" alt=""> Sort:</span>
            <select class="compact-select styled-select-native" id="sellSort" aria-label="Sort sell products">
              <option value="name">Sort by name</option>
              <option value="price">Sort by price</option>
              <option value="stock">Sort by quantity</option>
            </select>
          </div>
        </div>
        <div class="toolbar-right">
          <div class="sell-search-wrap">
            <input class="compact-input sell-search-input" id="sellSearch" type="search" placeholder="Search products…">
          </div>
        </div>
      </div>
      <div class="sell-table-scroll">
        <table class="sell-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>SRP</th>
              <th style="text-align:center">Qty</th>
              <th style="text-align:right">Action</th>
            </tr>
          </thead>
          <tbody id="sellProductRows">${sellProductRows()}</tbody>
        </table>
      </div>
    </section>
    <section class="panel sell-cart-panel">
      <div class="sell-cart-header">
        <div class="sell-cart-title-group">
          <div class="sell-header-icon-badge">
            <img class="panel-icon" src="src/icon/dark/cart.svg" alt="">
          </div>
          <div>
            <div class="sell-cart-heading">Current Cart</div>
            <div class="sell-cart-subheading">Review items before checkout</div>
          </div>
        </div>
        <span class="cart-pill" id="cartPill">${cartCount()}</span>
      </div>
      <div class="sell-cart-scroll">
        <table class="sell-cart-table">
          <thead>
            <tr>
              <th>Name</th>
              <th style="text-align:center">Qty</th>
              <th style="text-align:right">Total</th>
            </tr>
          </thead>
          <tbody id="sellCartRows">${sellCartRows()}</tbody>
        </table>
      </div>
      <div class="sell-summary">
        <div class="sell-summary-left">
          <span class="sell-summary-label">Total :</span>
          <strong class="sell-total-amount">${money(cartTotal())}</strong>
          <span class="sell-summary-items-count" id="sellCartItemCount">${cartCount()} items</span>
        </div>
        <div class="sell-summary-actions">
          <button class="sell-checkout-btn" id="sellCheckoutBtn" ${state.cart.length ? "" : "disabled"}><img class="btn-icon" src="src/icon/white/cart.svg" alt=""> Checkout</button>
          <button class="sell-clear-btn" id="clearCartBtn" ${state.cart.length ? "" : "disabled"}><img class="btn-icon" src="src/icon/white/reset.svg" alt=""> Clean Cart</button>
        </div>
      </div>
    </section>
  </div>`;
}

export function sellProductRows(products = state.products.filter(p => p.stock > 0)) {
  if (!products.length) {
    return `<tr><td colspan="4" class="table-empty">No products found.</td></tr>`;
  }
  return products.map(p => {
    const inCart    = state.cart.find(i => i.id === p.id)?.qty || 0;
    const available = Math.max(0, p.stock - inCart);
    return `<tr>
      <td title="${escapeHtml(p.name)}">
        <div class="sell-prod-cell">
          <span class="sell-prod-name">${escapeHtml(p.name)}</span>
          ${p.category ? `<span class="sell-prod-cat">${escapeHtml(p.category)}</span>` : ""}
        </div>
      </td>
      <td><span class="sell-prod-srp">${money(p.price)}</span></td>
      <td style="text-align:center">
        ${available <= 5 && available > 0
          ? `<span class="sell-stock-tag low" title="Low stock: ${available} left">${available} left</span>`
          : available > 5
          ? `<span class="sell-stock-tag normal">${available}</span>`
          : `<span class="sell-stock-tag out">0 left</span>`
        }
      </td>
      <td style="text-align:right">
        <button class="sell-add-btn" type="button" data-add="${p.id}" ${available ? "" : "disabled"}>
          ${available ? `<img class="btn-sm-icon" src="src/icon/white/add.svg" alt=""> Add` : "Out"}
        </button>
      </td>
    </tr>`;
  }).join("");
}

export function sellCartRows() {
  if (!state.cart.length) {
    return `<tr>
      <td class="sell-cart-empty-cell" colspan="3">
        <div class="sell-cart-empty-state">
          <div class="sell-empty-icon-wrap">
            <img src="src/icon/dark/cart.svg" alt="">
          </div>
          <div class="sell-empty-title">Your cart is empty</div>
          <div class="sell-empty-text">Click &ldquo;+ Add&rdquo; on any item from the catalog to begin checkout.</div>
        </div>
      </td>
    </tr>`;
  }
  return state.cart.map(item => `<tr>
    <td title="${escapeHtml(item.name)}">
      <div class="sell-cart-item-info">
        <span class="sell-cart-item-name">${escapeHtml(item.name)}</span>
        <span class="sell-cart-item-unit">${money(item.price)} each</span>
      </div>
    </td>
    <td style="text-align:center">
      <div class="sell-cart-qty">
        <button class="qty-btn" data-cart-remove-step="${item.id}" aria-label="Decrease ${escapeHtml(item.name)} quantity"><img class="btn-sm-icon" src="src/icon/dark/minus.svg" alt="−"></button>
        <input class="sell-qty-input" type="number" min="1" value="${item.qty}" data-cart-qty data-cart-id="${item.id}" aria-label="${escapeHtml(item.name)} quantity">
        <button class="qty-btn" data-cart-add-step="${item.id}" aria-label="Increase ${escapeHtml(item.name)} quantity"><img class="btn-sm-icon" src="src/icon/dark/add.svg" alt="+"></button>
      </div>
    </td>
    <td style="text-align:right">
      <span class="sell-cart-line-total">${money(item.price * item.qty)}</span>
    </td>
  </tr>`).join("");
}

// ---------------------------------------------------------------------------
// Active tab orchestrator (called whenever cart changes)
// ---------------------------------------------------------------------------

let _renderActiveTab;
export function registerRenderActiveTab(fn) { _renderActiveTab = fn; }
function renderActiveTab() { if (_renderActiveTab) _renderActiveTab(); }
