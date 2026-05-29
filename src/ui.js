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
    showPresetSelect: document.querySelector("#showPresetSelect"),
    showPresetToggleBtn: document.querySelector("#showPresetToggleBtn"),
    showTimeline: document.querySelector("#showTimeline"),
    showStepLabel: document.querySelector("#showStepLabel"),
    showStepDuration: document.querySelector("#showStepDuration"),
    showStepTheme: document.querySelector("#showStepTheme"),
    showStepBackground: document.querySelector("#showStepBackground"),
    showStepModel: document.querySelector("#showStepModel"),
    showStepText: document.querySelector("#showStepText"),
    showStepCamera: document.querySelector("#showStepCamera"),
    showStepModelBrightness: document.querySelector("#showStepModelBrightness"),
    showStepModelBrightnessValue: document.querySelector("#showStepModelBrightnessValue"),
    showStepBackgroundBrightness: document.querySelector("#showStepBackgroundBrightness"),
    showStepBackgroundBrightnessValue: document.querySelector("#showStepBackgroundBrightnessValue"),
    showStepImageBrightness: document.querySelector("#showStepImageBrightness"),
    showStepImageBrightnessValue: document.querySelector("#showStepImageBrightnessValue"),
    showStepImageSize: document.querySelector("#showStepImageSize"),
    showStepImageSizeValue: document.querySelector("#showStepImageSizeValue"),
    showStepBurst: document.querySelector("#showStepBurst"),
    showStepFreeze: document.querySelector("#showStepFreeze"),
    showStepApplyBtn: document.querySelector("#showStepApplyBtn"),
    showStepCaptureBtn: document.querySelector("#showStepCaptureBtn"),
    showStepAddBtn: document.querySelector("#showStepAddBtn"),
    showStepDuplicateBtn: document.querySelector("#showStepDuplicateBtn"),
    showStepDeleteBtn: document.querySelector("#showStepDeleteBtn"),
    showStepExportBtn: document.querySelector("#showStepExportBtn"),
    showStepImportBtn: document.querySelector("#showStepImportBtn"),
    showStepFileImportBtn: document.querySelector("#showStepFileImportBtn"),
    showPresetFileInput: document.querySelector("#showPresetFileInput"),
    showStepJson: document.querySelector("#showStepJson"),
    gestureToggleBtn: document.querySelector("#gestureToggleBtn"),
    freezeToggleBtn: document.querySelector("#freezeToggleBtn"),
    colorPicker: document.querySelector("#colorPicker"),
    fullscreenBtn: document.querySelector("#fullscreenBtn"),
    statusText: document.querySelector("#statusText"),
    diagnosticText: document.querySelector("#diagnosticText"),
    helpText: document.querySelector("#helpText"),
    helpButtons: [...document.querySelectorAll(".help-button")],
    cameraStatus: document.querySelector("#cameraStatus"),
    gestureMeter: document.querySelector("#gestureMeter"),
    gestureValue: document.querySelector("#gestureValue"),
    panelScale: document.querySelector("#panelScale"),
    panelScaleValue: document.querySelector("#panelScaleValue"),
    qualityValue: document.querySelector("#qualityValue"),
    performanceValue: document.querySelector("#performanceValue"),
    safetyModeBtn: document.querySelector("#safetyModeBtn"),
    healthRefreshBtn: document.querySelector("#healthRefreshBtn"),
    healthItems: [...document.querySelectorAll("[data-health-key]")],
    sensitivity: document.querySelector("#sensitivity"),
    sensitivityValue: document.querySelector("#sensitivityValue"),
    pointingSensitivity: document.querySelector("#pointingSensitivity"),
    pointingSensitivityValue: document.querySelector("#pointingSensitivityValue"),
    themeButtons: [...document.querySelectorAll("[data-theme]")],
    backgroundButtons: [...document.querySelectorAll("[data-background]")],
    backgroundSelect: document.querySelector("#backgroundSelect"),
    backgroundBrightness: document.querySelector("#backgroundBrightness"),
    backgroundBrightnessValue: document.querySelector("#backgroundBrightnessValue"),
    modelPlaceholderButtons: [...document.querySelectorAll("[data-model-placeholder]")],
    modelBrightness: document.querySelector("#modelBrightness"),
    modelBrightnessValue: document.querySelector("#modelBrightnessValue"),
    modelSize: document.querySelector("#modelSize"),
    modelSizeValue: document.querySelector("#modelSizeValue"),
    micToggleBtn: document.querySelector("#micToggleBtn"),
    audioFileInput: document.querySelector("#audioFileInput"),
    imageFileInput: document.querySelector("#imageFileInput"),
    meshFileInput: document.querySelector("#meshFileInput"),
    motionFileInput: document.querySelector("#motionFileInput"),
    poseVideoInput: document.querySelector("#poseVideoInput"),
    meshDensity: document.querySelector("#meshDensity"),
    meshDensityValue: document.querySelector("#meshDensityValue"),
    meshSize: document.querySelector("#meshSize"),
    meshSizeValue: document.querySelector("#meshSizeValue"),
    meshDepth: document.querySelector("#meshDepth"),
    meshDepthValue: document.querySelector("#meshDepthValue"),
    meshSpread: document.querySelector("#meshSpread"),
    meshSpreadValue: document.querySelector("#meshSpreadValue"),
    meshAnimationEnabled: document.querySelector("#meshAnimationEnabled"),
    meshAnimationLoop: document.querySelector("#meshAnimationLoop"),
    meshAnimationSpeed: document.querySelector("#meshAnimationSpeed"),
    meshAnimationSpeedValue: document.querySelector("#meshAnimationSpeedValue"),
    meshAnimationFollow: document.querySelector("#meshAnimationFollow"),
    meshAnimationFollowValue: document.querySelector("#meshAnimationFollowValue"),
    meshYaw: document.querySelector("#meshYaw"),
    meshYawValue: document.querySelector("#meshYawValue"),
    meshGround: document.querySelector("#meshGround"),
    meshGroundValue: document.querySelector("#meshGroundValue"),
    meshAutoCenter: document.querySelector("#meshAutoCenter"),
    motionDensity: document.querySelector("#motionDensity"),
    motionDensityValue: document.querySelector("#motionDensityValue"),
    motionLoop: document.querySelector("#motionLoop"),
    motionSpeed: document.querySelector("#motionSpeed"),
    motionSpeedValue: document.querySelector("#motionSpeedValue"),
    motionSize: document.querySelector("#motionSize"),
    motionSizeValue: document.querySelector("#motionSizeValue"),
    poseDensity: document.querySelector("#poseDensity"),
    poseDensityValue: document.querySelector("#poseDensityValue"),
    poseFollow: document.querySelector("#poseFollow"),
    poseFollowValue: document.querySelector("#poseFollowValue"),
    poseAura: document.querySelector("#poseAura"),
    poseAuraValue: document.querySelector("#poseAuraValue"),
    poseRetargetEnabled: document.querySelector("#poseRetargetEnabled"),
    poseRetargetSmoothing: document.querySelector("#poseRetargetSmoothing"),
    poseRetargetSmoothingValue: document.querySelector("#poseRetargetSmoothingValue"),
    imageContour: document.querySelector("#imageContour"),
    imageContourValue: document.querySelector("#imageContourValue"),
    imageColorMode: document.querySelector("#imageColorMode"),
    imageMonoColor: document.querySelector("#imageMonoColor"),
    imageAlpha: document.querySelector("#imageAlpha"),
    imageAlphaValue: document.querySelector("#imageAlphaValue"),
    imageBrightness: document.querySelector("#imageBrightness"),
    imageBrightnessValue: document.querySelector("#imageBrightnessValue"),
    imageSize: document.querySelector("#imageSize"),
    imageSizeValue: document.querySelector("#imageSizeValue"),
    imageLogoMode: document.querySelector("#imageLogoMode"),
    imageInteriorRatio: document.querySelector("#imageInteriorRatio"),
    imageInteriorRatioValue: document.querySelector("#imageInteriorRatioValue"),
    stepButtons: [...document.querySelectorAll("[data-step-target]")],
    importProgress: document.querySelector("#importProgress"),
    importProgressLabel: document.querySelector("#importProgressLabel"),
    importProgressValue: document.querySelector("#importProgressValue"),
    importProgressFill: document.querySelector("#importProgressFill"),
    audioStopBtn: document.querySelector("#audioStopBtn"),
    audioValue: document.querySelector("#audioValue"),
    audioSpectrum: document.querySelector("#audioSpectrum"),
  };

  initIcons(refs);
  initThemeButtons(refs);
  initShowComposer(refs);
  initPanelScale(refs);
  initPanelCollapse(refs);
  initPanelVisibility(refs);
  initSensitivity(refs);
  initTextFont(refs);
  initImageOptions(refs);
  initBrightnessControls(refs);
  initAnimationToggles(refs);
  initRangeSteppers(refs);
  initAudioSpectrum(refs);
  initHelpButtons(refs);

  return {
    refs,
    setStatus: (text, status) => setStatus(refs, text, status),
    setDiagnostic: (text) => setDiagnostic(refs, text),
    setQuality: (profile) => setQuality(refs, profile),
    setSafetyModeActive: (active) => setSafetyModeActive(refs, active),
    updateHealth: (items) => updateHealth(refs, items),
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
    getImageBrightness: () => Number(refs.imageBrightness?.value ?? 280) / 100,
    getImageSize: () => Number(refs.imageSize?.value ?? 100) / 100,
    getModelBrightness: () => Number(refs.modelBrightness?.value ?? 100) / 100,
    getModelSize: () => Number(refs.modelSize?.value ?? 100) / 100,
    getMeshOptions: () => getMeshOptions(refs),
    getMotionOptions: () => getMotionOptions(refs),
    getPoseOptions: () => getPoseOptions(refs),
    getBackgroundBrightness: () => Number(refs.backgroundBrightness?.value ?? 100) / 100,
    updateImageSizeLabel: (particleCount) => updateImageSizeLabel(refs, particleCount),
    getShowPresetId: () => refs.showPresetSelect?.value ?? "auto",
    setShowPresetOptions: (presets) => setShowPresetOptions(refs, presets),
    setShowPresetId: (id) => setShowPresetId(refs, id),
    setShowPresetActive: (active) => setShowPresetActive(refs, active),
    getShowStepDraft: () => getShowStepDraft(refs),
    setShowStepDraft: (step) => setShowStepDraft(refs, step),
    renderShowTimeline: (preset, activeIndex, selectedIndex) => renderShowTimeline(refs, preset, activeIndex, selectedIndex),
    getShowJson: () => refs.showStepJson?.value ?? "",
    setShowJson: (text) => {
      if (refs.showStepJson) refs.showStepJson.value = text;
    },
    setImportProgress: (progress) => setImportProgress(refs, progress),
    setAudioActive: (mode) => setAudioActive(refs, mode),
    updateAudioLevel: (level) => updateAudioLevel(refs, level),
    getSensitivity: () => Number(refs.sensitivity.value) / 100,
    getPointingSensitivity: () => Number(refs.pointingSensitivity?.value ?? 120) / 100,
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

function initShowComposer(refs) {
  if (refs.showStepTheme) {
    refs.showStepTheme.replaceChildren(
      ...THEMES.map((theme) => {
        const option = document.createElement("option");
        option.value = theme.id;
        option.textContent = theme.label;
        return option;
      }),
    );
  }

  const controls = [
    { input: refs.showStepModelBrightness, output: refs.showStepModelBrightnessValue },
    { input: refs.showStepBackgroundBrightness, output: refs.showStepBackgroundBrightnessValue },
    { input: refs.showStepImageBrightness, output: refs.showStepImageBrightnessValue },
    { input: refs.showStepImageSize, output: refs.showStepImageSizeValue },
  ];

  for (const control of controls) {
    if (!control.input) continue;
    updatePercentLabel(control.output, control.input.value);
    control.input.addEventListener("input", () => updatePercentLabel(control.output, control.input.value));
  }
}

function setShowPresetId(refs, id) {
  if (!refs.showPresetSelect) return;
  const hasOption = [...refs.showPresetSelect.options].some((option) => option.value === id);
  refs.showPresetSelect.value = hasOption ? id : "auto";
}

function setShowPresetOptions(refs, presets) {
  if (!refs.showPresetSelect || !Array.isArray(presets)) return;
  const previous = refs.showPresetSelect.value || "auto";
  refs.showPresetSelect.replaceChildren(
    ...presets.map((preset) => {
      const option = document.createElement("option");
      option.value = preset.id;
      option.textContent = preset.label;
      return option;
    }),
  );
  setShowPresetId(refs, previous);
}

function getShowStepDraft(refs) {
  return {
    label: normalizeShowLabel(refs.showStepLabel?.value),
    duration: Math.round(Number(refs.showStepDuration?.value ?? 10) * 1000),
    theme: refs.showStepTheme?.value ?? "neon",
    background: refs.showStepBackground?.value ?? "nebula",
    model: refs.showStepModel?.value ?? "heart",
    text: normalizeCustomText(refs.showStepText?.value ?? "LOVE"),
    camera: refs.showStepCamera?.value ?? "hold",
    modelBrightness: Number(refs.showStepModelBrightness?.value ?? 100) / 100,
    backgroundBrightness: Number(refs.showStepBackgroundBrightness?.value ?? 100) / 100,
    imageBrightness: Number(refs.showStepImageBrightness?.value ?? 280) / 100,
    imageSize: Number(refs.showStepImageSize?.value ?? 100) / 100,
    burst: Boolean(refs.showStepBurst?.checked),
    freeze: Boolean(refs.showStepFreeze?.checked),
  };
}

function setShowStepDraft(refs, step = {}) {
  if (refs.showStepLabel) refs.showStepLabel.value = normalizeShowLabel(step.label);
  if (refs.showStepDuration) refs.showStepDuration.value = formatSeconds(step.duration ?? 10000);
  setSelectValue(refs.showStepTheme, step.theme ?? "neon");
  setSelectValue(refs.showStepBackground, step.background ?? "nebula");
  setSelectValue(refs.showStepModel, step.model ?? "heart");
  if (refs.showStepText) refs.showStepText.value = normalizeCustomText(step.text ?? "LOVE");
  setSelectValue(refs.showStepCamera, typeof step.camera === "string" ? step.camera : "hold");
  setComposerRange(refs.showStepModelBrightness, refs.showStepModelBrightnessValue, step.modelBrightness ?? 1);
  setComposerRange(refs.showStepBackgroundBrightness, refs.showStepBackgroundBrightnessValue, step.backgroundBrightness ?? 1);
  setComposerRange(refs.showStepImageBrightness, refs.showStepImageBrightnessValue, step.imageBrightness ?? 2.8);
  setComposerRange(refs.showStepImageSize, refs.showStepImageSizeValue, step.imageSize ?? 1);
  if (refs.showStepBurst) refs.showStepBurst.checked = Boolean(step.burst);
  if (refs.showStepFreeze) refs.showStepFreeze.checked = Boolean(step.freeze);
}

function renderShowTimeline(refs, preset, activeIndex = -1, selectedIndex = 0) {
  if (!refs.showTimeline) return;
  const steps = Array.isArray(preset?.steps) ? preset.steps : [];
  refs.showTimeline.replaceChildren(
    ...steps.map((step, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "show-timeline-item";
      button.dataset.showStep = String(index);
      button.classList.toggle("is-active", index === activeIndex);
      button.classList.toggle("is-selected", index === selectedIndex);

      const title = document.createElement("span");
      title.textContent = step.label || `片段 ${index + 1}`;
      const meta = document.createElement("small");
      meta.textContent = `${Math.round((Number(step.duration) || 10000) / 1000)}s`;
      button.append(title, meta);
      return button;
    }),
  );
}

function setSelectValue(select, value) {
  if (!select) return;
  const hasOption = [...select.options].some((option) => option.value === value);
  select.value = hasOption ? value : select.options[0]?.value;
}

function setComposerRange(input, output, ratio) {
  if (!input) return;
  const min = Number(input.min);
  const max = Number(input.max);
  const value = THREE.MathUtils.clamp(Math.round(Number(ratio) * 100), min, max);
  input.value = String(value);
  updatePercentLabel(output, value);
}

function formatSeconds(duration) {
  const value = Number(duration);
  const milliseconds = value > 0 && value <= 120 ? value * 1000 : value;
  const seconds = THREE.MathUtils.clamp((Number.isFinite(milliseconds) ? milliseconds : 10000) / 1000, 2, 120);
  return Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1);
}

