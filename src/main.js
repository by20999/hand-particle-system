import "./styles.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { Hands } from "@mediapipe/hands";

const PARTICLE_COUNT = 68000;
const MODEL_SCALE = 2.25;
const START_SCALE = MODEL_SCALE * 0.86;
const MP_HANDS_ASSET_BASE = `${import.meta.env.BASE_URL}mediapipe/hands/`;
const clock = new THREE.Clock();

const canvas = document.querySelector("#scene");
const video = document.querySelector("#camera");
const shapeSelect = document.querySelector("#shapeSelect");
const colorPicker = document.querySelector("#colorPicker");
const fullscreenBtn = document.querySelector("#fullscreenBtn");
const statusText = document.querySelector("#statusText");
const diagnosticText = document.querySelector("#diagnosticText");
const cameraStatus = document.querySelector("#cameraStatus");
const gestureMeter = document.querySelector("#gestureMeter");
const gestureValue = document.querySelector("#gestureValue");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x06080d, 0.055);

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
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.82,
  0.55,
  0.18,
);
const composer = new EffectComposer(renderer);
composer.addPass(renderPass);
composer.addPass(bloomPass);

const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(PARTICLE_COUNT * 3);
const targets = new Float32Array(PARTICLE_COUNT * 3);
const velocities = new Float32Array(PARTICLE_COUNT * 3);
const randomness = new Float32Array(PARTICLE_COUNT);
const colorMixes = new Float32Array(PARTICLE_COUNT);
const brightnesses = new Float32Array(PARTICLE_COUNT);

for (let i = 0; i < PARTICLE_COUNT; i += 1) {
  const i3 = i * 3;
  positions[i3] = (Math.random() - 0.5) * 8;
  positions[i3 + 1] = (Math.random() - 0.5) * 8;
  positions[i3 + 2] = (Math.random() - 0.5) * 8;
  randomness[i] = Math.random();
  colorMixes[i] = Math.random();
  brightnesses[i] = 1;
}

geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
geometry.setAttribute("aRandom", new THREE.BufferAttribute(randomness, 1));
geometry.setAttribute("aColorMix", new THREE.BufferAttribute(colorMixes, 1));
geometry.setAttribute("aBrightness", new THREE.BufferAttribute(brightnesses, 1));

const material = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(colorPicker.value) },
    uAccent: { value: new THREE.Color("#52d7de") },
    uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    uPointSize: { value: 30 },
  },
  vertexShader: `
    attribute float aRandom;
    attribute float aColorMix;
    attribute float aBrightness;
    varying float vRandom;
    varying float vColorMix;
    varying float vBrightness;
    uniform float uTime;
    uniform float uPixelRatio;
    uniform float uPointSize;

    void main() {
      vRandom = aRandom;
      vColorMix = aColorMix;
      vBrightness = aBrightness;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      float pulse = 0.78 + 0.22 * sin(uTime * 2.0 + aRandom * 8.0);
      gl_PointSize = uPointSize * pulse * (0.9 + vBrightness * 0.08) * uPixelRatio / max(0.45, -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    varying float vRandom;
    varying float vColorMix;
    varying float vBrightness;
    uniform vec3 uColor;
    uniform vec3 uAccent;

    void main() {
      vec2 uv = gl_PointCoord - vec2(0.5);
      float d = length(uv);
      float alpha = smoothstep(0.5, 0.0, d);
      float core = smoothstep(0.18, 0.0, d);
      vec3 color = mix(uColor, uAccent, vColorMix * 0.55);
      color += core * 0.85;
      color *= vBrightness;
      gl_FragColor = vec4(color, alpha * (0.72 + vRandom * 0.38) * clamp(vBrightness, 0.25, 1.65));
    }
  `,
});

const particleSystem = new THREE.Points(geometry, material);
scene.add(particleSystem);

const staticLights = createStaticLightSources();
scene.add(staticLights);

const state = {
  model: "heart",
  color: new THREE.Color(colorPicker.value),
  gesture: 0,
  gestureTarget: 0,
  gestureLow: 1,
  gestureHigh: 0,
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
};

setTargets(state.model);
snapParticlesToTargets();
initCameraTracking();
animate();

shapeSelect.addEventListener("change", () => {
  state.model = shapeSelect.value;
  setTargets(state.model);
});

colorPicker.addEventListener("input", () => {
  state.color.set(colorPicker.value);
  material.uniforms.uColor.value.copy(state.color);
  updateStaticLightColors(state.color);
});

