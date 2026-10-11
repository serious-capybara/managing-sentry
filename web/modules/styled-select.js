const SELECTOR = ".styled-select-native";

function closeSelect(wrapper, returnFocus = false) {
  const trigger = wrapper.querySelector(".styled-select-trigger");
  const menu = wrapper.querySelector(".styled-select-menu");
  if (!trigger || !menu || menu.hidden) return;

  menu.hidden = true;
  trigger.setAttribute("aria-expanded", "false");
  wrapper.classList.remove("is-open");
  if (returnFocus) trigger.focus();
}

function closeOtherSelects(except) {
  document.querySelectorAll(".styled-select.is-open").forEach(wrapper => {
    if (wrapper !== except) closeSelect(wrapper);
  });
}

function focusOption(menu, index) {
  const options = [...menu.querySelectorAll('[role="option"]:not([aria-disabled="true"])')];
  if (!options.length) return;
  options[Math.max(0, Math.min(index, options.length - 1))].focus();
}

export function bindStyledSelect(select) {
  if (!select || select.dataset.styledBound === "true") return;
  select.dataset.styledBound = "true";

  const wrapper = document.createElement("div");
  wrapper.className = "styled-select";
  select.parentNode.insertBefore(wrapper, select);
  wrapper.appendChild(select);

  select.classList.add("styled-select-native");
  select.tabIndex = -1;
  select.setAttribute("aria-hidden", "true");

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "styled-select-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-label", select.getAttribute("aria-label") || select.id);

  const menu = document.createElement("div");
  menu.className = "styled-select-menu";
  menu.id = `${select.id}-options`;
  menu.setAttribute("role", "listbox");
  menu.hidden = true;
  trigger.setAttribute("aria-controls", menu.id);

  const syncSelection = () => {
    const selectedOption = select.options[select.selectedIndex];
    trigger.textContent = selectedOption?.textContent?.trim() || "";
    menu.querySelectorAll('[role="option"]').forEach(option => {
      const selected = option.dataset.value === select.value;
      option.setAttribute("aria-selected", String(selected));
      option.classList.toggle("is-selected", selected);
    });
  };

  [...select.options].forEach(option => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "styled-select-option";
    item.setAttribute("role", "option");
    item.dataset.value = option.value;
    item.textContent = option.textContent.trim();
    item.setAttribute("aria-selected", String(option.selected));
    if (option.disabled) {
      item.disabled = true;
      item.setAttribute("aria-disabled", "true");
    }
    item.addEventListener("click", () => {
      select.value = option.value;
      syncSelection();
      closeSelect(wrapper, true);
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    menu.appendChild(item);
  });

  trigger.addEventListener("click", () => {
    const willOpen = menu.hidden;
    closeOtherSelects(wrapper);
    menu.hidden = !willOpen;
    trigger.setAttribute("aria-expanded", String(willOpen));
    wrapper.classList.toggle("is-open", willOpen);
    if (willOpen) {
      const selectedIndex = [...menu.querySelectorAll('[role="option"]')]
        .findIndex(option => option.getAttribute("aria-selected") === "true");
      focusOption(menu, selectedIndex);
    }
  });

  trigger.addEventListener("keydown", event => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (menu.hidden) {
        trigger.click();
        if (event.key === "ArrowUp") focusOption(menu, menu.children.length - 1);
      } else {
        focusOption(menu, event.key === "ArrowUp" ? menu.children.length - 1 : 0);
      }
    }
  });

  menu.addEventListener("keydown", event => {
    const options = [...menu.querySelectorAll('[role="option"]:not([aria-disabled="true"])')];
    const currentIndex = options.indexOf(document.activeElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(menu, currentIndex + (event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      focusOption(menu, event.key === "Home" ? 0 : options.length - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeSelect(wrapper, true);
    } else if (event.key === "Tab") {
      closeSelect(wrapper);
    }
  });

  select.addEventListener("change", syncSelection);
  wrapper.append(trigger, menu);
  syncSelection();
}

export function bindStyledSelects(container) {
  container.querySelectorAll(SELECTOR).forEach(bindStyledSelect);
}

document.addEventListener("click", event => {
  if (event.target instanceof Element && !event.target.closest(".styled-select")) {
    closeOtherSelects(null);
  }
});
