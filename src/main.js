import "./styles.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { createAudioReactor, stopAudioSource, updateAudioReactor, useAudioFile, useMicrophone } from "./audio.js";
import {
  applyBackgroundTheme,
  createBackgroundSystem,
  setBackgroundBrightness,
  setBackgroundMode,
  updateBackground,
} from "./backgrounds.js";
import { MP_HANDS_ASSET_BASE, renderPixelRatio, selectQualityProfile } from "./config.js";
import {
  average,
  calculateHandOpenness,
  classifyGestureCommand,
  fistViewPose,
  lerpAngle,
  normalizeAngle,
  palmCenter,
} from "./gestures.js";
import { applyStaticLightColors, createStaticLightSources, updateStaticLights } from "./lighting.js";
import {
  createParticleSystem,
  setCustomText,
  setImagePoints,
  setMeshPoints,
  setParticleDrawCount,
  setParticleTargets,
  setTextFont,
  snapParticlesToTargets,
  updateParticles,
} from "./particles.js";
import { THEMES, applyThemeToDocument, getTheme } from "./themes.js";
import { createUI } from "./ui.js";
import { SHOW_PRESET_LIBRARY } from "./show-presets/index.js";

const ui = createUI();
const {
  canvas,
  video,
  shapeSelect,
  modelButtons,
  textInput,
  textApplyBtn,
  textFontSelect,
  themeSelect,
  showPresetSelect,
  showPresetToggleBtn,
  showTimeline,
  showStepApplyBtn,
  showStepCaptureBtn,
  showStepAddBtn,
  showStepDuplicateBtn,
  showStepDeleteBtn,
  showStepExportBtn,
  showStepImportBtn,
  showStepFileImportBtn,
  showPresetFileInput,
  gestureToggleBtn,
  freezeToggleBtn,
  colorPicker,
  fullscreenBtn,
  sensitivity,
  themeButtons,
  backgroundButtons,
  backgroundSelect,
  backgroundBrightness,
  modelPlaceholderButtons,
  modelBrightness,
  micToggleBtn,
  audioFileInput,
  imageFileInput,
  imageBrightness,
  imageSize,
  meshFileInput,
  audioStopBtn,
} = ui.refs;

const qualityProfile = selectQualityProfile();
const pixelRatio = renderPixelRatio(qualityProfile);
ui.setQuality(qualityProfile);
const initialTheme = getTheme(ui.getThemeId());
colorPicker.value = initialTheme.primary;
ui.setThemeActive(initialTheme.id);
applyThemeToDocument(initialTheme);

const clock = new THREE.Clock();

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.84;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x06080d, 0.055);
scene.fog.color.set(initialTheme.background);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.0, 8.2);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.enablePan = true;
controls.minDistance = 3.2;
controls.maxDistance = 18;
controls.target.set(0, 0, 0);
controls.update();

const renderPass = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.58, 0.42, 0.33);
const composer = new EffectComposer(renderer);
composer.addPass(renderPass);
composer.addPass(bloomPass);

const particles = createParticleSystem({
  count: qualityProfile.particleCount,
  color: initialTheme.primary,
  accent: initialTheme.accent,
  pixelRatio,
  fboSimulation: shouldUseFboSimulation(renderer, qualityProfile),
});
scene.add(particles.system);

const staticLights = createStaticLightSources(new THREE.Color(initialTheme.primary), new THREE.Color(initialTheme.accent));
scene.add(staticLights);

const motionTrail = createMotionTrail(initialTheme);
scene.add(motionTrail.group);

const backgroundSystem = createBackgroundSystem(initialTheme);
scene.add(backgroundSystem.group);
setBackgroundBrightness(backgroundSystem, ui.getBackgroundBrightness(), initialTheme);
setBackgroundMode(backgroundSystem, ui.getBackgroundMode(), initialTheme);
ui.setBackgroundActive(backgroundSystem.mode);

const audioReactor = createAudioReactor();
let imageWorker = null;
let imageWorkerJobId = 0;
const imageWorkerJobs = new Map();

const SHOW_PRESETS = {
  auto: {
    label: "自动巡演",
    steps: [
      { label: "霓虹爱心", theme: "neon", background: "nebula", model: "heart", camera: "front", duration: 9500 },
      {
        label: "玫瑰舞台",
        theme: "rose",
        background: "stage",
        model: "flower",
        camera: "close",
        modelBrightness: 1.08,
        backgroundBrightness: 1.18,
        duration: 10500,
      },
      {
        label: "电紫土星",
        theme: "violet",
        background: "minimal",
        model: "saturn",
        camera: "left",
        modelBrightness: 1.12,
        backgroundBrightness: 0.9,
        duration: 9500,
      },
      {
        label: "夜空烟花",
        theme: "laser",
        background: "fireworks",
        model: "fireworks",
        camera: "wide",
        burst: true,
        duration: 11000,
      },
    ],
  },
  romance: {
    label: "玫瑰告白",
    steps: [
      {
        label: "玫红花朵",
        theme: "rose",
        background: "stage",
        model: "flower",
        camera: "close",
        modelBrightness: 1.06,
        backgroundBrightness: 1.12,
        duration: 11500,
      },
      {
        label: "文字告白",
        theme: "gold",
        background: "nebula",
        model: "text",
        text: "LOVE",
        camera: "front",
        modelBrightness: 1.1,
        duration: 10500,
      },
      {
        label: "暖光爱心",
        theme: "gold",
        background: "minimal",
        model: "heart",
        camera: "low",
        backgroundBrightness: 0.88,
        duration: 9500,
      },
    ],
  },
  club: {
    label: "夜场烟花",
    steps: [
      {
        label: "激光爱心",
        theme: "laser",
        background: "stage",
        model: "heart",
        camera: "front",
        backgroundBrightness: 1.22,
        burst: true,
        duration: 8500,
      },
      {
        label: "电紫土星",
        theme: "violet",
        background: "nebula",
        model: "saturn",
        camera: "right",
        modelBrightness: 1.18,
        duration: 8500,
      },
      {
        label: "爆场烟花",
        theme: "laser",
        background: "fireworks",
        model: "fireworks",
        camera: "wide",
        backgroundBrightness: 1.3,
        burst: true,
        duration: 12000,
      },
    ],
  },
  gallery: {
    label: "图形展台",
    steps: [
      {
        label: "图片点云",
        theme: "ice",
        background: "minimal",
        model: "image",
        camera: "front",
        imageBrightness: 3.0,
        imageSize: 1,
        duration: 10500,
      },
      {
        label: "3D 点云",
        theme: "blackGold",
        background: "stage",
        model: "mesh",
        camera: "wide",
        modelBrightness: 1.15,
        duration: 10500,
      },
      {
        label: "文字陈列",
        theme: "aurora",
        background: "nebula",
        model: "text",
        text: "PARTICLE",
        camera: "front",
        duration: 9500,
      },
      { label: "土星陈列", theme: "gold", background: "minimal", model: "saturn", camera: "top", duration: 9000 },
    ],
  },
  ...Object.fromEntries(
    SHOW_PRESET_LIBRARY.map((preset) => [
      preset.id,
      {
        label: preset.label,
        steps: preset.steps,
      },
    ]),
  ),
};

ui.setShowPresetOptions(showPresetOptionList());

const CUSTOM_SHOW_STORAGE_KEY = "customShowPreset";
const SHOW_MODELS = new Set(["heart", "flower", "saturn", "fireworks", "text", "image", "mesh"]);
const SHOW_BACKGROUNDS = new Set(["nebula", "stage", "minimal", "fireworks", "aurora", "lattice", "sunset"]);
const SHOW_THEMES = new Set(THEMES.map((theme) => theme.id));
const CAMERA_SHOTS = {
  front: { position: [0, 1.0, 8.2], target: [0, 0, 0] },
  close: { position: [0, 0.72, 5.35], target: [0, 0.08, 0] },
  wide: { position: [0, 1.2, 10.7], target: [0, 0, 0] },
  left: { position: [-5.25, 1.25, 6.45], target: [0, 0.05, 0] },
  right: { position: [5.25, 1.25, 6.45], target: [0, 0.05, 0] },
  top: { position: [0, 7.35, 4.55], target: [0, 0.05, 0] },
  low: { position: [0, -0.95, 6.35], target: [0, 0.1, 0] },
};
const DEFAULT_CUSTOM_SHOW = {
  label: "自定义编排",
  steps: [
    {
      label: "开场爱心",
      theme: "neon",
      background: "nebula",
      model: "heart",
      camera: "front",
      modelBrightness: 1.06,
      backgroundBrightness: 1.08,
      duration: 9000,
    },
    {
      label: "近景花朵",
      theme: "rose",
      background: "stage",
      model: "flower",
      camera: "close",
      modelBrightness: 1.08,
      backgroundBrightness: 1.2,
      duration: 10000,
    },
    {
      label: "烟花收尾",
      theme: "laser",
      background: "fireworks",
      model: "fireworks",
      camera: "wide",
      backgroundBrightness: 1.25,
      burst: true,
      duration: 11000,
    },
  ],
};

const state = {
  model: "heart",
  theme: initialTheme,
  color: new THREE.Color(initialTheme.primary),
  accent: new THREE.Color(initialTheme.accent),
  sensitivity: ui.getSensitivity(),
  modelBrightness: ui.getModelBrightness(),
  imageBrightness: ui.getImageBrightness(),
  imageSize: ui.getImageSize(),
  backgroundBrightness: ui.getBackgroundBrightness(),
  gesture: 0,
  gestureControlEnabled: true,
  frozen: false,
  gestureTarget: 0,
  smoothGesture: 0,
  handSpread: 0,
  openness: 0,
  handMode: "idle",
  fistViewActive: false,
  fistViewBaseRoll: 0,
  fistViewBaseY: 0.5,
  fistViewBaseTheta: 0,
  fistViewBasePhi: Math.PI / 2,
  fistViewTheta: 0,
  fistViewPhi: Math.PI / 2,
  lightPulse: 0,
  pointer: new THREE.Vector2(999, 999),
  pointerDown: false,
  pointerActiveUntil: 0,
  pointerBoost: 0,
  recoverUntil: 0,
  hands: null,
  detectedHands: [],
  modelReady: false,
  cameraReady: false,
  resultFrames: 0,
  sentFrames: 0,
  sendFailures: 0,
  lastHandResultTime: 0,
  lastDetectedHandTime: 0,
  lastVideoSendTime: 0,
  lastStatusDetailTime: 0,
  diagnosticHoldUntil: 0,
  lastErrorMessage: "",
  processingVideo: false,
  modelTransition: null,
  cameraTransition: null,
  customText: ui.getCustomText(),
  textFont: ui.getTextFontId(),
  showPreset: ui.getShowPresetId(),
  customShowPreset: loadCustomShowPreset(),
  showPresetActive: false,
  showStepIndex: -1,
  showEditorStepIndex: 0,
  nextShowStepAt: 0,
  manualFreeze: false,
  timelineFreeze: false,
  timelineFreezeAt: 0,
  gestureCommand: { name: "none", pointing: false, pointX: 0, pointY: 0, pointZ: 0 },
  lastGestureCommand: "none",
  gestureCommandUntil: 0,
  audioLevel: 0,
  beatPulse: 0,
  audioMotion: null,
  audioRig: {
    scale: 1,
    x: 0,
    y: 0,
    z: 0,
    tiltX: 0,
    tiltZ: 0,
    impactX: 0,
    impactY: 0,
    impactZ: 0,
    impactTiltX: 0,
    impactTiltZ: 0,
    anchorX: 0,
    anchorY: 0,
    anchorZ: 0,
    yaw: 0,
    spinVelocity: 0,
    motionSeed: 0,
    lastImpact: 0,
  },
  motionTrail: {
    points: [],
    lastSampleAt: 0,
  },
  fireworkExplosion: 0,
  fireworksBurstUntil: 0,
};

const performanceStats = {
  frames: 0,
  lastUpdate: performance.now(),
};

particles.customText = state.customText;
particles.textFont = state.textFont;
setParticleTargets(particles, state.model);
snapParticlesToTargets(particles);
ui.setModelActive(state.model);
syncParticleDrawRange();
syncParticleBrightnessUniforms();
renderShowComposer();
installShowPresetApi();
initCameraTracking();
animate();

