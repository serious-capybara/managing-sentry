/* ============================================================
 * api.js — Centralised HTTP helper for all backend calls.
 * Attempts multiple base paths so the app works whether served
 * from a sub-directory or the root.
 * ============================================================ */

export const API_BASE = "../backend/web/api";

let detectedApiBase = null;

const CANDIDATE_BASES = [
  "../backend/web/api",
  "backend/web/api",
  "/backend/web/api",
  "./backend/web/api"
];

/**
 * Fetch a backend PHP endpoint, automatically detecting the
 * working base path on first success and reusing it thereafter.
 *
 * @param {string} endpoint  - e.g. "products.php" or "login.php?action=logout"
 * @param {RequestInit} options - standard fetch options
 * @returns {Promise<any>}   Parsed JSON response body
 */
export async function apiRequest(endpoint, options = {}) {
  const cleanEndpoint = endpoint.replace(/^\/+/, "");
  const candidateBases = detectedApiBase
    ? [detectedApiBase]
    : CANDIDATE_BASES;

  let lastError = null;

  for (let i = 0; i < candidateBases.length; i++) {
    const base = candidateBases[i];
    const url = `${base}/${cleanEndpoint}`;
    try {
      const response = await fetch(url, {
        ...options,
        headers: { "Content-Type": "application/json", ...(options.headers || {}) }
      });

      const rawText = await response.text();
      let result = null;

      try {
        result = rawText ? JSON.parse(rawText) : {};
      } catch (jsonErr) {
        if (response.status === 404 && i < candidateBases.length - 1) {
          continue;
        }
        if (!response.ok) {
          throw new Error(`Server returned status ${response.status} (${response.statusText})`);
        }
        throw new Error("Invalid response from server (expected JSON).");
      }

      if (!response.ok) {
        throw new Error(result.error || result.message || `Server error (${response.status})`);
      }

      detectedApiBase = base;
      return result;
    } catch (err) {
      lastError = err;
      if (
        i < candidateBases.length - 1 &&
        (err.message.includes("404") || err.message.includes("Failed to fetch"))
      ) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error("The server request failed.");
}
