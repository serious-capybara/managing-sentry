// loads products, history and capital from the API into the app state

import { state, persist } from "./state.js";
import { apiRequest }     from "./api.js";
import { parseTimestamp, formatDateTime24, toast } from "./utils.js";
import { ensureStockBaseline, ensureExpiryBatches, earliestExpiry } from "./stock-logic.js";
import { getProfitBreakdown, getSalesRevenue } from "./finance.js";

// loads products, history and capital and maps the database fields to the app state
export async function loadDashboardData() {
  let productsRes = null;
  let transactionsRes = null;
  let capitalRes = null;

  try {
    const [p, t, c] = await Promise.allSettled([
      apiRequest("products.php"),
      apiRequest("get_history.php?limit=1000", {
        onResponse: (res, base) => {
          state.historySource = base;
          state.historyWarning = res?.headers?.get?.("X-History-Warnings") || "";
        }
      }),
      apiRequest("capital.php")
    ]);

    // show load failures instead of leaving blank pages
    state.authFailed = [p, t, c].some(r => r.status === "rejected" && /sign(ed)? in|log in/i.test(r.reason?.message || ""));
    const failed = [["products", p], ["history", t], ["capital", c]].filter(([, r]) => r.status === "rejected");
    if (failed.length && !state.authFailed) {
      const [what, r] = failed[0];
      console.warn(`Could not load ${what}:`, r.reason);
      toast(`Could not load ${what} from the server: ${r.reason?.message || "unknown error"}`);
    }

    if (p.status === "fulfilled" && Array.isArray(p.value)) productsRes = p.value;
    if (t.status === "fulfilled" && Array.isArray(t.value)) {
      transactionsRes = t.value;
      state.historyError = state.historyWarning
        ? `Part of the history could not be loaded (${state.historyWarning}).`
        : "";
    } else if (t.status === "rejected") {
      state.historyError = t.reason?.message || "Could not load history from the server.";
      console.warn("History request failed:", t.reason);
    }
    if (c.status === "fulfilled" && c.value) capitalRes = c.value;
  } catch (err) {
    console.warn("Backend API sync offline, using local/cached state:", err);
  }

  // products
  // Use the server's answer whenever we got one (even an empty list); only fall back to the
  // cached copy when the request itself failed.
  const rawProducts = Array.isArray(productsRes) ? productsRes : state.products;

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

  // history
  const rawTransactions = Array.isArray(transactionsRes) ? transactionsRes : state.transactions;
  state.transactions = rawTransactions.map((t, idx) => {
    const id = Number(t.id ?? t.entry_id ?? t.order_id ?? (idx + 1));
    const name = t.name || (t.order_id ? `Order #${t.order_id}` : "Transaction");
    const amount = Number(t.amount ?? t.total_amount ?? 0);
    const qty = Number(t.qty ?? t.total_quantity ?? 1);
    const costPerUnit = Number(t.costPerUnit ?? t.cost_per_unit ?? 0);
    const cogs = t.cogs == null ? undefined : Number(t.cogs);
    const rawDate = t.date || t.created_at || t.transaction_timestamp;
    const parsed = parseTimestamp(rawDate) ?? parseTimestamp(t.timestamp);
    const timestamp = parsed ?? 0;
    const dateStr = parsed != null ? formatDateTime24(parsed) : "—";
    const type = String(t.type || "SALE").trim().toUpperCase().replace(/_/g, " ");
    const items = Array.isArray(t.items) ? t.items : [];

    return {
      ...t,
      id,
      type,
      items,
      name,
      amount,
      qty,
      costPerUnit,
      cogs,
      timestamp,
      date: dateStr,
      notes: t.notes || ""
    };
  }).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  // capital and sales totals
  if (capitalRes && (capitalRes.capital !== undefined || capitalRes.current_balance !== undefined)) {
    state.capital = Number(capitalRes.capital ?? capitalRes.current_balance ?? 0);
    state.startingCapital = Number(capitalRes.starting_capital ?? state.capital);
  } else if (state.capital === undefined) {
    state.capital = 0;
  }

  state.salesToday = getSalesRevenue("today");
  state.totalSales = getSalesRevenue("all");
  state.profit = getProfitBreakdown().grossProfit;

  // drop cart items whose product is gone
  state.cart = (state.cart || []).filter(item =>
    state.products.some(p => p.id === Number(item.id))
  );

  // make sure every product has a baseline and valid expiry batches
  state.products.forEach(p => {
    ensureStockBaseline(p);
    ensureExpiryBatches(p);
    const earliest = earliestExpiry(p);
    p.expiry = earliest ? earliest.expiry : (p.expiry || "");
  });

  persist();
}