function normalizeShowLabel(label) {
  const trimmed = String(label ?? "").trim();
  return trimmed.length > 0 ? trimmed.slice(0, 18) : "新片段";
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

  const pointingSaved = Number(safeReadStorage("pointingSensitivity"));
  const pointingValue = Number.isFinite(pointingSaved) && pointingSaved >= 60 && pointingSaved <= 180 ? pointingSaved : 120;
  if (refs.pointingSensitivity) {
    refs.pointingSensitivity.value = String(pointingValue);
    updatePointingSensitivityLabel(refs);
    refs.pointingSensitivity.addEventListener("input", () => {
      updatePointingSensitivityLabel(refs);
      safeWriteStorage("pointingSensitivity", refs.pointingSensitivity.value);
    });
  }
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

function initBrightnessControls(refs) {
  const controls = [
    { input: refs.imageBrightness, output: refs.imageBrightnessValue, storage: "imageBrightness", fallback: 280 },
    { input: refs.imageSize, output: refs.imageSizeValue, storage: "imageSize", fallback: 100 },
    { input: refs.modelBrightness, output: refs.modelBrightnessValue, storage: "modelBrightness", fallback: 100 },
    { input: refs.modelSize, output: refs.modelSizeValue, storage: "modelSize", fallback: 100 },
    { input: refs.backgroundBrightness, output: refs.backgroundBrightnessValue, storage: "backgroundBrightness", fallback: 100 },
    { input: refs.meshDensity, output: refs.meshDensityValue, storage: "meshDensity", fallback: 100 },
    { input: refs.meshSize, output: refs.meshSizeValue, storage: "meshSize", fallback: 100 },
    { input: refs.meshDepth, output: refs.meshDepthValue, storage: "meshDepth", fallback: 100 },
    { input: refs.meshSpread, output: refs.meshSpreadValue, storage: "meshSpread", fallback: 100 },
    { input: refs.meshAnimationSpeed, output: refs.meshAnimationSpeedValue, storage: "meshAnimationSpeed", fallback: 100 },
    { input: refs.meshAnimationFollow, output: refs.meshAnimationFollowValue, storage: "meshAnimationFollow", fallback: 100 },
    { input: refs.meshYaw, output: refs.meshYawValue, storage: "meshYaw", fallback: 0, format: "degrees" },
    { input: refs.meshGround, output: refs.meshGroundValue, storage: "meshGround", fallback: 0 },
    { input: refs.motionDensity, output: refs.motionDensityValue, storage: "motionDensity", fallback: 100 },
    { input: refs.motionSpeed, output: refs.motionSpeedValue, storage: "motionSpeed", fallback: 100 },
    { input: refs.motionSize, output: refs.motionSizeValue, storage: "motionSize", fallback: 100 },
    { input: refs.poseDensity, output: refs.poseDensityValue, storage: "poseDensity", fallback: 100 },
    { input: refs.poseFollow, output: refs.poseFollowValue, storage: "poseFollow", fallback: 100 },
    { input: refs.poseAura, output: refs.poseAuraValue, storage: "poseAura", fallback: 100 },
    { input: refs.poseRetargetSmoothing, output: refs.poseRetargetSmoothingValue, storage: "poseRetargetSmoothing", fallback: 35 },
  ];

  for (const control of controls) {
    if (!control.input) continue;
    const saved = Number(safeReadStorage(control.storage));
    const min = Number(control.input.min);
    const max = Number(control.input.max);
    const value = Number.isFinite(saved) && saved >= min && saved <= max ? saved : control.fallback;
    control.input.value = String(value);
    updateRangeLabel(control.output, value, control.format);
    control.input.addEventListener("input", () => {
      const nextValue = Number(control.input.value);
      updateRangeLabel(control.output, nextValue, control.format);
      safeWriteStorage(control.storage, String(nextValue));
    });
  }
}

function initAnimationToggles(refs) {
  const toggles = [
    { input: refs.meshAnimationEnabled, storage: "meshAnimationEnabled", fallback: true },
    { input: refs.meshAnimationLoop, storage: "meshAnimationLoop", fallback: true },
    { input: refs.meshAutoCenter, storage: "meshAutoCenter", fallback: true },
    { input: refs.motionLoop, storage: "motionLoop", fallback: true },
    { input: refs.poseRetargetEnabled, storage: "poseRetargetEnabled", fallback: true },
  ];
  for (const toggle of toggles) {
    if (!toggle.input) continue;
    const saved = safeReadStorage(toggle.storage);
    toggle.input.checked = saved == null ? toggle.fallback : saved !== "false";
    toggle.input.addEventListener("change", () => {
      safeWriteStorage(toggle.storage, toggle.input.checked ? "true" : "false");
    });
  }
}

function initRangeSteppers(refs) {
  const byId = new Map(
    [
      refs.modelBrightness,
      refs.modelSize,
      refs.imageBrightness,
      refs.imageSize,
      refs.backgroundBrightness,
      refs.sensitivity,
      refs.pointingSensitivity,
      refs.meshDensity,
      refs.meshSize,
      refs.meshDepth,
      refs.meshSpread,
      refs.meshAnimationSpeed,
      refs.meshAnimationFollow,
      refs.meshYaw,
      refs.meshGround,
      refs.motionDensity,
      refs.motionSpeed,
      refs.motionSize,
      refs.poseDensity,
      refs.poseFollow,
      refs.poseAura,
      refs.poseRetargetSmoothing,
    ]
      .filter(Boolean)
      .map((input) => [input.id, input]),
  );

  for (const button of refs.stepButtons ?? []) {
    button.addEventListener("click", () => {
      const input = byId.get(button.dataset.stepTarget);
      if (!input) return;
      const step = Number(button.dataset.step) || Number(input.step) || 1;
      const min = Number(input.min);
      const max = Number(input.max);
      const next = THREE.MathUtils.clamp(Number(input.value) + step, min, max);
      input.value = String(next);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
}

function updatePercentLabel(output, value) {
  if (output) {
    output.textContent = `${Math.round(Number(value))}%`;
  }
}

function updateRangeLabel(output, value, format) {
  if (!output) return;
  if (format === "degrees") {
    output.textContent = `${Math.round(Number(value))}°`;
    return;
  }
  updatePercentLabel(output, value);
}

function updateImageSizeLabel(refs, particleCount) {
  if (!refs.imageSizeValue || !refs.imageSize) return;
  const size = Math.round(Number(refs.imageSize.value));
  if (Number.isFinite(particleCount) && particleCount > 0) {
    refs.imageSizeValue.textContent = `${size}% · ${Math.round(particleCount / 1000)}k`;
    return;
  }
  refs.imageSizeValue.textContent = `${size}%`;
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

function getMeshOptions(refs) {
  return {
    density: Number(refs.meshDensity?.value ?? 100) / 100,
    size: Number(refs.meshSize?.value ?? 100) / 100,
    depth: Number(refs.meshDepth?.value ?? 100) / 100,
    spread: Number(refs.meshSpread?.value ?? 100) / 100,
    animationEnabled: refs.meshAnimationEnabled ? refs.meshAnimationEnabled.checked : true,
    animationLoop: refs.meshAnimationLoop ? refs.meshAnimationLoop.checked : true,
    animationSpeed: Number(refs.meshAnimationSpeed?.value ?? 100) / 100,
    animationFollow: Number(refs.meshAnimationFollow?.value ?? 100) / 100,
    yaw: THREE.MathUtils.degToRad(Number(refs.meshYaw?.value ?? 0)),
    groundOffset: Number(refs.meshGround?.value ?? 0) / 100,
    autoCenter: refs.meshAutoCenter ? refs.meshAutoCenter.checked : true,
  };
}

function getMotionOptions(refs) {
  return {
    density: Number(refs.motionDensity?.value ?? 100) / 100,
    loop: refs.motionLoop ? refs.motionLoop.checked : true,
    speed: Number(refs.motionSpeed?.value ?? 100) / 100,
    size: Number(refs.motionSize?.value ?? 100) / 100,
  };
}

function getPoseOptions(refs) {
  return {
    density: Number(refs.poseDensity?.value ?? 100) / 100,
    follow: Number(refs.poseFollow?.value ?? 100) / 100,
    aura: Number(refs.poseAura?.value ?? 100) / 100,
    retargetEnabled: refs.poseRetargetEnabled ? refs.poseRetargetEnabled.checked : true,
    retargetSmoothing: Number(refs.poseRetargetSmoothing?.value ?? 35) / 100,
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

function initHelpButtons(refs) {
  for (const button of refs.helpButtons) {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const text = button.dataset.help ?? "";
      const isActive = button.classList.contains("is-active");
      for (const item of refs.helpButtons) {
        item.classList.remove("is-active");
        item.setAttribute("aria-expanded", "false");
      }
      if (!refs.helpText) return;
      if (isActive || !text) {
        refs.helpText.hidden = true;
        refs.helpText.textContent = "";
        return;
      }
      button.classList.add("is-active");
      button.setAttribute("aria-expanded", "true");
      refs.helpText.textContent = text;
      refs.helpText.hidden = false;
    });
  }
}

function updateSensitivityLabel(refs) {
  refs.sensitivityValue.textContent = `${Math.round(Number(refs.sensitivity.value))}%`;
}

function updatePointingSensitivityLabel(refs) {
  if (refs.pointingSensitivityValue && refs.pointingSensitivity) {
    refs.pointingSensitivityValue.textContent = `${Math.round(Number(refs.pointingSensitivity.value))}%`;
  }
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

function setSafetyModeActive(refs, active) {
  refs.safetyModeBtn?.classList.toggle("is-active", active);
  if (refs.safetyModeBtn) {
    refs.safetyModeBtn.textContent = active ? "安全中" : "安全";
  }
}

function updateHealth(refs, items = {}) {
  for (const item of refs.healthItems ?? []) {
    const value = items[item.dataset.healthKey];
    if (!value) continue;
    const label = typeof value === "string" ? value : value.label;
    const status = typeof value === "string" ? "ok" : value.status;
    const output = item.querySelector("strong");
    if (output) output.textContent = label ?? "--";
    item.classList.toggle("is-ok", status === "ok");
    item.classList.toggle("is-warn", status === "warn");
    item.classList.toggle("is-error", status === "error");
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
  if (refs.backgroundSelect) {
    refs.backgroundSelect.value = mode;
  }
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

function setShowPresetActive(refs, active) {
  refs.showPresetToggleBtn?.classList.toggle("is-active", active);
  if (refs.showPresetToggleBtn) {
    refs.showPresetToggleBtn.textContent = active ? "停止" : "巡演";
  }
}

function setImportProgress(refs, progress) {
  if (!refs.importProgress) return;
  const active = Boolean(progress?.active);
  refs.importProgress.hidden = !active;
  refs.importProgress.classList.toggle("is-error", Boolean(progress?.error));
  if (!active) return;
  const value = THREE.MathUtils.clamp(Number(progress?.value ?? 0), 0, 1);
  const label = progress?.label ?? "正在导入";
  refs.importProgressLabel.textContent = label;
  refs.importProgressValue.textContent = progress?.indeterminate ? "--" : `${Math.round(value * 100)}%`;
  refs.importProgressFill.style.width = progress?.indeterminate ? "38%" : `${Math.round(value * 100)}%`;
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
