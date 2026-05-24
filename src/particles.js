import * as THREE from "three";
import { MODEL_SCALE, START_SCALE } from "./config.js";
import { writeShapeTargets, writeTextTargets } from "./shapes.js";

export function createParticleSystem({ count, color, accent = "#52d7de", pixelRatio }) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const targets = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const randomness = new Float32Array(count);
  const colorMixes = new Float32Array(count);
  const brightnesses = new Float32Array(count);
  const baseBrightnesses = new Float32Array(count);
  const targetRadii = new Float32Array(count);
  const targetDirX = new Float32Array(count);
  const targetDirY = new Float32Array(count);
  const targetDirZ = new Float32Array(count);
  const targetKinds = new Float32Array(count);
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
    baseBrightnesses[i] = 1;
    targetKinds[i] = 0;
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
        float sizeBrightness = 0.62 + clamp(vBrightness, 0.08, 1.8) * 0.28;
        gl_PointSize = uPointSize * pulse * sizeBrightness * uPixelRatio / max(0.45, -mvPosition.z);
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
    baseBrightnesses,
    targetRadii,
    targetDirX,
    targetDirY,
    targetDirZ,
    targetKinds,
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
  particles.currentModel = model;
  if (model === "text") {
    writeTextTargets(particles.customText, particles, particles.textFont);
  } else {
    writeShapeTargets(model, particles);
  }
  particles.geometry.attributes.aColorMix.needsUpdate = true;
  particles.geometry.attributes.aBrightness.needsUpdate = true;
  particles.baseBrightnesses.set(particles.brightnesses);
}

export function setCustomText(particles, text, fontId = particles.textFont ?? "modern") {
  particles.customText = text;
  particles.textFont = fontId;
  setParticleTargets(particles, "text");
}

