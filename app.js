(() => {
  "use strict";

  function init() {
    const screens = {
      menu: document.getElementById("menuScreen"),
      workspace: document.getElementById("workspaceScreen"),
      settings: document.getElementById("settingsScreen")
    };

    const missingScreens = Object.entries(screens)
      .filter(([, screen]) => !screen)
      .map(([name]) => name);

    if (missingScreens.length) {
      console.error("FrameLabs 3 is missing required screen elements:", missingScreens);
      return;
    }

    let currentScreen = "menu";
    let returnScreen = "menu";
    let toastTimer = 0;

    function notify(message) {
      const region = document.getElementById("toastRegion");
      if (!region) {
        console.info(message);
        return;
      }

      region.replaceChildren();
      const toast = document.createElement("div");
      toast.className = "toast";
      toast.textContent = message;
      region.appendChild(toast);

      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => toast.remove(), 2800);
    }

    function showScreen(name) {
      if (!Object.prototype.hasOwnProperty.call(screens, name)) {
        console.warn("Unknown FrameLabs 3 screen:", name);
        notify("That screen is not available.");
        return false;
      }

      Object.entries(screens).forEach(([key, screen]) => {
        const visible = key === name;
        screen.classList.toggle("active", visible);
        screen.hidden = !visible;
        screen.inert = !visible;
        screen.setAttribute("aria-hidden", String(!visible));
      });

      currentScreen = name;
      return true;
    }

    function openSettings() {
      if (currentScreen !== "settings") {
        returnScreen = currentScreen;
      }
      showScreen("settings");
    }

    function bindClick(selector, handler) {
      document.querySelectorAll(selector).forEach((element) => {
        element.addEventListener("click", (event) => handler(event, element));
      });
    }

    // Bind navigation directly to each control. This avoids relying on the
    // clicked child element bubbling through a delegated selector.
    bindClick("[data-nav]", (event, button) => {
      event.preventDefault();

      switch (button.dataset.nav) {
        case "workspace":
          showScreen("workspace");
          break;
        case "settings":
          openSettings();
          break;
        case "menu":
          showScreen("menu");
          break;
        case "back":
          showScreen(returnScreen);
          break;
        default:
          notify("That navigation destination is not available.");
      }
    });

    bindClick("[data-tab]", (event, tab) => {
      event.preventDefault();
      const target = tab.dataset.tab;
      const targetPanel = document.querySelector('[data-panel="' + target + '"]');

      if (!targetPanel) {
        notify("That settings panel is not available.");
        return;
      }

      document.querySelectorAll("[data-tab]").forEach((button) => {
        const active = button === tab;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", String(active));
        button.tabIndex = active ? 0 : -1;
      });

      document.querySelectorAll("[data-panel]").forEach((panel) => {
        const active = panel === targetPanel;
        panel.classList.toggle("active", active);
        panel.hidden = !active;
      });
    });

    bindClick("[data-tool]", (event, tool) => {
      event.preventDefault();
      document.querySelectorAll("[data-tool]").forEach((button) => {
        const selected = button === tool;
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
      notify(tool.dataset.tool + " tool selected. Tool behaviour will be added with the simulation engine.");
    });

    bindClick("[data-scene]", (event, scene) => {
      event.preventDefault();
      document.querySelectorAll("[data-scene]").forEach((button) => {
        button.classList.toggle("current", button === scene);
      });
      notify(scene.dataset.scene + " selected in the scene list.");
    });

    bindClick("[data-switch]", (event, toggle) => {
      event.preventDefault();
      const enabled = toggle.getAttribute("aria-checked") !== "true";
      toggle.setAttribute("aria-checked", String(enabled));
      toggle.classList.toggle("on", enabled);

      const label = toggle.querySelector("b");
      if (label) {
        label.textContent = enabled
          ? (toggle.dataset.mode || "On")
          : "Off";
      }
    });

    bindClick("[data-choice]", (event, choice) => {
      event.preventDefault();
      document.querySelectorAll('[data-choice="' + choice.dataset.choice + '"]').forEach((button) => {
        const selected = button === choice;
        button.classList.toggle("chosen", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
    });

    bindClick("[data-action]", (event, action) => {
      event.preventDefault();

      switch (action.dataset.action) {
        case "about": {
          const dialog = document.getElementById("aboutDialog");
          if (dialog && typeof dialog.showModal === "function") {
            dialog.showModal();
          } else {
            notify("FrameLabs 3 — 2D Structural Lab / UI preview");
          }
          break;
        }
        case "reset-view":
          notify("Viewport layout reset. Scene controls are a UI preview.");
          break;
        case "workspace-info":
          notify("This browser page is a preview. The native Windows game contains the 2D structural simulation.");
          break;
        default:
          notify("That action is not available yet.");
      }
    });

    document.querySelectorAll("[data-range]").forEach((range) => {
      const output = document.querySelector('[data-output="' + range.dataset.range + '"]');

      const update = () => {
        const min = Number(range.min || 0);
        const max = Number(range.max || 100);
        const value = Number(range.value);
        const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;

        range.style.setProperty("--fill", fill + "%");
        if (output) output.textContent = value + "%";
      };

      range.addEventListener("input", update);
      update();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && currentScreen === "workspace") {
        showScreen("menu");
        return;
      }

      if (event.key === "Escape" && currentScreen === "settings") {
        showScreen(returnScreen);
        return;
      }

      if (currentScreen !== "workspace" || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      const target = event.target;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) {
        return;
      }

      const shortcutTools = { v: "Select", g: "Move", p: "Place", i: "Inspect" };
      const toolName = shortcutTools[event.key.toLowerCase()];
      if (!toolName) return;

      const button = document.querySelector('[data-tool="' + toolName + '"]');
      if (button) button.click();
    });

    showScreen("menu");
  }

  // Support both the normal deferred script load and any future non-deferred
  // embedding of this file.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
