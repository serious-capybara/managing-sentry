// login, menu, drawer, logout and set capital events

import { state, saveSession, clearSession } from "../state.js";
import { toast } from "../utils.js";
import { apiRequest, setAuthView } from "../api.js";
import { loadDashboardData } from "../data-loader.js";
import { startLiveSync } from "../live-sync.js";
import { kickSaleQueue } from "../sale-queue.js";
import { updateStats } from "../stock-logic.js";
import { renderPage } from "../router.js";
import { openSetCapitalModal } from "../modals/capital-modal.js";
import { askYesNo } from "../modals/dialogs.js";

export function bindSidebarEvents() {
  // phone / tablet menu drawer
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

  // desktop menu collapse
  const sidebarBrandToggle = document.getElementById("sidebarBrandToggle");
  const sidebarCollapseBtn = document.getElementById("sidebarCollapseBtn");

  const toggleSidebarCollapse = (e) => {
    if (e) e.stopPropagation();
    const isCollapsed = sidebar?.classList.toggle("collapsed");
    mainContent?.classList.toggle("collapsed-sidebar", isCollapsed);
    localStorage.setItem("sentrySidebarCollapsed", isCollapsed ? "true" : "false");
  };

  // open menu: only the collapse button closes it
  sidebarCollapseBtn?.addEventListener("click", toggleSidebarCollapse);

  // collapsed menu: the logo opens it again
  sidebarBrandToggle?.addEventListener("click", (e) => {
    if (sidebar?.classList.contains("collapsed")) {
      toggleSidebarCollapse(e);
    }
  });

  // remember the collapsed state
  if (localStorage.getItem("sentrySidebarCollapsed") === "true") {
    sidebar?.classList.add("collapsed");
    mainContent?.classList.add("collapsed-sidebar");
  }

  // login
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async e => {
      e.preventDefault();
      const usernameInput = document.getElementById("username");
      const passwordInput = document.getElementById("password");
      const username = usernameInput?.value?.trim() || "admin";
      const password = passwordInput?.value || "";
      const message = document.getElementById("loginMessage");

      if (message) message.textContent = "Signing in…";
      try {
        // A real server login is required. (There used to be an "offline fallback" that let ANY
        // password in when the server was unreachable - that hid the real problem and left every
        // page empty because no server session existed.)
        const user = await apiRequest("login.php", {
          method: "POST",
          body: JSON.stringify({ username, password })
        });

        saveSession(username || "admin", user?.full_name || user?.username || username || "admin");

        try {
          await loadDashboardData();
        } catch (dataErr) {
          console.warn("Could not sync dashboard data during login:", dataErr);
        }

        if (state.authFailed) {
          clearSession();
          throw new Error("Signed in, but the browser did not keep the server session (cookie blocked). Please try again or contact the administrator.");
        }

        if (message) message.textContent = "";

        setAuthView(true);
        renderPage("dashboard");
        kickSaleQueue();
        startLiveSync();
      } catch (error) {
        if (message) message.textContent = error.message;
      }
    });
  }

  // show / hide password
  const showPassword = document.getElementById("showPassword");
  if (showPassword) {
    showPassword.addEventListener("click", e => {
      const input = document.getElementById("password");
      if (!input) return;
      input.type = input.type === "password" ? "text" : "password";
      e.target.textContent = input.type === "password" ? "Show" : "Hide";
    });
  }

  // menu items
  document.querySelectorAll(".nav-item[data-page]").forEach(btn => {
    btn.addEventListener("click", () => {
      // Show the click right away (highlight + close the drawer), then build the page
      // on the next frame so the screen never waits for the page to be drawn.
      const page = btn.dataset.page;
      document.querySelectorAll(".nav-item, .nav-sub").forEach(item => {
        item.classList.toggle("active", item.dataset.page === page);
      });
      if (window.innerWidth <= 1024) closeMobileSidebar();
      requestAnimationFrame(() => setTimeout(() => renderPage(page), 0));
    });
  });

  // logout (asks first)
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
      setAuthView(false);
      closeMobileSidebar();
    });
  }

  // set capital button
  const setCapitalBtn = document.getElementById("setCapitalBtn");
  if (setCapitalBtn) {
    setCapitalBtn.addEventListener("click", () => {
      openSetCapitalModal();
    });
  }
}
