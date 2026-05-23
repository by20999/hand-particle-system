import * as THREE from "three";
import createElement from "lucide/dist/esm/createElement.mjs";
import Eye from "lucide/dist/esm/icons/eye.mjs";
import EyeOff from "lucide/dist/esm/icons/eye-off.mjs";
import Maximize2 from "lucide/dist/esm/icons/maximize-2.mjs";
import Minimize2 from "lucide/dist/esm/icons/minimize-2.mjs";
import PanelLeftClose from "lucide/dist/esm/icons/panel-left-close.mjs";
import PanelLeftOpen from "lucide/dist/esm/icons/panel-left-open.mjs";
import { THEMES } from "./themes.js";

export function createUI() {
  const refs = {
    canvas: document.querySelector("#scene"),
    video: document.querySelector("#camera"),
    panel: document.querySelector("#controlPanel"),
    panelBody: document.querySelector("#panelBody"),
    panelToggleBtn: document.querySelector("#panelToggleBtn"),
    panelHideBtn: document.querySelector("#panelHideBtn"),
    panelRestoreBtn: document.querySelector("#panelRestoreBtn"),
    shapeSelect: document.querySelector("#shapeSelect"),
    colorPicker: document.querySelector("#colorPicker"),
    fullscreenBtn: document.querySelector("#fullscreenBtn"),
    statusText: document.querySelector("#statusText"),
    diagnosticText: document.querySelector("#diagnosticText"),
    cameraStatus: document.querySelector("#cameraStatus"),
    gestureMeter: document.querySelector("#gestureMeter"),
    gestureValue: document.querySelector("#gestureValue"),
    panelScale: document.querySelector("#panelScale"),
    panelScaleValue: document.querySelector("#panelScaleValue"),
    qualityValue: document.querySelector("#qualityValue"),
    performanceValue: document.querySelector("#performanceValue"),
    sensitivity: document.querySelector("#sensitivity"),
    sensitivityValue: document.querySelector("#sensitivityValue"),
    themeButtons: [...document.querySelectorAll("[data-theme]")],
  };

  initIcons(refs);
  initThemeButtons(refs);
  initPanelScale(refs);
  initPanelCollapse(refs);
  initPanelVisibility(refs);
  initSensitivity(refs);

  return {
    refs,
    setStatus: (text, status) => setStatus(refs, text, status),
    setDiagnostic: (text) => setDiagnostic(refs, text),
    setQuality: (profile) => setQuality(refs, profile),
    setThemeActive: (themeId) => setThemeActive(refs, themeId),
    getThemeId: () => safeReadStorage("themeId") ?? "neon",
    saveThemeId: (themeId) => safeWriteStorage("themeId", themeId),
    getSensitivity: () => Number(refs.sensitivity.value) / 100,
    updateSensitivityLabel: () => updateSensitivityLabel(refs),
    updatePerformance: (stats) => updatePerformance(refs, stats),
    setFullscreenActive: (active) => renderIcon(refs.fullscreenBtn, active ? Minimize2 : Maximize2),
    updateGestureMeter: (percent) => updateGestureMeter(refs, percent),
  };
}

function initIcons(refs) {
  renderIcon(refs.panelHideBtn, EyeOff);
  renderIcon(refs.panelRestoreBtn, Eye);
  renderIcon(refs.panelToggleBtn, PanelLeftClose);
  renderIcon(refs.fullscreenBtn, Maximize2);
}

function initThemeButtons(refs) {
  for (const button of refs.themeButtons) {
    const theme = THEMES.find((item) => item.id === button.dataset.theme);
    if (!theme) continue;
    button.style.setProperty("--swatch-primary", theme.primary);
    button.style.setProperty("--swatch-secondary", theme.accent);
  }
}

function initPanelScale(refs) {
  const saved = safeReadStorage("panelScale");
  const defaultScale = window.matchMedia("(max-width: 680px)").matches ? 86 : 100;
  const scale = Number.isFinite(Number(saved)) && Number(saved) > 0 ? Number(saved) : defaultScale;
  applyPanelScale(refs, scale, false);

  refs.panelScale?.addEventListener("input", () => {
    applyPanelScale(refs, Number(refs.panelScale.value), true);
  });
}

