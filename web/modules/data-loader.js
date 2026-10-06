/* ============================================================
 * data-loader.js — Fetches all dashboard data from backend API
 * and normalises database SQL responses to frontend state.
 * Includes offline fallback data if backend endpoints are unreachable.
 * ============================================================ */

import { state, persist } from "./state.js";
import { apiRequest }     from "./api.js";
import { ensureStockBaseline, ensureExpiryBatches, earliestExpiry } from "./stock-logic.js";

const DEFAULT_PRODUCTS = [
  { id: 1, name: "Alaxan FR 200mg", category: "Medicine", cost: 7.50, price: 10.00, stock: 90, sold: 15, expiry: "2026-10-10", expiryBatches: [{ batchId: "B1", expiry: "2026-10-10", qty: 90 }] },
  { id: 2, name: "Argentina Corned Beef 150g", category: "Canned Goods", cost: 32.00, price: 42.00, stock: 64, sold: 22, expiry: "2026-10-12", expiryBatches: [{ batchId: "B2", expiry: "2026-10-12", qty: 64 }] },
  { id: 3, name: "Bear Brand Milk 320g", category: "Beverages", cost: 95.00, price: 115.00, stock: 3, sold: 40, expiry: "2027-01-15", expiryBatches: [{ batchId: "B3", expiry: "2027-01-15", qty: 3 }] },
  { id: 4, name: "Bioflu Tablet", category: "Medicine", cost: 6.50, price: 9.00, stock: 108, sold: 52, expiry: "2026-11-20", expiryBatches: [{ batchId: "B4", expiry: "2026-11-20", qty: 108 }] },
  { id: 5, name: "Biogesic 500mg", category: "Medicine", cost: 4.00, price: 5.50, stock: 133, sold: 88, expiry: "2026-10-09", expiryBatches: [{ batchId: "B5", expiry: "2026-10-09", qty: 133 }] },
  { id: 6, name: "C2 Green Tea Apple 500ml", category: "Beverages", cost: 20.00, price: 28.00, stock: 90, sold: 30, expiry: "2026-12-05", expiryBatches: [{ batchId: "B6", expiry: "2026-12-05", qty: 90 }] },
  { id: 7, name: "Century Tuna Oil 155g", category: "Canned Goods", cost: 29.00, price: 38.00, stock: 59, sold: 18, expiry: "2027-03-10", expiryBatches: [{ batchId: "B7", expiry: "2027-03-10", qty: 59 }] }
];

const DEFAULT_TRANSACTIONS = [
  { id: 101, name: "Argentina Corned Beef 150g", type: "SALE", amount: 84.00, qty: 2, costPerUnit: 32.00, date: new Date().toLocaleString(), timestamp: Date.now(), notes: "Customer cash purchase" },
  { id: 102, name: "Alaxan FR 200mg", type: "SALE", amount: 50.00, qty: 5, costPerUnit: 7.50, date: new Date().toLocaleString(), timestamp: Date.now() - 3600000, notes: "OTC Sale" },
  { id: 103, name: "Bear Brand Milk 320g", type: "STOCK IN", amount: 2850.00, qty: 30, costPerUnit: 95.00, date: new Date(Date.now() - 86400000).toLocaleString(), timestamp: Date.now() - 86400000, notes: "Supplier delivery" }
];

/**
 * Fetch products, transaction history, and capital from the backend
 * and normalize SQL database fields to frontend state properties.
 */