shapeSelect.addEventListener("change", () => {
  selectModel(shapeSelect.value);
});

for (const button of modelButtons) {
  button.addEventListener("click", () => {
    selectModel(button.dataset.model);
  });
}

for (const button of modelPlaceholderButtons) {
  button.addEventListener("click", () => {
    showHeldDiagnostic("更多模型入口已预留，后续可在这里接入新模型", 5000);
  });
}

textApplyBtn.addEventListener("click", () => {
  state.customText = ui.getCustomText();
  state.textFont = ui.getTextFontId();
  textInput.value = state.customText;
  selectModel("text", true);
});

textInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    state.customText = ui.getCustomText();
    state.textFont = ui.getTextFontId();
    textInput.value = state.customText;
    selectModel("text", true);
  }
});

textFontSelect.addEventListener("change", () => {
  state.textFont = ui.getTextFontId();
  setTextFont(particles, state.textFont);
  if (state.model === "text") {
    selectModel("text", true);
  }
});

colorPicker.addEventListener("input", () => {
  state.color.set(colorPicker.value);
  syncParticlePalette();
  applyStaticLightColors(staticLights, state.color, state.accent);
  applyThemeToDocument({
    ...state.theme,
    primary: colorPicker.value,
    glowA: hexToGlow(colorPicker.value, 0.15),
  });
  ui.setThemeActive(null);
});

for (const button of themeButtons) {
  button.addEventListener("click", () => {
    const theme = getTheme(button.dataset.theme);
    applyTheme(theme);
  });
}

themeSelect?.addEventListener("change", () => {
  applyTheme(getTheme(themeSelect.value));
});

gestureToggleBtn?.addEventListener("click", () => {
  state.gestureControlEnabled = !state.gestureControlEnabled;
  ui.setGestureControlActive(state.gestureControlEnabled);
  if (!state.gestureControlEnabled) {
    state.detectedHands = [];
    state.gestureTarget = 0;
    state.gesture = THREE.MathUtils.lerp(state.gesture, 0, 0.5);
    state.fistViewActive = false;
    controls.enabled = true;
    ui.setStatus("手势控制已关闭，模型可独立律动", "idle");
    ui.setDiagnostic("摄像头预览已隐藏，手势输入暂不参与粒子控制");
  } else {
    ui.setStatus("手势控制已开启，等待手掌入镜", "ready");
  }
});

freezeToggleBtn?.addEventListener("click", () => {
  if (state.frozen) {
    state.manualFreeze = false;
    state.timelineFreeze = false;
    state.timelineFreezeAt = 0;
  } else {
    state.manualFreeze = true;
    state.timelineFreeze = false;
    state.timelineFreezeAt = 0;
  }
  syncFrozenState();
  if (state.frozen) {
    ui.setStatus("画面已静止，可观察细节或截图", "idle");
  } else {
    ui.setStatus(state.gestureControlEnabled ? "画面继续运行，等待手势输入" : "画面继续运行，手势控制关闭", "ready");
  }
});

showPresetSelect?.addEventListener("change", () => {
  state.showPreset = ui.getShowPresetId();
  state.showStepIndex = -1;
  state.showEditorStepIndex = 0;
  state.nextShowStepAt = 0;
  state.timelineFreeze = false;
  state.timelineFreezeAt = 0;
  syncFrozenState();
  renderShowComposer();
  if (state.showPresetActive) {
    showHeldDiagnostic(`演出预设切换为 ${getActiveShowPreset().label}`, 5000);
  }
});

showPresetToggleBtn?.addEventListener("click", () => {
  state.showPresetActive = !state.showPresetActive;
  state.showPreset = ui.getShowPresetId();
  state.showStepIndex = -1;
  state.nextShowStepAt = 0;
  if (!state.showPresetActive) {
    state.timelineFreeze = false;
    state.timelineFreezeAt = 0;
    syncFrozenState();
  }
  ui.setShowPresetActive(state.showPresetActive);
  showHeldDiagnostic(state.showPresetActive ? "演出巡演已启动" : "演出巡演已停止", 5000);
  renderShowComposer();
});

showTimeline?.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-show-step]");
  if (!button) return;
  const index = Number(button.dataset.showStep);
  const preset = getActiveShowPreset();
  if (!Number.isInteger(index) || !preset.steps[index]) return;
  state.showEditorStepIndex = index;
  ui.setShowStepDraft(preset.steps[index]);
  renderShowComposer();
});

showStepApplyBtn?.addEventListener("click", () => {
  const preset = ensureEditingCustomPreset();
  const index = clampShowStepIndex(state.showEditorStepIndex, preset);
  const step = normalizeShowStep(ui.getShowStepDraft(), index);
  preset.steps[index] = step;
  persistCustomShowPreset();
  applyShowStep(step, preset);
  state.showStepIndex = index;
  state.nextShowStepAt = performance.now() + step.duration;
  showHeldDiagnostic(`已应用自定义片段：${step.label}`, 5000);
  renderShowComposer();
});

showStepCaptureBtn?.addEventListener("click", () => {
  const preset = ensureEditingCustomPreset();
  const index = clampShowStepIndex(state.showEditorStepIndex, preset);
  const step = normalizeShowStep(captureCurrentShowStep(), index);
  preset.steps[index] = step;
  ui.setShowStepDraft(step);
  persistCustomShowPreset();
  showHeldDiagnostic(`已捕获当前画面：${step.label}`, 5000);
  renderShowComposer();
});

showStepAddBtn?.addEventListener("click", () => {
  const preset = ensureEditingCustomPreset();
  const index = clampShowStepIndex(state.showEditorStepIndex, preset);
  const step = normalizeShowStep(ui.getShowStepDraft(), index + 1);
  preset.steps.splice(index + 1, 0, { ...step, label: nextStepLabel(step.label, preset.steps.length + 1) });
  state.showEditorStepIndex = index + 1;
  persistCustomShowPreset();
  renderShowComposer();
  showHeldDiagnostic("已新增自定义演出片段", 4200);
});

showStepDuplicateBtn?.addEventListener("click", () => {
  const preset = ensureEditingCustomPreset();
  const index = clampShowStepIndex(state.showEditorStepIndex, preset);
  const source = preset.steps[index] ?? normalizeShowStep(ui.getShowStepDraft(), index);
  preset.steps.splice(index + 1, 0, { ...source, label: nextStepLabel(source.label, preset.steps.length + 1) });
  state.showEditorStepIndex = index + 1;
  persistCustomShowPreset();
  renderShowComposer();
  showHeldDiagnostic("已复制当前演出片段", 4200);
});

showStepDeleteBtn?.addEventListener("click", () => {
  const preset = ensureEditingCustomPreset();
  if (preset.steps.length <= 1) {
    showHeldDiagnostic("至少保留一个演出片段", 4200);
    return;
  }
  const index = clampShowStepIndex(state.showEditorStepIndex, preset);
  preset.steps.splice(index, 1);
  state.showEditorStepIndex = Math.min(index, preset.steps.length - 1);
  persistCustomShowPreset();
  renderShowComposer();
  showHeldDiagnostic("已删除自定义演出片段", 4200);
});

showStepExportBtn?.addEventListener("click", () => {
  ui.setShowJson(JSON.stringify(getActiveShowPreset(), null, 2));
  showHeldDiagnostic("已导出当前演出 JSON，可复制保存或继续修改后导入", 6000);
});

showStepImportBtn?.addEventListener("click", () => {
  try {
    importCustomShowPreset(JSON.parse(ui.getShowJson()), "自定义演出 JSON 已导入");
  } catch (error) {
    showHeldDiagnostic(`导入失败：${error?.message ?? "JSON 格式不正确"}`, 8000);
  }
});

showStepFileImportBtn?.addEventListener("click", () => {
  showPresetFileInput?.click();
});

showPresetFileInput?.addEventListener("change", async () => {
  const [file] = showPresetFileInput.files ?? [];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    importCustomShowPreset(parsed, `已从文件导入演出：${file.name}`);
  } catch (error) {
    showHeldDiagnostic(`文件导入失败：${error?.message ?? "JSON 格式不正确"}`, 8000);
  } finally {
    showPresetFileInput.value = "";
  }
});

for (const button of backgroundButtons) {
  button.addEventListener("click", () => {
    setBackgroundMode(backgroundSystem, button.dataset.background, state.theme);
    ui.setBackgroundActive(backgroundSystem.mode);
    ui.saveBackgroundMode(backgroundSystem.mode);
  });
}

backgroundSelect?.addEventListener("change", () => {
  setBackgroundMode(backgroundSystem, backgroundSelect.value, state.theme);
  ui.setBackgroundActive(backgroundSystem.mode);
  ui.saveBackgroundMode(backgroundSystem.mode);
});

backgroundBrightness?.addEventListener("input", () => {
  state.backgroundBrightness = ui.getBackgroundBrightness();
  setBackgroundBrightness(backgroundSystem, state.backgroundBrightness, state.theme);
});

modelBrightness?.addEventListener("input", () => {
  state.modelBrightness = ui.getModelBrightness();
  syncParticleBrightnessUniforms();
});

imageBrightness?.addEventListener("input", () => {
  state.imageBrightness = ui.getImageBrightness();
  syncParticleBrightnessUniforms();
});

imageSize?.addEventListener("input", () => {
  state.imageSize = ui.getImageSize();
  syncParticleDrawRange();
});

micToggleBtn.addEventListener("click", async () => {
  try {
    await useMicrophone(audioReactor);
    ui.setAudioActive("mic");
  } catch (error) {
    console.error(error);
    ui.setDiagnostic(`麦克风不可用：${error?.message ?? "unknown error"}`);
  }
});

audioFileInput.addEventListener("change", async () => {
  const [file] = audioFileInput.files ?? [];
  if (!file) return;
  try {
    await useAudioFile(audioReactor, file);
    ui.setAudioActive("file");
  } catch (error) {
    console.error(error);
    ui.setDiagnostic(`音频文件不可用：${error?.message ?? "unknown error"}`);
  }
});

imageFileInput?.addEventListener("change", async () => {
  const [file] = imageFileInput.files ?? [];
  if (!file) return;
  try {
    ui.setImportProgress({ active: true, value: 0.06, label: "准备读取图片" });
    showHeldDiagnostic(`正在分析 ${file.name}，大图或高粒子档可能需要几秒`, 60000);
    const imageSampleTarget = Math.min(
      qualityProfile.maxImageSamples ?? 1200000,
      Math.round(particles.count * (qualityProfile.imageSampleMultiplier ?? 3)),
    );
    const points = await createImagePointCloud(
      file,
      { ...ui.getImageOptions(), maxSide: qualityProfile.imageMaxSide },
      imageSampleTarget,
      (progress) => {
        ui.setImportProgress({ active: true, ...progress });
      },
    );
    ui.setImportProgress({ active: true, value: 0.94, label: "正在生成图片粒子" });
    setImagePoints(particles, points);
    selectModel("image", true);
    syncParticleDrawRange();
    syncParticleBrightnessUniforms();
    ui.setImportProgress({ active: true, value: 1, label: "图片导入完成" });
    showHeldDiagnostic(`图片/Logo 已生成 ${points.length} 个采样点，可用手势和音乐驱动`, 8000);
    window.setTimeout(() => ui.setImportProgress({ active: false }), 900);
  } catch (error) {
    console.error(error);
    ui.setImportProgress({ active: true, value: 1, label: "加载失败，请重新导入", error: true });
    showHeldDiagnostic(`加载失败，请重新导入：${error?.message ?? "unknown error"}`, 12000);
  } finally {
    imageFileInput.value = "";
  }
});

