/* ============================================================
 * events/sidebar-events.js — Sidebar, navigation, and auth events.
 * Binds login form, navigation buttons, logout, set capital,
 * and database reset actions.
 * ============================================================ */

import { state } from "../state.js";
import { toast, money } from "../utils.js";
import { apiRequest } from "../api.js";
import { loadDashboardData } from "../data-loader.js";
import { updateStats } from "../stock-logic.js";
import { renderPage } from "../router.js";

export function bindSidebarEvents() {
  const loginScreen = document.getElementById("loginScreen");
  const app = document.getElementById("app");

  // Login form submit
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async e => {
      e.preventDefault();
      const username = document.getElementById("username")?.value.trim();
      const password = document.getElementById("password")?.value;
      const message = document.getElementById("loginMessage");

      if (message) message.textContent = "Signing in…";
      try {
        await apiRequest("login.php", {
          method: "POST",
          body: JSON.stringify({ username, password })
        });
        await loadDashboardData();
        if (message) message.textContent = "";
        if (loginScreen) loginScreen.classList.add("hidden");
        if (app) app.classList.remove("hidden");
        renderPage("dashboard");
      } catch (error) {
        if (message) message.textContent = error.message;
      }
    });
  }

  // Password visibility toggle
  const showPassword = document.getElementById("showPassword");
  if (showPassword) {
    showPassword.addEventListener("click", e => {
      const input = document.getElementById("password");
      if (!input) return;
      input.type = input.type === "password" ? "text" : "password";
      e.target.textContent = input.type === "password" ? "Show" : "Hide";
    });
  }

  // Primary navigation items
  document.querySelectorAll(".nav-item[data-page]").forEach(btn => {
    btn.addEventListener("click", () => renderPage(btn.dataset.page));
  });

  // Submenu navigation items
  document.querySelectorAll(".nav-sub[data-page]").forEach(btn => {
    btn.addEventListener("click", () => renderPage(btn.dataset.page));
  });

  // Expandable navigation group dropdown toggle
  document.querySelectorAll(".nav-parent").forEach(btn => {
    btn.addEventListener("click", () => btn.closest(".nav-group")?.classList.toggle("open"));
  });

  // Logout action
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await apiRequest("login.php?action=logout", {
          method: "POST",
          body: "{}"
        });
      } catch (error) {
        toast(`Could not confirm server sign-out: ${error.message}`);
      }
      if (app) app.classList.add("hidden");
      if (loginScreen) loginScreen.classList.remove("hidden");
      loginForm?.reset();
    });
  }

  // Set capital button
  const setCapitalBtn = document.getElementById("setCapitalBtn");
  if (setCapitalBtn) {
    setCapitalBtn.addEventListener("click", async () => {
      const value = prompt("Enter your new capital amount:", state.capital);
      if (value !== null && !isNaN(value) && Number(value) >= 0) {
        try {
          const result = await apiRequest("capital.php", {
            method: "POST",
            body: JSON.stringify({ capital: Number(value) })
          });
          state.capital = Number(result.capital);
          updateStats();
          toast("Capital updated successfully.");
        } catch (error) {
          toast(`Could not save capital: ${error.message}`);
        }
      }
    });
  }

  // Reset database data button
  const resetDataBtn = document.getElementById("resetDataBtn");
  if (resetDataBtn) {
    resetDataBtn.addEventListener("click", async () => {
      if (!confirm("This permanently clears database sales/history and archives all products. Continue?")) return;
      try {
        await apiRequest("reset.php", { method: "POST", body: "{}" });
        state.cart = [];
        await loadDashboardData();
        renderPage("dashboard");
        toast("Database data has been reset.");
      } catch (error) {
        toast(`Could not reset database data: ${error.message}`);
      }
    });
  }
}
