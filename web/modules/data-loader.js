// loads products, history and capital from the API into the app state.
// Only the first 100 products and 100 history rows are loaded up front; the rest streams in
// in the background (see loadRestInBackground) so a big shop never freezes the page.

import { state, persist, getActivePage } from "./state.js";
import { apiRequest }     from "./api.js";
import { parseTimestamp, formatDateTime24, toast } from "./utils.js";
import { ensureStockBaseline, ensureExpiryBatches, earliestExpiry } from "./stock-logic.js";
import { getProfitBreakdown, getSalesRevenue } from "./finance.js";

const FIRST_PAGE = 100;
const BACKGROUND_PAGE = 300;
const totals = { products: 0, history: 0 };
let backgroundRun = 0;
let historyLoaded = 0;          // history rows fetched from the server so far
let historyAllRun = null;       // the running "load everything" request, if any

// loads products, history and capital and maps the database fields to the app state
let lastLoadFinished = 0;

/**
 * Reload products, history and capital. A page that just opened can call this freely: if data
 * was loaded a moment ago it is reused. Pass { force: true } when fresh data is really needed.
 */
export async function loadDashboardData({ force = false } = {}) {
  if (!force && Date.now() - lastLoadFinished < 4000 && !state.loadingMore) return;
  let productsRes = null;
  let transactionsRes = null;
  let capitalRes = null;

  try {
    const [p, t, c] = await Promise.allSettled([
      apiRequest(`products.php?limit=${FIRST_PAGE}&offset=0`, { onResponse: res => { totals.products = Number(res?.headers?.get?.("X-Total-Count")) || 0; } }),
      apiRequest(`get_history.php?limit=${FIRST_PAGE}&offset=0`, {
        onResponse: (res, base) => {
          totals.history = Number(res?.headers?.get?.("X-Total-Count")) || 0;
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

  state.products = rawProducts.map(mapProduct);

  // history
  const rawTransactions = Array.isArray(transactionsRes) ? transactionsRes : state.transactions;
  state.transactions = rawTransactions.map(mapTransaction).sort(byNewest);

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
  const previouslyLoaded = historyLoaded;
  historyLoaded = rawTransactions.length;
  // keep the pages the user already scrolled through, so a refresh does not shorten the list
  if (previouslyLoaded > historyLoaded && hasMoreHistory()) {
    try { await loadMoreHistory(previouslyLoaded - historyLoaded); } catch { /* next refresh */ }
  }
  lastLoadFinished = Date.now();
  loadRestInBackground(state.products.length);
  // Dashboard totals and reports need every sale, so on those pages the rest is fetched too.
  if (["dashboard", "reports"].includes(getActivePage())) loadAllHistory();
}

const byNewest = (a, b) => (b.timestamp || 0) - (a.timestamp || 0);

function mapProduct(p) {
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
}

function mapTransaction(t, idx) {
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
}

function refreshDerivedState() {
  state.salesToday = getSalesRevenue("today");
  state.totalSales = getSalesRevenue("all");
  state.profit = getProfitBreakdown().grossProfit;
  state.products.forEach(p => {
    ensureStockBaseline(p);
    ensureExpiryBatches(p);
    const earliest = earliestExpiry(p);
    p.expiry = earliest ? earliest.expiry : (p.expiry || "");
  });
}

/** Products stream in quietly after the first 100 are shown. */
async function loadRestInBackground(haveProducts) {
  const run = ++backgroundRun;
  state.loadingMore = totals.products > haveProducts;
  if (!state.loadingMore) return;
  let have = haveProducts;
  try {
    while (have < totals.products && run === backgroundRun) {
      const rows = await apiRequest(`products.php?limit=${BACKGROUND_PAGE}&offset=${have}`);
      if (!Array.isArray(rows) || !rows.length || run !== backgroundRun) break;
      state.products.push(...rows.map(mapProduct));
      have += rows.length;
      await new Promise(resolve => setTimeout(resolve, 60));   // let the page breathe between requests
    }
    if (run === backgroundRun) {
      refreshDerivedState();
      persist();
    }
  } catch (error) {
    console.warn("Background loading stopped:", error);
  } finally {
    if (run === backgroundRun) {
      state.loadingMore = false;
      window.dispatchEvent(new CustomEvent("data-fully-loaded"));
    }
  }
}

/** How many history rows exist on the server in total. */
export const historyTotalCount = () => totals.history;
export const hasMoreHistory = () => historyLoaded < totals.history;

function addHistoryRows(rows) {
  const seen = new Set(state.transactions.map(t => `${t.type}:${t.id}`));
  const fresh = rows.map((t, i) => mapTransaction(t, historyLoaded + i)).filter(t => !seen.has(`${t.type}:${t.id}`));
  historyLoaded += rows.length;
  state.transactions.push(...fresh);
  state.transactions.sort(byNewest);
}

/** Fetch the next page of history (called when the user scrolls to the end of the table). */
export async function loadMoreHistory(count = 100) {
  if (!hasMoreHistory()) return 0;
  const rows = await apiRequest(`get_history.php?limit=${count}&offset=${historyLoaded}`);
  if (!Array.isArray(rows) || !rows.length) { totals.history = historyLoaded; return 0; }
  addHistoryRows(rows);
  refreshDerivedState();
  return rows.length;
}

/** Fetch all remaining history (dashboard / report totals, "Oldest" order, searching). */
export function loadAllHistory() {
  if (!hasMoreHistory()) return Promise.resolve();
  if (historyAllRun) return historyAllRun;
  historyAllRun = (async () => {
    try {
      while (hasMoreHistory()) {
        const got = await loadMoreHistory(BACKGROUND_PAGE);
        if (!got) break;
        await new Promise(resolve => setTimeout(resolve, 60));
      }
    } catch (error) {
      console.warn("Loading the full history stopped:", error);
    } finally {
      historyAllRun = null;
      window.dispatchEvent(new CustomEvent("data-fully-loaded"));
    }
  })();
  return historyAllRun;
}