meshFileInput?.addEventListener("change", async () => {
  const [file] = meshFileInput.files ?? [];
  if (!file) return;
  try {
    ui.setImportProgress({ active: true, value: 0.06, label: "准备读取 GLB" });
    showHeldDiagnostic("正在读取 GLB 并采样模型表面", 60000);
    const meshSampleTarget = Math.min(
      qualityProfile.maxMeshSamples ?? 360000,
      Math.round(particles.count * (qualityProfile.meshSampleMultiplier ?? 1)),
    );
    const points = await createMeshPointCloud(file, meshSampleTarget, (progress) => {
      ui.setImportProgress({ active: true, ...progress });
    });
    ui.setImportProgress({ active: true, value: 0.94, label: "正在生成 3D 粒子" });
    setMeshPoints(particles, points);
    selectModel("mesh", true);
    ui.setImportProgress({ active: true, value: 1, label: "GLB 导入完成" });
    showHeldDiagnostic(`GLB 模型已生成 ${points.length} 个 3D 表面采样点`, 8000);
    window.setTimeout(() => ui.setImportProgress({ active: false }), 900);
  } catch (error) {
    console.error(error);
    ui.setImportProgress({ active: true, value: 1, label: "加载失败，请重新导入", error: true });
    showHeldDiagnostic(`加载失败，请重新导入：${error?.message ?? "unknown error"}`, 12000);
  } finally {
    meshFileInput.value = "";
  }
});

audioStopBtn.addEventListener("click", () => {
  stopAudioSource(audioReactor);
  ui.setAudioActive("off");
  ui.updateAudioLevel(0);
});

sensitivity.addEventListener("input", () => {
  state.sensitivity = ui.getSensitivity();
});

fullscreenBtn.addEventListener("click", async () => {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen();
  } else {
    await document.exitFullscreen();
  }
});

document.addEventListener("fullscreenchange", () => {
  ui.setFullscreenActive(Boolean(document.fullscreenElement));
});

window.addEventListener("pointermove", (event) => {
  if (event.target.closest?.(".panel")) return;
  state.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  state.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  if (event.shiftKey) {
    state.pointerActiveUntil = performance.now() + 650;
    state.pointerBoost = Math.max(state.pointerBoost, 0.42);
  }
});

window.addEventListener("pointerdown", (event) => {
  if (!event.target.closest?.(".panel") && state.model === "fireworks" && !event.shiftKey) {
    triggerFireworksBurst();
  }

  if (event.target.closest?.(".panel") || !event.shiftKey) return;
  state.pointerDown = true;
  state.pointerActiveUntil = performance.now() + 1200;
  state.pointerBoost = 1;
  state.recoverUntil = 0;
  state.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  state.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener("pointerup", () => {
  state.pointerDown = false;
  state.pointerActiveUntil = 0;
  state.recoverUntil = performance.now() + 1400;
});

window.addEventListener("pointerleave", () => {
  state.pointerDown = false;
  state.pointerActiveUntil = 0;
  state.recoverUntil = performance.now() + 1400;
});

window.addEventListener("resize", () => {
  const nextPixelRatio = renderPixelRatio(qualityProfile);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(nextPixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  particles.material.uniforms.uPixelRatio.value = nextPixelRatio;
});

async function initCameraTracking() {
  try {
    ui.setStatus("正在加载手势模型", "idle");
    const handsModule = await import("@mediapipe/hands");
    const Hands = resolveHandsConstructor(handsModule);

    state.hands = new Hands({
      locateFile: (file) => `${MP_HANDS_ASSET_BASE}${file}`,
    });
    state.hands.setOptions({
      maxNumHands: 2,
      modelComplexity: qualityProfile.modelComplexity,
      minDetectionConfidence: 0.35,
      minTrackingConfidence: 0.35,
      selfieMode: true,
    });
    state.hands.onResults((results) => {
      state.detectedHands = results.multiHandLandmarks ?? [];
      state.lastHandResultTime = performance.now();
      state.resultFrames += 1;
      if (state.detectedHands.length > 0) {
        state.lastDetectedHandTime = state.lastHandResultTime;
      }
    });

    if (typeof state.hands.initialize === "function") {
      await state.hands.initialize();
    }
    state.modelReady = true;
    ui.setDiagnostic("模型已加载，正在请求摄像头");

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera API is not available in this browser context.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: qualityProfile.video.width },
        height: { ideal: qualityProfile.video.height },
        facingMode: "user",
      },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    state.cameraReady = true;
    processVideoFrame();
    ui.setStatus("摄像头已开启，等待双手入镜", "ready");
  } catch (error) {
    console.warn(error);
    state.lastErrorMessage = error?.message ?? "unknown error";
    ui.setStatus("摄像头或手势模型不可用，可用鼠标预览粒子", "error");
    ui.setDiagnostic(`错误：${state.lastErrorMessage}`);
  }
}

function resolveHandsConstructor(module) {
  const globalScope = typeof globalThis !== "undefined" ? globalThis : undefined;
  const candidates = [
    module?.Hands,
    module?.default?.Hands,
    module?.default,
    module?.t?.Hands,
    module?.["module.exports"]?.Hands,
    globalScope?.Hands,
  ];
  const Hands = candidates.find((candidate) => typeof candidate === "function");
  if (!Hands) {
    throw new Error("MediaPipe Hands 模块导出不可用");
  }
  return Hands;
}

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.033);
  const elapsed = clock.elapsedTime;
  const now = performance.now();
  updatePerformanceStats(now);
  if (state.showPresetActive && (!state.manualFreeze || state.timelineFreeze)) {
    updateShowPreset(now);
  }
  activateTimelineFreezeIfReady(now);
  if (state.frozen) {
    updateCameraRig(delta, now);
    composer.render();
    return;
  }
  const audio = updateAudioReactor(audioReactor);
  state.audioMotion = audio;
  state.audioLevel = audio.level;
  state.beatPulse = audio.beat;
  ui.updateAudioLevel(audio);
  particles.material.uniforms.uTime.value = elapsed;
  detectHands(now);
  updateFireworkExplosion(now);
  updateParticles(particles, state, {
    delta,
    elapsed,
    now,
    renderer,
    bloomPass,
    onGestureUpdate: ui.updateGestureMeter,
  });

  updateCameraRig(delta, now);
  state.lightPulse = updateStaticLights(staticLights, elapsed);
  updateBackground(backgroundSystem, elapsed, state.audioMotion, state.model);
  updateParticleRig(delta, elapsed, state.audioMotion);

  composer.render();
}

function detectHands(now) {
  if (!state.gestureControlEnabled) {
    state.detectedHands = [];
    easeGestureToFallback(now, 0);
    updateDiagnostics(0, now);
    return;
  }

  if (!state.hands || video.readyState < 2) {
    easeGestureToFallback(now);
    updateDiagnostics(0, now);
    return;
  }

  const hands = now - state.lastHandResultTime < 1200 ? state.detectedHands : [];

  if (hands.length === 0) {
    easeGestureToFallback(now);
    state.gestureCommand = { name: "none", pointing: false, pointX: 0, pointY: 0, pointZ: 0 };
    state.handMode = "idle";
    state.fistViewActive = false;
    controls.enabled = true;
    ui.setStatus("等待手掌入镜", "ready");
    updateDiagnostics(0, now);
    return;
  }

  const opennessValues = hands.map(calculateHandOpenness);
  const openness = average(opennessValues);
  let spread = openness;

  if (hands.length >= 2) {
    const c0 = palmCenter(hands[0]);
    const c1 = palmCenter(hands[1]);
    const distance = Math.hypot(c0.x - c1.x, c0.y - c1.y);
    spread = THREE.MathUtils.clamp((distance - 0.1) / 0.34, 0, 1);
    ui.setStatus("双手已追踪，实时响应中", "ready");
  } else {
    ui.setStatus("单手追踪中，双手可控制整体扩散", "ready");
  }

  state.openness = openness;
  state.handSpread = spread;
  const rawGesture = hands.length >= 2 ? spread * 0.48 + openness * 0.52 : openness;
  const gestureFloor = THREE.MathUtils.clamp(0.22 - (state.sensitivity - 1) * 0.12, 0.08, 0.34);
  const gestureRange = THREE.MathUtils.clamp(0.58 - (state.sensitivity - 1) * 0.16, 0.38, 0.78);
  const responsiveGesture = THREE.MathUtils.clamp((rawGesture - gestureFloor) / gestureRange, 0, 1);
  state.gestureTarget = THREE.MathUtils.clamp(Math.pow(responsiveGesture, 1.22), 0, 1);
  state.handMode = state.gestureTarget > 0.62 ? "展开" : state.gestureTarget < 0.26 ? "收拢" : "半开";
  const follow = state.gestureTarget > state.gesture ? 0.12 : 0.28;
  state.gesture = THREE.MathUtils.lerp(state.gesture, state.gestureTarget, follow);
  updateGestureCommand(hands, now);
  updateFistViewControl(hands[0], hands.length);
  updateDiagnostics(hands.length, now);
}

function updateGestureCommand(hands, now) {
  const command = classifyGestureCommand(hands);
  if (command.name !== "none") {
    if (command.pointing && state.gestureCommand?.pointing) {
      command.pointX = THREE.MathUtils.lerp(state.gestureCommand.pointX, command.pointX, 0.36);
      command.pointY = THREE.MathUtils.lerp(state.gestureCommand.pointY, command.pointY, 0.36);
      command.pointZ = THREE.MathUtils.lerp(state.gestureCommand.pointZ, command.pointZ, 0.36);
    }
    state.gestureCommand = command;
    state.lastGestureCommand = command.name;
    state.gestureCommandUntil = now + (command.pointing ? 220 : 520);
    return;
  }

  if (now < state.gestureCommandUntil && state.gestureCommand?.name !== "none") {
    if (state.gestureCommand.pointing) {
      state.gestureCommand = {
        ...state.gestureCommand,
        pointX: THREE.MathUtils.lerp(state.gestureCommand.pointX, 0, 0.08),
        pointY: THREE.MathUtils.lerp(state.gestureCommand.pointY, 0, 0.08),
        pointZ: THREE.MathUtils.lerp(state.gestureCommand.pointZ, 0, 0.08),
      };
    }
    return;
  }

  state.gestureCommand = command;
  state.lastGestureCommand = "none";
}

async function processVideoFrame() {
  if (!state.hands) return;
  if (state.processingVideo) {
    requestAnimationFrame(processVideoFrame);
    return;
  }

  const now = performance.now();
  if (now - state.lastVideoSendTime < qualityProfile.frameInterval) {
    requestAnimationFrame(processVideoFrame);
    return;
  }

  state.processingVideo = true;
  try {
    if (video.readyState >= 2) {
      state.lastVideoSendTime = now;
      state.sentFrames += 1;
      await state.hands.send({ image: video });
    }
  } catch (error) {
    console.error(error);
    state.sendFailures += 1;
    state.lastErrorMessage = error?.message ?? "send failed";
    ui.setStatus("手势识别暂停，可用鼠标预览粒子", "error");
    ui.setDiagnostic(`识别循环错误：${state.lastErrorMessage}`);
  } finally {
    state.processingVideo = false;
    requestAnimationFrame(processVideoFrame);
  }
}

function updateFistViewControl(hand, handCount) {
  if (state.cameraTransition) {
    state.fistViewActive = false;
    return;
  }

  const active = handCount === 1 && state.gestureTarget < 0.24;

  if (!active) {
    if (state.fistViewActive) {
      controls.enabled = true;
    }
    state.fistViewActive = false;
    return;
  }

  const pose = fistViewPose(hand);
  const cameraOffset = camera.position.clone().sub(controls.target);
  const current = new THREE.Spherical().setFromVector3(cameraOffset);

  if (!state.fistViewActive) {
    state.fistViewBaseRoll = pose.roll;
    state.fistViewBaseY = pose.centerY;
    state.fistViewBaseTheta = current.theta;
    state.fistViewBasePhi = current.phi;
    state.fistViewTheta = current.theta;
    state.fistViewPhi = current.phi;
  }

  const rollDelta = normalizeAngle(pose.roll - state.fistViewBaseRoll);
  state.fistViewTheta = state.fistViewBaseTheta - rollDelta * 1.9;
  state.fistViewPhi = THREE.MathUtils.clamp(
    state.fistViewBasePhi + (pose.centerY - state.fistViewBaseY) * 3.0,
    0.68,
    2.35,
  );
  state.fistViewActive = true;
  controls.enabled = false;
}

