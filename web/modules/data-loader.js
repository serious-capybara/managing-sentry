/* ============================================================
 * data-loader.js — Fetches all dashboard data from the backend
 * and populates the shared state object.
 * ============================================================ */

import { state, persist } from "./state.js";
import { apiRequest }     from "./api.js";
import { ensureStockBaseline, ensureExpiryBatches, earliestExpiry } from "./stock-logic.js";

/**
 * Load products, transaction history, and capital from the backend
 * concurrently, then normalise and store everything in `state`.
 */
export async function loadDashboardData() {
  const [products, transactions, capital] = await Promise.all([
    apiRequest("products.php"),
    apiRequest("get_history.php"),
    apiRequest("capital.php")
  ]);

  state.products = products.map(product => ({
    ...product,
    id: Number(product.id),
    price: Number(product.price),
    cost: Number(product.cost),
    stock: Number(product.stock),
    stockBaseline: Number(product.stockBaseline),
    sold: Number(product.sold),
    expiryBatches: Array.isArray(product.expiryBatches) ? product.expiryBatches : []
  }));

  const sales = transactions.filter(t => t.type === "SALE");
  const today = new Date().toDateString();

  state.salesToday = sales.reduce(
    (sum, sale) => new Date(sale.date).toDateString() === today ? sum + Number(sale.amount) : sum,
    0
  );
  state.totalSales = sales.reduce((sum, sale) => sum + Number(sale.amount), 0);
  state.profit     = sales.reduce(
    (sum, sale) => sum + Number(sale.amount) - Number(sale.costPerUnit || 0) * Number(sale.qty),
    0
  );

  state.transactions = transactions.map(t => ({
    ...t,
    timestamp: new Date(t.date).getTime(),
    date:      new Date(t.date).toLocaleString(),
    qty:       Number(t.qty),
    amount:    Number(t.amount),
    costPerUnit: Number(t.costPerUnit || 0)
  }));

  state.capital = Number(capital.capital);

  /* Remove cart items whose products no longer exist in inventory. */
  state.cart = (state.cart || []).filter(item =>
    state.products.some(p => p.id === Number(item.id))
  );

  /* Migration: ensure every product has baseline + expiry batch data. */
  state.products.forEach(p => {
    ensureStockBaseline(p);
    ensureExpiryBatches(p);
    const earliest = earliestExpiry(p);
    p.expiry = earliest ? earliest.expiry : (p.expiry || "");
  });

  persist();
}
