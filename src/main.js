import "./styles.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { createAudioReactor, stopAudioSource, updateAudioReactor, useAudioFile, useMicrophone } from "./audio.js";
import { applyBackgroundTheme, createBackgroundSystem, setBackgroundMode, updateBackground } from "./backgrounds.js";
import { MP_HANDS_ASSET_BASE, renderPixelRatio, selectQualityProfile } from "./config.js";
import { average, calculateHandOpenness, fistViewPose, lerpAngle, normalizeAngle, palmCenter } from "./gestures.js";
import { applyStaticLightColors, createStaticLightSources, updateStaticLights } from "./lighting.js";
import {
  createParticleSystem,
  setCustomText,
  setParticleTargets,
  setTextFont,
  snapParticlesToTargets,
  updateParticles,
} from "./particles.js";
import { applyThemeToDocument, getTheme } from "./themes.js";
import { createUI } from "./ui.js";

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
  gestureToggleBtn,
  freezeToggleBtn,
  colorPicker,
  fullscreenBtn,
  sensitivity,
  themeButtons,
  backgroundButtons,
  micToggleBtn,
  audioFileInput,
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
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.82, 0.55, 0.18);
const composer = new EffectComposer(renderer);
composer.addPass(renderPass);
composer.addPass(bloomPass);

const particles = createParticleSystem({
  count: qualityProfile.particleCount,
  color: initialTheme.primary,
  accent: initialTheme.accent,
  pixelRatio,
});
scene.add(particles.system);

const staticLights = createStaticLightSources(new THREE.Color(initialTheme.primary), new THREE.Color(initialTheme.accent));
scene.add(staticLights);

const motionTrail = createMotionTrail(initialTheme);
scene.add(motionTrail.group);

const backgroundSystem = createBackgroundSystem(initialTheme);
scene.add(backgroundSystem.group);
setBackgroundMode(backgroundSystem, ui.getBackgroundMode(), initialTheme);
ui.setBackgroundActive(backgroundSystem.mode);

const audioReactor = createAudioReactor();

const state = {
  model: "heart",
  theme: initialTheme,
  color: new THREE.Color(initialTheme.primary),
  accent: new THREE.Color(initialTheme.accent),
  sensitivity: ui.getSensitivity(),
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
  lastErrorMessage: "",
  processingVideo: false,
  modelTransition: null,
  customText: ui.getCustomText(),
  textFont: ui.getTextFontId(),
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
  state.frozen = !state.frozen;
  ui.setFreezeActive(state.frozen);
  if (state.frozen) {
    ui.setStatus("画面已静止，可观察细节或截图", "idle");
  }
});

for (const button of backgroundButtons) {
  button.addEventListener("click", () => {
    setBackgroundMode(backgroundSystem, button.dataset.background, state.theme);
    ui.setBackgroundActive(backgroundSystem.mode);
    ui.saveBackgroundMode(backgroundSystem.mode);
  });
}

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
    const { Hands } = await import("@mediapipe/hands");

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
    console.error(error);
    state.lastErrorMessage = error?.message ?? "unknown error";
    ui.setStatus("摄像头或手势模型不可用，可用鼠标预览粒子", "error");
    ui.setDiagnostic(`错误：${state.lastErrorMessage}`);
  }
}

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.033);
  const elapsed = clock.elapsedTime;
  const now = performance.now();
  updatePerformanceStats(now);
  if (state.frozen) {
    controls.update();
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
    bloomPass,
    onGestureUpdate: ui.updateGestureMeter,
  });

  controls.update();
  applyFistCameraControl(delta);
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
  updateFistViewControl(hands[0], hands.length);
  updateDiagnostics(hands.length, now);
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
    ui.setDiagnostic(
      `识别到 ${handCount} 只手，${state.handMode}，目标 ${Math.round(
        state.gestureTarget * 100,
      )}%，当前 ${Math.round(state.gesture * 100)}%${viewText}，已分析 ${state.resultFrames} 帧`,
    );
    return;
  }

  const secondsSinceHand =
    state.lastDetectedHandTime > 0 ? Math.round((now - state.lastDetectedHandTime) / 1000) : null;
  const lastSeen = secondsSinceHand === null ? "尚未识别到手" : `${secondsSinceHand} 秒前识别过手`;
  ui.setDiagnostic(`${lastSeen}，请让完整手掌出现在下方预览框中`);
}