function applyFistCameraControl(delta) {
  if (!state.fistViewActive) return;

  const offset = camera.position.clone().sub(controls.target);
  const spherical = new THREE.Spherical().setFromVector3(offset);
  const follow = Math.min(1, delta * 9.0);
  spherical.theta = lerpAngle(spherical.theta, state.fistViewTheta, follow);
  spherical.phi = THREE.MathUtils.lerp(spherical.phi, state.fistViewPhi, follow);
  spherical.radius = THREE.MathUtils.clamp(spherical.radius, controls.minDistance, controls.maxDistance);
  spherical.makeSafe();

  camera.position.copy(new THREE.Vector3().setFromSpherical(spherical).add(controls.target));
  camera.lookAt(controls.target);
}

function easeGestureToFallback(now, forcedPointerForce = null) {
  const pointerIsActive = state.pointerDown || now < state.pointerActiveUntil;
  const pointerForce =
    forcedPointerForce ??
    (state.pointerDown
      ? THREE.MathUtils.clamp(0.48 + (1 - state.pointer.length() * 0.35) * 0.26, 0.34, 0.72)
      : pointerIsActive
        ? THREE.MathUtils.clamp(0.18 + (1 - state.pointer.length() * 0.35) * 0.24, 0.12, 0.42)
        : 0.02);
  state.gestureTarget = pointerForce;
  state.gesture = THREE.MathUtils.lerp(state.gesture, pointerForce, pointerIsActive ? 0.16 : 0.22);
  state.fistViewActive = false;
  controls.enabled = true;
}

function updateDiagnostics(handCount, now) {
  if (now - state.lastStatusDetailTime < 250) return;
  state.lastStatusDetailTime = now;

  if (now < state.diagnosticHoldUntil) {
    return;
  }

  if (!state.gestureControlEnabled) {
    ui.setDiagnostic("手势控制关闭中；点击“手势关”可恢复摄像头预览和手势输入");
    return;
  }

  if (!state.modelReady) {
    ui.setDiagnostic("模型加载中");
    return;
  }

  if (!state.cameraReady || video.readyState < 2) {
    ui.setDiagnostic("摄像头未就绪：请允许浏览器摄像头权限");
    return;
  }

  if (state.sentFrames > 0 && state.resultFrames === 0) {
    ui.setDiagnostic("摄像头有画面，但模型还没有返回结果");
    return;
  }

  if (handCount > 0) {
    const viewText = state.fistViewActive ? "，拳头视角控制中" : "";
    const commandText =
      state.gestureCommand?.name === "point"
        ? "，食指指向控制中"
        : state.gestureCommand?.name === "heart"
          ? "，比心指令"
          : "";
    ui.setDiagnostic(
      `识别到 ${handCount} 只手，${state.handMode}，目标 ${Math.round(
        state.gestureTarget * 100,
      )}%，当前 ${Math.round(state.gesture * 100)}%${viewText}${commandText}，已分析 ${state.resultFrames} 帧`,
    );
    return;
  }

  const secondsSinceHand =
    state.lastDetectedHandTime > 0 ? Math.round((now - state.lastDetectedHandTime) / 1000) : null;
  const lastSeen = secondsSinceHand === null ? "尚未识别到手" : `${secondsSinceHand} 秒前识别过手`;
  ui.setDiagnostic(`${lastSeen}，请让完整手掌出现在下方预览框中`);
}

function applyTheme(theme, options = {}) {
  const { save = true } = options;
  state.theme = theme;
  state.color.set(theme.primary);
  state.accent.set(theme.accent);
  colorPicker.value = theme.primary;
  syncParticlePalette();
  scene.fog.color.set(theme.background);
  applyStaticLightColors(staticLights, state.color, state.accent);
  motionTrail.material.color.set(theme.accent ?? theme.rim);
  motionTrail.tubeMaterial.color.set(theme.accent ?? theme.primary);
  motionTrail.sparkMaterial.uniforms.uColor.value.set(theme.primary ?? theme.accent);
  applyBackgroundTheme(backgroundSystem, theme);
  applyThemeToDocument(theme);
  ui.setThemeActive(theme.id);
  if (save) {
    ui.saveThemeId(theme.id);
  }
}

function showHeldDiagnostic(text, duration = 8000) {
  ui.setDiagnostic(text);
  state.diagnosticHoldUntil = performance.now() + duration;
}

function updateShowPreset(now) {
  if (!state.showPresetActive) return;
  const preset = getActiveShowPreset();
  const steps = preset.steps;
  if (!steps.length) return;
  if (now < state.nextShowStepAt) return;

  state.showStepIndex = (state.showStepIndex + 1) % steps.length;
  const step = normalizeShowStep(steps[state.showStepIndex], state.showStepIndex);
  applyShowStep(step, preset);
  state.nextShowStepAt = now + step.duration;
  renderShowComposer({ syncDraft: false });
}

function applyShowStep(step, preset) {
  const normalized = normalizeShowStep(step, state.showStepIndex);
  if (normalized.theme) {
    applyTheme(getTheme(normalized.theme), { save: false });
  }
  if (normalized.background) {
    setBackgroundMode(backgroundSystem, normalized.background, state.theme);
    ui.setBackgroundActive(backgroundSystem.mode);
  }
  setModelBrightnessRatio(normalized.modelBrightness);
  setBackgroundBrightnessRatio(normalized.backgroundBrightness);
  setImageBrightnessRatio(normalized.imageBrightness);
  setImageSizeRatio(normalized.imageSize);

  if (normalized.text && textInput) {
    textInput.value = normalized.text;
  }

  const model = resolveShowModel(normalized.model);
  selectModel(model, model === "text");
  if (normalized.camera && normalized.camera !== "hold") {
    startCameraTransition(normalized.camera, normalized.cameraDuration);
  }
  if (normalized.burst) {
    triggerShowBurst();
  } else if (model === "fireworks") {
    triggerFireworksBurst();
  }

  scheduleTimelineFreeze(normalized);
  showHeldDiagnostic(`演出：${preset.label} / ${normalized.label}`, 3600);
}

function resolveShowModel(model) {
  if (model === "image" && !particles.customImagePoints?.length) {
    return "heart";
  }
  if (model === "mesh" && !particles.customMeshPoints?.length) {
    return "saturn";
  }
  return model;
}

function getActiveShowPreset() {
  if (state.showPreset === "custom") {
    return state.customShowPreset;
  }
  return SHOW_PRESETS[state.showPreset] ?? SHOW_PRESETS.auto;
}

function showPresetOptionList() {
  return [
    ...Object.entries(SHOW_PRESETS).map(([id, preset]) => ({ id, label: preset.label })),
    { id: "custom", label: "自定义编排" },
  ];
}

function ensureEditingCustomPreset() {
  if (state.showPreset !== "custom") {
    state.customShowPreset = normalizeShowPreset(cloneShowPreset(getActiveShowPreset()), "自定义编排");
    state.customShowPreset.label = "自定义编排";
    state.showPreset = "custom";
    state.showStepIndex = -1;
    state.nextShowStepAt = 0;
    ui.setShowPresetId("custom");
  }
  return state.customShowPreset;
}

function importCustomShowPreset(input, message = "自定义演出已导入") {
  state.customShowPreset = normalizeShowPreset(input, "自定义编排");
  state.showPreset = "custom";
  state.showStepIndex = -1;
  state.showEditorStepIndex = 0;
  state.nextShowStepAt = 0;
  state.timelineFreeze = false;
  state.timelineFreezeAt = 0;
  syncFrozenState();
  ui.setShowPresetId("custom");
  persistCustomShowPreset();
  renderShowComposer();
  ui.setShowJson(JSON.stringify(state.customShowPreset, null, 2));
  showHeldDiagnostic(message, 6000);
}

function installShowPresetApi() {
  if (typeof window === "undefined") return;
  window.handParticleShows = {
    list: () => showPresetOptionList().map((preset) => ({ ...preset })),
    current: () => cloneShowPreset(getActiveShowPreset()),
    importPreset: (preset) => {
      importCustomShowPreset(preset, "外部接口已导入自定义演出");
      return cloneShowPreset(state.customShowPreset);
    },
    play: (presetId = "custom") => {
      ui.setShowPresetId(presetId);
      state.showPreset = ui.getShowPresetId();
      state.showPresetActive = true;
      state.showStepIndex = -1;
      state.nextShowStepAt = 0;
      ui.setShowPresetActive(true);
      renderShowComposer();
      return cloneShowPreset(getActiveShowPreset());
    },
    stop: () => {
      state.showPresetActive = false;
      state.timelineFreeze = false;
      state.timelineFreezeAt = 0;
      syncFrozenState();
      ui.setShowPresetActive(false);
    },
  };
}

function renderShowComposer(options = {}) {
  const { syncDraft = true } = options;
  const preset = getActiveShowPreset();
  state.showEditorStepIndex = clampShowStepIndex(state.showEditorStepIndex, preset);
  ui.renderShowTimeline(preset, state.showStepIndex, state.showEditorStepIndex);
  if (syncDraft) {
    ui.setShowStepDraft(preset.steps[state.showEditorStepIndex] ?? DEFAULT_CUSTOM_SHOW.steps[0]);
  }
}

function clampShowStepIndex(index, preset = getActiveShowPreset()) {
  const max = Math.max(0, (preset.steps?.length ?? 1) - 1);
  return THREE.MathUtils.clamp(Number.isInteger(index) ? index : 0, 0, max);
}

function captureCurrentShowStep() {
  return {
    label: `捕获${modelLabel(state.model)}`,
    duration: 10000,
    theme: state.theme?.id ?? "neon",
    background: backgroundSystem.mode,
    model: state.model,
    text: state.customText,
    camera: nearestCameraShot(),
    modelBrightness: state.modelBrightness,
    backgroundBrightness: state.backgroundBrightness,
    imageBrightness: state.imageBrightness,
    imageSize: state.imageSize,
    burst: state.model === "fireworks",
    freeze: state.frozen,
  };
}

function normalizeShowPreset(input, fallbackLabel = "自定义编排") {
  const source = Array.isArray(input) ? { label: fallbackLabel, steps: input } : input;
  const rawSteps = Array.isArray(source?.steps)
    ? source.steps
    : source && typeof source === "object" && source.model
      ? [source]
      : DEFAULT_CUSTOM_SHOW.steps;
  const steps = rawSteps.slice(0, 80).map((step, index) => normalizeShowStep(step, index));
  return {
    label: normalizeShowPresetLabel(source?.label ?? fallbackLabel),
    steps: steps.length > 0 ? steps : DEFAULT_CUSTOM_SHOW.steps.map((step, index) => normalizeShowStep(step, index)),
  };
}

function normalizeShowStep(step = {}, index = 0) {
  const duration = normalizeShowDuration(step.duration ?? step.seconds);
  return {
    label: normalizeShowLabel(step.label, index),
    duration,
    theme: SHOW_THEMES.has(step.theme) ? step.theme : "neon",
    background: SHOW_BACKGROUNDS.has(step.background) ? step.background : "nebula",
    model: SHOW_MODELS.has(step.model) ? step.model : "heart",
    text: normalizeShowText(step.text ?? "LOVE"),
    camera: normalizeCameraSpec(step.camera),
    cameraDuration: normalizeShowDuration(step.cameraDuration ?? 1400, 300, 6000),
    modelBrightness: normalizeShowRatio(step.modelBrightness, 1, 0.45, 2.2),
    backgroundBrightness: normalizeShowRatio(step.backgroundBrightness, 1, 0.35, 2.2),
    imageBrightness: normalizeShowRatio(step.imageBrightness, 2.8, 0.6, 4.8),
    imageSize: normalizeShowRatio(step.imageSize, 1, 0.45, 1),
    burst: normalizeShowBoolean(step.burst),
    freeze: normalizeShowBoolean(step.freeze),
  };
}

function normalizeShowDuration(value, min = 2000, max = 120000) {
  const numeric = Number(value);
  const milliseconds = numeric > 0 && numeric <= 120 ? numeric * 1000 : numeric;
  return Math.round(THREE.MathUtils.clamp(Number.isFinite(milliseconds) ? milliseconds : 10000, min, max));
}

function normalizeShowRatio(value, fallback, min, max) {
  if (value === undefined || value === null || value === "") return fallback;
  const numeric = Number(String(value).replace("%", ""));
  const ratio = numeric > 10 ? numeric / 100 : numeric;
  return THREE.MathUtils.clamp(Number.isFinite(ratio) ? ratio : fallback, min, max);
}

