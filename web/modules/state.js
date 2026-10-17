// app state, saving to the browser and the one-hour login session

export const defaultState = {
  capital: 0,
  salesToday: 0,
  totalSales: 0,
  profit: 0,
  operatingExpenses: 0,
  interest: 0,
  taxes: 0,
  cart: [],
  products: [],
  transactions: []
};

const savedState = JSON.parse(localStorage.getItem("inventorySuperAdmin") || "null");

// the shared app state
export const state = { ...structuredClone(defaultState), ...(savedState || {}) };

// saves the app data in the browser so a refresh keeps it
function writeStateToStorage() {
  localStorage.setItem("inventorySuperAdmin", JSON.stringify({
    cart: state.cart,
    products: state.products,
    transactions: state.transactions,
    startingCapital: state.startingCapital,
    capital: state.capital,
    operatingExpenses: state.operatingExpenses,
    interest: state.interest,
    taxes: state.taxes
  }));
}

let persistTimer = null;

// batched save: quick changes (like tapping Add a few times) cause one save
export function persist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    writeStateToStorage();
  }, 300);
}

// save now (used when the page closes or hides)
export function flushPersist() {
  if (!persistTimer) return;
  clearTimeout(persistTimer);
  persistTimer = null;
  writeStateToStorage();
}

window.addEventListener("pagehide", flushPersist);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushPersist();
});

// login session (valid for 1 hour) and last page
const SESSION_KEY = "sentrySession";
const ACTIVE_PAGE_KEY = "sentryActivePage";
const ONE_HOUR_MS = 60 * 60 * 1000;

// stores the login, valid for one hour
export function saveSession(username = "admin", fullName = username) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    username,
    fullName,
    loginTime: Date.now()
  }));
}

// the saved login, or null once it is over an hour old
export function getSession() {
  try {
    const data = localStorage.getItem(SESSION_KEY);
    if (!data) return null;
    const session = JSON.parse(data);
    if (!session?.loginTime || Date.now() - session.loginTime >= ONE_HOUR_MS) {
      clearSession();
      return null;
    }
    return session;
  } catch (e) {
    clearSession();
    return null;
  }
}

// forget the login
export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// true while the login is still valid
export function isSessionValid() {
  return getSession() !== null;
}

// remember the current page for refreshes
export function saveActivePage(page) {
  if (page && page !== "add-product") {
    localStorage.setItem(ACTIVE_PAGE_KEY, page);
  }
}

// last page, dashboard by default
export function getActivePage() {
  return localStorage.getItem(ACTIVE_PAGE_KEY) || "dashboard";
}
