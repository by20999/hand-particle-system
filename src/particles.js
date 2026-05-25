import * as THREE from "three";
import { MODEL_SCALE, START_SCALE } from "./config.js";
import { writePointCloudTargets, writeShapeTargets, writeTextTargets } from "./shapes.js";

export function createParticleSystem({ count, color, accent = "#52d7de", pixelRatio }) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const targets = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const randomness = new Float32Array(count);
  const colorMixes = new Float32Array(count);
  const particleParams = new Float32Array(count * 2);
  const particleColors = new Float32Array(count * 4);
  const brightnesses = new Float32Array(count);
  const baseBrightnesses = new Float32Array(count);
  const targetRadii = new Float32Array(count);
  const targetDirX = new Float32Array(count);
  const targetDirY = new Float32Array(count);
  const targetDirZ = new Float32Array(count);
  const targetDirections = new Float32Array(count * 3);
  const targetMeta = new Float32Array(count * 3);
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
    particleParams[i * 2] = randomness[i];
    particleParams[i * 2 + 1] = colorMixes[i];
    particleColors[i3] = 1;
    particleColors[i3 + 1] = 1;
    particleColors[i3 + 2] = 1;
    particleColors[i3 + 3] = 1;
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
  geometry.setAttribute("aTarget", new THREE.BufferAttribute(targets, 3));
  geometry.setAttribute("aTargetDir", new THREE.BufferAttribute(targetDirections, 3));
  geometry.setAttribute("aTargetMeta", new THREE.BufferAttribute(targetMeta, 3));
  geometry.setAttribute("aParticleParams", new THREE.BufferAttribute(particleParams, 2));
  geometry.setAttribute("aParticleColor", new THREE.BufferAttribute(particleColors, 4));
  geometry.setAttribute("aWavePhase", new THREE.BufferAttribute(wavePhase, 1));
  geometry.setAttribute("aDepthSign", new THREE.BufferAttribute(depthSigns, 1));

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
      uModelScale: { value: MODEL_SCALE * 0.72 },
      uShapeGesture: { value: 0 },
      uDiffusion: { value: 0.05 },
      uRadialExpansion: { value: 0 },
      uDepthExpansion: { value: 0 },
      uTransitionBoost: { value: 0 },
      uMusicImpact: { value: 0 },
      uMusicTransient: { value: 0 },
      uMusicShimmer: { value: 0 },
      uFireworkExplosion: { value: 0 },
      uModelType: { value: 0 },
      uPointer: { value: new THREE.Vector3(0, 0, 0) },
      uUseVertexColor: { value: 0 },
    },
    vertexShader: `
      attribute vec3 aTarget;
      attribute vec3 aTargetDir;
      attribute vec3 aTargetMeta;
      attribute vec4 aParticleColor;
      attribute vec2 aParticleParams;
      attribute float aWavePhase;
      attribute float aDepthSign;
      varying float vRandom;
      varying float vColorMix;
      varying float vBrightness;
      varying vec4 vParticleColor;
      uniform float uTime;
      uniform float uPixelRatio;
      uniform float uPointSize;
      uniform float uModelScale;
      uniform float uShapeGesture;
      uniform float uDiffusion;
      uniform float uRadialExpansion;
      uniform float uDepthExpansion;
      uniform float uTransitionBoost;
      uniform float uMusicImpact;
      uniform float uMusicTransient;
      uniform float uMusicShimmer;
      uniform float uFireworkExplosion;
      uniform float uModelType;
      uniform vec3 uPointer;

      float smooth01(float value) {
        float x = clamp(value, 0.0, 1.0);
        return x * x * (3.0 - 2.0 * x);
      }

      void main() {
        float aRandom = aParticleParams.x;
        vRandom = aRandom;
        vColorMix = aParticleParams.y;
        vParticleColor = aParticleColor;
        float targetRadius = aTargetMeta.x;
        float targetKind = aTargetMeta.y;
        float baseBrightness = aTargetMeta.z;
        float radialWeight = 0.28 + aRandom * 1.25;
        float depthWeight = 0.18 + aRandom * 0.82;
        float waveY = aWavePhase * 1.37 + aRandom * 4.881;
        float waveZ = aWavePhase * 0.77 + aRandom * 7.417;
        float rx = sin(uTime * 0.71 + aWavePhase) * 0.5;
        float ry = sin(uTime * 1.13 + waveY) * 0.5;
        float rz = sin(uTime * 1.67 + waveZ) * 0.5;
        vec3 target = vec3(
          aTarget.x * uModelScale + aTargetDir.x * uRadialExpansion * radialWeight + rx * uDiffusion,
          aTarget.y * uModelScale + aTargetDir.y * uRadialExpansion * radialWeight + ry * uDiffusion,
          aTarget.z * uModelScale * (1.0 + uShapeGesture * 2.2) +
            aTargetDir.z * uRadialExpansion * radialWeight +
            uDepthExpansion * aDepthSign * depthWeight +
            rz * uDiffusion * 1.35
        );
        float brightness = baseBrightness;

        if (abs(uModelType - 3.0) < 0.5) {
          float burst = smooth01(uFireworkExplosion);
          float launchDrift = (1.0 - burst) * (0.034 + aRandom * 0.035);
          float fireworkScale = ${MODEL_SCALE.toFixed(8)} * (0.94 + uTransitionBoost * 0.08);
          float sparkDelay = aRandom * 0.16;
          float sparkBurst = smooth01((burst - sparkDelay) / max(0.001, 1.0 - sparkDelay));
          float rayDistance = targetRadius * (1.98 + uFireworkExplosion * 0.66 + uMusicTransient * 0.16);
          float rocketLift = sin(uTime * (0.82 + aRandom * 0.22) + waveY) * launchDrift;
          if (targetKind < 0.5) {
            target = vec3(
              aTarget.x * fireworkScale + sin(uTime * 1.9 + aWavePhase) * launchDrift * 0.34,
              aTarget.y * fireworkScale + rocketLift * (1.0 - burst * 0.55),
              aTarget.z * fireworkScale + cos(uTime * 1.4 + waveZ) * launchDrift * 0.26
            );
            brightness = baseBrightness * (0.96 + (1.0 - burst) * 0.82 + uMusicShimmer * 0.32);
          } else if (targetKind < 1.5) {
            float flash = sin(3.14159265 * clamp(burst, 0.0, 1.0));
            float coreFade = pow(1.0 - burst, 2.4);
            float coreScatter = targetRadius * (0.34 + aRandom * 0.32) * burst;
            target = vec3(
              aTarget.x * fireworkScale + aTargetDir.x * coreScatter,
              aTarget.y * fireworkScale + aTargetDir.y * coreScatter - burst * burst * 0.18 + rocketLift * 0.16,
              aTarget.z * fireworkScale + aTargetDir.z * coreScatter
            );
            brightness = baseBrightness * (0.08 + coreFade * 0.92 + flash * 0.56);
          } else {
            float afterglow = 0.9 + sin(uTime * 3.4 + aWavePhase) * 0.05;
            float flutter = sin(uTime * (3.4 + aRandom * 1.8) + aWavePhase) * sparkBurst * 0.065;
            float branchFlutter = sin(uTime * (4.0 + aRandom * 2.2) + waveZ) * sparkBurst * 0.1;
            float gravity = sparkBurst * sparkBurst * (0.08 + aRandom * 0.22);
            float petalTrace = 0.42 + sparkBurst * 0.58;
            target = vec3(
              aTarget.x * fireworkScale + aTargetDir.x * rayDistance * petalTrace * afterglow + flutter,
              aTarget.y * fireworkScale + aTargetDir.y * rayDistance * petalTrace * afterglow - gravity * 1.28 +
                cos(uTime * 2.6 + waveY) * sparkBurst * 0.045,
              aTarget.z * fireworkScale + aTargetDir.z * rayDistance * petalTrace + branchFlutter +
                sin(uTime * 1.8 + waveZ) * sparkBurst * 0.035
            );
            brightness = baseBrightness *
              (0.52 + sparkBurst * (1.95 + uMusicShimmer * 0.72) + sin(rayDistance * 2.1 + uTime * 7.0) * 0.16);
          }
        }

        vec3 scatter = normalize(position + vec3(aRandom * 0.7 + 0.1, aDepthSign * 0.4, radialWeight * 0.25));
        target += scatter * uTransitionBoost * (1.2 + aRandom * 1.6);
        target += uPointer * (0.55 + aRandom * 0.45);

        vBrightness = brightness;
        vec4 mvPosition = modelViewMatrix * vec4(target, 1.0);
        float pulse = 0.78 + 0.22 * sin(uTime * 2.0 + aRandom * 8.0);
        float sizeBrightness = 0.62 + clamp(vBrightness, 0.08, 2.2) * 0.28;
        gl_PointSize = uPointSize * pulse * sizeBrightness * uPixelRatio / max(0.45, -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying float vRandom;
      varying float vColorMix;
      varying float vBrightness;
      varying vec4 vParticleColor;
      uniform vec3 uColor;
      uniform vec3 uAccent;
      uniform float uUseVertexColor;

      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv);
        float alpha = smoothstep(0.5, 0.0, d);
        float core = smoothstep(0.18, 0.0, d);
        vec3 palette = mix(uColor, uAccent, vColorMix * 0.55);
        vec3 color = mix(palette, vParticleColor.rgb, uUseVertexColor);
        color += core * 0.85;
        color *= vBrightness;
        float vertexAlpha = mix(1.0, vParticleColor.a, uUseVertexColor);
        gl_FragColor = vec4(color, alpha * vertexAlpha * (0.72 + vRandom * 0.38) * clamp(vBrightness, 0.25, 1.65));
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
    particleParams,
    particleColors,
    brightnesses,
    baseBrightnesses,
    targetRadii,
    targetDirX,
    targetDirY,
    targetDirZ,
    targetDirections,
    targetMeta,
    targetKinds,
    wavePhase,
    wavePhaseY,
    wavePhaseZ,
    depthSigns,
    radialWeights,
    depthWeights,
    swirlWeights,
    pointerPhase,
    gpuDriven: true,
  };
}

export function setParticleTargets(particles, model) {
  particles.currentModel = model;
  if (model === "text") {
    writeTextTargets(particles.customText, particles, particles.textFont);
  } else if (model === "image") {
    writePointCloudTargets(particles.customImagePoints, particles);
  } else if (model === "mesh") {
    writePointCloudTargets(particles.customMeshPoints, particles);
  } else {
    writeShapeTargets(model, particles);
  }
  syncTargetDirectionAttribute(particles);
  syncParticleParamsAttribute(particles);
  particles.geometry.attributes.aTarget.needsUpdate = true;
  particles.geometry.attributes.aTargetDir.needsUpdate = true;
  particles.geometry.attributes.aTargetMeta.needsUpdate = true;
  particles.geometry.attributes.aParticleParams.needsUpdate = true;
  particles.geometry.attributes.aParticleColor.needsUpdate = true;
  particles.material.uniforms.uUseVertexColor.value = model === "image" || model === "mesh" ? 1 : 0;
  particles.baseBrightnesses.set(particles.brightnesses);
  syncTargetMetaAttribute(particles);
  particles.geometry.attributes.aTargetMeta.needsUpdate = true;
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

export function setImagePoints(particles, points) {
  particles.customImagePoints = points;
  setParticleTargets(particles, "image");
}

export function setMeshPoints(particles, points) {
  particles.customMeshPoints = points;
  setParticleTargets(particles, "mesh");
}

export function snapParticlesToTargets(particles) {
  if (particles.gpuDriven) {
    return;
  }
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
  const { material } = particles;

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
  const baseModelScale = isTextModel ? 0.62 : isFireworksModel ? 0.72 : isFlowerModel ? 0.62 : 0.72;
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

  const pointerDirection = state.gestureCommand?.pointing
    ? new THREE.Vector3(state.gestureCommand.pointX * 0.85, state.gestureCommand.pointY * 0.52, state.gestureCommand.pointZ * 0.36)
    : new THREE.Vector3(0, 0, 0);
  material.uniforms.uModelScale.value = modelScale;
  material.uniforms.uShapeGesture.value = shapeGesture;
  material.uniforms.uDiffusion.value = diffusion;
  material.uniforms.uRadialExpansion.value = radialExpansion;
  material.uniforms.uDepthExpansion.value = depthExpansion;
  material.uniforms.uTransitionBoost.value = transitionBoost;
  material.uniforms.uMusicImpact.value = musicImpact;
  material.uniforms.uMusicTransient.value = musicTransient;
  material.uniforms.uMusicShimmer.value = musicShimmer;
  material.uniforms.uFireworkExplosion.value = fireworkExplosion;
  material.uniforms.uModelType.value = isTextModel ? 4 : isFireworksModel ? 3 : isFlowerModel ? 1 : state.model === "saturn" ? 2 : 0;
  material.uniforms.uPointer.value.lerp(pointerDirection, 0.18);

  const textToneDown = isTextModel ? 0.78 : 1;
  bloomPass.strength =
    (0.42 +
      shapeGesture * 0.22 +
      transitionBoost * 0.18 +
      musicImpact * 0.34 +
      musicShimmer * 0.04 +
      (isFireworksModel ? fireworkExplosion * 0.68 : 0)) *
    textToneDown;
  material.uniforms.uPointSize.value =
    (isTextModel ? 12.4 : isFireworksModel ? 7.4 : 18) +
    shapeGesture * (isTextModel ? 2.4 : isFireworksModel ? 1.1 : 5) +
    musicImpact * (isFireworksModel ? 3.1 : 4.2) +
    (isFireworksModel ? fireworkExplosion * 6.2 : 0);
  onGestureUpdate(Math.round(g * 100));
}

function syncTargetDirectionAttribute(particles) {
  const { count, targetDirX, targetDirY, targetDirZ, targetDirections } = particles;
  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    targetDirections[i3] = targetDirX[i];
    targetDirections[i3 + 1] = targetDirY[i];
    targetDirections[i3 + 2] = targetDirZ[i];
  }
}

function syncTargetMetaAttribute(particles) {
  const { count, targetRadii, targetKinds, baseBrightnesses, targetMeta } = particles;
  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    targetMeta[i3] = targetRadii[i];
    targetMeta[i3 + 1] = targetKinds[i];
    targetMeta[i3 + 2] = baseBrightnesses[i];
  }
}

function syncParticleParamsAttribute(particles) {
  const { count, randomness, colorMixes, particleParams } = particles;
  for (let i = 0; i < count; i += 1) {
    const i2 = i * 2;
    particleParams[i2] = randomness[i];
    particleParams[i2 + 1] = colorMixes[i];
  }
}