function normalizeShowBoolean(value) {
  if (typeof value === "string") {
    return value === "1" || value.toLowerCase() === "true" || value === "是";
  }
  return Boolean(value);
}

function normalizeShowPresetLabel(label) {
  const trimmed = String(label ?? "").trim();
  return trimmed.length > 0 ? trimmed.slice(0, 24) : "自定义编排";
}

function normalizeShowLabel(label, index) {
  const trimmed = String(label ?? "").trim();
  return trimmed.length > 0 ? trimmed.slice(0, 18) : `片段 ${index + 1}`;
}

function normalizeShowText(text) {
  const trimmed = String(text ?? "").trim();
  return trimmed.length > 0 ? trimmed.slice(0, 18) : "LOVE";
}

function normalizeCameraSpec(cameraSpec) {
  if (!cameraSpec || cameraSpec === "hold") return "hold";
  if (typeof cameraSpec === "string") {
    return CAMERA_SHOTS[cameraSpec] ? cameraSpec : "hold";
  }
  const position = vectorArray(cameraSpec.position);
  const target = vectorArray(cameraSpec.target);
  if (!position || !target) return "hold";
  return { position, target };
}

function vectorArray(value) {
  if (!Array.isArray(value) || value.length < 3) return null;
  const vector = value.slice(0, 3).map(Number);
  return vector.every(Number.isFinite) ? vector : null;
}

function cloneShowPreset(preset) {
  return JSON.parse(JSON.stringify(preset));
}

function loadCustomShowPreset() {
  try {
    const raw = localStorage.getItem(CUSTOM_SHOW_STORAGE_KEY);
    return raw ? normalizeShowPreset(JSON.parse(raw), "自定义编排") : normalizeShowPreset(DEFAULT_CUSTOM_SHOW);
  } catch {
    return normalizeShowPreset(DEFAULT_CUSTOM_SHOW);
  }
}

function persistCustomShowPreset() {
  state.customShowPreset = normalizeShowPreset(state.customShowPreset, "自定义编排");
  try {
    localStorage.setItem(CUSTOM_SHOW_STORAGE_KEY, JSON.stringify(state.customShowPreset));
  } catch {
    // Local storage can be unavailable in strict privacy modes.
  }
}

function nextStepLabel(label, count) {
  const base = String(label ?? "片段").replace(/\s+\d+$/, "").slice(0, 14).trim() || "片段";
  return `${base} ${count}`;
}

function setModelBrightnessRatio(value) {
  setRangeRatio(modelBrightness, value);
  state.modelBrightness = ui.getModelBrightness();
  syncParticleBrightnessUniforms();
}

function setBackgroundBrightnessRatio(value) {
  setRangeRatio(backgroundBrightness, value);
  state.backgroundBrightness = ui.getBackgroundBrightness();
  setBackgroundBrightness(backgroundSystem, state.backgroundBrightness, state.theme);
}

function setImageBrightnessRatio(value) {
  setRangeRatio(imageBrightness, value);
  state.imageBrightness = ui.getImageBrightness();
  syncParticleBrightnessUniforms();
}

function setImageSizeRatio(value) {
  setRangeRatio(imageSize, value);
  state.imageSize = ui.getImageSize();
  syncParticleDrawRange();
}

function setRangeRatio(input, ratio) {
  if (!input) return;
  const min = Number(input.min);
  const max = Number(input.max);
  const step = Number(input.step) || 1;
  const raw = THREE.MathUtils.clamp(Number(ratio) * 100, min, max);
  const aligned = Math.round(raw / step) * step;
  input.value = String(THREE.MathUtils.clamp(aligned, min, max));
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function scheduleTimelineFreeze(step) {
  state.timelineFreeze = false;
  state.timelineFreezeAt = step.freeze ? performance.now() + Math.min(1400, step.duration * 0.42) : 0;
  syncFrozenState();
}

function activateTimelineFreezeIfReady(now) {
  if (state.timelineFreezeAt <= 0 || now < state.timelineFreezeAt) return;
  state.timelineFreezeAt = 0;
  state.timelineFreeze = true;
  syncFrozenState();
}

function syncFrozenState() {
  state.frozen = state.manualFreeze || state.timelineFreeze;
  ui.setFreezeActive(state.frozen);
}

function updateCameraRig(delta, now) {
  if (state.cameraTransition) {
    updateCameraTransition(now);
    return;
  }
  controls.update();
  applyFistCameraControl(delta);
}

function startCameraTransition(cameraSpec, duration = 1400) {
  const shot = resolveCameraShot(cameraSpec);
  if (!shot) return;
  state.fistViewActive = false;
  controls.enabled = false;
  state.cameraTransition = {
    startedAt: performance.now(),
    duration: THREE.MathUtils.clamp(Number(duration) || 1400, 300, 6000),
    fromPosition: camera.position.clone(),
    fromTarget: controls.target.clone(),
    toPosition: shot.position,
    toTarget: shot.target,
  };
}

function updateCameraTransition(now) {
  const transition = state.cameraTransition;
  if (!transition) return;
  const progress = THREE.MathUtils.clamp((now - transition.startedAt) / transition.duration, 0, 1);
  const eased = progress * progress * (3 - 2 * progress);
  camera.position.lerpVectors(transition.fromPosition, transition.toPosition, eased);
  controls.target.lerpVectors(transition.fromTarget, transition.toTarget, eased);
  camera.lookAt(controls.target);
  if (progress >= 1) {
    state.cameraTransition = null;
    controls.enabled = true;
    controls.update();
  }
}

function resolveCameraShot(cameraSpec) {
  if (!cameraSpec || cameraSpec === "hold") return null;
  const shot = typeof cameraSpec === "string" ? CAMERA_SHOTS[cameraSpec] : cameraSpec;
  const position = vectorArray(shot?.position);
  const target = vectorArray(shot?.target);
  if (!position || !target) return null;
  return {
    position: new THREE.Vector3(...position),
    target: new THREE.Vector3(...target),
  };
}

function nearestCameraShot() {
  let bestId = "front";
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [id, shot] of Object.entries(CAMERA_SHOTS)) {
    const position = new THREE.Vector3(...shot.position);
    const target = new THREE.Vector3(...shot.target);
    const distance = camera.position.distanceToSquared(position) + controls.target.distanceToSquared(target) * 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestId = id;
    }
  }
  return bestId;
}

function triggerShowBurst() {
  triggerFireworksBurst();
  state.pointerBoost = Math.max(state.pointerBoost, 0.92);
  state.pointerActiveUntil = performance.now() + 900;
  state.recoverUntil = performance.now() + 1600;
  state.gesture = Math.max(state.gesture, 0.24);
  state.gestureTarget = Math.max(state.gestureTarget, 0.42);
}

function modelLabel(model) {
  if (model === "flower") return "花朵";
  if (model === "saturn") return "土星";
  if (model === "fireworks") return "烟花";
  if (model === "text") return "文字";
  if (model === "image") return "图片";
  if (model === "mesh") return "3D";
  return "爱心";
}

function syncParticlePalette() {
  const palette = particlePaletteForModel(state.model, state);
  particles.material.uniforms.uColor.value.set(palette.primary);
  particles.material.uniforms.uAccent.value.set(palette.accent);
}

function particlePaletteForModel(model, currentState) {
  if (model === "flower") {
    return {
      primary: "#c80b32",
      accent: "#47d07a",
    };
  }

  if (model === "saturn") {
    return {
      primary: "#f6c76a",
      accent: currentState.theme?.accent ?? "#7fdcff",
    };
  }

  if (model === "fireworks") {
    return {
      primary: currentState.theme?.primary ?? "#ffd166",
      accent: "#fff4c2",
    };
  }

  return {
    primary: `#${currentState.color.getHexString()}`,
    accent: `#${currentState.accent.getHexString()}`,
  };
}

function selectModel(model, forceRefresh = false) {
  if (!model) return;
  const normalized = model === "text" ? "text" : model;
  if (normalized === "image" && !particles.customImagePoints?.length) {
    showHeldDiagnostic("请先上传图片/Logo，导入后会自动切换到图片粒子", 7000);
    imageFileInput?.click();
    return;
  }
  if (normalized === "mesh" && !particles.customMeshPoints?.length) {
    showHeldDiagnostic("请先上传 GLB 模型，导入后会自动切换到 3D 粒子", 7000);
    meshFileInput?.click();
    return;
  }
  if (!forceRefresh && state.model === normalized) return;

  state.model = normalized;
  shapeSelect.value = normalized;
  ui.setModelActive(normalized);
  state.modelTransition = {
    startedAt: performance.now(),
    duration: 1250,
  };

  if (normalized === "text") {
    state.customText = ui.getCustomText();
    state.textFont = ui.getTextFontId();
    textInput.value = state.customText;
    particles.customText = state.customText;
    setCustomText(particles, state.customText, state.textFont);
  } else {
    setParticleTargets(particles, normalized);
  }

  syncParticlePalette();
  syncParticleDrawRange();
  syncParticleBrightnessUniforms();
}

function syncParticleBrightnessUniforms() {
  particles.material.uniforms.uModelBrightness.value = THREE.MathUtils.clamp(state.modelBrightness ?? 1, 0.35, 2.4);
  particles.material.uniforms.uImageBrightness.value =
    state.model === "image" ? THREE.MathUtils.clamp(state.imageBrightness ?? 2.8, 0.45, 5.2) : 1;
}

function syncParticleDrawRange() {
  const visibleCount = currentVisibleParticleCount();
  setParticleDrawCount(particles, visibleCount);
  ui.updateImageSizeLabel(state.model === "image" ? visibleCount : null);
}

function currentVisibleParticleCount() {
  if (state.model !== "image") {
    return particles.count;
  }
  const size = THREE.MathUtils.clamp(state.imageSize ?? 1, 0.45, 1);
  const density = THREE.MathUtils.clamp(size ** 1.42, 0.32, 1);
  return Math.max(12000, Math.round(particles.count * density));
}

function triggerFireworksBurst() {
  state.fireworksBurstUntil = performance.now() + 3200;
}

function updateFireworkExplosion(now) {
  if (state.model !== "fireworks") {
    state.fireworkExplosion = THREE.MathUtils.lerp(state.fireworkExplosion, 0, 0.12);
    return;
  }

  const handOpenBurst = state.gestureTarget > 0.26 ? THREE.MathUtils.clamp((state.gestureTarget - 0.26) / 0.42, 0, 0.95) : 0;
  const clickBurst = now < state.fireworksBurstUntil ? 1 : 0;
  const target = Math.max(handOpenBurst, clickBurst);
  state.fireworkExplosion = THREE.MathUtils.lerp(state.fireworkExplosion, target, target > state.fireworkExplosion ? 0.36 : 0.3);
}