export function setTextFont(particles, fontId) {
  particles.textFont = fontId;
  if (particles.currentModel === "text") {
    setParticleTargets(particles, "text");
  }
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
    brightnesses,
    baseBrightnesses,
    targetRadii,
    targetDirX,
    targetDirY,
    targetDirZ,
    targetKinds,
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
  const audio = state.audioMotion ?? {};
  const audioLevel = audio.level ?? state.audioLevel ?? 0;
  const beatPulse = audio.beat ?? state.beatPulse ?? 0;
  const bassLevel = audio.bass ?? audioLevel;
  const midLevel = audio.mid ?? audioLevel * 0.6;
  const trebleLevel = audio.treble ?? audioLevel * 0.35;
  const kickPulse = audio.kick ?? beatPulse;
  const peakLevel = audio.peak ?? Math.max(audioLevel, beatPulse);
  const onsetPulse = audio.onset ?? 0;
  const isTextModel = state.model === "text";
  const isFlowerModel = state.model === "flower";
  const isFireworksModel = state.model === "fireworks";
  const rawShapeGesture = handActive ? g : Math.min(g, 0.34 + state.pointerBoost * 0.18);
  const shapeGesture = isFireworksModel ? Math.min(rawShapeGesture, 0.42) : rawShapeGesture;
  const musicShapeDrive = isFireworksModel ? 0.18 : 0.22;
  const fireworkExplosion = isFireworksModel ? (state.fireworkExplosion ?? 0) : 0;
  const calmMusic = THREE.MathUtils.smoothstep(audioLevel, 0.34, 0.86) * 0.36;
  const musicImpact = Math.min(
    1,
    beatPulse * 0.5 + kickPulse * 1.08 + onsetPulse * 0.86 + THREE.MathUtils.smoothstep(peakLevel, 0.56, 0.92) * 0.74,
  );
  const musicTransient = Math.min(1, musicImpact * 0.38 + Math.max(0, bassLevel - audioLevel * 0.62) * 0.16);
  const musicShimmer = Math.min(1, THREE.MathUtils.smoothstep(trebleLevel, 0.34, 0.88) * 0.62 + midLevel * 0.05);
  const baseModelScale = isTextModel ? 0.56 : isFireworksModel ? 0.72 : isFlowerModel ? 0.62 : 0.72;
  const gestureScale = isTextModel ? 1.72 : isFireworksModel ? 0.22 : 2.38;
  const modelScale = MODEL_SCALE * (baseModelScale + shapeGesture * gestureScale) * (1 + musicTransient * 0.045);
  const diffusion = recovering
    ? 0.04 + shapeGesture * 0.28
    : 0.05 +
      shapeGesture * (isTextModel ? 2.6 : 4.25) +
      state.pointerBoost * 0.38 +
      transitionBoost * 2.8 +
      musicTransient * musicShapeDrive +
      musicShimmer * 0.12 +
      calmMusic * 0.035;
  const radialExpansion =
    shapeGesture * (isTextModel ? 1.85 : 3.2) + transitionBoost * 2.2 + musicTransient * 0.3 + calmMusic * 0.025;
  const depthExpansion =
    shapeGesture * (isTextModel ? 2.45 : 4.85) + transitionBoost * 3.0 + musicTransient * 0.36 + calmMusic * 0.03;
  const transitionReturn = 2.8 + (1 - transitionBoost) * 8.4;
  const returnStrength = recovering ? 10.5 : Math.min(4.8 + (1 - shapeGesture) * 8.2, transitionReturn);
  const swirlStrength =
    recovering
      ? 0
      : 0.04 +
        shapeGesture * 0.72 +
        state.pointerBoost * 0.32 +
        transitionBoost * 0.85 +
        beatPulse * 0.28 +
        midLevel * 0.1;
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
    let tx = baseX * modelScale + targetDirX[i] * radialPulse + rx * diffusion;
    let ty = baseY * modelScale + targetDirY[i] * radialPulse + ry * diffusion;
    let tz =
      baseZ * modelScale * (1.0 + shapeGesture * 2.2) +
      targetDirZ[i] * radialPulse +
      depthPulse +
      rz * diffusion * 1.35;

    if (isFireworksModel) {
      const burst = fireworkExplosion * fireworkExplosion * (3 - 2 * fireworkExplosion);
      const fireworkKind = targetKinds[i] ?? 0;
      const launchDrift = (1 - burst) * (0.034 + randomness[i] * 0.035);
      const rocketLift = Math.sin(elapsed * (0.82 + randomness[i] * 0.22) + wavePhaseY[i]) * launchDrift;
      const fireworkScale = MODEL_SCALE * (0.94 + transitionBoost * 0.08);
      const sparkDelay = randomness[i] * 0.16;
      const sparkBurst = THREE.MathUtils.smoothstep(burst, sparkDelay, 1);
      const rayDistance = targetRadii[i] * (1.98 + fireworkExplosion * 0.66 + musicTransient * 0.16);
      const flutter = Math.sin(elapsed * (3.4 + randomness[i] * 1.8) + wavePhase[i]) * sparkBurst * 0.065;
      const gravity = sparkBurst * sparkBurst * (0.08 + randomness[i] * 0.22);

      if (fireworkKind < 0.5) {
        tx = baseX * fireworkScale + Math.sin(elapsed * 1.9 + wavePhase[i]) * launchDrift * 0.34;
        ty = baseY * fireworkScale + rocketLift * (1 - burst * 0.55);
        tz = baseZ * fireworkScale + Math.cos(elapsed * 1.4 + wavePhaseZ[i]) * launchDrift * 0.26;
        brightnesses[i] = baseBrightnesses[i] * (0.96 + (1 - burst) * 0.82 + musicShimmer * 0.32);
      } else if (fireworkKind < 1.5) {
        const flash = Math.sin(Math.PI * THREE.MathUtils.clamp(burst, 0, 1));
        const coreFade = (1 - burst) ** 2.4;
        const coreScatter = targetRadii[i] * (0.34 + randomness[i] * 0.32) * burst;
        tx = baseX * fireworkScale + targetDirX[i] * coreScatter;
        ty = baseY * fireworkScale + targetDirY[i] * coreScatter - burst * burst * 0.18 + rocketLift * 0.16;
        tz = baseZ * fireworkScale + targetDirZ[i] * coreScatter;
        brightnesses[i] = baseBrightnesses[i] * (0.08 + coreFade * 0.92 + flash * 0.56);
      } else {
        const afterglow = 0.9 + Math.sin(elapsed * 3.4 + wavePhase[i]) * 0.05;
        const branchFlutter = Math.sin(elapsed * (4.0 + randomness[i] * 2.2) + wavePhaseZ[i]) * sparkBurst * 0.1;
        const petalTrace = 0.42 + sparkBurst * 0.58;
        tx = baseX * fireworkScale + targetDirX[i] * rayDistance * petalTrace * afterglow + flutter;
        ty =
          baseY * fireworkScale +
          targetDirY[i] * rayDistance * petalTrace * afterglow -
          gravity * 1.28 +
          Math.cos(elapsed * 2.6 + wavePhaseY[i]) * sparkBurst * 0.045;
        tz =
          baseZ * fireworkScale +
          targetDirZ[i] * rayDistance * petalTrace +
          branchFlutter +
          Math.sin(elapsed * 1.8 + wavePhaseZ[i]) * sparkBurst * 0.035;
        brightnesses[i] =
          baseBrightnesses[i] *
          (0.52 + sparkBurst * (1.95 + musicShimmer * 0.72) + Math.sin(rayDistance * 2.1 + elapsed * 7) * 0.16);
      }
    } else if (brightnesses[i] !== baseBrightnesses[i]) {
      brightnesses[i] = THREE.MathUtils.lerp(brightnesses[i], baseBrightnesses[i], 0.18);
    }

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
  geometry.attributes.aBrightness.needsUpdate = true;
  const textToneDown = isTextModel ? 0.68 : 1;
  bloomPass.strength =
    (0.42 +
      shapeGesture * 0.22 +
      transitionBoost * 0.18 +
      musicImpact * 0.34 +
      musicShimmer * 0.04 +
      (isFireworksModel ? fireworkExplosion * 0.68 : 0)) *
    textToneDown;
  material.uniforms.uPointSize.value =
    (isTextModel ? 9.8 : isFireworksModel ? 7.4 : 18) +
    shapeGesture * (isTextModel ? 1.8 : isFireworksModel ? 1.1 : 5) +
    musicImpact * (isFireworksModel ? 3.1 : 4.2) +
    (isFireworksModel ? fireworkExplosion * 6.2 : 0);
  onGestureUpdate(Math.round(g * 100));
}
