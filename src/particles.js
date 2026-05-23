import * as THREE from "three";
import { MODEL_SCALE, START_SCALE } from "./config.js";
import { writeShapeTargets } from "./shapes.js";

export function createParticleSystem({ count, color, accent = "#52d7de", pixelRatio }) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const targets = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const randomness = new Float32Array(count);
  const colorMixes = new Float32Array(count);
  const brightnesses = new Float32Array(count);
  const targetRadii = new Float32Array(count);
  const targetDirX = new Float32Array(count);
  const targetDirY = new Float32Array(count);
  const targetDirZ = new Float32Array(count);
  const wavePhase = new Float32Array(count);
  const wavePhaseY = new Float32Array(count);
  const wavePhaseZ = new Float32Array(count);
  const depthSigns = new Float32Array(count);
  const radialWeights = new Float32Array(count);
  const depthWeights = new Float32Array(count);
  const swirlWeights = new Float32Array(count);
  const pointerPhase = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    const random = Math.random();
    positions[i3] = (Math.random() - 0.5) * 8;
    positions[i3 + 1] = (Math.random() - 0.5) * 8;
    positions[i3 + 2] = (Math.random() - 0.5) * 8;
    randomness[i] = random;
    colorMixes[i] = Math.random();
    brightnesses[i] = 1;
    wavePhase[i] = i * 12.9898 + random * 6.283;
    wavePhaseY[i] = i * 17.121 + random * 4.881;
    wavePhaseZ[i] = i * 9.271 + random * 7.417;
    depthSigns[i] = Math.sin(i * 19.191 + random * 8.0);
    radialWeights[i] = 0.28 + random * 1.25;
    depthWeights[i] = 0.18 + random * 0.82;
    swirlWeights[i] = 0.4 + random;
    pointerPhase[i] = i * 0.13;
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
      uColor: { value: new THREE.Color(color) },
      uAccent: { value: new THREE.Color(accent) },
      uPixelRatio: { value: pixelRatio },
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

  const system = new THREE.Points(geometry, material);

  return {
    count,
    geometry,
    material,
    system,
    positions,
    targets,
    velocities,
    randomness,
    colorMixes,
    brightnesses,
    targetRadii,
    targetDirX,
    targetDirY,
    targetDirZ,
    wavePhase,
    wavePhaseY,
    wavePhaseZ,
    depthSigns,
    radialWeights,
    depthWeights,
    swirlWeights,
    pointerPhase,
  };
}

export function setParticleTargets(particles, model) {
  writeShapeTargets(model, particles);
  particles.geometry.attributes.aColorMix.needsUpdate = true;
  particles.geometry.attributes.aBrightness.needsUpdate = true;
}

