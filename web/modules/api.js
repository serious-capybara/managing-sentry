/* ============================================================
 * api.js — Centralised HTTP helper for all backend calls.
 * Multi-base fallback, CORS resilience, and session view management.
 * ============================================================ */

import { isSessionValid } from "./state.js";

export const API_BASE = "https://managing-sentry-web.vercel.app/api";

let detectedApiBase = null;

export function getCandidateBases() {
  const isLocal = typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  if (isLocal) {
    const host = window.location.hostname;
    return [
      `http://${host}:8003/api`,
      `http://${host}:8003`,
      "http://localhost:8003/api",
      "http://localhost:8003",
      "http://127.0.0.1:8003/api",
      "http://127.0.0.1:8003",
      "https://managing-sentry-web.vercel.app/api",
      "./api",
      "/api"
    ];
  }

  return [
    "https://managing-sentry-web.vercel.app/api",
    "http://localhost:8003/api",
    "http://localhost:8003",
    "http://127.0.0.1:8003/api",
    "http://127.0.0.1:8003",
    "./api",
    "/api"
  ];
}

/**
 * Switch between the app view and the login screen.
 * Clears any leftover inline display styles so the .hidden class always wins.
 * @param {boolean} loggedIn
 */
export function setAuthView(loggedIn) {
  document.documentElement.classList.remove("session-active");
  const app = document.getElementById("app");
  const loginScreen = document.getElementById("loginScreen");
  if (app) {
    app.style.removeProperty("display");
    app.classList.toggle("hidden", !loggedIn);
  }
  if (loginScreen) {
    loginScreen.style.removeProperty("display");
    loginScreen.classList.toggle("hidden", loggedIn);
  }
  if (!loggedIn) document.getElementById("loginForm")?.reset();
}

/**
 * Fetch a backend endpoint with candidate base fallback and CORS resilience.
 *
 * @param {string} endpoint  - e.g. "products.php" or "login.php?action=logout"
 * @param {RequestInit} options - standard fetch options
 * @returns {Promise<any>}   Parsed JSON response body
 */
export async function apiRequest(endpoint, rawOptions = {}) {
  const { onResponse, ...options } = rawOptions;   // onResponse(response) lets a caller read headers
  const cleanEndpoint = endpoint.replace(/^\/+/, "");
  const baseList = getCandidateBases();
  const candidateBases = detectedApiBase
    ? [detectedApiBase, ...baseList.filter(b => b !== detectedApiBase)]
    : baseList;

  let lastError = null;

  for (let i = 0; i < candidateBases.length; i++) {
    const base = candidateBases[i];
    const url = `${base}/${cleanEndpoint}`;

    try {
      let response;
      try {
        response = await fetch(url, {
          cache: "no-store",
          ...options,
          credentials: "include",
          headers: { "Content-Type": "application/json", ...(options.headers || {}) }
        });
      } catch (fetchErr) {
        response = await fetch(url, {
          cache: "no-store",
          ...options,
          headers: { "Content-Type": "application/json", ...(options.headers || {}) }
        });
      }

      if (response.status === 404 && i < candidateBases.length - 1) {
        if (base === detectedApiBase) detectedApiBase = null;
        continue;
      }

      const rawText = await response.text();
      let result = null;

      try {
        result = rawText ? JSON.parse(rawText) : {};
      } catch (jsonErr) {
        if (response.status === 404 && i < candidateBases.length - 1) {
          if (base === detectedApiBase) detectedApiBase = null;
          continue;
        }
        if (!response.ok) {
          if (base === detectedApiBase) detectedApiBase = null;
          throw new Error(`Server returned status ${response.status} (${response.statusText})`);
        }
        throw new Error("Invalid response from server (expected JSON).");
      }

      if (response.status === 401) {
        if (!isSessionValid()) setAuthView(false);
        throw new Error(result.error || "Not signed in. Please log in again.");
      }

      if (!response.ok) {
        if (response.status === 404 && i < candidateBases.length - 1) {
          if (base === detectedApiBase) detectedApiBase = null;
          continue;
        }
        throw new Error(result.error || `Server error (${response.status})`);
      }

      detectedApiBase = base;
      if (typeof onResponse === "function") onResponse(response, base);
      return result;
    } catch (err) {
      lastError = err;
      if (base === detectedApiBase) detectedApiBase = null;
      if (
        i < candidateBases.length - 1 &&
        (err.name === "TypeError" ||
         err.message.includes("404") ||
         err.message.includes("fetch") ||
         err.message.includes("NetworkError") ||
         err.message.includes("Failed to fetch"))
      ) {
        continue;
      }
    }
  }

  throw lastError || new Error("The server request failed.");
}
