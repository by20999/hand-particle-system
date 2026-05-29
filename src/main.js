import "./styles.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { createAudioReactor, stopAudioSource, updateAudioReactor, useAudioFile, useMicrophone } from "./audio.js";
import {
  applyBackgroundTheme,
  createBackgroundSystem,
  setBackgroundBrightness,
  setBackgroundMode,
  updateBackground,
} from "./backgrounds.js";
import { MP_HANDS_ASSET_BASE, MP_POSE_ASSET_BASE, renderPixelRatio, selectQualityProfile } from "./config.js";
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
import { loadBvhMotion } from "./importers/bvh-importer.js";
import { createPoseVideoElement, disposePoseVideoElement } from "./importers/pose-video-importer.js";
import {
  POSE_CONNECTIONS_LOCAL,
  POSE_CORE_IDS,
  POSE_DETAIL_NODE_IDS,
  POSE_LEFT_IDS,
  POSE_NODE_IDS,
  POSE_RETARGET_ANGLE_LIMITS,
  POSE_RETARGET_CHILD,
  POSE_RETARGET_REQUIRED,
  POSE_RETARGET_SIDE_POINTS,
  POSE_RETARGET_SPECS,
  POSE_RIGHT_IDS,
  canonicalBoneName,
} from "./motion/pose-retarget-config.js";
import {
  createParticleSystem,
  setCustomText,
  setImagePoints,
  setMeshPoints,
  setParticleDrawCount,
  setParticleTargets,
  setPosePoints,
  setTextFont,
  snapParticlesToTargets,
  updateParticles,
} from "./particles.js";
import { THEMES, applyThemeToDocument, getTheme } from "./themes.js";
import { createUI } from "./ui.js";
import { createMeshParticleSource, sampleMeshSource } from "./importers/mesh-importer.js";
import {
  CAMERA_SHOTS,
  CUSTOM_SHOW_STORAGE_KEY,
  DEFAULT_CUSTOM_SHOW,
  SHOW_PRESETS,
  cloneShowPreset,
  nextStepLabel,
  normalizeShowPreset,
  normalizeShowStep,
  showPresetOptionList,
  vectorArray,
} from "./show-controller.js";

const POINTING_MODE_HOLD_MS = 560;
const POINTING_EXIT_EPSILON = 0.025;

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
  pointingSensitivity,
  themeButtons,
  backgroundButtons,
  backgroundSelect,
  backgroundBrightness,
  modelPlaceholderButtons,
  modelBrightness,
  modelSize,
  safetyModeBtn,
  healthRefreshBtn,
  micToggleBtn,
  audioFileInput,
  imageFileInput,
  imageBrightness,
  imageSize,
  meshFileInput,
  motionFileInput,
  poseVideoInput,
  meshDensity,
  meshSize,
  meshDepth,
  meshSpread,
  meshAnimationEnabled,
  meshAnimationLoop,
  meshAnimationSpeed,
  meshAnimationFollow,
  meshYaw,
  meshGround,
  meshAutoCenter,
  motionDensity,
  motionLoop,
  motionSpeed,
  motionSize,
  poseDensity,
  poseFollow,
  poseAura,
  poseRetargetEnabled,
  poseRetargetSmoothing,
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

if (!hasWebGLSupport()) {
  ui.setStatus("WebGL 不可用，无法启动粒子画面", "error");
  ui.setDiagnostic("错误：当前浏览器或显卡环境不支持 WebGL，请更换 Chrome/Edge 或检查硬件加速。");
  throw new Error("WebGL is not available");
}

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

renderer.domElement.addEventListener("webglcontextlost", (event) => {
  event.preventDefault();
  state.resourceFailures += 1;
  ui.setStatus("WebGL 上下文丢失", "error");
  showHeldDiagnostic("WebGL 上下文丢失，请刷新页面或开启现场安全模式后重试", 12000);
  updateHealthPanel(true);
});
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
let meshBasePoints = [];
let meshTransformedPoints = [];
let meshAnimationSource = null;
let meshOptionsFrame = 0;
let bvhMotionSource = null;
let poseVideoRetargeter = null;
let poseTracker = null;
let poseVideoElement = null;
let poseFrameTimer = 0;
const POSE_FRAME_INTERVAL_MS = qualityProfile.id === "compact" ? 125 : qualityProfile.id === "balanced" ? 95 : 72;
ui.setShowPresetOptions(showPresetOptionList());
const state = {
  model: "heart",
  theme: initialTheme,
  color: new THREE.Color(initialTheme.primary),
  accent: new THREE.Color(initialTheme.accent),
  sensitivity: ui.getSensitivity(),
  pointingSensitivity: ui.getPointingSensitivity(),
  modelBrightness: ui.getModelBrightness(),
  modelSize: ui.getModelSize(),
  meshOptions: ui.getMeshOptions(),
  motionOptions: ui.getMotionOptions(),
  poseOptions: ui.getPoseOptions(),
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
  poseVideoActive: false,
  poseProcessingVideo: false,
  poseVideoRetargetReady: false,
  poseVideoRetargetActive: false,
  poseVideoRetargetFrames: 0,
  poseVideoRetargetReason: "",
  poseVideoRetargetMatchedBones: 0,
  poseLastFrameAt: 0,
  poseResultFrames: 0,
  poseVideoFrames: 0,
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
  pointingModeUntil: 0,
  pointingBlend: 0,
  pointingRig: {
    x: 0,
    y: 0,
    z: 0,
  },
  audioLevel: 0,
  beatPulse: 0,
  audioMotion: null,
  safetyMode: readBooleanStorage("safetyMode"),
  healthLastUpdate: 0,
  resourceFailures: 0,
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
  fps: 0,
};

