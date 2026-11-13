(() => {
  "use strict";

  const screens = {
    menu: document.getElementById("menuScreen"),
    workspace: document.getElementById("workspaceScreen"),
    settings: document.getElementById("settingsScreen")
  };
  let currentScreen = "menu";
  let returnScreen = "menu";
  let toastTimer = 0;

  function showScreen(name) {
    if (!screens[name]) return;
    Object.entries(screens).forEach(([key, screen]) => {
      const visible = key === name;
      screen.classList.toggle("active", visible);
      screen.setAttribute("aria-hidden", String(!visible));
    });
    currentScreen = name;
  }

  function openSettings() {
    if (currentScreen !== "settings") returnScreen = currentScreen;
    showScreen("settings");
  }

  function notify(message) {
    const region = document.getElementById("toastRegion");
    if (!region) return;
    region.replaceChildren();
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    region.appendChild(toast);
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.remove(), 2800);
  }

  document.addEventListener("click", (event) => {
    const nav = event.target.closest("[data-nav]");
    if (nav) {
      const destination = nav.dataset.nav;
      if (destination === "settings") openSettings();
      else if (destination === "back") showScreen(returnScreen);
      else if (destination === "workspace" || destination === "menu") showScreen(destination);
      return;
    }

    const tab = event.target.closest("[data-tab]");
    if (tab) {
      const target = tab.dataset.tab;
      document.querySelectorAll("[data-tab]").forEach((button) => {
        const active = button.dataset.tab === target;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", String(active));
      });
      document.querySelectorAll("[data-panel]").forEach((panel) => {
        const active = panel.dataset.panel === target;
        panel.classList.toggle("active", active);
        panel.hidden = !active;
      });
      return;
    }

    const tool = event.target.closest("[data-tool]");
    if (tool) {
      document.querySelectorAll("[data-tool]").forEach((button) => {
        const selected = button === tool;
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
      notify(tool.dataset.tool + " tool selected. Tool behaviour will be added with the simulation engine.");
      return;
    }

    const scene = event.target.closest("[data-scene]");
    if (scene) {
      document.querySelectorAll("[data-scene]").forEach((button) => button.classList.toggle("current", button === scene));
      notify(scene.dataset.scene + " selected in the scene list.");
      return;
    }

    const toggle = event.target.closest("[data-switch]");
    if (toggle) {
      const enabled = toggle.getAttribute("aria-checked") !== "true";
      toggle.setAttribute("aria-checked", String(enabled));
      toggle.classList.toggle("on", enabled);
      const label = toggle.querySelector("b");
      if (label) label.textContent = enabled ? (toggle.dataset.mode || "On") : "Off";
      return;
    }

    const choice = event.target.closest("[data-choice]");
    if (choice) {
      document.querySelectorAll('[data-choice="' + choice.dataset.choice + '"]').forEach((button) => {
        const selected = button === choice;
        button.classList.toggle("chosen", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
      return;
    }

    const action = event.target.closest("[data-action]");
    if (action) {
      if (action.dataset.action === "about") {
        const dialog = document.getElementById("aboutDialog");
        if (dialog && typeof dialog.showModal === "function") dialog.showModal();
        else notify("FrameLabs 3 — 2D Structural Lab / Version 0.4.0");
      } else if (action.dataset.action === "reset-view") {
        notify("Viewport layout reset. Scene controls are a UI preview.");
      } else if (action.dataset.action === "workspace-info") {
        notify("This browser page is a preview. The native Windows game contains the 2D structural simulation.");
      }
    }
  });

  document.querySelectorAll("[data-range]").forEach((range) => {
    const output = document.querySelector('[data-output="' + range.dataset.range + '"]');
    const update = () => {
      const min = Number(range.min || 0);
      const max = Number(range.max || 100);
      const value = Number(range.value);
      const fill = ((value - min) / (max - min)) * 100;
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
    if (currentScreen !== "workspace" || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target;
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
    const shortcutTools = { v: "Select", g: "Move", p: "Place", i: "Inspect" };
    const toolName = shortcutTools[event.key.toLowerCase()];
    if (!toolName) return;
    const button = document.querySelector('[data-tool="' + toolName + '"]');
    if (button) button.click();
  });

  // UI-only prototype: no physics, rendering backend, simulation, or hardware control.
  showScreen("menu");
})();
