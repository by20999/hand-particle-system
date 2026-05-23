import "./styles.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { MP_HANDS_ASSET_BASE, renderPixelRatio, selectQualityProfile } from "./config.js";
import { average, calculateHandOpenness, fistViewPose, lerpAngle, normalizeAngle, palmCenter } from "./gestures.js";
import { applyStaticLightColors, createStaticLightSources, updateStaticLights } from "./lighting.js";
import { createParticleSystem, setParticleTargets, snapParticlesToTargets, updateParticles } from "./particles.js";
import { applyThemeToDocument, getTheme } from "./themes.js";
import { createUI } from "./ui.js";

const ui = createUI();
const {
  canvas,
  video,
  shapeSelect,
  colorPicker,
  fullscreenBtn,
  sensitivity,
  themeButtons,
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
camera.position.set(0, 1.2, 9.5);

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

const state = {
  model: "heart",
  theme: initialTheme,
  color: new THREE.Color(initialTheme.primary),
  accent: new THREE.Color(initialTheme.accent),
  sensitivity: ui.getSensitivity(),
  gesture: 0,
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
};

const performanceStats = {
  frames: 0,
  lastUpdate: performance.now(),
};

setParticleTargets(particles, state.model);
snapParticlesToTargets(particles);
initCameraTracking();
animate();

shapeSelect.addEventListener("change", () => {
  state.model = shapeSelect.value;
  state.modelTransition = {
    startedAt: performance.now(),
    duration: 1250,
  };
  setParticleTargets(particles, state.model);
});

colorPicker.addEventListener("input", () => {
  state.color.set(colorPicker.value);
  particles.material.uniforms.uColor.value.copy(state.color);
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
  particles.material.uniforms.uTime.value = elapsed;
  detectHands(now);
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
  particles.system.rotation.y += delta * (0.018 + state.smoothGesture * 0.035);
  particles.system.rotation.x = Math.sin(elapsed * 0.22) * 0.08;

  composer.render();
}

function detectHands(now) {
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

function easeGestureToFallback(now) {
  const pointerIsActive = state.pointerDown || now < state.pointerActiveUntil;
  const pointerForce = state.pointerDown
    ? THREE.MathUtils.clamp(0.48 + (1 - state.pointer.length() * 0.35) * 0.26, 0.34, 0.72)
    : pointerIsActive
      ? THREE.MathUtils.clamp(0.18 + (1 - state.pointer.length() * 0.35) * 0.24, 0.12, 0.42)
      : 0.02;
  state.gestureTarget = pointerForce;
  state.gesture = THREE.MathUtils.lerp(state.gesture, pointerForce, pointerIsActive ? 0.16 : 0.22);
  state.fistViewActive = false;
  controls.enabled = true;
}

function updateDiagnostics(handCount, now) {
  if (now - state.lastStatusDetailTime < 250) return;
  state.lastStatusDetailTime = now;

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
  particles.material.uniforms.uColor.value.copy(state.color);
  particles.material.uniforms.uAccent.value.copy(state.accent);
  scene.fog.color.set(theme.background);
  applyStaticLightColors(staticLights, state.color, state.accent);
  applyThemeToDocument(theme);
  ui.setThemeActive(theme.id);
  ui.saveThemeId(theme.id);
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