function readBooleanStorage(key) {
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function writeBooleanStorage(key, value) {
  try {
    localStorage.setItem(key, value ? "true" : "false");
  } catch {
    // Local storage can be unavailable in strict privacy modes.
  }
}

function hasWebGLSupport() {
  try {
    const testCanvas = document.createElement("canvas");
    return Boolean(testCanvas.getContext("webgl2") || testCanvas.getContext("webgl") || testCanvas.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

particles.customText = state.customText;
particles.textFont = state.textFont;
setParticleTargets(particles, state.model);
snapParticlesToTargets(particles);
ui.setModelActive(state.model);
syncParticleDrawRange();
syncParticleBrightnessUniforms();
renderShowComposer();
installShowPresetApi();
ui.setSafetyModeActive(state.safetyMode);
updateHealthPanel(true);
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
    state.gestureCommand = { name: "none", pointing: false, pointX: 0, pointY: 0, pointZ: 0 };
    state.pointingModeUntil = 0;
    state.pointingBlend = 0;
    state.pointingRig.x = 0;
    state.pointingRig.y = 0;
    state.pointingRig.z = 0;
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

modelSize?.addEventListener("input", () => {
  state.modelSize = ui.getModelSize();
});

safetyModeBtn?.addEventListener("click", () => {
  setSafetyMode(!state.safetyMode);
});

healthRefreshBtn?.addEventListener("click", () => {
  updateHealthPanel(true);
  showHeldDiagnostic("健康检查已刷新", 2600);
});

imageBrightness?.addEventListener("input", () => {
  state.imageBrightness = ui.getImageBrightness();
  syncParticleBrightnessUniforms();
});

imageSize?.addEventListener("input", () => {
  state.imageSize = ui.getImageSize();
  syncParticleDrawRange();
});

for (const input of [meshDensity, meshSize, meshDepth, meshSpread, meshAnimationSpeed, meshAnimationFollow, meshYaw, meshGround]) {
  input?.addEventListener("input", () => {
    state.meshOptions = ui.getMeshOptions();
    if (input === meshDensity) {
      syncParticleDrawRange();
      return;
    }
    if (input === meshAnimationSpeed || input === meshAnimationFollow) {
      updateMeshAnimationPlayback();
      return;
    }
    scheduleMeshOptionsUpdate();
  });
}

for (const input of [meshAnimationEnabled, meshAnimationLoop]) {
  input?.addEventListener("change", () => {
    state.meshOptions = ui.getMeshOptions();
    updateMeshAnimationPlayback();
  });
}

meshAutoCenter?.addEventListener("change", () => {
  state.meshOptions = ui.getMeshOptions();
  scheduleMeshOptionsUpdate();
});

for (const input of [motionDensity, motionSpeed, motionSize]) {
  input?.addEventListener("input", () => {
    state.motionOptions = ui.getMotionOptions();
    if (input === motionDensity) {
      syncParticleDrawRange();
    }
  });
}

motionLoop?.addEventListener("change", () => {
  state.motionOptions = ui.getMotionOptions();
  updateBvhPlaybackOptions();
});

for (const input of [poseDensity, poseFollow, poseAura, poseRetargetSmoothing]) {
  input?.addEventListener("input", () => {
    state.poseOptions = ui.getPoseOptions();
    if (input === poseDensity) {
      syncParticleDrawRange();
    }
  });
}

poseRetargetEnabled?.addEventListener("change", () => {
  state.poseOptions = ui.getPoseOptions();
  if (state.poseOptions.retargetEnabled && state.poseVideoActive) {
    const prepared = preparePoseVideoRetargeter();
    state.poseVideoRetargetReady = prepared.ok;
    if (prepared.ok) {
      showHeldDiagnostic(`视频驱动 3D 已开启，匹配 ${prepared.matchedBones ?? 0} 根骨骼`, 7000);
    } else {
      showHeldDiagnostic(`视频驱动 3D 未匹配：${prepared.reason}`, 8000);
    }
  } else {
    stopPoseVideoRetargeter(true);
    state.poseVideoRetargetReason = "视频驱动 3D 已关闭";
    if (state.poseVideoActive && particles.customPosePoints?.length) {
      selectModel("pose", true);
    }
  }
});

micToggleBtn.addEventListener("click", async () => {
  try {
    await useMicrophone(audioReactor);
    ui.setAudioActive("mic");
    updateHealthPanel(true);
  } catch (error) {
    console.error(error);
    state.resourceFailures += 1;
    ui.setDiagnostic(`麦克风不可用：${error?.message ?? "unknown error"}`);
    updateHealthPanel(true);
  }
});

audioFileInput.addEventListener("change", async () => {
  const [file] = audioFileInput.files ?? [];
  if (!file) return;
  try {
    await useAudioFile(audioReactor, file);
    ui.setAudioActive("file");
    updateHealthPanel(true);
  } catch (error) {
    console.error(error);
    state.resourceFailures += 1;
    ui.setDiagnostic(`音频文件不可用：${error?.message ?? "unknown error"}`);
    updateHealthPanel(true);
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
    if (/\.fbx$/i.test(file.name)) {
      throw new Error("FBX 不建议直接导入，请先用 Blender 或动捕工具导出为 GLB/glTF 或 BVH");
    }
    ui.setImportProgress({ active: true, value: 0.06, label: "准备读取 GLB/glTF" });
    showHeldDiagnostic("正在读取 AI 动捕角色文件；带内置动画的 GLB/glTF 会自动播放并转成粒子", 60000);
    state.meshOptions = ui.getMeshOptions();
    const meshSampleTarget = Math.min(
      qualityProfile.maxMeshSamples ?? 360000,
      Math.round(particles.count * (qualityProfile.meshSampleMultiplier ?? 1) * THREE.MathUtils.clamp(state.meshOptions.density, 0.25, 1.2)),
    );
    const source = await createMeshParticleSource(file, meshSampleTarget, {
      animatedSampleLimit: currentAnimatedMeshSampleLimit(meshSampleTarget),
      staticSampleLimit: qualityProfile.maxMeshSamples ?? 980000,
      onProgress: (progress) => {
        ui.setImportProgress({ active: true, ...progress });
      },
    });
    ui.setImportProgress({ active: true, value: 0.94, label: "正在生成 3D 粒子" });
    stopPoseVideoRetargeter(false);
    stopMeshAnimationSource();
    meshAnimationSource = source;
    meshBasePoints = source.points;
    meshTransformedPoints = transformMeshPoints(meshBasePoints, state.meshOptions, meshTransformedPoints);
    updateMeshAnimationPlayback();
    setMeshPoints(particles, meshTransformedPoints, meshAnimationSource.hasAnimation ? currentVisibleParticleCount("mesh") : undefined);
    selectModel("mesh", true);
    syncParticleDrawRange();
    const animationLabel = source.hasAnimation ? `，已播放 ${source.animations.length} 段内置动画并转为动态粒子` : "";
    const textureLabel = source.texturedSamples > source.points.length * 0.05 ? "，已还原贴图颜色" : "";
    ui.setImportProgress({ active: true, value: 1, label: "3D 模型导入完成" });
    showHeldDiagnostic(`GLB/glTF 已生成 ${source.points.length} 个表面采样点${textureLabel}${animationLabel}`, 10000);
    window.setTimeout(() => ui.setImportProgress({ active: false }), 900);
  } catch (error) {
    console.error(error);
    ui.setImportProgress({ active: true, value: 1, label: "加载失败，请重新导入", error: true });
    showHeldDiagnostic(`加载失败，请重新导入：${error?.message ?? "unknown error"}`, 12000);
  } finally {
    meshFileInput.value = "";
  }
});

motionFileInput?.addEventListener("change", async () => {
  const [file] = motionFileInput.files ?? [];
  if (!file) return;
  try {
    if (/\.fbx$/i.test(file.name)) {
      throw new Error("FBX 不建议直接导入，请先用 Blender 或动捕工具导出为 GLB/glTF 或 BVH");
    }
    ui.setImportProgress({ active: true, value: 0.08, label: "正在读取 BVH 动作" });
    showHeldDiagnostic("正在解析 BVH 动作；如果当前 3D 模型带骨骼，会先尝试驱动它", 60000);
    state.motionOptions = ui.getMotionOptions();
    const result = await loadBvhMotion(file, (progress) => {
      ui.setImportProgress({ active: true, ...progress });
    });
    const retargeted = tryApplyBvhToMesh(result, file.name);
    if (retargeted.ok) {
      selectModel("mesh", true);
      ui.setImportProgress({ active: true, value: 1, label: "BVH 已驱动当前模型" });
      showHeldDiagnostic(`BVH 已匹配当前 GLB/glTF 骨骼，匹配 ${retargeted.matchedBones} 根骨骼，正在转为动态粒子`, 10000);
    } else {
      stopPoseVideo();
      startBvhParticleMotion(result, file.name);
      selectModel("pose", true);
      ui.setImportProgress({ active: true, value: 1, label: "BVH 粒子骨架已开始驱动" });
      showHeldDiagnostic(`BVH 匹配不足，已回退为 3D 粒子动作骨架；${retargeted.reason}`, 11000);
    }
    window.setTimeout(() => ui.setImportProgress({ active: false }), 900);
  } catch (error) {
    console.error(error);
    ui.setImportProgress({ active: true, value: 1, label: "加载失败，请重新导入", error: true });
    showHeldDiagnostic(`BVH 动作加载失败，请重新导入：${error?.message ?? "unknown error"}`, 12000);
  } finally {
    motionFileInput.value = "";
  }
});

poseVideoInput?.addEventListener("change", async () => {
  const [file] = poseVideoInput.files ?? [];
  if (!file) return;
  try {
    ui.setImportProgress({ active: true, value: 0.06, label: "准备读取姿态视频" });
    showHeldDiagnostic("正在加载姿态视频，首次使用会加载 MediaPipe Pose 模型", 60000);
    await startPoseVideo(file);
    if (state.poseVideoRetargetReady) {
      selectModel("mesh", true);
      const matchedBones = state.poseVideoRetargetMatchedBones || poseVideoRetargeter?.matchedBones || 0;
      ui.setImportProgress({ active: true, value: 1, label: "导入成功，已匹配 3D 人物" });
      showHeldDiagnostic(`导入成功：姿态视频已匹配当前 3D 人物，匹配 ${matchedBones} 根骨骼，已开启比例自适应和脚底稳定`, 10000);
      window.setTimeout(() => ui.setImportProgress({ active: false }), 1200);
    } else {
      selectModel("pose", true);
      const reason = state.poseVideoRetargetReason || "没有找到可驱动的 3D 骨骼模型";
      ui.setImportProgress({ active: true, value: 1, label: "导入失败，已回退为粒子骨架", error: true });
      showHeldDiagnostic(`导入失败：${reason}。已回退成原粒子骨架。`, 12000);
      window.setTimeout(() => ui.setImportProgress({ active: false }), 1800);
    }
  } catch (error) {
    console.error(error);
    ui.setImportProgress({ active: true, value: 1, label: "加载失败，请重新导入", error: true });
    showHeldDiagnostic(`姿态视频加载失败，请重新导入：${error?.message ?? "unknown error"}`, 12000);
  } finally {
    poseVideoInput.value = "";
  }
});

audioStopBtn.addEventListener("click", () => {
  stopAudioSource(audioReactor);
  ui.setAudioActive("off");
  ui.updateAudioLevel(0);
  updateHealthPanel(true);
});

sensitivity.addEventListener("input", () => {
  state.sensitivity = ui.getSensitivity();
});

pointingSensitivity?.addEventListener("input", () => {
  state.pointingSensitivity = ui.getPointingSensitivity();
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
    updateHealthPanel(true);
  } catch (error) {
    console.warn(error);
    state.lastErrorMessage = error?.message ?? "unknown error";
    state.resourceFailures += 1;
    ui.setStatus("摄像头或手势模型不可用，可用鼠标预览粒子", "error");
    ui.setDiagnostic(`错误：${state.lastErrorMessage}`);
    updateHealthPanel(true);
  }
}

async function startPoseVideo(file) {
  stopBvhParticleMotion();
  stopPoseVideo();
  stopPoseVideoRetargeter(false);
  ui.setImportProgress({ active: true, value: 0.16, label: "正在加载 Pose 模型" });
  poseTracker = await createPoseTracker();
  state.poseOptions = ui.getPoseOptions();
  setPosePoints(particles, createFallbackPosePointCloud(currentPoseSampleTarget()), currentVisibleParticleCount("pose"));
  const preparedRetarget = preparePoseVideoRetargeter();
  state.poseVideoRetargetReady = preparedRetarget.ok;
  poseVideoElement = await createPoseVideoElement(file);
  ui.setImportProgress({ active: true, value: 0.36, label: "正在启动姿态视频" });
  await poseVideoElement.play();
  state.poseVideoActive = true;
  state.poseLastFrameAt = 0;
  state.poseResultFrames = 0;
  state.poseVideoFrames = 0;
  state.poseVideoRetargetFrames = 0;
  schedulePoseVideoFrame();
}

function stopPoseVideo() {
  state.poseVideoActive = false;
  state.poseProcessingVideo = false;
  state.poseVideoRetargetReady = false;
  state.poseVideoRetargetActive = false;
  state.poseVideoRetargetFrames = 0;
  state.poseVideoRetargetReason = "";
  state.poseVideoRetargetMatchedBones = 0;
  stopPoseVideoRetargeter(false);
  if (poseFrameTimer) {
    window.clearTimeout(poseFrameTimer);
    poseFrameTimer = 0;
  }
  if (poseVideoElement) {
    disposePoseVideoElement(poseVideoElement);
    poseVideoElement = null;
  }
}

async function createPoseTracker() {
  if (poseTracker) return poseTracker;
  const poseModule = await import("@mediapipe/pose");
  const Pose = resolvePoseConstructor(poseModule);
  const tracker = new Pose({
    locateFile: (file) => `${MP_POSE_ASSET_BASE}${file}`,
  });
  tracker.setOptions({
    modelComplexity: qualityProfile.modelComplexity > 0 ? 1 : 0,
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.42,
    minTrackingConfidence: 0.42,
    selfieMode: false,
  });
  tracker.onResults((results) => {
    const landmarks = results.poseLandmarks;
    if (!landmarks?.length) return;
    const now = performance.now();
    const retargeted = updatePoseVideoRetarget(landmarks, now);
    if (!retargeted && state.model === "pose") {
      const points = createPosePointCloud(landmarks, currentPoseSampleTarget());
      if (!points.length) return;
      setPosePoints(particles, points, currentVisibleParticleCount("pose"));
    }
    state.poseLastFrameAt = now;
    state.poseResultFrames += 1;
    if (state.model === "pose") {
      syncParticleDrawRange();
      syncParticleBrightnessUniforms();
    } else if (retargeted && state.model === "mesh") {
      syncParticleDrawRange();
      syncParticleBrightnessUniforms();
    }
  });
  if (typeof tracker.initialize === "function") {
    await tracker.initialize();
  }
  poseTracker = tracker;
  return poseTracker;
}

function schedulePoseVideoFrame() {
  if (!state.poseVideoActive || !poseTracker || !poseVideoElement) return;
  if (poseFrameTimer) return;
  poseFrameTimer = window.setTimeout(() => {
    poseFrameTimer = 0;
    processPoseVideoFrame();
  }, currentPoseFrameInterval());
}

async function processPoseVideoFrame() {
  if (!state.poseVideoActive || !poseTracker || !poseVideoElement) return;
  const shouldProcess = state.model === "pose" || (state.model === "mesh" && state.poseVideoRetargetReady);
  if (!shouldProcess) {
    schedulePoseVideoFrame();
    return;
  }
  if (state.poseProcessingVideo) {
    schedulePoseVideoFrame();
    return;
  }
  if (poseVideoElement.readyState >= 2 && !poseVideoElement.paused) {
    state.poseProcessingVideo = true;
    try {
      await poseTracker.send({ image: poseVideoElement });
      state.poseVideoFrames += 1;
      const age = performance.now() - (state.poseLastFrameAt || 0);
      ui.setImportProgress({
        active: age > 900,
        value: 0.62,
        label: age > 900 ? "正在寻找人体姿态" : state.poseVideoRetargetActive ? `视频驱动 3D 中 ${state.poseVideoRetargetFrames} 帧` : `姿态视频驱动中 ${state.poseResultFrames} 帧`,
        indeterminate: true,
      });
    } catch (error) {
      console.warn(error);
      showHeldDiagnostic(`姿态识别暂时不可用：${error?.message ?? "unknown error"}`, 6000);
    } finally {
      state.poseProcessingVideo = false;
    }
  }
  schedulePoseVideoFrame();
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

function resolvePoseConstructor(module) {
  const globalScope = typeof globalThis !== "undefined" ? globalThis : undefined;
  const candidates = [module?.Pose, module?.default?.Pose, module?.default, module?.t?.Pose, module?.["module.exports"]?.Pose, globalScope?.Pose];
  const Pose = candidates.find((candidate) => typeof candidate === "function");
  if (!Pose) {
    throw new Error("MediaPipe Pose 模块导出不可用");
  }
  return Pose;
}

function createPosePointCloud(landmarks, targetCount) {
  if (!Array.isArray(landmarks) || landmarks.length < 17) return [];
  const visible = landmarks
    .map((landmark, id) => ({ landmark, id, visibility: poseVisibility(landmark) }))
    .filter((item) => item.visibility >= 0.22);
  if (visible.length < 6) return [];

  const bounds = poseBounds(visible);
  const bodySize = Math.max(bounds.width, bounds.height, 0.18);
  const centerX = (bounds.minX + bounds.maxX) * 0.5;
  const centerY = (bounds.minY + bounds.maxY) * 0.5;
  const centerZ = averagePoseZ(visible);
  const scale = THREE.MathUtils.clamp(2.86 / bodySize, 2.0, 5.8);
  const themeColors = posePaletteColors();
  const points = [];
  const connections = [];

  for (const [fromId, toId] of POSE_CONNECTIONS_LOCAL) {
    const from = projectPoseLandmark(landmarks[fromId], fromId, centerX, centerY, centerZ, scale);
    const to = projectPoseLandmark(landmarks[toId], toId, centerX, centerY, centerZ, scale);
    if (!from || !to) continue;
    const length = Math.hypot(from.x - to.x, from.y - to.y, from.z - to.z);
    if (length <= 0.002) continue;
    connections.push({ from, to, length, side: poseConnectionSide(fromId, toId) });
  }

  if (!connections.length) return [];
  const totalLength = connections.reduce((sum, connection) => sum + connection.length, 0);
  const lineTarget = Math.max(2600, Math.round(targetCount * 0.66));
  for (let connectionIndex = 0; connectionIndex < connections.length; connectionIndex += 1) {
    const connection = connections[connectionIndex];
    const count = Math.max(28, Math.round((connection.length / totalLength) * lineTarget));
    appendPoseLimbPoints(points, connection, count, themeColors, connectionIndex);
  }

  const jointTarget = Math.max(1400, Math.round(targetCount * 0.22));
  for (let i = 0; i < POSE_DETAIL_NODE_IDS.length; i += 1) {
    const id = POSE_DETAIL_NODE_IDS[i];
    const point = projectPoseLandmark(landmarks[id], id, centerX, centerY, centerZ, scale);
    if (!point) continue;
    const isCore = POSE_CORE_IDS.has(id);
    const isEndpoint = id >= 15 || id === 0;
    const count = Math.round(jointTarget * (isCore ? 0.074 : isEndpoint ? 0.055 : 0.042));
    appendPoseJointPoints(points, point, Math.max(24, count), themeColors, i);
  }

  const auraRatio = THREE.MathUtils.clamp(state.poseOptions?.aura ?? 1, 0, 1.8);
  appendPoseAuraPoints(points, landmarks, centerX, centerY, centerZ, scale, themeColors, Math.round(Math.max(180, targetCount * 0.08) * auraRatio));

  while (points.length < targetCount) {
    const source = points[Math.floor(hash01(points.length * 9.17) * points.length)] ?? points[0];
    points.push({
      ...source,
      x: source.x + (hash01(points.length * 2.31) - 0.5) * 0.012,
      y: source.y + (hash01(points.length * 3.93) - 0.5) * 0.012,
      z: source.z + (hash01(points.length * 5.29) - 0.5) * 0.014,
      glow: Math.min(1.42, (source.glow ?? 0.9) * 0.96),
    });
  }
  if (points.length > targetCount) {
    points.length = targetCount;
  }
  return points;
}

function createFallbackPosePointCloud(targetCount) {
  const fallbackLandmarks = [];
  const coords = {
    0: [0.5, 0.14, -0.05],
    11: [0.4, 0.32, 0],
    12: [0.6, 0.32, 0],
    13: [0.31, 0.48, 0.02],
    14: [0.69, 0.48, 0.02],
    15: [0.26, 0.64, 0.04],
    16: [0.74, 0.64, 0.04],
    17: [0.24, 0.66, 0.04],
    18: [0.76, 0.66, 0.04],
    19: [0.25, 0.68, 0.04],
    20: [0.75, 0.68, 0.04],
    21: [0.27, 0.66, 0.04],
    22: [0.73, 0.66, 0.04],
    23: [0.43, 0.58, 0],
    24: [0.57, 0.58, 0],
    25: [0.38, 0.79, 0.02],
    26: [0.62, 0.79, 0.02],
    27: [0.34, 0.96, 0.05],
    28: [0.66, 0.96, 0.05],
    29: [0.33, 0.99, 0.05],
    30: [0.67, 0.99, 0.05],
    31: [0.38, 1, 0.05],
    32: [0.62, 1, 0.05],
  };
  for (let id = 0; id <= 32; id += 1) {
    const [x = 0.5, y = 0.5, z = 0] = coords[id] ?? [];
    fallbackLandmarks[id] = { x, y, z, visibility: coords[id] ? 0.9 : 0.08 };
  }
  return createPosePointCloud(fallbackLandmarks, targetCount);
}

function poseVisibility(landmark) {
  if (!landmark) return 0;
  return landmark.visibility === undefined ? 1 : THREE.MathUtils.clamp(Number(landmark.visibility) || 0, 0, 1);
}

function poseBounds(visible) {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const { landmark } of visible) {
    minX = Math.min(minX, landmark.x);
    minY = Math.min(minY, landmark.y);
    maxX = Math.max(maxX, landmark.x);
    maxY = Math.max(maxY, landmark.y);
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function averagePoseZ(visible) {
  if (!visible.length) return 0;
  return visible.reduce((sum, item) => sum + (Number(item.landmark.z) || 0), 0) / visible.length;
}

function projectPoseLandmark(landmark, id, centerX, centerY, centerZ, scale) {
  const visibility = poseVisibility(landmark);
  if (visibility < 0.22) return null;
  return {
    id,
    x: (landmark.x - centerX) * scale,
    y: -(landmark.y - centerY) * scale + 0.05,
    z: THREE.MathUtils.clamp(((Number(landmark.z) || 0) - centerZ) * scale * 0.46, -0.72, 0.72),
    visibility,
  };
}

function appendPoseLimbPoints(points, connection, count, colors, seedOffset) {
  const { from, to, side } = connection;
  const color = poseSideColor(side, colors);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const length2d = Math.hypot(dx, dy) || 1;
  const nx = -dy / length2d;
  const ny = dx / length2d;
  const visibility = Math.min(from.visibility, to.visibility);
  const limbThickness = THREE.MathUtils.clamp(0.012 + connection.length * 0.012, 0.012, 0.045);

  for (let i = 0; i < count; i += 1) {
    const raw = (i + hash01((i + 1) * 3.17 + seedOffset * 19.3) * 0.72) / Math.max(1, count - 1);
    const t = THREE.MathUtils.clamp(raw, 0, 1);
    const ribbon = Math.sin(t * Math.PI) * limbThickness;
    const sideJitter = (hash01((i + 1) * 7.13 + seedOffset * 11.7) - 0.5) * ribbon * 2.2;
    const depthJitter = (hash01((i + 1) * 5.31 + seedOffset * 4.9) - 0.5) * limbThickness * 1.35;
    const luma = 0.78 + Math.sin(t * Math.PI) * 0.28 + hash01((i + 1) * 2.77 + seedOffset) * 0.08;
    points.push({
      x: from.x + dx * t + nx * sideJitter,
      y: from.y + dy * t + ny * sideJitter,
      z: from.z + dz * t + depthJitter,
      r: color.r,
      g: color.g,
      b: color.b,
      a: THREE.MathUtils.clamp(0.72 + visibility * 0.32, 0.45, 1),
      mix: color.mix,
      glow: luma,
      jitter: 0.0015 + limbThickness * 0.032,
      kind: side === "core" ? 1 : 0,
    });
  }
}

function appendPoseJointPoints(points, point, count, colors, seedOffset) {
  const color = poseSideColor(posePointSide(point.id), colors);
  const isCore = POSE_CORE_IDS.has(point.id);
  const radius = isCore ? 0.058 : point.id === 0 ? 0.052 : 0.042;
  for (let i = 0; i < count; i += 1) {
    const angle = hash01((i + 1) * 12.91 + seedOffset * 5.7) * Math.PI * 2;
    const ring = Math.sqrt(hash01((i + 1) * 8.37 + seedOffset * 2.3)) * radius;
    const lift = (hash01((i + 1) * 3.61 + seedOffset * 17.1) - 0.5) * radius * 0.74;
    points.push({
      x: point.x + Math.cos(angle) * ring,
      y: point.y + Math.sin(angle) * ring,
      z: point.z + lift,
      r: color.r,
      g: color.g,
      b: color.b,
      a: THREE.MathUtils.clamp(0.72 + point.visibility * 0.34, 0.48, 1),
      mix: color.mix,
      glow: 0.98 + hash01((i + 1) * 2.19 + seedOffset) * 0.36,
      jitter: 0.0012,
      kind: 2,
    });
  }
}

function appendPoseAuraPoints(points, landmarks, centerX, centerY, centerZ, scale, colors, count) {
  const ids = [0, 15, 16, 27, 28, 31, 32];
  const projected = ids.map((id) => projectPoseLandmark(landmarks[id], id, centerX, centerY, centerZ, scale)).filter(Boolean);
  if (!projected.length) return;
  for (let i = 0; i < count; i += 1) {
    const base = projected[Math.floor(hash01(i * 4.73) * projected.length)] ?? projected[0];
    const color = poseSideColor(posePointSide(base.id), colors);
    const angle = hash01(i * 9.41 + 0.27) * Math.PI * 2;
    const radius = 0.075 + hash01(i * 7.17 + 0.4) * 0.22;
    const vertical = (hash01(i * 3.11 + 0.8) - 0.5) * 0.18;
    points.push({
      x: base.x + Math.cos(angle) * radius,
      y: base.y + Math.sin(angle) * radius * 0.72 + vertical,
      z: base.z + (hash01(i * 6.91 + 0.12) - 0.5) * 0.28,
      r: Math.min(1, color.r * 1.08 + 0.05),
      g: Math.min(1, color.g * 1.08 + 0.05),
      b: Math.min(1, color.b * 1.08 + 0.05),
      a: 0.34 + hash01(i * 2.47) * 0.36,
      mix: color.mix,
      glow: 0.5 + hash01(i * 5.41) * 0.34,
      jitter: 0.003,
      kind: 0,
    });
  }
}

function posePaletteColors() {
  const primary = new THREE.Color(state.theme?.primary ?? "#ff4f8f");
  const accent = new THREE.Color(state.theme?.accent ?? "#49e6ff");
  const rim = new THREE.Color(state.theme?.rim ?? "#fff4c2");
  return {
    left: accent.clone().lerp(rim, 0.14),
    right: primary.clone().lerp(rim, 0.18),
    core: primary.clone().lerp(accent, 0.52).lerp(rim, 0.1),
    rim,
  };
}

function poseSideColor(side, colors) {
  const color = side === "left" ? colors.left : side === "right" ? colors.right : colors.core;
  const total = color.r + color.g + color.b + 0.001;
  return {
    r: color.r,
    g: color.g,
    b: color.b,
    mix: THREE.MathUtils.clamp((color.g * 0.45 + color.b * 0.65) / total, 0, 1),
  };
}

function poseConnectionSide(fromId, toId) {
  const fromSide = posePointSide(fromId);
  const toSide = posePointSide(toId);
  return fromSide === toSide ? fromSide : "core";
}

function posePointSide(id) {
  if (POSE_LEFT_IDS.has(id)) return "left";
  if (POSE_RIGHT_IDS.has(id)) return "right";
  return "core";
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
  updateMeshAnimation(delta, now);
  updateBvhParticleMotion(delta, now);
  detectHands(now);
  updatePointingBlend(now);
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
    if (!state.gestureCommand?.pointing || (now >= state.pointingModeUntil && state.pointingBlend <= POINTING_EXIT_EPSILON)) {
      state.gestureCommand = { name: "none", pointing: false, pointX: 0, pointY: 0, pointZ: 0 };
      state.lastGestureCommand = "none";
    }
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
  updateGestureCommand(hands, now);
  const pointingMode = isPointingModeActive(now);
  if (pointingMode) {
    ui.setStatus("食指指向中，模型跟随移动", "ready");
  }
  const rawGesture = hands.length >= 2 ? spread * 0.48 + openness * 0.52 : openness;
  const gestureFloor = THREE.MathUtils.clamp(0.22 - (state.sensitivity - 1) * 0.12, 0.08, 0.34);
  const gestureRange = THREE.MathUtils.clamp(0.58 - (state.sensitivity - 1) * 0.16, 0.38, 0.78);
  const responsiveGesture = THREE.MathUtils.clamp((rawGesture - gestureFloor) / gestureRange, 0, 1);
  const nextGestureTarget = THREE.MathUtils.clamp(Math.pow(responsiveGesture, 1.22), 0, 1);
  state.gestureTarget = pointingMode ? 0.006 : nextGestureTarget;
  state.handMode = pointingMode ? "指向" : state.gestureTarget > 0.62 ? "展开" : state.gestureTarget < 0.26 ? "收拢" : "半开";
  const follow = pointingMode ? 0.78 : state.gestureTarget > state.gesture ? 0.12 : 0.28;
  state.gesture = THREE.MathUtils.lerp(state.gesture, state.gestureTarget, follow);
  if (pointingMode) {
    state.smoothGesture = THREE.MathUtils.lerp(state.smoothGesture, 0, 0.62);
  }
  updateFistViewControl(hands[0], hands.length);
  updateDiagnostics(hands.length, now);
}

function updateGestureCommand(hands, now) {
  const command = classifyGestureCommand(hands);
  if (command.name !== "none") {
    if (command.pointing && state.gestureCommand?.pointing) {
      command.pointX = THREE.MathUtils.lerp(state.gestureCommand.pointX, command.pointX, 0.54);
      command.pointY = THREE.MathUtils.lerp(state.gestureCommand.pointY, command.pointY, 0.54);
      command.pointZ = THREE.MathUtils.lerp(state.gestureCommand.pointZ, command.pointZ, 0.54);
    }
    state.gestureCommand = command;
    state.lastGestureCommand = command.name;
    state.gestureCommandUntil = now + (command.pointing ? POINTING_MODE_HOLD_MS : 520);
    if (command.pointing) {
      state.pointingModeUntil = now + POINTING_MODE_HOLD_MS;
    }
    return;
  }

  if (now < state.gestureCommandUntil && state.gestureCommand?.name !== "none") {
    if (state.gestureCommand.pointing && now < state.pointingModeUntil) {
      state.lastGestureCommand = "point";
    }
    return;
  }

  if (!state.gestureCommand?.pointing || state.pointingBlend <= POINTING_EXIT_EPSILON) {
    state.gestureCommand = command;
  }
  state.lastGestureCommand = "none";
}

function isPointingModeActive(now) {
  return Boolean(state.gestureCommand?.pointing && (now < state.pointingModeUntil || state.pointingBlend > POINTING_EXIT_EPSILON));
}

function updatePointingBlend(now) {
  const target = state.gestureCommand?.pointing && now < state.pointingModeUntil ? 1 : 0;
  const follow = target > state.pointingBlend ? 0.48 : 0.13;
  state.pointingBlend = THREE.MathUtils.lerp(state.pointingBlend, target, follow);
  if (target === 0 && state.pointingBlend <= POINTING_EXIT_EPSILON && state.gestureCommand?.pointing) {
    state.gestureCommand = { name: "none", pointing: false, pointX: 0, pointY: 0, pointZ: 0 };
    state.lastGestureCommand = "none";
  }
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
  if (state.cameraTransition || state.gestureCommand?.pointing || state.pointingBlend > POINTING_EXIT_EPSILON) {
    if (state.fistViewActive) {
      controls.enabled = true;
    }
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
  if (model === "pose" && !particles.customPosePoints?.length) {
    return "heart";
  }
  return model;
}

function getActiveShowPreset() {
  if (state.showPreset === "custom") {
    return state.customShowPreset;
  }
  return SHOW_PRESETS[state.showPreset] ?? SHOW_PRESETS.auto;
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
  if (model === "ring") return "戒指";
  if (model === "cake") return "生日蛋糕";
  if (model === "balloons") return "气球";
  if (model === "text") return "文字";
  if (model === "pose") return "姿态";
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

  if (model === "ring") {
    return {
      primary: "#ffd86a",
      accent: "#eaf8ff",
    };
  }

  if (model === "cake") {
    return {
      primary: "#ff7cb6",
      accent: "#ffe9a6",
    };
  }

  if (model === "balloons") {
    return {
      primary: "#ff4f8f",
      accent: "#49e6ff",
    };
  }

  if (model === "pose") {
    return {
      primary: "#49e6ff",
      accent: currentState.theme?.primary ?? "#ff4f8f",
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
  if (normalized === "pose" && !particles.customPosePoints?.length) {
    showHeldDiagnostic("请先上传舞蹈/人物视频，导入后会自动切换到姿态粒子", 7000);
    poseVideoInput?.click();
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
  } else if (normalized === "mesh" && meshBasePoints.length) {
    meshTransformedPoints = transformMeshPoints(meshBasePoints, state.meshOptions, meshTransformedPoints);
    setMeshPoints(particles, meshTransformedPoints, meshAnimationSource?.hasAnimation ? currentVisibleParticleCount("mesh") : undefined);
  } else {
    setParticleTargets(particles, normalized, normalized === "pose" ? { writeCount: currentVisibleParticleCount("pose") } : undefined);
  }

  syncParticlePalette();
  syncParticleDrawRange();
  syncParticleBrightnessUniforms();
}

function syncParticleBrightnessUniforms() {
  particles.material.uniforms.uModelBrightness.value = THREE.MathUtils.clamp(state.modelBrightness ?? 1, 0.35, 2.4);
  particles.material.uniforms.uImageBrightness.value =
    state.model === "image" || state.model === "pose" ? THREE.MathUtils.clamp(state.imageBrightness ?? 2.8, 0.45, 5.2) : 1;
}

function syncParticleDrawRange() {
  const visibleCount = currentVisibleParticleCount();
  setParticleDrawCount(particles, visibleCount);
  ui.updateImageSizeLabel(state.model === "image" ? visibleCount : null);
}

function currentVisibleParticleCount(model = state.model) {
  const safetyRatio = state.safetyMode ? 0.58 : 1;
  if (model === "mesh") {
    const density = THREE.MathUtils.clamp(state.meshOptions?.density ?? 1, 0.25, 1.2);
    const liveLimit = meshAnimationSource?.hasAnimation || meshAnimationSource?.poseVideoDriven ? meshBasePoints.length || particles.count : particles.count;
    return Math.min(particles.count, liveLimit, Math.max(22000, Math.round(particles.count * Math.min(1, density) * safetyRatio)));
  }
  if (model === "pose") {
    const densitySource = bvhMotionSource ? state.motionOptions?.density : state.poseOptions?.density;
    const density = THREE.MathUtils.clamp(densitySource ?? 1, 0.35, 1.8);
    const ratio = (qualityProfile.id === "compact" ? 0.16 : qualityProfile.id === "balanced" ? 0.2 : 0.24) * density;
    return Math.min(particles.count, Math.max(18000, Math.round(particles.count * ratio * safetyRatio)));
  }
  if (model === "image") {
    const size = THREE.MathUtils.clamp(state.imageSize ?? 1, 0.45, 1);
    const density = THREE.MathUtils.clamp(size ** 1.42, 0.32, 1);
    return Math.max(12000, Math.round(particles.count * density * safetyRatio));
  }
  return Math.max(26000, Math.round(particles.count * safetyRatio));
}

function currentPoseSampleTarget() {
  const density = THREE.MathUtils.clamp(state.poseOptions?.density ?? 1, 0.35, 1.6);
  const base = Math.max(5000, Math.round((qualityProfile.poseSampleCount ?? qualityProfile.particleCount * 0.025) / 100) * 100);
  return Math.min(26000, Math.max(4200, Math.round((base * density) / 100) * 100));
}

function currentPoseFrameInterval() {
  const follow = THREE.MathUtils.clamp(state.poseOptions?.follow ?? 1, 0.45, 1.8);
  return Math.round(THREE.MathUtils.clamp(POSE_FRAME_INTERVAL_MS / follow, 44, 180));
}

function scheduleMeshOptionsUpdate() {
  if (!meshBasePoints.length || state.model !== "mesh") return;
  if (meshOptionsFrame) return;
  meshOptionsFrame = requestAnimationFrame(() => {
    meshOptionsFrame = 0;
    meshTransformedPoints = transformMeshPoints(meshBasePoints, state.meshOptions, meshTransformedPoints);
    setMeshPoints(particles, meshTransformedPoints, meshAnimationSource?.hasAnimation ? currentVisibleParticleCount("mesh") : undefined);
    syncParticleDrawRange();
    syncParticleBrightnessUniforms();
  });
}

function transformMeshPoints(points, options = {}, target = []) {
  if (!Array.isArray(points) || points.length === 0) return points;
  const size = THREE.MathUtils.clamp(options.size ?? 1, 0.25, 2.6);
  const depth = THREE.MathUtils.clamp(options.depth ?? 1, 0.2, 2.4);
  const spread = THREE.MathUtils.clamp(options.spread ?? 1, 0, 2);
  const yaw = THREE.MathUtils.clamp(options.yaw ?? 0, -Math.PI, Math.PI);
  const groundOffset = THREE.MathUtils.clamp(options.groundOffset ?? 0, -1.2, 1.2);
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const center = options.autoCenter ? meshPointCloudCenter(points) : null;
  target.length = points.length;
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];
    const next = target[i] ?? {};
    const baseX = (point.baseX ?? point.x) - (center?.x ?? 0);
    const baseY = (point.baseY ?? point.y) - (center?.y ?? 0);
    const baseZ = (point.baseZ ?? point.z ?? 0) - (center?.z ?? 0);
    const x = baseX * size;
    const z = baseZ * size * depth;
    next.x = x * cosYaw - z * sinYaw;
    next.y = baseY * size + groundOffset;
    next.z = x * sinYaw + z * cosYaw;
    next.r = point.r ?? 1;
    next.g = point.g ?? 1;
    next.b = point.b ?? 1;
    next.a = point.a ?? 1;
    next.mix = point.mix;
    next.glow = point.glow;
    next.kind = point.kind;
    next.jitter = (point.baseJitter ?? point.jitter ?? 0.004) * spread;
    target[i] = next;
  }
  return target;
}

function meshPointCloudCenter(points) {
  const box = new THREE.Box3();
  const temp = new THREE.Vector3();
  const limit = Math.min(points.length, 120000);
  const stride = Math.max(1, Math.floor(points.length / limit));
  for (let i = 0; i < points.length; i += stride) {
    const point = points[i];
    temp.set(point.baseX ?? point.x ?? 0, point.baseY ?? point.y ?? 0, point.baseZ ?? point.z ?? 0);
    box.expandByPoint(temp);
  }
  if (box.isEmpty()) return new THREE.Vector3();
  return box.getCenter(new THREE.Vector3());
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
  const pointingPower = THREE.MathUtils.clamp(state.pointingBlend ?? 0, 0, 1);
  const pointingGain = THREE.MathUtils.clamp(state.pointingSensitivity ?? 1.2, 0.6, 1.8);
  const pointingX = state.gestureCommand?.pointing ? state.gestureCommand.pointX : 0;
  const pointingY = state.gestureCommand?.pointing ? state.gestureCommand.pointY : 0;
  const pointingZ = state.gestureCommand?.pointing ? state.gestureCommand.pointZ : 0;
  const pointingSpeed = (3.9 + pointingGain * 1.45) * pointingPower;
  if (pointingPower > 0.04) {
    state.pointingRig.x = THREE.MathUtils.clamp(
      state.pointingRig.x + pointingX * pointingSpeed * delta,
      -4.9 * pointingGain,
      4.9 * pointingGain,
    );
    state.pointingRig.y = THREE.MathUtils.clamp(
      state.pointingRig.y + pointingY * pointingSpeed * 0.72 * delta,
      -2.75 * pointingGain,
      2.75 * pointingGain,
    );
    state.pointingRig.z = THREE.MathUtils.clamp(
      state.pointingRig.z + pointingZ * pointingSpeed * 0.48 * delta,
      -1.35 * pointingGain,
      1.35 * pointingGain,
    );
  } else {
    state.pointingRig.x = THREE.MathUtils.lerp(state.pointingRig.x, 0, 0.035);
    state.pointingRig.y = THREE.MathUtils.lerp(state.pointingRig.y, 0, 0.035);
    state.pointingRig.z = THREE.MathUtils.lerp(state.pointingRig.z, 0, 0.035);
  }
  const musicMix = 1 - pointingPower * 0.9;
  const targetX =
    (state.audioRig.anchorX + orbitX + state.audioRig.impactX) * musicMix +
    state.pointingRig.x;
  const targetY =
    (state.audioRig.anchorY + orbitY + kick * 0.28 * modelMotion + state.audioRig.impactY) * musicMix +
    state.pointingRig.y;
  const targetZ =
    (state.audioRig.anchorZ + orbitZ + state.audioRig.impactZ) * musicMix +
    state.pointingRig.z;
  const targetTiltX =
    drive * Math.sin(elapsed * 1.75 + bass * 3.1) * phraseLift * 0.46 + state.audioRig.impactTiltX - targetZ * 0.16;
  const targetTiltZ =
    drive * Math.sin(elapsed * 2.1 + treble * 4.4) * (0.12 + phraseLift * 0.48) +
    state.audioRig.impactTiltZ -
    targetX * 0.18;
  const targetYaw =
    enabled || pointingPower > 0.04 ? Math.atan2(targetX - state.audioRig.x, 1.6 + targetZ - state.audioRig.z) * (enabled ? 1.35 : 0.82) : 0;
  const follow = enabled ? THREE.MathUtils.clamp(0.12 + impact * 0.26 + kick * 0.1 + onset * 0.08, 0.12, 0.46) : 0.09;
  const positionFollow = Math.max(follow, pointingPower > 0.04 ? 0.18 + pointingPower * 0.18 : follow);

  state.audioRig.scale = THREE.MathUtils.lerp(state.audioRig.scale, targetScale, follow);
  state.audioRig.x = THREE.MathUtils.lerp(state.audioRig.x, targetX, positionFollow);
  state.audioRig.y = THREE.MathUtils.lerp(state.audioRig.y, targetY, positionFollow);
  state.audioRig.z = THREE.MathUtils.lerp(state.audioRig.z, targetZ, positionFollow);
  state.audioRig.tiltX = THREE.MathUtils.lerp(state.audioRig.tiltX, targetTiltX, positionFollow);
  state.audioRig.tiltZ = THREE.MathUtils.lerp(state.audioRig.tiltZ, targetTiltZ, positionFollow);
  state.audioRig.yaw = THREE.MathUtils.lerp(state.audioRig.yaw, targetYaw, positionFollow);

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
  performanceStats.fps = fps;
  performanceStats.frames = 0;
  performanceStats.lastUpdate = now;
  ui.updatePerformance({
    fps,
    particleCount: particles.visibleCount ?? particles.count,
  });
  updateHealthPanel();
}

function setSafetyMode(active) {
  state.safetyMode = Boolean(active);
  writeBooleanStorage("safetyMode", state.safetyMode);
  ui.setSafetyModeActive(state.safetyMode);
  if (state.safetyMode) {
    state.showPresetActive = false;
    ui.setShowPresetActive(false);
    setBackgroundMode(backgroundSystem, "minimal", state.theme);
    ui.setBackgroundActive(backgroundSystem.mode);
    ui.saveBackgroundMode(backgroundSystem.mode);
    setBackgroundBrightnessRatio(0.72);
    setModelBrightnessRatio(Math.min(state.modelBrightness ?? 1, 0.95));
    setImageBrightnessRatio(Math.min(state.imageBrightness ?? 2.8, 2.1));
    setRangeRatio(meshDensity, 0.58);
    setRangeRatio(meshAnimationFollow, 0.72);
    setRangeRatio(motionDensity, 0.72);
    setRangeRatio(poseDensity, 0.72);
    state.pointerBoost = 0;
    state.recoverUntil = performance.now() + 1200;
    showHeldDiagnostic("现场安全模式已开启：降低绘制量、Bloom 和背景复杂度", 5200);
  } else {
    showHeldDiagnostic("现场安全模式已关闭，可继续手动调高亮度和粒子密度", 4200);
  }
  syncParticleDrawRange();
  syncParticleBrightnessUniforms();
  updateHealthPanel(true);
}

function updateHealthPanel(force = false) {
  const now = performance.now();
  if (!force && now - (state.healthLastUpdate ?? 0) < 1200) return;
  state.healthLastUpdate = now;
  const gl = renderer.getContext();
  const webglOk = Boolean(gl && !gl.isContextLost?.());
  const handsStatus = state.modelReady ? "ok" : state.lastErrorMessage ? "error" : "warn";
  const cameraStatus = state.cameraReady ? "ok" : state.lastErrorMessage ? "error" : "warn";
  const audioStatus = audioReactor.enabled ? "ok" : "warn";
  const fps = performanceStats.fps || 0;
  ui.updateHealth({
    webgl: { status: webglOk ? "ok" : "error", label: webglOk ? (renderer.capabilities.isWebGL2 ? "WebGL2" : "WebGL1") : "异常" },
    camera: { status: cameraStatus, label: state.cameraReady ? "已开启" : state.lastErrorMessage ? "不可用" : "待授权" },
    mediapipe: { status: handsStatus, label: state.modelReady ? "Hands 已加载" : state.lastErrorMessage ? "加载失败" : "加载中" },
    mic: { status: audioReactor.stream ? "ok" : "warn", label: audioReactor.stream ? "已开启" : "未开启" },
    audio: { status: audioStatus, label: audioReactor.enabled ? "响应中" : "未开启" },
    resources: { status: state.resourceFailures > 0 || state.lastErrorMessage ? "warn" : "ok", label: state.resourceFailures > 0 ? `${state.resourceFailures} 项异常` : "正常" },
    quality: { status: state.safetyMode ? "warn" : "ok", label: `${qualityProfile.label} · ${Math.round((particles.visibleCount ?? particles.count) / 1000)}k` },
    fps: { status: !fps ? "warn" : fps >= 45 ? "ok" : fps >= 28 ? "warn" : "error", label: fps ? `${fps} FPS` : "测量中" },
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

function stopMeshAnimationSource() {
  if (!meshAnimationSource) return;
  meshAnimationSource.action?.stop();
  meshAnimationSource.mixer?.stopAllAction?.();
  meshAnimationSource = null;
}

function updateMeshAnimationPlayback() {
  updateMeshAnimationPlaybackForSource(meshAnimationSource);
}

function updateMeshAnimationPlaybackForSource(source) {
  if (!source?.hasAnimation || !source.mixer) return;
  const enabled = Boolean(state.meshOptions?.animationEnabled);
  const loop = state.meshOptions?.animationLoop !== false;
  source.enabled = enabled;
  source.mixer.timeScale = THREE.MathUtils.clamp(state.meshOptions?.animationSpeed ?? 1, 0.25, 2.2);
  if (source.action) {
    source.action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    source.action.clampWhenFinished = !loop;
    source.action.paused = !enabled;
    const duration = source.action.getClip()?.duration ?? 0;
    const canResume = loop || duration <= 0 || source.action.time < duration - 0.05;
    if (enabled && canResume && !source.action.isRunning()) {
      source.action.play();
    }
  }
}

function updateMeshAnimation(delta, now) {
  if (meshAnimationSource?.poseVideoDriven) return;
  if (!meshAnimationSource?.hasAnimation || !meshAnimationSource.mixer) return;
  updateMeshAnimationPlayback();
  if (!meshAnimationSource.enabled) return;
  meshAnimationSource.mixer.update(delta);
  if (state.model !== "mesh") return;
  if (now - meshAnimationSource.lastSampleAt < currentMeshAnimationFrameInterval()) return;
  meshAnimationSource.lastSampleAt = now;
  sampleMeshSource(meshAnimationSource);
  meshBasePoints = meshAnimationSource.points;
  meshTransformedPoints = transformMeshPoints(meshBasePoints, state.meshOptions, meshTransformedPoints);
  setMeshPoints(particles, meshTransformedPoints, currentVisibleParticleCount("mesh"));
}

function currentMeshAnimationFrameInterval() {
  const follow = THREE.MathUtils.clamp(state.meshOptions?.animationFollow ?? 1, 0.35, 1.8);
  return Math.round(THREE.MathUtils.clamp(86 / follow, 42, 180));
}

function currentAnimatedMeshSampleLimit(targetCount) {
  const density = THREE.MathUtils.clamp(state.meshOptions?.density ?? 1, 0.25, 1.2);
  const profileLimit =
    qualityProfile.id === "compact" ? 76000 : qualityProfile.id === "balanced" ? 118000 : qualityProfile.id === "ultra" ? 260000 : 185000;
  return Math.max(36000, Math.min(targetCount, Math.round(profileLimit * density)));
}

function preparePoseVideoRetargeter() {
  if (!state.poseOptions?.retargetEnabled) {
    return markPoseVideoRetargetFailure("视频驱动 3D 已关闭");
  }
  const target = meshAnimationSource?.skinnedMeshes?.find((mesh) => mesh?.skeleton?.bones?.length);
  if (!target) {
    return markPoseVideoRetargetFailure("当前没有带骨骼的 GLB/glTF");
  }

  const boneMap = createHumanoidBoneMap(target.skeleton);
  const matchedRequired = POSE_RETARGET_REQUIRED.filter((name) => boneMap.has(name)).length;
  if (matchedRequired < 4) {
    return markPoseVideoRetargetFailure("当前模型骨骼命名匹配不足", matchedRequired);
  }

  meshAnimationSource.action?.stop();
  meshAnimationSource.mixer?.stopAllAction?.();
  target.skeleton.pose();
  meshAnimationSource.scene.updateMatrixWorld(true);

  const restBones = target.skeleton.bones.map((bone) => ({
    bone,
    position: bone.position.clone(),
    quaternion: bone.quaternion.clone(),
    scale: bone.scale.clone(),
  }));
  const states = new Map();
  for (const spec of POSE_RETARGET_SPECS) {
    const stateForBone = capturePoseRetargetBoneState(boneMap, spec);
    if (stateForBone) {
      states.set(spec.bone, stateForBone);
    }
  }

  if (states.size < 4) {
    return markPoseVideoRetargetFailure("当前模型缺少可驱动的肢体骨骼", states.size);
  }

  const restMetrics = computePoseRetargetRestMetrics(boneMap, target);
  const rootState = capturePoseRetargetRootState(boneMap);
  poseVideoRetargeter = {
    mesh: target,
    skeleton: target.skeleton,
    boneMap,
    states,
    restBones,
    previousLocalQuats: new Map(),
    previousDirections: new Map(),
    footLocks: createPoseRetargetFootLocks(),
    restMetrics,
    rootState,
    rootMotion: new THREE.Vector3(),
    neutralHips: null,
    matchedBones: states.size,
  };
  meshAnimationSource.poseVideoDriven = true;
  meshAnimationSource.hasAnimation = true;
  return markPoseVideoRetargetSuccess(states.size);
}

function markPoseVideoRetargetFailure(reason, matchedBones = 0) {
  state.poseVideoRetargetReady = false;
  state.poseVideoRetargetReason = reason;
  state.poseVideoRetargetMatchedBones = matchedBones;
  return { ok: false, reason, matchedBones };
}

function markPoseVideoRetargetSuccess(matchedBones) {
  state.poseVideoRetargetReady = true;
  state.poseVideoRetargetReason = "";
  state.poseVideoRetargetMatchedBones = matchedBones;
  return { ok: true, matchedBones };
}

function stopPoseVideoRetargeter(resetPose = true) {
  if (poseVideoRetargeter && resetPose) {
    restorePoseRetargetRestPose(poseVideoRetargeter);
  }
  poseVideoRetargeter = null;
  state.poseVideoRetargetReady = false;
  state.poseVideoRetargetActive = false;
  state.poseVideoRetargetMatchedBones = 0;
  if (meshAnimationSource) {
    meshAnimationSource.poseVideoDriven = false;
    meshAnimationSource.hasAnimation = meshAnimationSource.nativeHasAnimation ?? Boolean(meshAnimationSource.animations?.length);
  }
}

function computePoseRetargetRestMetrics(boneMap, mesh) {
  const point = (role) => {
    const bone = boneMap.get(role);
    return bone ? bone.getWorldPosition(new THREE.Vector3()) : null;
  };
  const distance = (a, b) => {
    const from = point(a);
    const to = point(b);
    return from && to ? from.distanceTo(to) : 0;
  };
  const box = new THREE.Box3();
  for (const bone of mesh.skeleton?.bones ?? []) {
    box.expandByPoint(bone.getWorldPosition(new THREE.Vector3()));
  }
  const size = box.getSize(new THREE.Vector3());
  const height = Math.max(size.y, size.x, size.z, 0.001);
  const shoulderWidth = distance("lupperarm", "rupperarm") || distance("lshoulder", "rshoulder");
  const hipWidth = distance("lupperleg", "rupperleg");
  const torsoLength = distance("hips", "chest") || distance("hips", "spine");
  return {
    height,
    shoulderRatio: shoulderWidth / height || 0.18,
    hipRatio: hipWidth / height || 0.14,
    torsoRatio: torsoLength / height || 0.34,
  };
}

function capturePoseRetargetRootState(boneMap) {
  const bone = boneMap.get("hips");
  if (!bone) return null;
  return {
    bone,
    restPosition: bone.position.clone(),
  };
}

function createPoseRetargetFootLocks() {
  return {
    left: { blend: 0, ankle: null, toe: null, lastCenter: null },
    right: { blend: 0, ankle: null, toe: null, lastCenter: null },
  };
}

function updatePoseVideoRetarget(landmarks, now) {
  if (!state.poseOptions?.retargetEnabled) return false;
  if (!poseVideoRetargeter) {
    const prepared = preparePoseVideoRetargeter();
    if (!prepared.ok) return false;
  }
  const points = createPoseRetargetPointMap(landmarks);
  if (!points) return false;
  applyPoseRetargetFrame(poseVideoRetargeter, points);
  sampleMeshSource(meshAnimationSource);
  meshBasePoints = meshAnimationSource.points;
  meshTransformedPoints = transformMeshPoints(meshBasePoints, state.meshOptions, meshTransformedPoints);
  if (state.model !== "mesh") {
    selectModel("mesh", true);
  }
  setMeshPoints(particles, meshTransformedPoints, currentVisibleParticleCount("mesh"));
  state.poseVideoRetargetActive = true;
  state.poseVideoRetargetFrames += 1;
  poseVideoRetargeter.lastFrameAt = now;
  return true;
}

function createHumanoidBoneMap(skeleton) {
  const map = new Map();
  for (const bone of skeleton.bones) {
    const key = canonicalBoneName(bone.name);
    if (key && !map.has(key)) {
      map.set(key, bone);
    }
  }
  fillHumanoidBoneMapFromHierarchy(map);
  return map;
}

function fillHumanoidBoneMapFromHierarchy(map) {
  const hips = map.get("hips");
  if (!hips) return;
  if (!map.has("spine")) {
    const spine = firstCentralChildBone(hips);
    if (spine) map.set("spine", spine);
  }
  if (!map.has("chest")) {
    const chest = firstCentralChildBone(map.get("spine"));
    if (chest && chest !== map.get("spine")) map.set("chest", chest);
  }
  if (!map.has("neck")) {
    const neck = firstCentralChildBone(map.get("chest") ?? map.get("spine"));
    if (neck && neck !== map.get("chest")) map.set("neck", neck);
  }
}

function firstCentralChildBone(bone) {
  if (!bone?.children?.length) return null;
  return bone.children.find((child) => child.isBone && !/^[lr]/.test(canonicalBoneName(child.name))) ?? null;
}

function capturePoseRetargetBoneState(boneMap, spec) {
  const bone = boneMap.get(spec.bone);
  if (!bone) return null;
  const endBone = findPoseRetargetEndBone(boneMap, spec.bone, bone);
  if (!endBone) return null;
  const start = new THREE.Vector3();
  const end = new THREE.Vector3();
  bone.getWorldPosition(start);
  endBone.getWorldPosition(end);
  const restDir = end.sub(start);
  if (restDir.lengthSq() < 0.000001) return null;
  const length = restDir.length();
  restDir.normalize();
  return {
    bone,
    restDir,
    restWorldQuaternion: bone.getWorldQuaternion(new THREE.Quaternion()),
    restLocalQuaternion: bone.quaternion.clone(),
    length,
  };
}

function findPoseRetargetEndBone(boneMap, role, bone) {
  const preferred = POSE_RETARGET_CHILD[role];
  if (preferred && boneMap.has(preferred)) return boneMap.get(preferred);
  return bone.children.find((child) => child.isBone) ?? null;
}

function createPoseRetargetPointMap(landmarks) {
  const visible = landmarks
    .map((landmark, id) => ({ landmark, id, visibility: poseVisibility(landmark) }))
    .filter((item) => item.visibility > 0.2);
  if (visible.length < 8) return null;
  const bounds = poseBounds(visible);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const centerZ = averagePoseZ(visible);
  const scale = 2.25 / Math.max(bounds.width, bounds.height, 0.28);
  const points = new Map();
  for (const id of POSE_DETAIL_NODE_IDS) {
    const point = projectPoseLandmark(landmarks[id], id, centerX, centerY, centerZ, scale);
    if (point) {
      const vector = new THREE.Vector3(point.x, point.y, point.z * 1.65);
      vector.visibility = point.visibility;
      vector.poseId = id;
      points.set(id, vector);
    }
  }
  addPoseCompositePoint(points, "shoulders", 11, 12);
  addPoseCompositePoint(points, "hips", 23, 24);
  points.metrics = computePoseRetargetMetrics(points);
  return points;
}

function addPoseCompositePoint(points, name, leftId, rightId) {
  const left = points.get(leftId);
  const right = points.get(rightId);
  if (!left || !right) return;
  const composite = new THREE.Vector3().addVectors(left, right).multiplyScalar(0.5);
  composite.visibility = Math.min(left.visibility ?? 1, right.visibility ?? 1);
  points.set(name, composite);
}

function computePoseRetargetMetrics(points) {
  const values = [...points.values()];
  const box = new THREE.Box3();
  for (const value of values) box.expandByPoint(value);
  const size = box.getSize(new THREE.Vector3());
  const distance = (a, b) => {
    const from = points.get(a);
    const to = points.get(b);
    return from && to ? from.distanceTo(to) : 0;
  };
  const shoulderWidth = distance(11, 12);
  const hipWidth = distance(23, 24);
  const torsoLength = distance("hips", "shoulders");
  const bodyHeight = Math.max(size.y, 0.001);
  const footYs = [27, 28, 29, 30, 31, 32].map((id) => points.get(id)?.y).filter((value) => Number.isFinite(value));
  return {
    height: bodyHeight,
    width: Math.max(size.x, 0.001),
    depth: Math.max(size.z, 0.001),
    groundY: footYs.length ? Math.min(...footYs) : box.min.y,
    shoulderRatio: shoulderWidth / bodyHeight || 0.18,
    hipRatio: hipWidth / bodyHeight || 0.14,
    torsoRatio: torsoLength / bodyHeight || 0.34,
  };
}

function applyPoseRetargetFrame(retargeter, points) {
  restorePoseRetargetRestPose(retargeter);
  const smoothing = THREE.MathUtils.clamp(state.poseOptions?.retargetSmoothing ?? 0.35, 0, 0.85);
  const follow = THREE.MathUtils.clamp(1 - smoothing, 0.15, 1);
  stabilizePoseRetargetFeet(retargeter, points);
  applyPoseRetargetRootMotion(retargeter, points, follow);
  for (const spec of POSE_RETARGET_SPECS) {
    const stateForBone = retargeter.states.get(spec.bone);
    if (!stateForBone) continue;
    const from = points.get(spec.from);
    const to = points.get(spec.to);
    const confidence = poseRetargetSpecConfidence(from, to);
    if (!from || !to || confidence < 0.18) {
      holdPoseRetargetBone(retargeter, stateForBone, spec.bone, follow);
      continue;
    }
    const targetDir = new THREE.Vector3().subVectors(to, from);
    if (targetDir.lengthSq() < 0.000001) continue;
    applyPoseRetargetScaleAdaptation(retargeter, points, spec.bone, targetDir);
    targetDir.normalize();
    smoothPoseRetargetDirection(retargeter, spec.bone, targetDir, confidence);

    const fullAlign = new THREE.Quaternion().setFromUnitVectors(stateForBone.restDir, targetDir);
    const align = new THREE.Quaternion().identity().slerp(fullAlign, THREE.MathUtils.clamp(spec.strength ?? 1, 0, 1));
    const desiredWorld = align.multiply(stateForBone.restWorldQuaternion);
    const parentWorld = stateForBone.bone.parent?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion();
    const desiredLocal = parentWorld.invert().multiply(desiredWorld).normalize();
    const limitedLocal = limitPoseRetargetLocalQuaternion(stateForBone, desiredLocal, spec.bone, confidence);
    const previous = retargeter.previousLocalQuats.get(spec.bone);
    const confidenceFollow = THREE.MathUtils.clamp(follow * (0.35 + confidence * 0.65), 0.06, 1);
    const blended = previous
      ? previous.clone().slerp(limitedLocal, confidenceFollow)
      : stateForBone.restLocalQuaternion.clone().slerp(limitedLocal, confidenceFollow);
    stateForBone.bone.quaternion.copy(blended);
    retargeter.previousLocalQuats.set(spec.bone, blended.clone());
    stateForBone.bone.updateMatrixWorld(true);
  }
  retargeter.mesh.updateMatrixWorld(true);
}

function poseRetargetSpecConfidence(from, to) {
  return THREE.MathUtils.clamp(Math.min(from?.visibility ?? 1, to?.visibility ?? 1), 0, 1);
}

function holdPoseRetargetBone(retargeter, stateForBone, key, follow) {
  const previous = retargeter.previousLocalQuats.get(key);
  if (!previous) return;
  const held = previous.clone().slerp(stateForBone.restLocalQuaternion, THREE.MathUtils.clamp(0.035 + follow * 0.035, 0.035, 0.09));
  stateForBone.bone.quaternion.copy(held);
  retargeter.previousLocalQuats.set(key, held);
  stateForBone.bone.updateMatrixWorld(true);
}

function smoothPoseRetargetDirection(retargeter, key, targetDir, confidence) {
  const previous = retargeter.previousDirections.get(key);
  if (previous) {
    const directionFollow = THREE.MathUtils.clamp(0.32 + confidence * 0.58, 0.26, 0.9);
    targetDir.copy(previous.clone().lerp(targetDir, directionFollow));
    if (targetDir.lengthSq() > 0.000001) targetDir.normalize();
  }
  retargeter.previousDirections.set(key, targetDir.clone());
}

function limitPoseRetargetLocalQuaternion(stateForBone, desiredLocal, key, confidence) {
  const baseLimit = POSE_RETARGET_ANGLE_LIMITS[key] ?? 1.75;
  const confidenceScale = THREE.MathUtils.clamp(0.72 + confidence * 0.28, 0.72, 1);
  const limit = baseLimit * confidenceScale;
  const angle = stateForBone.restLocalQuaternion.angleTo(desiredLocal);
  if (!Number.isFinite(angle) || angle <= limit || angle <= 0.0001) return desiredLocal;
  return stateForBone.restLocalQuaternion.clone().slerp(desiredLocal, limit / angle).normalize();
}

function applyPoseRetargetScaleAdaptation(retargeter, points, key, direction) {
  const metrics = points.metrics;
  const rest = retargeter.restMetrics;
  if (!metrics || !rest) return;
  const isArm = key.includes("arm");
  const isLeg = key.includes("leg") || key.includes("foot");
  const isCore = key === "spine" || key === "chest" || key === "neck" || key === "head";
  if (isArm && metrics.shoulderRatio > 0.001) {
    direction.x *= THREE.MathUtils.clamp(rest.shoulderRatio / metrics.shoulderRatio, 0.78, 1.22);
    direction.z *= 1.08;
  } else if (isLeg && metrics.hipRatio > 0.001) {
    direction.x *= THREE.MathUtils.clamp(rest.hipRatio / metrics.hipRatio, 0.8, 1.18);
    direction.z *= 0.94;
  } else if (isCore && metrics.torsoRatio > 0.001) {
    direction.y *= THREE.MathUtils.clamp(rest.torsoRatio / metrics.torsoRatio, 0.86, 1.16);
    direction.z *= 0.82;
  }
}

function stabilizePoseRetargetFeet(retargeter, points) {
  const metrics = points.metrics;
  if (!metrics) return;
  for (const side of ["left", "right"]) {
    const ids = POSE_RETARGET_SIDE_POINTS[side];
    const lock = retargeter.footLocks?.[side];
    const ankle = points.get(ids.ankle);
    const toe = points.get(ids.toe) ?? points.get(ids.heel);
    if (!lock || !ankle || !toe) continue;
    const visibility = Math.min(ankle.visibility ?? 1, toe.visibility ?? 1);
    const center = new THREE.Vector3().addVectors(ankle, toe).multiplyScalar(0.5);
    const velocity = lock.lastCenter ? center.distanceTo(lock.lastCenter) : 0;
    const groundGap = center.y - metrics.groundY;
    const planted =
      visibility > 0.46 &&
      groundGap < Math.max(0.075, metrics.height * 0.07) &&
      velocity < Math.max(0.045, metrics.height * 0.055);

    if (planted) {
      if (!lock.ankle || lock.blend < 0.08) {
        lock.ankle = ankle.clone();
        lock.toe = toe.clone();
      } else {
        lock.ankle.lerp(ankle, 0.055);
        lock.toe.lerp(toe, 0.055);
      }
      lock.blend = THREE.MathUtils.lerp(lock.blend, 1, 0.28);
    } else {
      lock.blend = THREE.MathUtils.lerp(lock.blend, 0, 0.22);
    }

    if (lock.blend > 0.025 && lock.ankle && lock.toe) {
      const amount = THREE.MathUtils.clamp(lock.blend * 0.76, 0, 0.76);
      ankle.lerp(lock.ankle, amount);
      toe.lerp(lock.toe, amount * 0.92);
    }
    lock.lastCenter = center;
  }
}

function applyPoseRetargetRootMotion(retargeter, points, follow) {
  const root = retargeter.rootState;
  const hips = points.get("hips");
  if (!root || !hips) return;
  if (!retargeter.neutralHips) {
    retargeter.neutralHips = hips.clone();
  }
  const offset = new THREE.Vector3().subVectors(hips, retargeter.neutralHips);
  const meshScale = 1 / Math.max(meshAnimationSource?.normalizer ?? 1, 0.001);
  const target = new THREE.Vector3(
    THREE.MathUtils.clamp(offset.x * 0.18, -0.22, 0.22),
    THREE.MathUtils.clamp(offset.y * 0.14, -0.16, 0.18),
    THREE.MathUtils.clamp(offset.z * 0.12, -0.12, 0.12),
  ).multiplyScalar(meshScale);
  retargeter.rootMotion.lerp(target, THREE.MathUtils.clamp(0.08 + follow * 0.22, 0.08, 0.3));
  root.bone.position.copy(root.restPosition).add(retargeter.rootMotion);
  root.bone.updateMatrixWorld(true);
}

function restorePoseRetargetRestPose(retargeter) {
  for (const item of retargeter.restBones) {
    item.bone.position.copy(item.position);
    item.bone.quaternion.copy(item.quaternion);
    item.bone.scale.copy(item.scale);
  }
  retargeter.mesh.updateMatrixWorld(true);
}

function tryApplyBvhToMesh(bvh, fileName) {
  const target = meshAnimationSource?.skinnedMeshes?.find((mesh) => mesh?.skeleton?.bones?.length);
  if (!target) {
    return { ok: false, reason: "当前没有带骨骼的 GLB/glTF，因此改用 BVH 粒子骨架播放" };
  }

  const resolver = createBvhBoneResolver(target.skeleton, bvh.skeleton);
  if (resolver.matchedBones < 8) {
    return { ok: false, reason: "BVH 与当前 GLB/glTF 的骨骼命名匹配较少，因此改用 BVH 粒子骨架播放" };
  }

  try {
    if (meshAnimationEnabled) {
      meshAnimationEnabled.checked = true;
      meshAnimationEnabled.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      state.meshOptions = { ...state.meshOptions, animationEnabled: true };
    }
    const retargetedClip = SkeletonUtils.retargetClip(target, bvh.skeleton, bvh.clip, {
      fps: 24,
      hip: resolver.hipName,
      hipInfluence: new THREE.Vector3(0.65, 0.45, 0.65),
      preserveBonePositions: true,
      getBoneName: resolver.getBoneName,
    });
    if (!retargetedClip?.tracks?.length) {
      throw new Error("未生成可用骨骼轨道");
    }
    stopBvhParticleMotion();
    meshAnimationSource.action?.stop();
    meshAnimationSource.mixer?.stopAllAction?.();
    meshAnimationSource.mixer = new THREE.AnimationMixer(target);
    meshAnimationSource.action = meshAnimationSource.mixer.clipAction(retargetedClip);
    meshAnimationSource.action.reset().play();
    meshAnimationSource.animations = [retargetedClip];
    meshAnimationSource.hasAnimation = true;
    meshAnimationSource.enabled = true;
    meshAnimationSource.bvhFileName = fileName;
    meshAnimationSource.lastSampleAt = 0;
    updateMeshAnimationPlaybackForSource(meshAnimationSource);
    sampleMeshSource(meshAnimationSource);
    meshBasePoints = meshAnimationSource.points;
    meshTransformedPoints = transformMeshPoints(meshBasePoints, state.meshOptions, meshTransformedPoints);
    setMeshPoints(particles, meshTransformedPoints, currentVisibleParticleCount("mesh"));
    return { ok: true, matchedBones: resolver.matchedBones };
  } catch (error) {
    console.warn("BVH retarget failed", error);
    return { ok: false, reason: "BVH 重定向失败，已改用 BVH 粒子骨架播放" };
  }
}

function createBvhBoneResolver(targetSkeleton, sourceSkeleton) {
  const sourceByCanonical = new Map();
  const sourceByName = new Map();
  for (const bone of sourceSkeleton.bones) {
    sourceByName.set(bone.name, bone.name);
    const key = canonicalBoneName(bone.name);
    if (key && !sourceByCanonical.has(key)) {
      sourceByCanonical.set(key, bone.name);
    }
  }

  const targetToSource = new Map();
  let matchedBones = 0;
  for (const bone of targetSkeleton.bones) {
    const direct = sourceByName.get(bone.name);
    const canonical = sourceByCanonical.get(canonicalBoneName(bone.name));
    const sourceName = direct ?? canonical;
    if (sourceName) {
      targetToSource.set(bone.name, sourceName);
      matchedBones += 1;
    }
  }

  return {
    matchedBones,
    hipName: sourceByCanonical.get("hips") ?? sourceSkeleton.bones[0]?.name ?? "Hips",
    getBoneName: (bone) => targetToSource.get(bone.name),
  };
}

function startBvhParticleMotion(bvh, fileName) {
  stopBvhParticleMotion();
  const root = bvh.skeleton.bones[0];
  const mixer = new THREE.AnimationMixer(root);
  const action = mixer.clipAction(bvh.clip);
  action.setLoop(state.motionOptions?.loop === false ? THREE.LoopOnce : THREE.LoopRepeat, state.motionOptions?.loop === false ? 1 : Infinity);
  action.clampWhenFinished = state.motionOptions?.loop === false;
  action.reset().play();
  bvhMotionSource = {
    fileName,
    root,
    skeleton: bvh.skeleton,
    clip: bvh.clip,
    mixer,
    action,
    points: [],
    lastSampleAt: 0,
  };
  bvhMotionSource.points = createBvhPointCloud(bvhMotionSource, currentBvhSampleTarget());
  setPosePoints(particles, bvhMotionSource.points, currentVisibleParticleCount("pose"));
}

function stopBvhParticleMotion() {
  if (!bvhMotionSource) return;
  bvhMotionSource.action?.stop();
  bvhMotionSource.mixer?.stopAllAction?.();
  bvhMotionSource = null;
}

function updateBvhParticleMotion(delta, now) {
  if (!bvhMotionSource) return;
  updateBvhPlaybackOptions();
  bvhMotionSource.mixer.update(delta);
  if (state.model !== "pose") return;
  if (now - bvhMotionSource.lastSampleAt < 68) return;
  bvhMotionSource.lastSampleAt = now;
  bvhMotionSource.points = createBvhPointCloud(bvhMotionSource, currentBvhSampleTarget());
  setPosePoints(particles, bvhMotionSource.points, currentVisibleParticleCount("pose"));
}

function updateBvhPlaybackOptions() {
  if (!bvhMotionSource?.action || !bvhMotionSource?.mixer) return;
  const loop = state.motionOptions?.loop !== false;
  bvhMotionSource.action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
  bvhMotionSource.action.clampWhenFinished = !loop;
  bvhMotionSource.mixer.timeScale = THREE.MathUtils.clamp(state.motionOptions?.speed ?? 1, 0.25, 2.2);
}

function currentBvhSampleTarget() {
  const density = THREE.MathUtils.clamp(state.motionOptions?.density ?? 1, 0.35, 1.8);
  const base = qualityProfile.id === "compact" ? 7200 : qualityProfile.id === "balanced" ? 10800 : qualityProfile.id === "ultra" ? 26000 : 18000;
  return Math.min(36000, Math.max(5200, Math.round((base * density) / 100) * 100));
}

function createBvhPointCloud(source, targetCount) {
  const bones = source.skeleton.bones.filter(Boolean);
  if (!bones.length) return createFallbackPosePointCloud(targetCount);
  source.root.updateMatrixWorld(true);
  const rawPositions = new Map();
  const box = new THREE.Box3();
  const temp = new THREE.Vector3();
  for (const bone of bones) {
    bone.getWorldPosition(temp);
    rawPositions.set(bone, temp.clone());
    box.expandByPoint(temp);
  }
  if (box.isEmpty()) return createFallbackPosePointCloud(targetCount);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const scale = (2.46 * THREE.MathUtils.clamp(state.motionOptions?.size ?? 1, 0.45, 2.6)) / Math.max(size.x, size.y, size.z, 0.001);
  const nodes = new Map();
  for (const bone of bones) {
    const raw = rawPositions.get(bone);
    const side = bvhBoneSide(bone.name);
    nodes.set(bone, {
      id: bone.name,
      side,
      x: (raw.x - center.x) * scale,
      y: (raw.y - center.y) * scale + 0.05,
      z: (raw.z - center.z) * scale,
      visibility: 1,
    });
  }

  const connections = [];
  let totalLength = 0;
  for (const bone of bones) {
    if (!bone.parent?.isBone || !nodes.has(bone.parent)) continue;
    const from = nodes.get(bone.parent);
    const to = nodes.get(bone);
    const length = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
    if (length <= 0.002) continue;
    const side = from.side === to.side ? from.side : "core";
    connections.push({ from, to, length, side });
    totalLength += length;
  }
  if (!connections.length) return createFallbackPosePointCloud(targetCount);

  const colors = posePaletteColors();
  const points = [];
  const limbBudget = Math.round(targetCount * 0.74);
  for (let i = 0; i < connections.length; i += 1) {
    const connection = connections[i];
    const count = Math.max(22, Math.round((connection.length / totalLength) * limbBudget));
    appendPoseLimbPoints(points, connection, count, colors, i + 41);
  }

  const keyNodes = [...nodes.values()].filter((node) => isBvhKeyJoint(node.id));
  const jointBudget = Math.max(260, Math.round(targetCount * 0.16));
  const jointCount = Math.max(16, Math.round(jointBudget / Math.max(1, keyNodes.length)));
  for (let i = 0; i < keyNodes.length; i += 1) {
    appendBvhJointPoints(points, keyNodes[i], jointCount, colors, i + 7);
  }

  appendBvhAuraPoints(points, keyNodes, colors, Math.max(180, Math.round(targetCount * 0.1)));
  if (points.length > targetCount) points.length = targetCount;
  return points;
}

function appendBvhJointPoints(points, point, count, colors, seedOffset) {
  const color = poseSideColor(point.side, colors);
  const radius = point.side === "core" ? 0.052 : 0.04;
  for (let i = 0; i < count; i += 1) {
    const angle = hash01((i + 1) * 10.19 + seedOffset * 4.7) * Math.PI * 2;
    const ring = Math.sqrt(hash01((i + 1) * 6.37 + seedOffset * 2.1)) * radius;
    const lift = (hash01((i + 1) * 3.51 + seedOffset * 12.1) - 0.5) * radius * 0.82;
    points.push({
      x: point.x + Math.cos(angle) * ring,
      y: point.y + Math.sin(angle) * ring,
      z: point.z + lift,
      r: color.r,
      g: color.g,
      b: color.b,
      a: 0.92,
      mix: color.mix,
      glow: 1.02 + hash01((i + 1) * 2.29 + seedOffset) * 0.32,
      jitter: 0.0012,
      kind: 2,
    });
  }
}

function appendBvhAuraPoints(points, nodes, colors, count) {
  const featured = nodes.filter((node) => /head|hand|foot|toe/i.test(node.id));
  const pool = featured.length ? featured : nodes;
  for (let i = 0; i < count; i += 1) {
    const base = pool[Math.floor(hash01(i * 4.73) * pool.length)] ?? pool[0];
    const color = poseSideColor(base.side, colors);
    const angle = hash01(i * 9.41 + 0.27) * Math.PI * 2;
    const radius = 0.075 + hash01(i * 7.17 + 0.4) * 0.2;
    points.push({
      x: base.x + Math.cos(angle) * radius,
      y: base.y + Math.sin(angle) * radius * 0.72,
      z: base.z + (hash01(i * 6.91 + 0.12) - 0.5) * 0.3,
      r: Math.min(1, color.r * 1.08 + 0.05),
      g: Math.min(1, color.g * 1.08 + 0.05),
      b: Math.min(1, color.b * 1.08 + 0.05),
      a: 0.46,
      mix: color.mix,
      glow: 0.7 + hash01(i * 2.51) * 0.42,
      jitter: 0.0025,
      kind: 3,
    });
  }
}

function bvhBoneSide(name) {
  const canonical = canonicalBoneName(name);
  if (canonical.startsWith("l")) return "left";
  if (canonical.startsWith("r")) return "right";
  return "core";
}

function isBvhKeyJoint(name) {
  const canonical = canonicalBoneName(name);
  return /hips|spine|chest|neck|head|shoulder|upperarm|lowerarm|hand|upperleg|lowerleg|foot|toe/.test(canonical);
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
