import * as THREE from "three";

export function createUI() {
  const refs = {
    canvas: document.querySelector("#scene"),
    video: document.querySelector("#camera"),
    panel: document.querySelector("#controlPanel"),
    panelBody: document.querySelector("#panelBody"),
    panelToggleBtn: document.querySelector("#panelToggleBtn"),
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
  };

  initPanelScale(refs);
  initPanelCollapse(refs);

  return {
    refs,
    setStatus: (text, status) => setStatus(refs, text, status),
    setDiagnostic: (text) => setDiagnostic(refs, text),
    setQuality: (profile) => setQuality(refs, profile),
    updateGestureMeter: (percent) => updateGestureMeter(refs, percent),
  };
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
  refs.panelToggleBtn?.querySelector("[aria-hidden='true']")?.replaceChildren(collapsed ? "+" : "−");
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
