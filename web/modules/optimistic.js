import { state, persist, getSession } from "./state.js";
import { updateStats, consumeExpiryBatches } from "./stock-logic.js";
import { enqueueTask } from "./sale-queue.js";
import { makeClientRef } from "./utils.js";

const newToken = makeClientRef;
const whoIsWorking = () => getSession()?.fullName || getSession()?.username || "Unknown user";


function addLocalHistory(type, name, qty, cost, userNote, token) {
  state.transactions.unshift({
    id: 100000 + Date.now(),
    type,
    name,
    qty,
    amount: Math.abs(qty) * cost,
    costPerUnit: cost,
    cogs: Math.abs(qty) * cost,
    date: new Date().toISOString(),
    timestamp: Date.now(),
    notes: `By ${whoIsWorking()} (${token})${userNote ? `\n${userNote}` : ""}`,
    items: [],
    pending: true
  });
}

function finish() {
  persist();
  updateStats();
}

export function saveNewProduct(fields, userNote = "") {
  const token = newToken();
  const sameName = state.products.find(p => p.name.trim().toLowerCase() === fields.name.trim().toLowerCase());
  let tempProductId = null;

  if (sameName) {
    Object.assign(sameName, {
      category: fields.category, cost: fields.cost, price: fields.price,
      expiry: fields.expiry || sameName.expiry, low_stock_alert_level: fields.alertLevel, lowStockAlertLevel: fields.alertLevel
    });
    sameName.stock += fields.stock;
    addLocalHistory("STOCK IN", sameName.name, fields.stock, fields.cost, userNote, token);
  } else {
    tempProductId = -Date.now();
    state.products.push({
      id: tempProductId, name: fields.name, category: fields.category,
      cost: fields.cost, price: fields.price, srp: fields.price,
      stock: fields.stock, stockBaseline: fields.stock, sold: 0, soldRevenue: 0, soldCogs: 0,
      expiry: fields.expiry || "",
      expiryBatches: fields.expiry ? [{ expiry: fields.expiry, qty: fields.stock, addedAt: new Date().toISOString() }] : [],
      low_stock_alert_level: fields.alertLevel, lowStockAlertLevel: fields.alertLevel
    });
    addLocalHistory("NEW PRODUCT", fields.name, fields.stock, fields.cost, userNote, token);
  }
  finish();

  enqueueTask({
    token, tempProductId, label: `Adding "${fields.name}"`,
    endpoint: "products.php?action=add",
    body: {
      name: fields.name, category: fields.category, price: fields.price, cost: fields.cost,
      stock: fields.stock, low_stock_alert_level: fields.alertLevel, expiry: fields.expiry || "",
      notes: userNote, client_ref: token
    }
  });
}

export function saveEditedProduct(productId, fields, userNote = "") {
  const token = newToken();
  const product = state.products.find(p => p.id === productId);
  if (product) {
    Object.assign(product, {
      name: fields.name, category: fields.category, cost: fields.cost, price: fields.price, srp: fields.price,
      expiry: fields.expiry || "", low_stock_alert_level: fields.alertLevel, lowStockAlertLevel: fields.alertLevel
    });
    addLocalHistory("PRODUCT EDITED", fields.name, 0, fields.cost, userNote, token);
  }
  finish();

  enqueueTask({
    token, label: `Editing "${fields.name}"`,
    endpoint: "products.php?action=edit",
    body: {
      product_id: productId, id: productId, name: fields.name, category: fields.category,
      price: fields.price, cost: fields.cost, stock: product ? product.stock : 0,
      low_stock_alert_level: fields.alertLevel, expiry: fields.expiry || "",
      notes: userNote, client_ref: token
    }
  });
}

export function removeProductInBackground(productId, userNote = "") {
  const token = newToken();
  const product = state.products.find(p => p.id === productId);
  if (!product) return;
  state.products = state.products.filter(p => p.id !== productId);
  addLocalHistory("PRODUCT REMOVED", product.name, 0, product.cost, userNote, token);
  finish();

  enqueueTask({
    token, label: `Removing "${product.name}"`,
    endpoint: "products.php?action=delete",
    body: { product_id: productId, notes: userNote, client_ref: token }
  });
}

export function moveStockInBackground(product, type, quantity, { expiry = "", userNote = "" } = {}) {
  const token = newToken();
  if (type === "STOCK IN") {
    product.stock += quantity;
    if (expiry) {
      product.expiry = expiry;
      product.expiryBatches = [...(product.expiryBatches || []), { expiry, qty: quantity, addedAt: new Date().toISOString() }];
    }
  } else {
    product.stock = Math.max(0, product.stock - quantity);
    consumeExpiryBatches(product, quantity);
  }
  addLocalHistory(type, product.name, type === "STOCK OUT" ? -quantity : quantity, product.cost, userNote, token);
  finish();

  enqueueTask({
    token, label: `${type === "STOCK IN" ? "Adding" : "Removing"} ${quantity} units of "${product.name}"`,
    endpoint: "products.php?action=stock",
    body: { product_id: product.id, quantity, type, expiry, notes: userNote, client_ref: token }
  });
}