export function snapParticlesToTargets(particles) {
  const { count, positions, targets, velocities, geometry } = particles;
  for (let i = 0; i < count; i += 1) {
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

export function updateParticles(particles, state, options) {
  const { delta, elapsed, now, bloomPass, onGestureUpdate } = options;
  const {
    count,
    geometry,
    material,
    positions,
    targets,
    velocities,
    randomness,
    targetDirX,
    targetDirY,
    targetDirZ,
    wavePhase,
    wavePhaseY,
    wavePhaseZ,
    depthSigns,
    radialWeights,
    depthWeights,
    swirlWeights,
    pointerPhase,
  } = particles;

  const gestureSpeed = state.gesture > state.smoothGesture ? 0.52 : 0.42;
  state.smoothGesture = THREE.MathUtils.lerp(state.smoothGesture, state.gesture, gestureSpeed);
  state.pointerBoost = THREE.MathUtils.lerp(state.pointerBoost, state.pointerDown ? 1 : 0, 0.16);
  const g = state.smoothGesture;
  const handActive = now - state.lastHandResultTime < 1200 && state.detectedHands.length > 0;
  const recovering = !state.pointerDown && now < state.recoverUntil;
  let transitionBoost = 0;
  if (state.modelTransition) {
    const transitionProgress = (now - state.modelTransition.startedAt) / state.modelTransition.duration;
    if (transitionProgress >= 1) {
      state.modelTransition = null;
    } else {
      transitionBoost = Math.sin(Math.PI * THREE.MathUtils.clamp(transitionProgress, 0, 1));
    }
  }
  const shapeGesture = handActive ? g : Math.min(g, 0.34 + state.pointerBoost * 0.18);
  const modelScale = MODEL_SCALE * (0.48 + shapeGesture * 2.85);
  const diffusion = recovering
    ? 0.04 + shapeGesture * 0.28
    : 0.05 + shapeGesture * 4.25 + state.pointerBoost * 0.38 + transitionBoost * 2.8;
  const radialExpansion = shapeGesture * 3.6 + transitionBoost * 2.2;
  const depthExpansion = shapeGesture * 5.2 + transitionBoost * 3.0;
  const transitionReturn = 2.8 + (1 - transitionBoost) * 8.4;
  const returnStrength = recovering ? 10.5 : Math.min(4.8 + (1 - shapeGesture) * 8.2, transitionReturn);
  const swirlStrength = recovering ? 0 : 0.04 + shapeGesture * 0.72 + state.pointerBoost * 0.32 + transitionBoost * 0.85;
  const pointerActive = (state.pointerDown || now < state.pointerActiveUntil) && state.pointer.x < 10;
  const pointerPower = state.pointerDown ? 1 : 0.52;
  const pointerX = state.pointer.x * 4.2;
  const pointerY = state.pointer.y * 2.55;
  const pointerRadius = state.pointerDown ? 2.8 : 1.65;
  const pointerRepelBase = (state.pointerDown ? 0.092 : 0.038) * pointerPower;
  const pointerSwirlBase = (state.pointerDown ? 0.058 : 0.024) * pointerPower;
  const damping = recovering ? 0.58 : pointerActive ? 0.9 : THREE.MathUtils.lerp(0.72, 0.86, shapeGesture);

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    const rx = Math.sin(elapsed * 0.71 + wavePhase[i]) * 0.5;
    const ry = Math.sin(elapsed * 1.13 + wavePhaseY[i]) * 0.5;
    const rz = Math.sin(elapsed * 1.67 + wavePhaseZ[i]) * 0.5;
    const baseX = targets[i3];
    const baseY = targets[i3 + 1];
    const baseZ = targets[i3 + 2];
    const radialPulse = radialExpansion * radialWeights[i];
    const depthPulse = depthExpansion * depthSigns[i] * depthWeights[i];
    const tx = baseX * modelScale + targetDirX[i] * radialPulse + rx * diffusion;
    const ty = baseY * modelScale + targetDirY[i] * radialPulse + ry * diffusion;
    const tz =
      baseZ * modelScale * (1.0 + shapeGesture * 2.2) +
      targetDirZ[i] * radialPulse +
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
    velocities[i3] += (-pz / radial) * swirlStrength * delta * swirlWeights[i];
    velocities[i3 + 2] += (px / radial) * swirlStrength * delta * swirlWeights[i];

    if (pointerActive) {
      const dx = px - pointerX;
      const dy = py - pointerY;
      const d = Math.hypot(dx, dy) + 0.001;

      if (d < pointerRadius) {
        const falloff = (1 - d / pointerRadius) ** 2;
        const repel = pointerRepelBase * falloff;
        const swirl = pointerSwirlBase * falloff;
        velocities[i3] += (dx / d) * repel + (-dy / d) * swirl;
        velocities[i3 + 1] += (dy / d) * repel + (dx / d) * swirl;
        velocities[i3 + 2] += Math.sin(elapsed * 4 + pointerPhase[i]) * repel * 0.36;
      }
    }

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
  bloomPass.strength = 0.48 + shapeGesture * 0.28 + transitionBoost * 0.18;
  material.uniforms.uPointSize.value = 18 + shapeGesture * 5;
  onGestureUpdate(Math.round(g * 100));
}