function updateParticleRig(delta, elapsed, audio) {
  const enabled = audio?.enabled && (audio.level > 0.012 || audio.beat > 0.04 || audio.onset > 0.04);
  const drive = enabled ? 1 : 0;
  const modelMotion = state.model === "text" ? 0.82 : state.model === "fireworks" ? 1.05 : 1.08;
  const bass = audio?.bass ?? 0;
  const mid = audio?.mid ?? 0;
  const treble = audio?.treble ?? 0;
  const beat = audio?.beat ?? 0;
  const kick = audio?.kick ?? 0;
  const peak = audio?.peak ?? 0;
  const onset = audio?.onset ?? 0;
  const level = audio?.level ?? 0;
  const calmEnergy = THREE.MathUtils.smoothstep(level, 0.34, 0.84) * 0.32;
  const impact = drive * Math.max(kick * 1.32, beat * 1.08, onset * 1.18, THREE.MathUtils.smoothstep(peak, 0.42, 0.86));
  const phraseLift = drive * THREE.MathUtils.smoothstep(mid * 0.7 + treble * 0.42 + level * 0.24 + onset * 0.22, 0.22, 0.78);
  const impactEdge = impact > 0.34 && state.audioRig.lastImpact < 0.24;

  if (impactEdge) {
    state.audioRig.motionSeed += 1;
    const seed = state.audioRig.motionSeed;
    const side = seed % 2 === 0 ? 1 : -1;
    const angle = seed * 2.38 + Math.sin(elapsed * 0.65 + seed) * 1.05;
    const lane = seed % 3 === 0 ? -1 : seed % 3 === 1 ? 0 : 1;
    const travelX = side * (3.35 + impact * 2.05 + kick * 0.92 + onset * 0.82) * modelMotion;
    const travelY = (lane * 0.9 + Math.sin(angle * 1.43) * 0.7 + kick * 0.52 - 0.08) * modelMotion;
    const travelZ = Math.sin(angle) * (0.86 + impact * 0.92 + treble * 0.28) * modelMotion;
    state.audioRig.anchorX = THREE.MathUtils.clamp(travelX, -5.35, 5.35);
    state.audioRig.anchorY = THREE.MathUtils.clamp(travelY, -2.05, 2.15);
    state.audioRig.anchorZ = THREE.MathUtils.clamp(travelZ, -1.45, 1.45);
    state.audioRig.impactX += side * (0.8 + impact * 0.8);
    state.audioRig.impactY += (0.38 + kick * 0.75 + onset * 0.35) * modelMotion;
    state.audioRig.impactZ += Math.sin(angle * 0.7) * (0.38 + impact * 0.62) * modelMotion;
    state.audioRig.impactTiltX += (Math.sin(angle) * 0.82 + kick * 0.36) * modelMotion;
    state.audioRig.impactTiltZ += -side * (0.78 + impact * 0.58) * modelMotion;
    state.audioRig.spinVelocity += side * (1.7 + impact * 3.2 + treble * 0.72 + onset * 0.9);
  }

  state.audioRig.lastImpact = impact;
  state.audioRig.anchorX = THREE.MathUtils.lerp(state.audioRig.anchorX, 0, enabled ? 0.006 : 0.08);
  state.audioRig.anchorY = THREE.MathUtils.lerp(state.audioRig.anchorY, 0, enabled ? 0.008 : 0.08);
  state.audioRig.anchorZ = THREE.MathUtils.lerp(state.audioRig.anchorZ, 0, enabled ? 0.01 : 0.08);
  state.audioRig.impactX = THREE.MathUtils.lerp(state.audioRig.impactX, 0, 0.105);
  state.audioRig.impactY = THREE.MathUtils.lerp(state.audioRig.impactY, 0, 0.118);
  state.audioRig.impactZ = THREE.MathUtils.lerp(state.audioRig.impactZ, 0, 0.108);
  state.audioRig.impactTiltX = THREE.MathUtils.lerp(state.audioRig.impactTiltX, 0, 0.098);
  state.audioRig.impactTiltZ = THREE.MathUtils.lerp(state.audioRig.impactTiltZ, 0, 0.098);
  state.audioRig.spinVelocity = THREE.MathUtils.lerp(state.audioRig.spinVelocity, 0, 0.066);

  const heartbeat = impact * 0.28 + kick * 0.32 + onset * 0.22 + phraseLift * 0.06 + calmEnergy * 0.015;
  const targetScale = 1 + drive * heartbeat * modelMotion;
  const orbitX = drive * Math.sin(elapsed * (1.75 + mid * 1.55)) * (0.18 + phraseLift * 0.46) * modelMotion;
  const orbitY = drive * Math.sin(elapsed * (1.95 + treble * 1.8) + 1.7) * (0.12 + phraseLift * 0.28) * modelMotion;
  const orbitZ = drive * Math.cos(elapsed * (1.38 + bass * 1.45)) * (0.1 + phraseLift * 0.28) * modelMotion;
  const targetX =
    state.audioRig.anchorX +
    orbitX +
    state.audioRig.impactX +
    (state.gestureCommand?.pointing ? state.gestureCommand.pointX * 1.4 : 0);
  const targetY =
    state.audioRig.anchorY +
    orbitY +
    kick * 0.28 * modelMotion +
    state.audioRig.impactY +
    (state.gestureCommand?.pointing ? state.gestureCommand.pointY * 0.95 : 0);
  const targetZ =
    state.audioRig.anchorZ +
    orbitZ +
    state.audioRig.impactZ +
    (state.gestureCommand?.pointing ? state.gestureCommand.pointZ * 0.75 : 0);
  const targetTiltX =
    drive * Math.sin(elapsed * 1.75 + bass * 3.1) * phraseLift * 0.46 + state.audioRig.impactTiltX - targetZ * 0.16;
  const targetTiltZ =
    drive * Math.sin(elapsed * 2.1 + treble * 4.4) * (0.12 + phraseLift * 0.48) +
    state.audioRig.impactTiltZ -
    targetX * 0.18;
  const targetYaw = enabled ? Math.atan2(targetX - state.audioRig.x, 1.6 + targetZ - state.audioRig.z) * 1.35 : 0;
  const follow = enabled ? THREE.MathUtils.clamp(0.12 + impact * 0.26 + kick * 0.1 + onset * 0.08, 0.12, 0.46) : 0.09;

  state.audioRig.scale = THREE.MathUtils.lerp(state.audioRig.scale, targetScale, follow);
  state.audioRig.x = THREE.MathUtils.lerp(state.audioRig.x, targetX, follow);
  state.audioRig.y = THREE.MathUtils.lerp(state.audioRig.y, targetY, follow);
  state.audioRig.z = THREE.MathUtils.lerp(state.audioRig.z, targetZ, follow);
  state.audioRig.tiltX = THREE.MathUtils.lerp(state.audioRig.tiltX, targetTiltX, follow);
  state.audioRig.tiltZ = THREE.MathUtils.lerp(state.audioRig.tiltZ, targetTiltZ, follow);
  state.audioRig.yaw = THREE.MathUtils.lerp(state.audioRig.yaw, targetYaw, follow);

  particles.system.scale.setScalar(state.audioRig.scale);
  particles.system.position.set(state.audioRig.x, state.audioRig.y, state.audioRig.z);
  particles.system.rotation.y +=
    delta * (0.04 + state.smoothGesture * 0.055 + drive * phraseLift * 0.86 + state.audioRig.spinVelocity);
  particles.system.rotation.y += state.audioRig.yaw * delta * 2.6;
  particles.system.rotation.x = Math.sin(elapsed * 0.22) * 0.08 + state.audioRig.tiltX;
  particles.system.rotation.z = state.audioRig.tiltZ;
  updateMotionTrail(elapsed, audio);
}

function createMotionTrail(theme) {
  const maxPoints = 48;
  const particleLayers = 34;
  const linePositions = new Float32Array(maxPoints * 3);
  const particlePositions = new Float32Array(maxPoints * particleLayers * 3);
  const particleAges = new Float32Array(maxPoints * particleLayers);
  const particleSeeds = new Float32Array(maxPoints * particleLayers);
  const geometry = new THREE.BufferGeometry();
  const particleGeometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
  particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
  particleGeometry.setAttribute("aAge", new THREE.BufferAttribute(particleAges, 1));
  particleGeometry.setAttribute("aSeed", new THREE.BufferAttribute(particleSeeds, 1));
  for (let i = 0; i < particleSeeds.length; i += 1) {
    particleSeeds[i] = Math.random();
  }
  const material = new THREE.LineBasicMaterial({
    color: theme.accent ?? theme.rim,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const tubeMaterial = new THREE.MeshBasicMaterial({
    color: theme.accent ?? theme.primary,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sparkMaterial = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: {
      uColor: { value: new THREE.Color(theme.primary ?? theme.accent) },
      uOpacity: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uSize: { value: 96 },
    },
    vertexShader: `
      attribute float aAge;
      attribute float aSeed;
      varying float vAge;
      varying float vSeed;
      uniform float uPixelRatio;
      uniform float uSize;

      void main() {
        vAge = aAge;
        vSeed = aSeed;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float taper = pow(1.0 - clamp(aAge, 0.0, 1.0), 1.02);
        float sparkle = 0.78 + aSeed * 0.48;
        gl_PointSize = uSize * taper * sparkle * uPixelRatio / max(0.55, -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying float vAge;
      varying float vSeed;
      uniform vec3 uColor;
      uniform float uOpacity;

      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv);
        float alpha = smoothstep(0.5, 0.0, d) * pow(1.0 - vAge, 1.08);
        float core = smoothstep(0.18, 0.0, d);
        vec3 color = uColor * (0.58 + vSeed * 0.24) + core * 0.22;
        color = color / (vec3(1.0) + max(color - vec3(0.68), vec3(0.0)) * 0.42);
        gl_FragColor = vec4(color, alpha * uOpacity);
      }
    `,
  });
  const line = new THREE.Line(geometry, material);
  const tube = new THREE.Mesh(new THREE.BufferGeometry(), tubeMaterial);
  const sparks = new THREE.Points(particleGeometry, sparkMaterial);
  const group = new THREE.Group();
  group.add(tube, line, sparks);
  return {
    maxPoints,
    particleLayers,
    linePositions,
    particlePositions,
    particleAges,
    particleSeeds,
    geometry,
    particleGeometry,
    material,
    tube,
    tubeMaterial,
    sparkMaterial,
    needsTubeUpdate: false,
    group,
  };
}

function updateMotionTrail(elapsed, audio) {
  const active = audio?.enabled && (audio.level > 0.02 || audio.beat > 0.05 || audio.onset > 0.05);
  if (active && elapsed - state.motionTrail.lastSampleAt > 0.035) {
    state.motionTrail.points.unshift(particles.system.position.clone());
    state.motionTrail.points.length = Math.min(state.motionTrail.points.length, motionTrail.maxPoints);
    state.motionTrail.lastSampleAt = elapsed;
    motionTrail.needsTubeUpdate = true;
  }

  const points = state.motionTrail.points;
  for (let i = 0; i < motionTrail.maxPoints; i += 1) {
    const source = points[i] ?? points[points.length - 1] ?? particles.system.position;
    const i3 = i * 3;
    motionTrail.linePositions[i3] = source.x;
    motionTrail.linePositions[i3 + 1] = source.y;
    motionTrail.linePositions[i3 + 2] = source.z;

    const age = motionTrail.maxPoints <= 1 ? 1 : i / (motionTrail.maxPoints - 1);
    const radius = (1 - age) ** 0.98 * (0.78 + Math.min(audio.beat ?? 0, 1) * 0.26);
    for (let layer = 0; layer < motionTrail.particleLayers; layer += 1) {
      const particleIndex = i * motionTrail.particleLayers + layer;
      const p3 = particleIndex * 3;
      const seed = motionTrail.particleSeeds?.[particleIndex] ?? 0;
      const angle = seed * Math.PI * 2 + layer * 2.399;
      const spread = radius * (0.24 + (layer / motionTrail.particleLayers) ** 0.62);
      motionTrail.particlePositions[p3] = source.x + Math.cos(angle) * spread;
      motionTrail.particlePositions[p3 + 1] = source.y + Math.sin(angle) * spread * 0.58 + (seed - 0.5) * radius * 0.4;
      motionTrail.particlePositions[p3 + 2] = source.z + Math.sin(angle * 1.7) * spread * 0.42;
      motionTrail.particleAges[particleIndex] = age;
    }
  }
  motionTrail.geometry.attributes.position.needsUpdate = true;
  motionTrail.particleGeometry.attributes.position.needsUpdate = true;
  motionTrail.particleGeometry.attributes.aAge.needsUpdate = true;
  motionTrail.geometry.setDrawRange(0, points.length);
  motionTrail.particleGeometry.setDrawRange(0, points.length * motionTrail.particleLayers);
  if (points.length > 2 && motionTrail.needsTubeUpdate) {
    const curve = new THREE.CatmullRomCurve3(points.slice().reverse(), false, "catmullrom", 0.45);
    const radius = 0.086 + Math.min(audio?.beat ?? 0, 1) * 0.032 + Math.min(audio?.onset ?? 0, 1) * 0.022;
    const nextGeometry = new THREE.TubeGeometry(curve, Math.min(160, points.length * 4), radius, 12, false);
    motionTrail.tube.geometry.dispose();
    motionTrail.tube.geometry = nextGeometry;
    motionTrail.needsTubeUpdate = false;
  }
  const beatPulse = Math.min(audio.beat ?? 0, 1);
  const onsetPulse = Math.min(audio.onset ?? 0, 1);
  const shimmer = active ? 0.5 + 0.5 * Math.sin(elapsed * (5.4 + beatPulse * 3.8)) : 0;
  const trailColor = new THREE.Color(state.theme?.primary ?? "#ffffff").lerp(
    new THREE.Color(state.theme?.accent ?? "#ffffff"),
    0.46 + shimmer * 0.28,
  );
  const tubeColor = trailColor.clone().lerp(new THREE.Color(state.theme?.rim ?? "#ffffff"), 0.12 + beatPulse * 0.1);
  motionTrail.material.color.lerp(trailColor, 0.18);
  motionTrail.tubeMaterial.color.lerp(tubeColor, 0.16);
  motionTrail.sparkMaterial.uniforms.uColor.value.lerp(trailColor, 0.18);
  const targetOpacity = active && points.length > 2 ? 0.13 + beatPulse * 0.13 + shimmer * 0.018 : 0;
  const targetTubeOpacity = active && points.length > 2 ? 0.04 + beatPulse * 0.055 + onsetPulse * 0.025 + shimmer * 0.012 : 0;
  motionTrail.material.opacity = THREE.MathUtils.lerp(motionTrail.material.opacity, targetOpacity, active ? 0.18 : 0.08);
  motionTrail.tubeMaterial.opacity = THREE.MathUtils.lerp(
    motionTrail.tubeMaterial.opacity,
    targetTubeOpacity,
    active ? 0.2 : 0.08,
  );
  motionTrail.sparkMaterial.uniforms.uOpacity.value = THREE.MathUtils.lerp(
    motionTrail.sparkMaterial.uniforms.uOpacity.value,
    active && points.length > 2 ? 0.2 + onsetPulse * 0.22 + shimmer * 0.04 : 0,
    active ? 0.22 : 0.08,
  );
  motionTrail.sparkMaterial.uniforms.uSize.value = 68 + beatPulse * 24 + shimmer * 5;
}

function updatePerformanceStats(now) {
  performanceStats.frames += 1;
  if (now - performanceStats.lastUpdate < 600) return;

  const elapsed = now - performanceStats.lastUpdate;
  if (performanceStats.frames < 6) {
    ui.updatePerformance({
      fpsLabel: "测量中",
      particleCount: particles.visibleCount ?? particles.count,
    });
    performanceStats.frames = 0;
    performanceStats.lastUpdate = now;
    return;
  }

  const fps = Math.round((performanceStats.frames * 1000) / elapsed);
  performanceStats.frames = 0;
  performanceStats.lastUpdate = now;
  ui.updatePerformance({
    fps,
    particleCount: particles.visibleCount ?? particles.count,
  });
}

function hexToGlow(hex, alpha) {
  const color = new THREE.Color(hex);
  return `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${alpha})`;
}

function shouldUseFboSimulation(activeRenderer, profile) {
  const gl = activeRenderer.getContext();
  const isMobileProfile = profile.id === "compact";
  const hasWebGl2 = activeRenderer.capabilities.isWebGL2;
  const hasVertexTextures = activeRenderer.capabilities.maxVertexTextures > 0;
  const hasFloatTargets =
    Boolean(gl.getExtension?.("EXT_color_buffer_float")) || Boolean(gl.getExtension?.("EXT_color_buffer_half_float"));
  return hasWebGl2 && hasVertexTextures && hasFloatTargets && !isMobileProfile;
}

async function createImagePointCloud(file, options, targetCount, onProgress) {
  if (supportsImageWorker()) {
    try {
      return await createImagePointCloudInWorker(file, options, targetCount, onProgress);
    } catch (error) {
      console.warn(`图片 Worker 采样失败，回退到主线程：${error?.message ?? error}`);
    }
  }
  return createImagePointCloudOnMain(file, options, targetCount, onProgress);
}

function supportsImageWorker() {
  return typeof Worker !== "undefined" && typeof URL !== "undefined";
}

function createImagePointCloudInWorker(file, options, targetCount, onProgress) {
  const worker = getImageWorker();
  const id = (imageWorkerJobId += 1);
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      imageWorkerJobs.delete(id);
      reject(new Error("图片采样超时"));
    }, 120000);
    imageWorkerJobs.set(id, { resolve, reject, timeout, onProgress });
    worker.postMessage({ id, file, options, targetCount });
  });
}

