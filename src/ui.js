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
    modelButtons: [...document.querySelectorAll("[data-model]")],
    textInput: document.querySelector("#textInput"),
    textApplyBtn: document.querySelector("#textApplyBtn"),
    textFontSelect: document.querySelector("#textFontSelect"),
    themeSelect: document.querySelector("#themeSelect"),
    gestureToggleBtn: document.querySelector("#gestureToggleBtn"),
    freezeToggleBtn: document.querySelector("#freezeToggleBtn"),
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
    backgroundButtons: [...document.querySelectorAll("[data-background]")],
    micToggleBtn: document.querySelector("#micToggleBtn"),
    audioFileInput: document.querySelector("#audioFileInput"),
    imageFileInput: document.querySelector("#imageFileInput"),
    meshFileInput: document.querySelector("#meshFileInput"),
    imageContour: document.querySelector("#imageContour"),
    imageContourValue: document.querySelector("#imageContourValue"),
    imageColorMode: document.querySelector("#imageColorMode"),
    imageMonoColor: document.querySelector("#imageMonoColor"),
    imageAlpha: document.querySelector("#imageAlpha"),
    imageAlphaValue: document.querySelector("#imageAlphaValue"),
    imageLogoMode: document.querySelector("#imageLogoMode"),
    imageInteriorRatio: document.querySelector("#imageInteriorRatio"),
    imageInteriorRatioValue: document.querySelector("#imageInteriorRatioValue"),
    audioStopBtn: document.querySelector("#audioStopBtn"),
    audioValue: document.querySelector("#audioValue"),
    audioSpectrum: document.querySelector("#audioSpectrum"),
  };

  initIcons(refs);
  initThemeButtons(refs);
  initPanelScale(refs);
  initPanelCollapse(refs);
  initPanelVisibility(refs);
  initSensitivity(refs);
  initTextFont(refs);
  initImageOptions(refs);
  initAudioSpectrum(refs);

  return {
    refs,
    setStatus: (text, status) => setStatus(refs, text, status),
    setDiagnostic: (text) => setDiagnostic(refs, text),
    setQuality: (profile) => setQuality(refs, profile),
    setThemeActive: (themeId) => setThemeActive(refs, themeId),
    setGestureControlActive: (active) => setGestureControlActive(refs, active),
    setFreezeActive: (active) => setFreezeActive(refs, active),
    setBackgroundActive: (mode) => setBackgroundActive(refs, mode),
    getBackgroundMode: () => safeReadStorage("backgroundMode") ?? "nebula",
    saveBackgroundMode: (mode) => safeWriteStorage("backgroundMode", mode),
    setModelActive: (model) => setModelActive(refs, model),
    getThemeId: () => safeReadStorage("themeId") ?? "neon",
    saveThemeId: (themeId) => safeWriteStorage("themeId", themeId),
    getCustomText: () => normalizeCustomText(refs.textInput.value),
    getTextFontId: () => refs.textFontSelect?.value ?? "modern",
    getImageOptions: () => getImageOptions(refs),
    setAudioActive: (mode) => setAudioActive(refs, mode),
    updateAudioLevel: (level) => updateAudioLevel(refs, level),
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
  if (refs.themeSelect) {
    refs.themeSelect.replaceChildren(
      ...THEMES.map((theme) => {
        const option = document.createElement("option");
        option.value = theme.id;
        option.textContent = theme.label;
        return option;
      }),
    );
  }

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

function initTextFont(refs) {
  if (!refs.textFontSelect) return;
  const saved = safeReadStorage("textFontId");
  if (saved && [...refs.textFontSelect.options].some((option) => option.value === saved)) {
    refs.textFontSelect.value = saved;
  }

  refs.textFontSelect?.addEventListener("change", () => {
    safeWriteStorage("textFontId", refs.textFontSelect.value);
  });
}

function initImageOptions(refs) {
  const update = () => {
    if (refs.imageContourValue && refs.imageContour) {
      refs.imageContourValue.textContent = `${Math.round(Number(refs.imageContour.value) * 100)}%`;
    }
    if (refs.imageAlphaValue && refs.imageAlpha) {
      refs.imageAlphaValue.textContent = `${Math.round(Number(refs.imageAlpha.value) * 100)}%`;
    }
    if (refs.imageInteriorRatioValue && refs.imageInteriorRatio) {
      refs.imageInteriorRatioValue.textContent = `${Math.round(Number(refs.imageInteriorRatio.value) * 100)}%`;
    }
  };

  for (const input of [refs.imageContour, refs.imageAlpha, refs.imageInteriorRatio]) {
    input?.addEventListener("input", update);
  }
  update();
}

function getImageOptions(refs) {
  return {
    contourStrength: Number(refs.imageContour?.value ?? 0.75),
    colorMode: refs.imageColorMode?.value ?? "original",
    monoColor: refs.imageMonoColor?.value ?? "#ff4f8f",
    globalAlpha: Number(refs.imageAlpha?.value ?? 1),
    logoMode: Boolean(refs.imageLogoMode?.checked),
    interiorRatio: Number(refs.imageInteriorRatio?.value ?? 0.35),
  };
}

function initAudioSpectrum(refs) {
  if (!refs.audioSpectrum) return;
  refs.audioBars = [];
  for (let i = 0; i < 72; i += 1) {
    const bar = document.createElement("span");
    bar.style.setProperty("--bar-index", String(i));
    refs.audioSpectrum.append(bar);
    refs.audioBars.push(bar);
  }
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
  if (refs.themeSelect && themeId) {
    refs.themeSelect.value = themeId;
  }
  for (const button of refs.themeButtons) {
    button.classList.toggle("is-active", button.dataset.theme === themeId);
  }
}

function setBackgroundActive(refs, mode) {
  for (const button of refs.backgroundButtons) {
    button.classList.toggle("is-active", button.dataset.background === mode);
  }
}

function setModelActive(refs, model) {
  refs.shapeSelect.value = model;
  for (const button of refs.modelButtons) {
    button.classList.toggle("is-active", button.dataset.model === model);
  }
}

function setAudioActive(refs, mode) {
  refs.micToggleBtn.classList.toggle("is-active", mode === "mic");
  refs.audioStopBtn.classList.toggle("is-active", mode === "off");
  refs.audioSpectrum?.classList.toggle("is-active", mode !== "off");
}

function setGestureControlActive(refs, active) {
  refs.gestureToggleBtn?.classList.toggle("is-active", active);
  if (refs.gestureToggleBtn) {
    refs.gestureToggleBtn.textContent = active ? "手势" : "手势关";
  }
  refs.video?.classList.toggle("is-disabled", !active);
}

function setFreezeActive(refs, active) {
  refs.freezeToggleBtn?.classList.toggle("is-active", active);
  if (refs.freezeToggleBtn) {
    refs.freezeToggleBtn.textContent = active ? "继续" : "静止";
  }
}

function updateAudioLevel(refs, audio) {
  const level = typeof audio === "number" ? audio : (audio?.level ?? 0);
  const beat = typeof audio === "number" ? 0 : (audio?.beat ?? 0);
  const bars = typeof audio === "number" ? [] : (audio?.bars ?? []);
  refs.audioValue.textContent = `${Math.round(level * 100)}%`;
  refs.audioSpectrum?.style.setProperty("--audio-level", level.toFixed(3));
  refs.audioSpectrum?.style.setProperty("--audio-beat", beat.toFixed(3));
  refs.audioSpectrum?.style.setProperty("--audio-glow", `${Math.round(10 + beat * 22)}px`);
  refs.audioSpectrum?.style.setProperty("--audio-halo-opacity", String(0.34 + level * 0.42 + beat * 0.1));

  if (refs.audioBars) {
    for (let i = 0; i < refs.audioBars.length; i += 1) {
      const centerDistance = Math.abs((i + 0.5) / refs.audioBars.length - 0.5) * 2;
      const sourceIndex = Math.floor(centerDistance ** 1.55 * Math.max(0, bars.length - 1));
      const source = bars.length > 0 ? bars[sourceIndex] : 0;
      const centerLift = 1 - centerDistance;
      const height = Math.max(0.06, Math.min(0.82, source * (0.68 + centerLift * 0.16) + beat * 0.035));
      const hot = Math.max(0, (height - 0.42) / 0.4);
      refs.audioBars[i].style.transform = `scaleY(${height.toFixed(3)})`;
      refs.audioBars[i].style.opacity = String(0.22 + height * 0.78);
      refs.audioBars[i].style.setProperty("--bar-hot", hot.toFixed(3));
    }
  }

  if (refs.audioSpectrum) {
    refs.audioSpectrum.classList.toggle("has-signal", level > 0.025 || beat > 0.05);
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

function normalizeCustomText(text) {
  const trimmed = String(text ?? "").trim();
  return trimmed.length > 0 ? trimmed.slice(0, 18) : "LOVE";
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
