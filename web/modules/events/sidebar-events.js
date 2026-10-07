/* ============================================================
 * events/sidebar-events.js — Sidebar, navigation, mobile drawer, and auth events.
 * Binds login form, navigation buttons, logout confirmation, set capital modal,
 * mobile menu toggle, collapse toggle, and database reset confirmation actions.
 * ============================================================ */

import { state, saveSession, clearSession } from "../state.js";
import { toast } from "../utils.js";
import { apiRequest } from "../api.js";
import { loadDashboardData } from "../data-loader.js";
import { updateStats } from "../stock-logic.js";
import { renderPage } from "../router.js";
import { openSetCapitalModal } from "../modals/capital-modal.js";
import { askYesNo } from "../modals/dialogs.js";

export function bindSidebarEvents() {
  const loginScreen = document.getElementById("loginScreen");
  const app = document.getElementById("app");

  // Mobile navigation drawer controls
  const mobileMenuToggle = document.getElementById("mobileMenuToggle");
  const sidebar = document.getElementById("sidebar") || document.querySelector(".sidebar");
  const sidebarBackdrop = document.getElementById("sidebarBackdrop");
  const mainContent = document.getElementById("mainContent") || document.querySelector(".main");

  const closeMobileSidebar = () => {
    sidebar?.classList.remove("open");
    sidebarBackdrop?.classList.remove("show");
  };

  const toggleMobileSidebar = () => {
    const isOpen = sidebar?.classList.contains("open");
    if (isOpen) {
      closeMobileSidebar();
    } else {
      sidebar?.classList.add("open");
      sidebarBackdrop?.classList.add("show");
    }
  };

  mobileMenuToggle?.addEventListener("click", toggleMobileSidebar);
  sidebarBackdrop?.addEventListener("click", closeMobileSidebar);

  const mobileViewport = window.matchMedia("(max-width: 1024px)");
  const onViewportChange = () => {
    if (!mobileViewport.matches) closeMobileSidebar();
  };
  if (mobileViewport.addEventListener) {
    mobileViewport.addEventListener("change", onViewportChange);
  } else {
    mobileViewport.addListener(onViewportChange);
  }

  // Desktop sidebar collapse/expand toggle
  const sidebarBrandToggle = document.getElementById("sidebarBrandToggle");
  const sidebarCollapseBtn = document.getElementById("sidebarCollapseBtn");

  const toggleSidebarCollapse = (e) => {
    if (e) e.stopPropagation();
    const isCollapsed = sidebar?.classList.toggle("collapsed");
    mainContent?.classList.toggle("collapsed-sidebar", isCollapsed);
    localStorage.setItem("sentrySidebarCollapsed", isCollapsed ? "true" : "false");
  };

  // In full view, ONLY the collapse button (dashboard-left icon) collapses the menu
  sidebarCollapseBtn?.addEventListener("click", toggleSidebarCollapse);

  // In collapsed view ONLY, clicking the logo container expands the menu back
  sidebarBrandToggle?.addEventListener("click", (e) => {
    if (sidebar?.classList.contains("collapsed")) {
      toggleSidebarCollapse(e);
    }
  });

  // Restore sidebar collapse state from localStorage on load
  if (localStorage.getItem("sentrySidebarCollapsed") === "true") {
    sidebar?.classList.add("collapsed");
    mainContent?.classList.add("collapsed-sidebar");
  }

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
        const user = await apiRequest("login.php", {
          method: "POST",
          body: JSON.stringify({ username, password })
        });
        saveSession(username || "admin", user.full_name || username || "admin");
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
    btn.addEventListener("click", () => {
      renderPage(btn.dataset.page);
      if (window.innerWidth <= 1024) closeMobileSidebar();
    });
  });

  // Logout action with confirmation dialog modal
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      const confirmed = await askYesNo("Are you sure you want to log out of Managing Sentry?", {
        title: "Confirm Logout",
        yesText: "Log Out",
        noText: "Cancel"
      });
      if (!confirmed) return;

      clearSession();
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
      closeMobileSidebar();
    });
  }

  // Set capital button (opens set capital modal)
  const setCapitalBtn = document.getElementById("setCapitalBtn");
  if (setCapitalBtn) {
    setCapitalBtn.addEventListener("click", () => {
      openSetCapitalModal();
    });
  }
}