function getImageWorker() {
  if (imageWorker) return imageWorker;
  imageWorker = new Worker(new URL("./image-worker.js", import.meta.url), { type: "module" });
  imageWorker.addEventListener("message", (event) => {
    const { id, points, error, progress } = event.data ?? {};
    const job = imageWorkerJobs.get(id);
    if (!job) return;
    if (progress) {
      job.onProgress?.(progress);
      return;
    }
    window.clearTimeout(job.timeout);
    imageWorkerJobs.delete(id);
    if (error) {
      job.reject(new Error(error));
    } else {
      job.resolve(points);
    }
  });
  imageWorker.addEventListener("error", (event) => {
    rejectImageWorkerJobs(event.message || "图片 Worker 异常");
    imageWorker.terminate();
    imageWorker = null;
  });
  return imageWorker;
}

function rejectImageWorkerJobs(message) {
  for (const [id, job] of imageWorkerJobs) {
    window.clearTimeout(job.timeout);
    job.reject(new Error(message));
    imageWorkerJobs.delete(id);
  }
}

async function createImagePointCloudOnMain(file, options, targetCount, onProgress) {
  onProgress?.({ value: 0.1, label: "正在解码图片" });
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const requestedMaxSide = Number(options.maxSide);
  const maxSideCap = Number.isFinite(requestedMaxSide) && requestedMaxSide > 0 ? requestedMaxSide : 1800;
  const maxSide = Math.min(maxSideCap, Math.max(900, Math.round(Math.sqrt(targetCount) * 2.6)));
  const scale = Math.min(maxSide / bitmap.width, maxSide / bitmap.height, 1);
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  onProgress?.({ value: 0.22, label: "正在读取像素" });
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const width = canvas.width;
  const height = canvas.height;
  const totalPixels = width * height;
  const grayscale = new Float32Array(totalPixels);
  const alpha = new Float32Array(totalPixels);
  const foreground = new Uint8Array(totalPixels);
  const gradient = new Float32Array(totalPixels);
  const blurred = new Float32Array(totalPixels);
  const contourStrength = THREE.MathUtils.clamp(options.contourStrength ?? 0.75, 0, 1);
  const interiorRatio = THREE.MathUtils.clamp(options.interiorRatio ?? 0.35, 0.2, 0.5);
  const colorMode = options.colorMode ?? "original";
  const mono = hexToDisplayRgb(options.monoColor ?? colorPicker.value);
  const globalAlpha = THREE.MathUtils.clamp(options.globalAlpha ?? 1, 0, 1);
  const alphaThreshold = options.logoMode ? 0.1 : 0.035;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = y * width + x;
      const index = pixelIndex * 4;
      const a = image.data[index + 3] / 255;
      const r = image.data[index] / 255;
      const g = image.data[index + 1] / 255;
      const b = image.data[index + 2] / 255;
      const luminance = r * 0.2126 + g * 0.7152 + b * 0.0722;
      alpha[pixelIndex] = a;
      grayscale[pixelIndex] = luminance;
    }
  }

  onProgress?.({ value: 0.38, label: "正在分析轮廓和纹理" });
  gaussianBlur3x3(grayscale, blurred, width, height);

  let threshold = 0;
  let logoPolarity = 1;
  if (options.logoMode) {
    threshold = otsuThreshold(blurred, alpha);
    logoPolarity = chooseLogoPolarity(blurred, alpha, threshold);
  }

  const candidates = [];
  const strongGradients = [];
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const pixelIndex = y * width + x;
      if (alpha[pixelIndex] < alphaThreshold) continue;
      if (options.logoMode && !isLogoForeground(blurred[pixelIndex], threshold, logoPolarity)) continue;
      foreground[pixelIndex] = 1;
      const gx =
        -blurred[pixelIndex - width - 1] -
        blurred[pixelIndex - 1] * 2 -
        blurred[pixelIndex + width - 1] +
        blurred[pixelIndex - width + 1] +
        blurred[pixelIndex + 1] * 2 +
        blurred[pixelIndex + width + 1];
      const gy =
        -blurred[pixelIndex - width - 1] -
        blurred[pixelIndex - width] * 2 -
        blurred[pixelIndex - width + 1] +
        blurred[pixelIndex + width - 1] +
        blurred[pixelIndex + width] * 2 +
        blurred[pixelIndex + width + 1];
      gradient[pixelIndex] = Math.hypot(gx, gy);
      strongGradients.push(gradient[pixelIndex]);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (strongGradients.length === 0) {
    if (options.logoMode) {
      return createImagePointCloudOnMain(file, { ...options, logoMode: false }, targetCount);
    }
    throw new Error("图片没有可采样的不透明像素");
  }

  strongGradients.sort((a, b) => a - b);
  onProgress?.({ value: 0.58, label: "正在建立采样候选" });
  const strongEdgeThreshold = strongGradients[Math.floor(strongGradients.length * 0.76)] ?? 0;
  const maxGradient = strongGradients[strongGradients.length - 1] || 1;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const pixelIndex = y * width + x;
      if (!foreground[pixelIndex]) continue;
      const index = pixelIndex * 4;
      const r0 = image.data[index] / 255;
      const g0 = image.data[index + 1] / 255;
      const b0 = image.data[index + 2] / 255;
      const a0 = image.data[index + 3] / 255;
      const lum = grayscale[pixelIndex];
      const edge = gradient[pixelIndex] / maxGradient;
      const isStrongEdge = gradient[pixelIndex] >= strongEdgeThreshold;
      const morphologyEdge =
        (foreground[pixelIndex - 1] === 0 ||
          foreground[pixelIndex + 1] === 0 ||
          foreground[pixelIndex - width] === 0 ||
          foreground[pixelIndex + width] === 0);
      const colorDetail = localColorContrast(image.data, width, pixelIndex);
      const chroma = Math.max(r0, g0, b0) - Math.min(r0, g0, b0);
      const alphaDetail = localContrast(alpha, width, pixelIndex);
      const detailWeight =
        Math.abs(lum - 0.5) * 0.08 +
        localContrast(blurred, width, pixelIndex) * 0.22 +
        colorDetail * 0.68 +
        chroma * 0.18 +
        alphaDetail * 0.46;
      const isAlphaEdge = alphaDetail > 0.11;
      const edgeWeight = isStrongEdge || morphologyEdge || isAlphaEdge ? 1 : Math.max(edge ** 0.66, detailWeight);
      const baseWeight = options.logoMode ? Math.max(interiorRatio, 0.36) : 0.26 + edge * 0.1 + detailWeight * 1.05;
      const weight = Math.max(
        isStrongEdge || morphologyEdge || isAlphaEdge ? 1 : 0,
        baseWeight * (1 - contourStrength) + edgeWeight * contourStrength,
      );
      const color = mapImageColor(r0, g0, b0, lum, colorMode, mono);
      candidates.push({
        x,
        y,
        r: color.r,
        g: color.g,
        b: color.b,
        a: a0 * globalAlpha,
        luminance: lum,
        gradient: edge,
        detail: detailWeight,
        strong: isStrongEdge || morphologyEdge || isAlphaEdge,
        weight: Math.max(0.0001, weight),
      });
    }
  }

  if (candidates.length === 0 && options.logoMode) {
    return createImagePointCloudOnMain(file, { ...options, logoMode: false }, targetCount);
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const maxDim = Math.max(maxX - minX, maxY - minY, 1);
  const target = Math.max(1, targetCount);
  onProgress?.({ value: 0.78, label: "正在分配高密度采样点" });
  const selected = weightedSampleCandidates(candidates, target, options.logoMode ? 0.7 : 0.36);
  return selected.map((point, i) => ({
    x:
      ((point.x +
        (hash01(i * 2.31) - 0.5) * (options.logoMode ? (point.strong ? 0.12 : 0.22) : point.strong ? 0.18 : 0.36) -
        centerX) /
        maxDim) *
      2.82,
    y:
      -((point.y +
        (hash01(i * 3.91) - 0.5) * (options.logoMode ? (point.strong ? 0.12 : 0.22) : point.strong ? 0.18 : 0.36) -
        centerY) /
        maxDim) *
      2.82,
    z: (point.a - 0.5) * 0.038 + (point.luminance - 0.5) * 0.026 + (hash01(i * 4.11) - 0.5) * 0.01,
    r: point.r,
    g: point.g,
    b: point.b,
    a: point.a,
    mix: THREE.MathUtils.clamp((point.g * 0.45 + point.b * 0.65) / (point.r + point.g + point.b + 0.001), 0, 1),
    glow: 0.44 + point.a * 0.2 + point.luminance * 0.13 + point.gradient * 0.16 + point.detail * 0.18,
    jitter: point.strong ? 0.00028 : 0.00075,
    kind: point.strong ? 1 : 0,
  }));
}

