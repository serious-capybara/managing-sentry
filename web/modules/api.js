/* ============================================================
 * api.js — Centralised HTTP helper for all backend calls.
 * All requests go to the FastAPI backend at http://127.0.0.1:8003.
 * Session cookie auth is sent with every request.
 * ============================================================ */

export const API_BASE = "https://managing-sentry-web.vercel.app/api";

/**
 * Redirect the user to the login screen (used on 401 responses).
 */
function redirectToLogin() {
  const app = document.getElementById("app");
  const loginScreen = document.getElementById("loginScreen");
  if (app) { app.style.setProperty("display", "none", "important"); app.classList.add("hidden"); }
  if (loginScreen) { loginScreen.style.removeProperty("display"); loginScreen.classList.remove("hidden"); }
  const loginForm = document.getElementById("loginForm");
  if (loginForm) loginForm.reset();
}

/**
 * Fetch a backend endpoint.
 *
 * @param {string} endpoint  - e.g. "products.php" or "login.php?action=logout"
 * @param {RequestInit} options - standard fetch options
 * @returns {Promise<any>}   Parsed JSON response body
 */
export async function apiRequest(endpoint, options = {}) {
  const cleanEndpoint = endpoint.replace(/^\/+/, "");
  const url = `${API_BASE}/${cleanEndpoint}`;

  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });

  const rawText = await response.text();
  let result = null;

  try {
    result = rawText ? JSON.parse(rawText) : {};
  } catch (jsonErr) {
    if (!response.ok) {
      throw new Error(`Server returned status ${response.status} (${response.statusText})`);
    }
    throw new Error("Invalid response from server (expected JSON).");
  }

  if (response.status === 401) {
    redirectToLogin();
    throw new Error(result.error || "Not signed in. Please log in again.");
  }

  if (!response.ok) {
    throw new Error(result.error || `Server error (${response.status})`);
  }

  return result;
}
