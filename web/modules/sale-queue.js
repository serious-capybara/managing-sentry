// saves sales to the server in the background.
// Checkout shows the sale right away and adds it here. Sales are sent one at a time,
// in order, retried when the connection drops, and kept in the browser across refreshes.

import { state, persist } from "./state.js";
import { apiRequest } from "./api.js";
import { toast, money } from "./utils.js";
import { loadDashboardData } from "./data-loader.js";
import { updateStats } from "./stock-logic.js";

const STORAGE_KEY = "sentrySaleQueue";
const RETRY_DELAYS = [2000, 5000, 10000, 20000, 30000];

let queue = readQueue();
let running = false;
let retryTimer = null;
let failures = 0;
const watchers = new Map();      // token → { saved(orderId), failed(message) }
let afterSaveHook = () => {};

function readQueue() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function writeQueue() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.warn("Could not store the waiting sales:", error);
  }
}

// sales still waiting for the server
export const pendingSaleCount = () => queue.length;

// runs when the queue empties (live-sync refreshes the screen)
export function onQueueDrained(callback) {
  afterSaveHook = callback;
}

// watch one sale: { saved(orderId), failed(message) }
export function watchSale(token, watcher) {
  watchers.set(token, watcher);
}

// queue a sale and start sending
export function enqueueSale(job) {
  queue.push(job);
  writeQueue();
  kickSaleQueue();
}

// start sending (also after login or when back online)
export function kickSaleQueue() {
  clearTimeout(retryTimer);
  retryTimer = null;
  if (!running && queue.length) run();
}

const isRejection = error =>
  Number.isInteger(error?.status) && error.status >= 400 && error.status < 500 &&
  ![401, 408, 429].includes(error.status);

async function alreadySaved(token) {
  // The connection may have dropped AFTER the server saved the sale. Look for our reference
  // before sending again, so a sale is never recorded twice.
  try {
    const history = await apiRequest("get_history.php");
    const match = (Array.isArray(history) ? history : []).find(entry =>
      String(entry.notes || "").includes(`[${token}]`)
    );
    return match ? Number(match.order_id ?? match.entry_id) : null;
  } catch {
    return null;
  }
}

async function run() {
  running = true;
  while (queue.length) {
    const job = queue[0];
    try {
      let orderId = job.maybeSent ? await alreadySaved(job.token) : null;
      if (!Number.isInteger(orderId)) {
        job.maybeSent = true;       // from here on, a failure may have reached the server
        writeQueue();
        const result = await apiRequest("make_sale.php", {
          method: "POST",
          body: JSON.stringify(job.body),
          onlyDetectedBase: true
        });
        orderId = Number(result.order_id);
        if (!Number.isInteger(orderId)) throw new Error("The server did not return a valid order ID.");
      }
      failures = 0;
      queue.shift();
      writeQueue();
      markSaved(job, orderId);
    } catch (error) {
      if (isRejection(error)) {
        queue.shift();
        writeQueue();
        await markRejected(job, error);
        continue;
      }
      if (error?.status === 401) {          // signed out: wait for the next login (it restarts the queue)
        running = false;
        return;
      }
      if (!error?.status || error.status >= 500) job.maybeSent = true;
      writeQueue();
      const delay = RETRY_DELAYS[Math.min(failures, RETRY_DELAYS.length - 1)];
      failures += 1;
      running = false;
      retryTimer = setTimeout(kickSaleQueue, delay);
      return;
    }
  }
  running = false;
  afterSaveHook();
}

function markSaved(job, orderId) {
  const tx = state.transactions.find(t => t.saleToken === job.token);
  if (tx) {
    // Swap the temporary number for the real one, but never leave two rows with the same ID.
    state.transactions = state.transactions.filter(t => t === tx || Number(t.id) !== orderId || t.type !== "SALE");
    tx.id = orderId;
    tx.order_id = orderId;
    delete tx.pending;
  }
  persist();
  watchers.get(job.token)?.saved(orderId);
  watchers.delete(job.token);
}

async function markRejected(job, error) {
  // The server refused this sale (for example, not enough stock): undo it on screen.
  state.transactions = state.transactions.filter(t => t.saleToken !== job.token);
  persist();
  try {
    await loadDashboardData();      // bring stock and money back to what the server really has
  } catch { /* ignore: the next refresh will fix it */ }
  updateStats();
  const message = error?.message || "unknown error";
  toast(`A sale of ${money(job.total)} could not be saved: ${message}. It was cancelled.`);
  watchers.get(job.token)?.failed(message);
  watchers.delete(job.token);
  afterSaveHook();
}

window.addEventListener("online", kickSaleQueue);
window.addEventListener("beforeunload", event => {
  if (queue.length) {
    event.preventDefault();
    event.returnValue = "";
  }
});