fullscreenBtn.addEventListener("click", async () => {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen();
  } else {
    await document.exitFullscreen();
  }
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
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  material.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
});

async function initCameraTracking() {
  try {
    setStatus("正在加载手势模型", "idle");

    state.hands = new Hands({
      locateFile: (file) => `${MP_HANDS_ASSET_BASE}${file}`,
    });
    state.hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
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
    setDiagnostic("模型已加载，正在请求摄像头");

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera API is not available in this browser context.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 960 },
        height: { ideal: 540 },
        facingMode: "user",
      },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    state.cameraReady = true;
    processVideoFrame();
    setStatus("摄像头已开启，等待双手入镜", "ready");
  } catch (error) {
    console.error(error);
    state.lastErrorMessage = error?.message ?? "unknown error";
    setStatus("摄像头或手势模型不可用，可用鼠标预览粒子", "error");
    setDiagnostic(`错误：${state.lastErrorMessage}`);
  }
}

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.033);
  const elapsed = clock.elapsedTime;
  material.uniforms.uTime.value = elapsed;
  detectHands();
  updateParticles(delta, elapsed);

  controls.update();
  applyFistCameraControl(delta);
  updateStaticLights(elapsed);
  particleSystem.rotation.y += delta * (0.018 + state.smoothGesture * 0.035);
  particleSystem.rotation.x = Math.sin(elapsed * 0.22) * 0.08;

  composer.render();
}

function detectHands() {
  if (!state.hands || video.readyState < 2) {
    easeGestureToFallback();
    updateDiagnostics(0);
    return;
  }

  const hands =
    performance.now() - state.lastHandResultTime < 1200 ? state.detectedHands : [];

  if (hands.length === 0) {
    easeGestureToFallback();
    state.handMode = "idle";
    state.fistViewActive = false;
    controls.enabled = true;
    setStatus("等待手掌入镜", "ready");
    updateDiagnostics(0);
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
    setStatus("双手已追踪，实时响应中", "ready");
  } else {
    setStatus("单手追踪中，双手可控制整体扩散", "ready");
  }

  state.openness = openness;
  state.handSpread = spread;
  const rawGesture =
    hands.length >= 2 ? spread * 0.48 + openness * 0.52 : openness;
  const responsiveGesture = THREE.MathUtils.clamp((rawGesture - 0.22) / 0.58, 0, 1);
  state.gestureTarget = THREE.MathUtils.clamp(Math.pow(responsiveGesture, 1.22), 0, 1);
  state.handMode =
    state.gestureTarget > 0.62 ? "展开" : state.gestureTarget < 0.26 ? "收拢" : "半开";
  const follow = state.gestureTarget > state.gesture ? 0.12 : 0.28;
  state.gesture = THREE.MathUtils.lerp(state.gesture, state.gestureTarget, follow);
  updateFistViewControl(hands[0], hands.length);
  updateDiagnostics(hands.length);
}

