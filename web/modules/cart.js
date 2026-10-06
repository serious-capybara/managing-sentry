/* ============================================================
 * cart.js — Cart state management and the Sell tab HTML renderer.
 * Handles adding, removing, and quantity-stepping cart items, and
 * the sell-tab grid of available products.
 * ============================================================ */

import { state, persist } from "./state.js";
import { money, escapeHtml, toast } from "./utils.js";

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

export function clearSellCart() {
  if (!state.cart.length) return;
  if (!confirm("Remove all items from the cart?")) return;
  state.cart = [];
  persist();
  renderActiveTab();
  toast("Cart cleared.");
}

// ---------------------------------------------------------------------------
// Sell tab renderers
// ---------------------------------------------------------------------------

export function renderSellTab() {
  return `<div class="sell-workspace">
    <section class="panel sell-panel">
      <div class="panel-title"><img class="panel-icon" src="src/icon/cart.svg" alt=""> Pick Items to Sell</div>
      <div class="sell-toolbar">
        <label class="sr-only" for="sellSort">Sort products</label>
        <select class="compact-select" id="sellSort">
          <option value="name">Sort by name</option>
          <option value="price">Sort by price</option>
          <option value="stock">Sort by quantity</option>
        </select>
        <label class="sr-only" for="sellSearch">Search products</label>
        <input class="compact-input" id="sellSearch" type="search" placeholder="Search products…">
      </div>
      <div class="sell-table-scroll">
        <table class="sell-table">
          <thead><tr><th>Name</th><th>SRP</th><th>Qty</th><th>Action</th></tr></thead>
          <tbody id="sellProductRows">${sellProductRows()}</tbody>
        </table>
      </div>
    </section>
    <section class="panel sell-cart-panel">
      <div class="panel-title"><img class="panel-icon" src="src/icon/cart.svg" alt=""> Cart</div>
      <div class="sell-cart-scroll">
        <table class="sell-cart-table">
          <thead><tr><th>Name</th><th>Qty</th><th>Total</th><th>Action</th></tr></thead>
          <tbody id="sellCartRows">${sellCartRows()}</tbody>
        </table>
      </div>
      <div class="sell-summary">
        <div class="sell-total"><span>Total</span><strong>${money(cartTotal())}</strong></div>
        <div class="sell-summary-actions">
          <button class="sell-checkout-btn" id="sellCheckoutBtn" ${state.cart.length ? "" : "disabled"}><img class="btn-icon" src="src/icon/cart.svg" alt=""> Checkout</button>
          <button class="sell-clear-btn" id="clearCartBtn" ${state.cart.length ? "" : "disabled"}><img class="btn-icon" src="src/icon/reset.svg" alt=""> Clean Cart</button>
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
      <td title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</td>
      <td>${money(p.price)}</td>
      <td>${available}</td>
      <td><div class="sell-add-controls">
        <input class="sell-qty-input" type="number" min="1" max="${available}" value="1" data-qty="${p.id}" aria-label="Quantity for ${escapeHtml(p.name)}" ${available ? "" : "disabled"}>
        <button class="sell-add-btn" type="button" data-add="${p.id}" ${available ? "" : "disabled"}>${available ? "Add" : "Out"}</button>
      </div></td>
    </tr>`;
  }).join("");
}

export function sellCartRows() {
  if (!state.cart.length) {
    return `<tr><td class="sell-cart-empty" colspan="4">Your cart is empty. Add products to start checkout.</td></tr>`;
  }
  return state.cart.map(item => `<tr>
    <td title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</td>
    <td><div class="sell-cart-qty">
      <button class="qty-btn" data-cart-remove-step="${item.id}" aria-label="Decrease ${escapeHtml(item.name)} quantity"><img class="btn-sm-icon" src="src/icon/minus.svg" alt="−"></button>
      <input class="sell-qty-input" type="number" min="1" value="${item.qty}" data-cart-qty data-cart-id="${item.id}" aria-label="${escapeHtml(item.name)} quantity">
      <button class="qty-btn" data-cart-add-step="${item.id}" aria-label="Increase ${escapeHtml(item.name)} quantity"><img class="btn-sm-icon" src="src/icon/add.svg" alt="+"></button>
    </div></td>
    <td>${money(item.price * item.qty)}</td>
    <td><button class="remove-btn" data-cart-remove="${item.id}">Remove</button></td>
  </tr>`).join("");
}

// ---------------------------------------------------------------------------
// Active tab orchestrator (called whenever cart changes)
// ---------------------------------------------------------------------------

let _renderActiveTab;
export function registerRenderActiveTab(fn) { _renderActiveTab = fn; }
function renderActiveTab() { if (_renderActiveTab) _renderActiveTab(); }