export async function loadDashboardData() {
  let productsRes = null;
  let transactionsRes = null;
  let capitalRes = null;

  try {
    const [p, t, c] = await Promise.allSettled([
      apiRequest("products.php"),
      apiRequest("get_history.php"),
      apiRequest("capital.php")
    ]);

    if (p.status === "fulfilled" && Array.isArray(p.value)) productsRes = p.value;
    if (t.status === "fulfilled" && Array.isArray(t.value)) transactionsRes = t.value;
    if (c.status === "fulfilled" && c.value) capitalRes = c.value;
  } catch (err) {
    console.warn("Backend API sync offline, using local/cached state:", err);
  }

  /* 1. Normalize Products */
  const rawProducts = (productsRes && productsRes.length) ? productsRes : (state.products.length ? state.products : DEFAULT_PRODUCTS);
  state.products = rawProducts.map(p => {
    const id = Number(p.id ?? p.product_id ?? 0);
    const name = p.name || "Unnamed Product";
    const category = p.category || "General";
    const price = Number(p.price ?? p.retail_price ?? p.srp ?? 0);
    const cost = Number(p.cost ?? p.base_cost ?? p.cost_price ?? 0);
    const stock = Number(p.stock ?? p.stock_quantity ?? p.quantity ?? 0);
    const sold = Number(p.sold ?? p.total_sold ?? p.units_sold ?? 0);
    const expiry = p.expiry || p.expiration_date || p.expiry_date || "";

    return {
      ...p,
      id,
      name,
      category,
      price,
      cost,
      stock,
      sold,
      expiry,
      stockBaseline: Number(p.stockBaseline ?? stock),
      expiryBatches: Array.isArray(p.expiryBatches) ? p.expiryBatches : []
    };
  });

  /* 2. Normalize Transactions */
  const rawTransactions = (transactionsRes && transactionsRes.length) ? transactionsRes : (state.transactions.length ? state.transactions : DEFAULT_TRANSACTIONS);
  state.transactions = rawTransactions.map((t, idx) => {
    const id = Number(t.id ?? t.order_id ?? (idx + 1));
    const type = t.type || "SALE";
    const name = t.name || (t.order_id ? `Order #${t.order_id}` : "Transaction");
    const amount = Number(t.amount ?? t.total_amount ?? 0);
    const qty = Number(t.qty ?? t.total_quantity ?? 1);
    const costPerUnit = Number(t.costPerUnit ?? t.cost_per_unit ?? 0);
    const rawDate = t.date || t.transaction_timestamp || new Date().toISOString();
    const dateObj = new Date(rawDate);
    const timestamp = isNaN(dateObj.getTime()) ? Date.now() : dateObj.getTime();
    const dateStr = isNaN(dateObj.getTime()) ? String(rawDate) : dateObj.toLocaleString();

    return {
      ...t,
      id,
      type,
      name,
      amount,
      qty,
      costPerUnit,
      timestamp,
      date: dateStr,
      notes: t.notes || ""
    };
  });

  /* 3. Normalize Capital & Sales Totals */
  if (capitalRes && (capitalRes.capital !== undefined || capitalRes.amount !== undefined)) {
    state.capital = Number(capitalRes.capital ?? capitalRes.amount ?? 20000);
  } else if (!state.capital) {
    state.capital = 20000;
  }

  const sales = state.transactions.filter(t => t.type === "SALE");
  const todayStr = new Date().toDateString();

  state.salesToday = sales.reduce(
    (sum, sale) => new Date(sale.timestamp).toDateString() === todayStr ? sum + Number(sale.amount) : sum,
    0
  );
  state.totalSales = sales.reduce((sum, sale) => sum + Number(sale.amount), 0);
  state.profit = sales.reduce(
    (sum, sale) => sum + Number(sale.amount) - (Number(sale.costPerUnit || 0) * Number(sale.qty || 1)),
    0
  );

  /* Clean cart items whose products no longer exist */
  state.cart = (state.cart || []).filter(item =>
    state.products.some(p => p.id === Number(item.id))
  );

  /* Ensure every product has baseline + expiry batch integrity */
  state.products.forEach(p => {
    ensureStockBaseline(p);
    ensureExpiryBatches(p);
    const earliest = earliestExpiry(p);
    p.expiry = earliest ? earliest.expiry : (p.expiry || "");
  });

  persist();
}