function localContrast(values, width, index) {
  const center = values[index];
  return Math.max(
    Math.abs(center - values[index - 1]),
    Math.abs(center - values[index + 1]),
    Math.abs(center - values[index - width]),
    Math.abs(center - values[index + width]),
  );
}

function localColorContrast(data, width, pixelIndex) {
  const index = pixelIndex * 4;
  const left = (pixelIndex - 1) * 4;
  const right = (pixelIndex + 1) * 4;
  const up = (pixelIndex - width) * 4;
  const down = (pixelIndex + width) * 4;
  let contrast = 0;
  for (let channel = 0; channel < 3; channel += 1) {
    const center = data[index + channel] / 255;
    contrast = Math.max(
      contrast,
      Math.abs(center - data[left + channel] / 255),
      Math.abs(center - data[right + channel] / 255),
      Math.abs(center - data[up + channel] / 255),
      Math.abs(center - data[down + channel] / 255),
    );
  }
  return contrast;
}

function gaussianBlur3x3(source, target, width, height) {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const center = y * width + x;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        target[center] = source[center];
        continue;
      }
      target[center] =
        (source[center - width - 1] +
          source[center - width] * 2 +
          source[center - width + 1] +
          source[center - 1] * 2 +
          source[center] * 4 +
          source[center + 1] * 2 +
          source[center + width - 1] +
          source[center + width] * 2 +
          source[center + width + 1]) /
        16;
    }
  }
}

function otsuThreshold(values, alpha) {
  const histogram = new Uint32Array(256);
  let total = 0;
  for (let i = 0; i < values.length; i += 1) {
    if (alpha[i] < 0.15) continue;
    histogram[Math.round(THREE.MathUtils.clamp(values[i], 0, 1) * 255)] += 1;
    total += 1;
  }
  if (total === 0) return 0.5;

  let sum = 0;
  for (let i = 0; i < 256; i += 1) {
    sum += i * histogram[i];
  }

  let sumBackground = 0;
  let weightBackground = 0;
  let bestVariance = -1;
  let threshold = 128;
  for (let i = 0; i < 256; i += 1) {
    weightBackground += histogram[i];
    if (weightBackground === 0) continue;
    const weightForeground = total - weightBackground;
    if (weightForeground === 0) break;
    sumBackground += i * histogram[i];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const variance = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      threshold = i;
    }
  }
  return threshold / 255;
}

function chooseLogoPolarity(values, alpha, threshold) {
  let dark = 0;
  let light = 0;
  for (let i = 0; i < values.length; i += 1) {
    if (alpha[i] < 0.15) continue;
    if (values[i] >= threshold) light += 1;
    else dark += 1;
  }
  if (dark === 0) return 1;
  if (light === 0) return -1;
  const total = dark + light;
  const darkRatio = dark / total;
  const lightRatio = light / total;
  if (darkRatio > 0.02 && darkRatio < 0.42) return -1;
  if (lightRatio > 0.02 && lightRatio < 0.42) return 1;
  return light >= dark ? 1 : -1;
}

function isLogoForeground(value, threshold, polarity) {
  return polarity >= 0 ? value >= threshold : value <= threshold;
}

function mapImageColor(r, g, b, luminance, mode, monoColor) {
  if (mode === "luminance") {
    const value = luminance;
    return { r: value, g: value, b: value };
  }
  if (mode === "monochrome") {
    return {
      r: monoColor.r * luminance,
      g: monoColor.g * luminance,
      b: monoColor.b * luminance,
    };
  }
  return { r, g, b };
}

function hexToDisplayRgb(hex) {
  const clean = String(hex ?? "#ffffff").replace("#", "").trim();
  const normalized =
    clean.length === 3
      ? clean
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : clean.padEnd(6, "f").slice(0, 6);
  const value = Number.parseInt(normalized, 16);
  if (!Number.isFinite(value)) {
    return { r: 1, g: 1, b: 1 };
  }
  return {
    r: ((value >> 16) & 255) / 255,
    g: ((value >> 8) & 255) / 255,
    b: (value & 255) / 255,
  };
}

function weightedSampleCandidates(candidates, targetCount, strongRatio) {
  if (candidates.length === 0) {
    throw new Error("图片没有可采样的前景像素");
  }
  const strong = candidates.filter((candidate) => candidate.strong);
  const flat = candidates.filter((candidate) => !candidate.strong);
  const selected = [];
  const strongTarget = Math.min(targetCount, Math.round(targetCount * strongRatio));
  const flatTarget = targetCount - strongTarget;

  if (strong.length > 0 && strong.length <= strongTarget) {
    appendMany(selected, strong);
    appendMany(selected, weightedPickMany(strong, strongTarget - strong.length, 17.13));
  } else {
    appendMany(selected, weightedPickMany(strong.length > 0 ? strong : candidates, strongTarget, 17.13));
  }
  appendMany(selected, weightedPickMany(flat.length > 0 ? flat : candidates, flatTarget, 29.71));

  while (selected.length < targetCount) {
    selected.push(candidates[Math.floor(hash01(selected.length * 8.31) * candidates.length)]);
  }
  if (selected.length > targetCount) {
    selected.length = targetCount;
  }
  return selected;
}

function appendMany(target, items) {
  for (let i = 0; i < items.length; i += 1) {
    target.push(items[i]);
  }
}

function weightedPickMany(candidates, count, seed) {
  if (count <= 0 || candidates.length === 0) return [];
  const cumulative = new Float64Array(candidates.length);
  let total = 0;
  for (let i = 0; i < candidates.length; i += 1) {
    total += candidates[i].weight;
    cumulative[i] = total;
  }
  const picked = [];
  const stride = total / count;
  const offset = hash01(seed * 0.37 + count * 0.017);
  for (let i = 0; i < count; i += 1) {
    const jitter = (hash01((i + 1) * seed + count * 0.013) - 0.5) * stride * 0.82;
    const value = THREE.MathUtils.clamp((i + offset) * stride + jitter, 0, total - Number.EPSILON);
    picked.push(candidates[lowerBound(cumulative, value)] ?? candidates[candidates.length - 1]);
  }
  return picked;
}

async function createMeshPointCloud(file, targetCount, onProgress) {
  const url = URL.createObjectURL(file);
  try {
    const loader = new GLTFLoader();
    const gltf = await new Promise((resolve, reject) => {
      loader.load(
        url,
        resolve,
        (event) => {
          const ratio = event.total > 0 ? event.loaded / event.total : 0.35;
          onProgress?.({ value: 0.12 + Math.min(0.38, ratio * 0.38), label: "正在读取 GLB 文件" });
        },
        reject,
      );
    });
    onProgress?.({ value: 0.55, label: "正在解析网格表面" });
    gltf.scene.updateMatrixWorld(true);
    const triangles = [];
    const box = new THREE.Box3();

    gltf.scene.traverse((object) => {
      if (!object.isMesh || !object.geometry?.attributes?.position) return;
      const geometry = object.geometry;
      const position = geometry.attributes.position;
      const index = geometry.index;
      const color = meshMaterialColor(object.material);
      const colorAttribute = geometry.attributes.color;
      const matrix = object.matrixWorld;
      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      const c = new THREE.Vector3();
      const count = index ? index.count : position.count;
      for (let i = 0; i < count; i += 3) {
        const ia = index ? index.getX(i) : i;
        const ib = index ? index.getX(i + 1) : i + 1;
        const ic = index ? index.getX(i + 2) : i + 2;
        a.fromBufferAttribute(position, ia).applyMatrix4(matrix);
        b.fromBufferAttribute(position, ib).applyMatrix4(matrix);
        c.fromBufferAttribute(position, ic).applyMatrix4(matrix);
        const area = new THREE.Triangle(a, b, c).getArea();
        if (area <= 0.000001) continue;
        triangles.push({
          a: a.clone(),
          b: b.clone(),
          c: c.clone(),
          area,
          color: color.clone(),
          colorA: colorAttribute ? readVertexColor(colorAttribute, ia) : null,
          colorB: colorAttribute ? readVertexColor(colorAttribute, ib) : null,
          colorC: colorAttribute ? readVertexColor(colorAttribute, ic) : null,
        });
        box.expandByPoint(a);
        box.expandByPoint(b);
        box.expandByPoint(c);
      }
    });

    if (triangles.length === 0) {
      throw new Error("GLB 中没有可采样的网格表面");
    }

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const normalizer = 2.28 / Math.max(size.x, size.y, size.z, 0.001);
    const cumulative = [];
    let totalArea = 0;
    for (const triangle of triangles) {
      totalArea += triangle.area;
      cumulative.push(totalArea);
    }

    const desiredCount = Number.isFinite(targetCount) && targetCount > 0 ? targetCount : triangles.length * 16;
    const sampleCount = Math.min(980000, Math.max(36000, desiredCount));
    onProgress?.({ value: 0.72, label: "正在采样模型表面" });
    const points = [];
    for (let i = 0; i < sampleCount; i += 1) {
      const pick = hash01(i * 12.9898) * totalArea;
      const triangle = triangles[lowerBound(cumulative, pick)] ?? triangles[triangles.length - 1];
      let u = hash01(i * 78.233);
      let v = hash01(i * 37.719);
      if (u + v > 1) {
        u = 1 - u;
        v = 1 - v;
      }
      const w = 1 - u - v;
      const point = new THREE.Vector3()
        .addScaledVector(triangle.a, u)
        .addScaledVector(triangle.b, v)
        .addScaledVector(triangle.c, w)
        .sub(center)
        .multiplyScalar(normalizer);
      const sampledColor = sampleTriangleColor(triangle, u, v, w);
      const colorTotal = sampledColor.r + sampledColor.g + sampledColor.b + 0.001;
      points.push({
        x: point.x,
        y: point.y,
        z: point.z,
        r: sampledColor.r,
        g: sampledColor.g,
        b: sampledColor.b,
        a: 1,
        mix: THREE.MathUtils.clamp((sampledColor.g * 0.45 + sampledColor.b * 0.65) / colorTotal, 0, 1),
        glow: 0.54 + hash01(i * 5.91) * 0.28,
        jitter: 0.004,
      });
      if (i > 0 && i % 18000 === 0) {
        onProgress?.({ value: 0.72 + Math.min(0.18, (i / sampleCount) * 0.18), label: "正在采样模型表面" });
      }
    }
    return points;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function meshMaterialColor(material) {
  const source = Array.isArray(material) ? material.find((item) => item?.color instanceof THREE.Color) : material;
  return source?.color instanceof THREE.Color ? source.color : new THREE.Color("#ffffff");
}

function readVertexColor(attribute, index) {
  return new THREE.Color(attribute.getX(index), attribute.getY(index), attribute.getZ(index));
}

function sampleTriangleColor(triangle, u, v, w) {
  if (!triangle.colorA || !triangle.colorB || !triangle.colorC) {
    return triangle.color;
  }
  return new THREE.Color(
    triangle.colorA.r * u + triangle.colorB.r * v + triangle.colorC.r * w,
    triangle.colorA.g * u + triangle.colorB.g * v + triangle.colorC.g * w,
    triangle.colorA.b * u + triangle.colorB.b * v + triangle.colorC.b * w,
  );
}

function lowerBound(values, target) {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (values[mid] < target) low = mid + 1;
    else high = mid;
  }
  return low;
}

function hash01(value) {
  return Math.abs(Math.sin(value * 43758.5453)) % 1;
}
