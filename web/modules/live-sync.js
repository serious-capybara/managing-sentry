// keeps the screen up to date with the server.
// Every few seconds it asks if anything changed and, if so, reloads the data
// and redraws the page without losing scroll, search text or sorting.
// It waits while you type, while a pop-up is open or while sales are still saving.

import { apiRequest } from "./api.js";
import { loadDashboardData } from "./data-loader.js";
import { isSessionValid } from "./state.js";
import { renderPage, currentPage } from "./router.js";
import { updateStats } from "./stock-logic.js";
import { pendingSaleCount, onQueueDrained } from "./sale-queue.js";

const CHECK_EVERY_MS = 5000;
const SCROLL_AREAS = [
  ".dashboard-table-scroll", ".products-table-scroll", ".stocks-table-scroll",
  ".transactions-table-scroll", ".low-stock-table-scroll", ".price-directory",
  ".price-match-list", ".report-table-wrap", ".sell-table-scroll", ".sell-cart-scroll",
  ".dash-expiring-table-wrap", ".stocks-low-table-wrap"
].join(",");
const TEXT_BOXES = "#pageContent input.compact-input, #pageContent input.sell-search-input";

let started = false;
let timer = null;
let checking = false;
let lastFingerprint = null;
let waitingForQuietMoment = false;
let useFallback = false;        // the server has no sync_status endpoint yet → use the capital timestamp

async function readFingerprint() {
  if (!useFallback) {
    try {
      const reply = await apiRequest("sync_status.php");
      if (reply && reply.version != null) return String(reply.version);
    } catch (error) {
      if (error?.status === 401 || !error?.status) throw error;   // signed out / offline: not a missing endpoint
      useFallback = true;
    }
  }
  const capital = await apiRequest("capital.php");
  return `capital:${capital.capital ?? capital.current_balance}:${capital.last_updated_at || ""}`;
}

// true if redrawing now would interrupt the user
function userIsBusy() {
  if (document.querySelector(".modal-overlay")) return true;
  if (document.body.classList.contains("m-sheet-open")) return true;
  const active = document.activeElement;
  return !!active && (active.tagName === "TEXTAREA" ||
    (active.tagName === "INPUT" && !["button", "checkbox", "radio", "submit"].includes(active.type)));
}

// redraw the page but keep scroll, search text and sorting
function redrawKeepingPlace() {
  const root = document.getElementById("pageContent");
  const scrolls = [...(root?.querySelectorAll(SCROLL_AREAS) || [])].map(el => [el.scrollTop, el.scrollLeft]);
  const texts = [...document.querySelectorAll(TEXT_BOXES)].map(el => el.value);
  const choices = [...(root?.querySelectorAll("select") || [])].map(el => el.value);

  renderPage(currentPage);

  const newRoot = document.getElementById("pageContent");
  newRoot?.querySelectorAll("select").forEach((el, i) => {
    if (choices[i] != null && choices[i] !== el.value && [...el.options].some(o => o.value === choices[i])) {
      el.value = choices[i];
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  document.querySelectorAll(TEXT_BOXES).forEach((el, i) => {
    if (texts[i] && el.value !== texts[i]) {
      el.value = texts[i];
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  newRoot?.querySelectorAll(SCROLL_AREAS).forEach((el, i) => {
    if (scrolls[i]) {
      el.scrollTop = scrolls[i][0];
      el.scrollLeft = scrolls[i][1];
    }
  });
}

// reload from the server and redraw
export async function refreshFromServer() {
  const fingerprint = await readFingerprint().catch(() => null);
  await loadDashboardData({ force: true });
  if (fingerprint) lastFingerprint = fingerprint;
  updateStats();
  if (userIsBusy()) {
    waitingForQuietMoment = true;
    return;
  }
  waitingForQuietMoment = false;
  redrawKeepingPlace();
}

async function check() {
  if (checking || document.hidden || !isSessionValid() || pendingSaleCount() > 0) return;
  checking = true;
  try {
    if (waitingForQuietMoment && !userIsBusy()) {
      await refreshFromServer();
      return;
    }
    const fingerprint = await readFingerprint();
    if (lastFingerprint === null) {
      lastFingerprint = fingerprint;
    } else if (fingerprint !== lastFingerprint) {
      await refreshFromServer();
    }
  } catch {
    /* offline or signed out: try again on the next round */
  } finally {
    checking = false;
  }
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    await check();
    schedule();
  }, CHECK_EVERY_MS);
}

// start watching (safe to call twice)
export function startLiveSync() {
  if (started) return;
  started = true;
  lastFingerprint = null;
  readFingerprint().then(f => { lastFingerprint = f; }).catch(() => {});
  onQueueDrained(() => { refreshFromServer().catch(() => {}); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
  window.addEventListener("online", check);
  window.addEventListener("data-fully-loaded", () => { if (!userIsBusy()) redrawKeepingPlace(); });
  window.addEventListener("focus", check);
  schedule();
}