function applyTheme(theme) {
  state.theme = theme;
  state.color.set(theme.primary);
  state.accent.set(theme.accent);
  colorPicker.value = theme.primary;
  syncParticlePalette();
  scene.fog.color.set(theme.background);
  applyStaticLightColors(staticLights, state.color, state.accent);
  motionTrail.material.color.set(theme.rim ?? theme.accent);
  motionTrail.sparkMaterial.uniforms.uColor.value.set(theme.primary ?? theme.accent);
  applyBackgroundTheme(backgroundSystem, theme);
  applyThemeToDocument(theme);
  ui.setThemeActive(theme.id);
  ui.saveThemeId(theme.id);
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
    const travelX = side * (3.05 + impact * 1.85 + kick * 0.82 + onset * 0.72) * modelMotion;
    const travelY = (lane * 0.82 + Math.sin(angle * 1.43) * 0.64 + kick * 0.48 - 0.08) * modelMotion;
    const travelZ = Math.sin(angle) * (0.78 + impact * 0.82 + treble * 0.24) * modelMotion;
    state.audioRig.anchorX = THREE.MathUtils.clamp(travelX, -4.85, 4.85);
    state.audioRig.anchorY = THREE.MathUtils.clamp(travelY, -1.85, 1.95);
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
    state.audioRig.impactX;
  const targetY =
    state.audioRig.anchorY +
    orbitY +
    kick * 0.28 * modelMotion +
    state.audioRig.impactY;
  const targetZ =
    state.audioRig.anchorZ +
    orbitZ +
    state.audioRig.impactZ;
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
  const maxPoints = 38;
  const particleLayers = 9;
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
    color: theme.rim ?? theme.accent,
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
      uSize: { value: 44 },
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
        float taper = pow(1.0 - clamp(aAge, 0.0, 1.0), 1.35);
        float sparkle = 0.7 + aSeed * 0.55;
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
        float alpha = smoothstep(0.5, 0.0, d) * pow(1.0 - vAge, 1.45);
        float core = smoothstep(0.18, 0.0, d);
        vec3 color = uColor * (0.74 + vSeed * 0.36) + core * 0.58;
        gl_FragColor = vec4(color, alpha * uOpacity);
      }
    `,
  });
  const line = new THREE.Line(geometry, material);
  const sparks = new THREE.Points(particleGeometry, sparkMaterial);
  const group = new THREE.Group();
  group.add(line, sparks);
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
    sparkMaterial,
    group,
  };
}

function updateMotionTrail(elapsed, audio) {
  const active = audio?.enabled && (audio.level > 0.02 || audio.beat > 0.05 || audio.onset > 0.05);
  if (active && elapsed - state.motionTrail.lastSampleAt > 0.035) {
    state.motionTrail.points.unshift(particles.system.position.clone());
    state.motionTrail.points.length = Math.min(state.motionTrail.points.length, motionTrail.maxPoints);
    state.motionTrail.lastSampleAt = elapsed;
  }

  const points = state.motionTrail.points;
  for (let i = 0; i < motionTrail.maxPoints; i += 1) {
    const source = points[i] ?? points[points.length - 1] ?? particles.system.position;
    const i3 = i * 3;
    motionTrail.linePositions[i3] = source.x;
    motionTrail.linePositions[i3 + 1] = source.y;
    motionTrail.linePositions[i3 + 2] = source.z;

    const age = motionTrail.maxPoints <= 1 ? 1 : i / (motionTrail.maxPoints - 1);
    const radius = (1 - age) ** 1.2 * (0.34 + Math.min(audio.beat ?? 0, 1) * 0.12);
    for (let layer = 0; layer < motionTrail.particleLayers; layer += 1) {
      const particleIndex = i * motionTrail.particleLayers + layer;
      const p3 = particleIndex * 3;
      const seed = motionTrail.particleSeeds?.[particleIndex] ?? 0;
      const angle = seed * Math.PI * 2 + layer * 2.399;
      const spread = radius * (0.22 + (layer / motionTrail.particleLayers) ** 0.72);
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
  const targetOpacity = active && points.length > 2 ? 0.2 + Math.min(audio.beat ?? 0, 1) * 0.28 : 0;
  motionTrail.material.opacity = THREE.MathUtils.lerp(motionTrail.material.opacity, targetOpacity, active ? 0.18 : 0.08);
  motionTrail.sparkMaterial.uniforms.uOpacity.value = THREE.MathUtils.lerp(
    motionTrail.sparkMaterial.uniforms.uOpacity.value,
    active && points.length > 2 ? 0.18 + Math.min(audio.onset ?? 0, 1) * 0.38 : 0,
    active ? 0.22 : 0.08,
  );
  motionTrail.sparkMaterial.uniforms.uSize.value = 46 + Math.min(audio.beat ?? 0, 1) * 20;
}

function updatePerformanceStats(now) {
  performanceStats.frames += 1;
  if (now - performanceStats.lastUpdate < 600) return;

  const elapsed = now - performanceStats.lastUpdate;
  if (performanceStats.frames < 6) {
    ui.updatePerformance({
      fpsLabel: "测量中",
      particleCount: particles.count,
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
    particleCount: particles.count,
  });
}

function hexToGlow(hex, alpha) {
  const color = new THREE.Color(hex);
  return `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${alpha})`;
}
