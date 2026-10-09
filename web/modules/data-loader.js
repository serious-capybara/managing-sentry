/* ============================================================
 * data-loader.js — Fetches all dashboard data from backend API
 * and normalises database SQL responses to frontend state.
 * Includes offline fallback data if backend endpoints are unreachable.
 * ============================================================ */

import { state, persist } from "./state.js";
import { apiRequest }     from "./api.js";
import { ensureStockBaseline, ensureExpiryBatches, earliestExpiry } from "./stock-logic.js";
import { getProfitBreakdown, getSalesRevenue } from "./finance.js";

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
  const rawProducts = productsRes !== null
    ? productsRes
    : (state.products.length
      ? state.products
      : []);

  state.products = rawProducts.map(p => {
    const id = Number(p.id ?? p.product_id ?? 0);
    const name = p.name || "Unnamed Product";
    const category = p.category || "General";
    const price = Number(p.price ?? p.retail_price ?? p.srp ?? 0);
    const cost = Number(p.cost ?? p.base_cost ?? p.cost_price ?? 0);
    const stock = Number(p.stock ?? p.stock_quantity ?? p.quantity ?? 0);
    const sold = Number(p.sold ?? p.total_sold ?? p.units_sold ?? 0);
    const expiry = p.expiry || p.expiration_date || p.expiry_date || "";
    const lowStockAlertLevel = Number(p.low_stock_alert_level ?? p.lowStockAlertLevel ?? 20);

    return {
      ...p,
      id,
      name,
      category,
      price,
      cost,
      stock,
      sold,
      low_stock_alert_level: lowStockAlertLevel,
      lowStockAlertLevel: lowStockAlertLevel,
      soldRevenue: p.sold_revenue == null
        ? (p.soldRevenue == null ? undefined : Number(p.soldRevenue))
        : Number(p.sold_revenue),
      soldCogs: p.sold_cogs == null
        ? (p.soldCogs == null ? undefined : Number(p.soldCogs))
        : Number(p.sold_cogs),
      expiry,
      stockBaseline: Number(p.stockBaseline ?? stock),
      expiryBatches: Array.isArray(p.expiryBatches) ? p.expiryBatches : []
    };
  });

  /* 2. Normalize Transactions */
  const rawTransactions = transactionsRes !== null
    ? transactionsRes
    : state.transactions;
  state.transactions = rawTransactions.map((t, idx) => {
    const id = Number(t.id ?? t.order_id ?? (idx + 1));
    const type = t.type || "SALE";
    const name = t.name || (t.order_id ? `Order #${t.order_id}` : "Transaction");
    const amount = Number(t.amount ?? t.total_amount ?? 0);
    const qty = Number(t.qty ?? t.total_quantity ?? 1);
    const costPerUnit = Number(t.costPerUnit ?? t.cost_per_unit ?? 0);
    const cogs = t.cogs == null ? undefined : Number(t.cogs);
    const rawDate = t.date || t.transaction_timestamp || new Date().toISOString();
    const dateObj = new Date(rawDate);
    const timestamp = isNaN(dateObj.getTime()) ? Date.now() : dateObj.getTime();
    let dateStr = String(rawDate);
    if (!isNaN(dateObj.getTime())) {
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, "0");
      const day = String(dateObj.getDate()).padStart(2, "0");
      const hours = String(dateObj.getHours()).padStart(2, "0");
      const minutes = String(dateObj.getMinutes()).padStart(2, "0");
      const seconds = String(dateObj.getSeconds()).padStart(2, "0");
      dateStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    return {
      ...t,
      id,
      type,
      name,
      amount,
      qty,
      costPerUnit,
      cogs,
      timestamp,
      date: dateStr,
      notes: t.notes || ""
    };
  });

  /* 3. Normalize Capital & Sales Totals */
  if (capitalRes && (capitalRes.capital !== undefined || capitalRes.amount !== undefined)) {
    state.capital = Number(capitalRes.capital ?? capitalRes.amount ?? 20000);
    state.operatingExpenses = Number(capitalRes.operating_expenses || 0);
    state.interest = Number(capitalRes.interest || 0);
    state.taxes = Number(capitalRes.taxes || 0);
  } else if (!state.capital) {
    state.capital = 20000;
  }

  state.salesToday = getSalesRevenue("today");
  state.totalSales = getSalesRevenue("all");
  state.profit = getProfitBreakdown().grossProfit;

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