async function processVideoFrame() {
  if (!state.hands) return;
  if (state.processingVideo) {
    requestAnimationFrame(processVideoFrame);
    return;
  }

  const now = performance.now();
  if (now - state.lastVideoSendTime < 28) {
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
    setStatus("手势识别暂停，可用鼠标预览粒子", "error");
    setDiagnostic(`识别循环错误：${state.lastErrorMessage}`);
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

function fistViewPose(hand) {
  const center = palmCenter(hand);
  return {
    centerY: center.y,
    roll: Math.atan2(hand[17].y - hand[5].y, hand[17].x - hand[5].x),
  };
}

function easeGestureToFallback() {
  const pointerIsActive = state.pointerDown || performance.now() < state.pointerActiveUntil;
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

function updateParticles(delta, elapsed) {
  const gestureSpeed = state.gesture > state.smoothGesture ? 0.52 : 0.42;
  state.smoothGesture = THREE.MathUtils.lerp(state.smoothGesture, state.gesture, gestureSpeed);
  state.pointerBoost = THREE.MathUtils.lerp(state.pointerBoost, state.pointerDown ? 1 : 0, 0.16);
  const g = state.smoothGesture;
  const handActive = performance.now() - state.lastHandResultTime < 1200 && state.detectedHands.length > 0;
  const recovering = !state.pointerDown && performance.now() < state.recoverUntil;
  const shapeGesture = handActive ? g : Math.min(g, 0.34 + state.pointerBoost * 0.18);
  const modelScale = MODEL_SCALE * (0.48 + shapeGesture * 2.85);
  const diffusion = recovering
    ? 0.04 + shapeGesture * 0.28
    : 0.05 + shapeGesture * 4.25 + state.pointerBoost * 0.38;
  const radialExpansion = shapeGesture * 3.6;
  const depthExpansion = shapeGesture * 5.2;
  const returnStrength = recovering ? 10.5 : 4.8 + (1 - shapeGesture) * 8.2;
  const swirlStrength = recovering ? 0 : 0.04 + shapeGesture * 0.72 + state.pointerBoost * 0.32;
  const pointerActive =
    (state.pointerDown || performance.now() < state.pointerActiveUntil) && state.pointer.x < 10;
  const pointerPower = state.pointerDown ? 1 : 0.52;

  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const i3 = i * 3;
    const rx = seededWave(i, elapsed, 0.71);
    const ry = seededWave(i, elapsed, 1.13);
    const rz = seededWave(i, elapsed, 1.67);
    const baseX = targets[i3];
    const baseY = targets[i3 + 1];
    const baseZ = targets[i3 + 2];
    const baseRadius = Math.hypot(baseX, baseY, baseZ) + 0.001;
    const radialPulse = radialExpansion * (0.28 + randomness[i] * 1.25);
    const depthSign = Math.sin(i * 19.191 + randomness[i] * 8.0);
    const depthPulse = depthExpansion * depthSign * (0.18 + randomness[i] * 0.82);
    const tx = baseX * modelScale + (baseX / baseRadius) * radialPulse + rx * diffusion;
    const ty = baseY * modelScale + (baseY / baseRadius) * radialPulse + ry * diffusion;
    const tz =
      baseZ * modelScale * (1.0 + shapeGesture * 2.2) +
      (baseZ / baseRadius) * radialPulse +
      depthPulse +
      rz * diffusion * 1.35;

    let px = positions[i3];
    let py = positions[i3 + 1];
    let pz = positions[i3 + 2];

    if (recovering) {
      const settle = 0.24;
      positions[i3] = THREE.MathUtils.lerp(px, tx, settle);
      positions[i3 + 1] = THREE.MathUtils.lerp(py, ty, settle);
      positions[i3 + 2] = THREE.MathUtils.lerp(pz, tz, settle);
      velocities[i3] *= 0.12;
      velocities[i3 + 1] *= 0.12;
      velocities[i3 + 2] *= 0.12;
      continue;
    }

    velocities[i3] += (tx - px) * returnStrength * delta;
    velocities[i3 + 1] += (ty - py) * returnStrength * delta;
    velocities[i3 + 2] += (tz - pz) * returnStrength * delta;

    const radial = Math.hypot(px, pz) + 0.001;
    velocities[i3] += (-pz / radial) * swirlStrength * delta * (0.4 + randomness[i]);
    velocities[i3 + 2] += (px / radial) * swirlStrength * delta * (0.4 + randomness[i]);

    if (pointerActive) {
      const mx = state.pointer.x * 4.2;
      const my = state.pointer.y * 2.55;
      const dx = px - mx;
      const dy = py - my;
      const d = Math.hypot(dx, dy) + 0.001;
      const radius = state.pointerDown ? 2.8 : 1.65;

      if (d < radius) {
        const falloff = (1 - d / radius) ** 2;
        const repel = (state.pointerDown ? 0.092 : 0.038) * pointerPower * falloff;
        const swirl = (state.pointerDown ? 0.058 : 0.024) * pointerPower * falloff;
        velocities[i3] += (dx / d) * repel + (-dy / d) * swirl;
        velocities[i3 + 1] += (dy / d) * repel + (dx / d) * swirl;
        velocities[i3 + 2] += Math.sin(elapsed * 4 + i * 0.13) * repel * 0.36;
      }
    }

    const damping = recovering ? 0.58 : pointerActive ? 0.9 : THREE.MathUtils.lerp(0.72, 0.86, shapeGesture);
    velocities[i3] *= damping;
    velocities[i3 + 1] *= damping;
    velocities[i3 + 2] *= damping;

    px += velocities[i3];
    py += velocities[i3 + 1];
    pz += velocities[i3 + 2];

    const radius = Math.hypot(px, py, pz);
    if (radius > 13.5) {
      const pull = 13.5 / radius;
      px *= pull;
      py *= pull;
      pz *= pull;
      velocities[i3] *= 0.45;
      velocities[i3 + 1] *= 0.45;
      velocities[i3 + 2] *= 0.45;
    }

    positions[i3] = px;
    positions[i3 + 1] = py;
    positions[i3 + 2] = pz;
  }

  geometry.attributes.position.needsUpdate = true;
  bloomPass.strength = 0.48 + shapeGesture * 0.28;
  material.uniforms.uPointSize.value = 18 + shapeGesture * 5;
  gestureMeter.style.width = `${Math.round(g * 100)}%`;
  gestureValue.textContent = `${Math.round(g * 100)}%`;
}

function setTargets(model) {
  const generators = {
    heart: heartPoint,
    flower: flowerPoint,
    saturn: saturnPoint,
    buddha: buddhaPoint,
    fireworks: fireworksPoint,
  };
  const generator = generators[model] ?? heartPoint;

  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const p = generator(i / PARTICLE_COUNT, randomness[i], i);
    const i3 = i * 3;
    targets[i3] = p.x;
    targets[i3 + 1] = p.y;
    targets[i3 + 2] = p.z;
    colorMixes[i] = p.mix ?? Math.random();
    brightnesses[i] = p.glow ?? 1;
  }

  geometry.attributes.aColorMix.needsUpdate = true;
  geometry.attributes.aBrightness.needsUpdate = true;
}

function snapParticlesToTargets() {
  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const i3 = i * 3;
    positions[i3] = targets[i3] * START_SCALE + (Math.random() - 0.5) * 0.14;
    positions[i3 + 1] = targets[i3 + 1] * START_SCALE + (Math.random() - 0.5) * 0.14;
    positions[i3 + 2] = targets[i3 + 2] * START_SCALE + (Math.random() - 0.5) * 0.14;
    velocities[i3] = 0;
    velocities[i3 + 1] = 0;
    velocities[i3 + 2] = 0;
  }
  geometry.attributes.position.needsUpdate = true;
}