function applyPanelScale(refs, value, shouldSave) {
  const scale = THREE.MathUtils.clamp(value, 78, 108);
  document.documentElement.style.setProperty("--panel-scale", `${scale / 100}`);
  refs.panelScale.value = String(scale);
  refs.panelScaleValue.textContent = `${Math.round(scale)}%`;

  if (shouldSave) {
    safeWriteStorage("panelScale", String(scale));
  }
}

function initPanelCollapse(refs) {
  const mobileQuery = window.matchMedia("(max-width: 680px)");
  const saved = safeReadStorage("panelCollapsed");
  const shouldCollapse = saved === null ? mobileQuery.matches : saved === "1";
  setPanelCollapsed(refs, shouldCollapse);

  refs.panelToggleBtn?.addEventListener("click", () => {
    const collapsed = !refs.panel.classList.contains("is-collapsed");
    setPanelCollapsed(refs, collapsed);
    safeWriteStorage("panelCollapsed", collapsed ? "1" : "0");
  });

  mobileQuery.addEventListener?.("change", (event) => {
    if (safeReadStorage("panelCollapsed") === null) {
      setPanelCollapsed(refs, event.matches);
    }
  });
}

function setPanelCollapsed(refs, collapsed) {
  refs.panel?.classList.toggle("is-collapsed", collapsed);
  refs.panelToggleBtn?.setAttribute("aria-expanded", String(!collapsed));
  refs.panelToggleBtn?.setAttribute("title", collapsed ? "展开面板" : "收起面板");
  renderIcon(refs.panelToggleBtn, collapsed ? PanelLeftOpen : PanelLeftClose);
}

function initPanelVisibility(refs) {
  refs.panelHideBtn?.addEventListener("click", () => {
    refs.panel.classList.add("is-hidden");
    refs.panelRestoreBtn.hidden = false;
  });

  refs.panelRestoreBtn?.addEventListener("click", () => {
    refs.panel.classList.remove("is-hidden");
    refs.panelRestoreBtn.hidden = true;
  });
}

function initSensitivity(refs) {
  const saved = Number(safeReadStorage("gestureSensitivity"));
  const value = Number.isFinite(saved) && saved >= 70 && saved <= 140 ? saved : 100;
  refs.sensitivity.value = String(value);
  updateSensitivityLabel(refs);

  refs.sensitivity?.addEventListener("input", () => {
    updateSensitivityLabel(refs);
    safeWriteStorage("gestureSensitivity", refs.sensitivity.value);
  });
}

function updateSensitivityLabel(refs) {
  refs.sensitivityValue.textContent = `${Math.round(Number(refs.sensitivity.value))}%`;
}

function setStatus(refs, text, status) {
  refs.statusText.textContent = text;
  refs.cameraStatus.className = `status-dot ${status}`;
}

function setDiagnostic(refs, text) {
  if (refs.diagnosticText) {
    refs.diagnosticText.textContent = text;
  }
}

function setQuality(refs, profile) {
  if (refs.qualityValue) {
    refs.qualityValue.textContent = `${profile.label} · ${Math.round(profile.particleCount / 1000)}k`;
  }
}

function setThemeActive(refs, themeId) {
  for (const button of refs.themeButtons) {
    button.classList.toggle("is-active", button.dataset.theme === themeId);
  }
}

function updatePerformance(refs, stats) {
  if (!refs.performanceValue) return;
  const fpsText = stats.fpsLabel ?? `${stats.fps} FPS`;
  refs.performanceValue.textContent = `${fpsText} · ${Math.round(stats.particleCount / 1000)}k 粒子`;
}

function updateGestureMeter(refs, percent) {
  refs.gestureMeter.style.width = `${percent}%`;
  refs.gestureValue.textContent = `${percent}%`;
}

function safeReadStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWriteStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Local storage can be unavailable in strict privacy modes.
  }
}

function renderIcon(target, iconNode) {
  if (!target) return;
  const slot = target.querySelector("[aria-hidden='true']") ?? target;
  const icon = createElement(iconNode, {
    width: 18,
    height: 18,
    "aria-hidden": "true",
    focusable: "false",
  });
  slot.replaceChildren(icon);
}