function heartPoint(t, r, i) {
  const layer = hash(i * 0.93);
  if (layer < 0.16) {
    return heartRimPoint(t, i);
  }
  if (layer < 0.28) {
    return heartAuraPoint(t, i);
  }

  let x = 0;
  let y = 0;

  for (let attempt = 0; attempt < 54; attempt += 1) {
    const candidateX = -1.3 + hash(i * 11.41 + attempt * 2.91) * 2.6;
    const candidateY = -1.08 + hash(i * 31.73 + attempt * 4.27) * 2.32;
    if (heart2DField(candidateX, candidateY) <= 0) {
      x = candidateX;
      y = candidateY;
      break;
    }
  }

  if (x === 0 && y === 0) {
    const p = heartCurvePoint(Math.PI * 2 * t);
    x = p.x * Math.sqrt(r);
    y = p.y * Math.sqrt(r);
  }

  const centerWeight = 1 - THREE.MathUtils.clamp(Math.hypot(x * 0.68, (y + 0.05) * 0.78), 0, 1);
  const topWeight = THREE.MathUtils.clamp(y + 0.18, 0, 1);
  const depth = 0.46 + centerWeight * 0.58 + topWeight * 0.12;
  const z = (hash(i * 17.37) - 0.5) * depth;

  return {
    x: x * 1.13,
    y: y * 1.16 - 0.08,
    z,
    mix: 0.18 + hash(i * 5.91) * 0.14,
    glow: 0.88 + centerWeight * 0.22,
  };
}

function heartRimPoint(t, i) {
  const angle = t * Math.PI * 2;
  const p = heartCurvePoint(angle);
  const topWeight = THREE.MathUtils.clamp(p.y + 0.18, 0, 1);
  const edge = 0.995 + (hash(i * 6.71) - 0.5) * 0.035;
  const z = (hash(i * 19.37) - 0.5) * (0.34 + topWeight * 0.1);

  return {
    x: p.x * edge * 1.14,
    y: p.y * edge * 1.16 - 0.08,
    z,
    mix: 0.12 + hash(i * 5.91) * 0.08,
    glow: 1.65,
  };
}

function heartAuraPoint(t, i) {
  const angle = t * Math.PI * 2;
  const p = heartCurvePoint(angle);
  const drift = 1.04 + hash(i * 4.19) * 0.13;
  const topWeight = THREE.MathUtils.clamp(p.y + 0.18, 0, 1);
  const z = (hash(i * 23.37) - 0.5) * (0.6 + topWeight * 0.18);

  return {
    x: p.x * drift * 1.14 + (hash(i * 31.41) - 0.5) * 0.08,
    y: p.y * drift * 1.16 - 0.08 + (hash(i * 41.73) - 0.5) * 0.08,
    z,
    mix: 0.16 + hash(i * 5.91) * 0.1,
    glow: 0.46,
  };
}

function heartCurvePoint(angle) {
  return {
    x: (16 * Math.sin(angle) ** 3) / 18,
    y:
    (13 * Math.cos(angle) -
      5 * Math.cos(2 * angle) -
      2 * Math.cos(3 * angle) -
      Math.cos(4 * angle)) /
      18,
  };
}

function heart2DField(x, y) {
  const a = x * x + y * y - 1;
  return a * a * a - x * x * y * y * y;
}

function flowerPoint(t, r) {
  const layer = Math.floor(t * 7);
  const local = (t * 7) % 1;
  const angle = local * Math.PI * 2 + layer * 0.42;
  const petalRadius = 0.34 + 0.72 * Math.sin(local * Math.PI) ** 0.7;
  const ring = layer === 0 ? r * 0.28 : petalRadius * Math.sqrt(r);
  const centerOffset = layer === 0 ? 0 : 0.72;
  return {
    x: Math.cos(angle) * (ring + centerOffset),
    y: Math.sin(angle) * (ring + centerOffset) * 0.82,
    z: Math.sin(angle * 3 + r * 4) * 0.16,
    mix: layer / 7,
  };
}

function saturnPoint(t, r) {
  if (t < 0.58) {
    const p = spherePoint(r, t / 0.58);
    return { x: p.x * 0.82, y: p.y * 0.82, z: p.z * 0.82, mix: 0.15 + r * 0.25 };
  }
  const angle = ((t - 0.58) / 0.42) * Math.PI * 2;
  const radius = 1.08 + r * 0.62;
  const tiltY = Math.sin(angle) * radius * 0.22;
  return {
    x: Math.cos(angle) * radius,
    y: tiltY,
    z: Math.sin(angle) * radius * 0.58 + (Math.random() - 0.5) * 0.05,
    mix: 0.72 + r * 0.28,
  };
}

function buddhaPoint(t, r) {
  if (t < 0.16) {
    const p = spherePoint(r, t / 0.16);
    return { x: p.x * 0.34, y: p.y * 0.34 + 0.72, z: p.z * 0.26, mix: 0.35 };
  }
  if (t < 0.42) {
    const p = spherePoint(r, (t - 0.16) / 0.26);
    return { x: p.x * 0.72, y: p.y * 0.62 - 0.03, z: p.z * 0.32, mix: 0.52 };
  }
  if (t < 0.72) {
    const side = t < 0.57 ? -1 : 1;
    const local = ((t - 0.42) / 0.3) * Math.PI;
    return {
      x: side * (0.25 + Math.sin(local) * 0.98 * Math.sqrt(r)),
      y: -0.58 + Math.cos(local) * 0.24 * r,
      z: (Math.random() - 0.5) * 0.22,
      mix: 0.7,
    };
  }
  if (t < 0.9) {
    const angle = ((t - 0.72) / 0.18) * Math.PI * 2;
    const radius = 0.62 + r * 0.18;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius + 0.54,
      z: -0.18,
      mix: 0.94,
    };
  }
  const angle = ((t - 0.9) / 0.1) * Math.PI * 2;
  const radius = 0.45 + r * 0.74;
  return {
    x: Math.cos(angle) * radius,
    y: -0.92 + Math.sin(angle) * radius * 0.22,
    z: (Math.random() - 0.5) * 0.18,
    mix: 0.82,
  };
}

function fireworksPoint(t, r, i) {
  const burst = Math.floor(t * 12);
  const local = (t * 12) % 1;
  const phi = Math.acos(2 * hash(i * 9.17) - 1);
  const theta = Math.PI * 2 * hash(i * 3.31 + burst);
  const radius = 0.18 + Math.sqrt(local) * (0.5 + hash(burst * 2.7) * 0.95);
  const centerAngle = (burst / 12) * Math.PI * 2;
  const cx = Math.cos(centerAngle) * 0.9;
  const cy = Math.sin(centerAngle * 1.7) * 0.48;
  const cz = Math.sin(centerAngle) * 0.4;
  return {
    x: cx + radius * Math.sin(phi) * Math.cos(theta),
    y: cy + radius * Math.cos(phi),
    z: cz + radius * Math.sin(phi) * Math.sin(theta),
    mix: r,
  };
}

function spherePoint(r, t) {
  const phi = Math.acos(1 - 2 * r);
  const theta = Math.PI * 2 * t;
  const radius = Math.cbrt(Math.random());
  return {
    x: radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta),
  };
}

function createStarField() {
  const starGeometry = new THREE.BufferGeometry();
  const count = 2600;
  const starPositions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    const radius = 18 + Math.random() * 22;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    starPositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
    starPositions[i3 + 1] = radius * Math.cos(phi);
    starPositions[i3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  return new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      color: 0x9fb8ff,
      size: 0.018,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    }),
  );
}

function createDecorativeDust() {
  const group = new THREE.Group();

  const haloCount = 5200;
  const haloGeometry = new THREE.BufferGeometry();
  const haloPositions = new Float32Array(haloCount * 3);
  const haloColors = new Float32Array(haloCount * 3);
  const colorA = new THREE.Color("#2fd4d9");
  const colorB = new THREE.Color("#ff4f8f");

  for (let i = 0; i < haloCount; i += 1) {
    const i3 = i * 3;
    const angle = Math.random() * Math.PI * 2;
    const radius = 5.8 + Math.random() * 4.8;
    const band = (Math.random() - 0.5) * 1.4;
    haloPositions[i3] = Math.cos(angle) * radius;
    haloPositions[i3 + 1] = band + Math.sin(angle * 2.0) * 0.35;
    haloPositions[i3 + 2] = Math.sin(angle) * radius * 0.62 - 2.2;

    const mixed = colorA.clone().lerp(colorB, Math.random() * 0.75);
    haloColors[i3] = mixed.r;
    haloColors[i3 + 1] = mixed.g;
    haloColors[i3 + 2] = mixed.b;
  }

  haloGeometry.setAttribute("position", new THREE.BufferAttribute(haloPositions, 3));
  haloGeometry.setAttribute("color", new THREE.BufferAttribute(haloColors, 3));
  group.add(
    new THREE.Points(
      haloGeometry,
      new THREE.PointsMaterial({
        size: 0.018,
        vertexColors: true,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
  );

  const veilCount = 3000;
  const veilGeometry = new THREE.BufferGeometry();
  const veilPositions = new Float32Array(veilCount * 3);
  for (let i = 0; i < veilCount; i += 1) {
    const i3 = i * 3;
    const y = (Math.random() - 0.5) * 7.5;
    const wave = Math.sin(y * 1.25 + Math.random() * 1.4);
    veilPositions[i3] = -5.8 + wave * 0.55 + (Math.random() - 0.5) * 0.8;
    veilPositions[i3 + 1] = y;
    veilPositions[i3 + 2] = -3.6 + (Math.random() - 0.5) * 1.2;
  }

  veilGeometry.setAttribute("position", new THREE.BufferAttribute(veilPositions, 3));
  group.add(
    new THREE.Points(
      veilGeometry,
      new THREE.PointsMaterial({
        color: 0x4ddde2,
        size: 0.014,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
  );

  return group;
}

function createLightRibbons() {
  const group = new THREE.Group();
  const colors = [0x52d7de, 0xff4f8f, 0xffd166, 0x8af0c9];

  for (let ribbon = 0; ribbon < 5; ribbon += 1) {
    const points = [];
    const turns = 1.15 + ribbon * 0.18;
    const width = 4.2 + ribbon * 0.72;
    const height = 1.05 + ribbon * 0.22;

    for (let i = 0; i <= 220; i += 1) {
      const t = i / 220;
      const angle = t * Math.PI * 2 * turns + ribbon * 0.76;
      const wobble = Math.sin(t * Math.PI * 6 + ribbon) * 0.18;
      points.push(
        new THREE.Vector3(
          Math.cos(angle) * (width + wobble),
          Math.sin(angle * 1.7) * height + (ribbon - 2) * 0.16,
          -3.4 + Math.sin(angle) * (1.18 + ribbon * 0.1),
        ),
      );
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: colors[ribbon % colors.length],
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const line = new THREE.Line(geometry, material);
    line.rotation.x = -0.18 + ribbon * 0.055;
    line.rotation.z = ribbon * 0.18;
    group.add(line);
  }

  return group;
}

function createStaticLightSources() {
  const group = new THREE.Group();
  group.userData.ambient = new THREE.AmbientLight(0xffffff, 0.12);
  group.add(group.userData.ambient);

  const lights = [
    { role: "main", position: [-0.2, 0.15, -4.2], intensity: 1.12, distance: 13, scale: 8.8, opacity: 0.34 },
    { role: "wash", position: [-2.8, 1.9, -5.4], intensity: 0.54, distance: 15, scale: 7.2, opacity: 0.22 },
    { role: "shade", position: [2.9, -1.7, -5.8], intensity: 0.38, distance: 14, scale: 6.8, opacity: 0.16 },
  ];

  const texture = createGlowTexture();
  group.userData.layers = [];
  for (const light of lights) {
    const point = new THREE.PointLight(0xffffff, light.intensity, light.distance, 2.4);
    point.position.set(...light.position);
    group.add(point);

    const material = new THREE.SpriteMaterial({
      map: texture,
      color: 0xffffff,
      transparent: true,
      opacity: light.opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(...light.position);
    sprite.scale.set(light.scale, light.scale, 1);
    group.add(sprite);
    group.userData.layers.push({ ...light, point, sprite, material });
  }

  applyStaticLightColors(group, new THREE.Color(colorPicker.value));
  return group;
}

function createGlowTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, "rgba(255,255,255,0.9)");
  gradient.addColorStop(0.18, "rgba(255,255,255,0.28)");
  gradient.addColorStop(0.62, "rgba(255,255,255,0.06)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function updateStaticLightColors(baseColor) {
  applyStaticLightColors(staticLights, baseColor);
}

function applyStaticLightColors(lightGroup, baseColor) {
  const hsl = {};
  baseColor.getHSL(hsl);
  const main = new THREE.Color().setHSL(hsl.h, Math.min(0.92, hsl.s * 0.82 + 0.12), 0.58);
  const wash = new THREE.Color().setHSL(
    hsl.h,
    Math.min(0.76, hsl.s * 0.5 + 0.08),
    Math.min(0.78, hsl.l + 0.22),
  );
  const shade = new THREE.Color().setHSL(
    (hsl.h + 0.965) % 1,
    Math.min(0.68, hsl.s * 0.42 + 0.06),
    Math.max(0.2, hsl.l * 0.42),
  );

  const colors = { main, wash, shade };
  for (const layer of lightGroup.userData.layers ?? []) {
    layer.point.color.copy(colors[layer.role]);
    layer.material.color.copy(colors[layer.role]);
  }
  lightGroup.userData.ambient?.color.copy(wash);
}

function updateStaticLights(elapsed) {
  const layers = staticLights.userData.layers ?? [];
  const pulse = 0.5 + 0.5 * Math.sin(elapsed * 0.34);
  state.lightPulse = pulse;

  for (let i = 0; i < layers.length; i += 1) {
    const layer = layers[i];
    const driftX = Math.sin(elapsed * (0.11 + i * 0.025) + i * 1.7) * 0.18;
    const driftY = Math.cos(elapsed * (0.09 + i * 0.02) + i * 1.2) * 0.14;
    layer.sprite.position.x = layer.position[0] + driftX;
    layer.sprite.position.y = layer.position[1] + driftY;
    layer.point.position.x = layer.sprite.position.x;
    layer.point.position.y = layer.sprite.position.y;

    const breathe = 0.92 + pulse * 0.12 + Math.sin(elapsed * 0.21 + i) * 0.025;
    layer.sprite.scale.set(layer.scale * breathe, layer.scale * breathe, 1);
    layer.material.opacity = layer.opacity * (0.88 + pulse * 0.14);
    layer.point.intensity = layer.intensity * (0.92 + pulse * 0.08);
  }
}

function calculateHandOpenness(hand) {
  const wrist = hand[0];
  const middleMcp = hand[9];
  const palm = Math.max(distance3(wrist, middleMcp), distance3(hand[5], hand[17]) * 0.92, 0.045);
  const center = palmCenter3(hand);
  const fingers = [
    { mcp: 5, pip: 6, tip: 8 },
    { mcp: 9, pip: 10, tip: 12 },
    { mcp: 13, pip: 14, tip: 16 },
    { mcp: 17, pip: 18, tip: 20 },
  ];

  const reach =
    fingers.reduce((sum, finger) => sum + distance3(hand[finger.tip], center) / palm, 0) /
    fingers.length;
  const reachScore = smoothClamp((reach - 1.02) / 0.92);

  const straightness =
    fingers.reduce((sum, finger) => {
      const angle = jointAngle(hand[finger.mcp], hand[finger.pip], hand[finger.tip]);
      return sum + smoothClamp((angle - 1.72) / 0.96);
    }, 0) / fingers.length;

  const fingertipSpread =
    (distance3(hand[8], hand[20]) + distance3(hand[4], hand[8]) * 0.72) / palm;
  const spreadScore = smoothClamp((fingertipSpread - 1.0) / 1.18);

  const wristReach =
    fingers.reduce((sum, finger) => sum + distance3(hand[finger.tip], wrist) / palm, 0) /
    fingers.length;
  const wristReachScore = smoothClamp((wristReach - 1.35) / 0.9);
  const thumbReach = smoothClamp((distance3(hand[4], center) / palm - 0.72) / 0.72);
  const raw =
    reachScore * 0.3 +
    straightness * 0.28 +
    spreadScore * 0.22 +
    wristReachScore * 0.14 +
    thumbReach * 0.06;

  return THREE.MathUtils.clamp(Math.pow(raw, 1.18), 0, 1);
}

function palmCenter(hand) {
  const ids = [0, 5, 9, 13, 17];
  const center = ids.reduce(
    (sum, id) => {
      sum.x += hand[id].x;
      sum.y += hand[id].y;
      return sum;
    },
    { x: 0, y: 0 },
  );
  center.x /= ids.length;
  center.y /= ids.length;
  return center;
}

function palmCenter3(hand) {
  const ids = [0, 5, 9, 13, 17];
  const center = ids.reduce(
    (sum, id) => {
      sum.x += hand[id].x;
      sum.y += hand[id].y;
      sum.z += hand[id].z ?? 0;
      return sum;
    },
    { x: 0, y: 0, z: 0 },
  );
  center.x /= ids.length;
  center.y /= ids.length;
  center.z /= ids.length;
  return center;
}

function distance3(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
}

function jointAngle(a, b, c) {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const abz = (a.z ?? 0) - (b.z ?? 0);
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const cbz = (c.z ?? 0) - (b.z ?? 0);
  const dot = abx * cbx + aby * cby + abz * cbz;
  const lenA = Math.hypot(abx, aby, abz);
  const lenC = Math.hypot(cbx, cby, cbz);
  return Math.acos(THREE.MathUtils.clamp(dot / Math.max(lenA * lenC, 0.000001), -1, 1));
}

function smoothClamp(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return x * x * (3 - 2 * x);
}

function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function lerpAngle(from, to, amount) {
  return from + normalizeAngle(to - from) * amount;
}

function seededWave(i, time, salt) {
  return Math.sin(time * salt + i * 12.9898 + randomness[i] * 6.283) * 0.5;
}

function hash(value) {
  return Math.abs(Math.sin(value * 43758.5453)) % 1;
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

function setStatus(text, status) {
  statusText.textContent = text;
  cameraStatus.className = `status-dot ${status}`;
}

function updateDiagnostics(handCount) {
  const now = performance.now();
  if (now - state.lastStatusDetailTime < 250) return;
  state.lastStatusDetailTime = now;

  if (!state.modelReady) {
    setDiagnostic("模型加载中");
    return;
  }

  if (!state.cameraReady || video.readyState < 2) {
    setDiagnostic("摄像头未就绪：请允许浏览器摄像头权限");
    return;
  }

  if (state.sentFrames > 0 && state.resultFrames === 0) {
    setDiagnostic("摄像头有画面，但模型还没有返回结果");
    return;
  }

  if (handCount > 0) {
    const viewText = state.fistViewActive ? "，拳头视角控制中" : "";
    setDiagnostic(
      `识别到 ${handCount} 只手，${state.handMode}，目标 ${Math.round(
        state.gestureTarget * 100,
      )}%，当前 ${Math.round(state.gesture * 100)}%${viewText}，已分析 ${state.resultFrames} 帧`,
    );
    return;
  }

  const secondsSinceHand =
    state.lastDetectedHandTime > 0 ? Math.round((now - state.lastDetectedHandTime) / 1000) : null;
  const lastSeen = secondsSinceHand === null ? "尚未识别到手" : `${secondsSinceHand} 秒前识别过手`;
  setDiagnostic(`${lastSeen}，请让完整手掌出现在下方预览框中`);
}

function setDiagnostic(text) {
  if (diagnosticText) {
    diagnosticText.textContent = text;
  }
}
