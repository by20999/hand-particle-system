import * as THREE from "three";
import { hash } from "./shapes.js";

const TAU = Math.PI * 2;

const BACKGROUND_MODES = {
  nebula: "星云",
  stage: "柔光舞台",
  minimal: "极简黑场",
  fireworks: "烟花夜空",
};

export function createBackgroundSystem(theme) {
  const group = new THREE.Group();
  const textures = {
    glow: createGlowTexture(),
    cloud: createCloudTexture(),
    beam: createBeamTexture(),
    spark: createSparkTexture(),
  };
  const nebula = createNebulaScene(theme, textures);
  const stage = createStageScene(theme, textures);
  const minimal = createMinimalScene(theme, textures);
  const fireworks = createFireworksScene(theme, textures);

  group.add(nebula, stage, minimal, fireworks);
  const system = {
    group,
    mode: "nebula",
    nebula,
    stage,
    minimal,
    fireworks,
    textures,
  };
  setBackgroundMode(system, "nebula", theme);
  return system;
}

export function backgroundModes() {
  return BACKGROUND_MODES;
}

export function setBackgroundMode(system, mode, theme) {
  system.mode = BACKGROUND_MODES[mode] ? mode : "nebula";
  system.nebula.visible = system.mode === "nebula";
  system.stage.visible = system.mode === "stage";
  system.minimal.visible = system.mode === "minimal";
  system.fireworks.visible = system.mode === "fireworks";
  document.documentElement.dataset.background = system.mode;
  applyBackgroundTheme(system, theme);
}

export function applyBackgroundTheme(system, theme) {
  for (const scene of [system.nebula, system.stage, system.minimal, system.fireworks]) {
    for (const item of scene.userData.materials ?? []) {
      if (item.material.uniforms?.uColorA) {
        item.material.uniforms.uColorA.value.copy(colorForRole(theme, "primary", item.mix ?? 0.5));
        item.material.uniforms.uColorB.value.copy(colorForRole(theme, "accent", item.mix ?? 0.5));
        item.material.uniforms.uColorC.value.copy(colorForRole(theme, "haze", item.mix ?? 0.5));
        item.material.uniforms.uRim.value.copy(colorForRole(theme, "rim", item.mix ?? 0.5));
        item.material.uniforms.uOpacity.value = item.opacity;
      } else if (item.material.color) {
        item.material.color.copy(colorForRole(theme, item.role, item.mix ?? 0.5));
        item.material.opacity = item.opacity;
      }
    }
  }
}

export function updateBackground(system, elapsed, audio = 0, model = "heart") {
  const metrics = normalizeAudio(audio);
  const active = system[system.mode];
  if (!active) return;
  const modelFocus = modelFocusValue(model);
  const focusScale = 1 + modelFocus * 0.08 + metrics.beat * 0.035;

  active.scale.lerp(new THREE.Vector3(focusScale, focusScale, focusScale), 0.025);
  updateAtmospheres(active, elapsed, metrics, modelFocus);

  if (system.mode === "nebula") {
    updateNebula(system.nebula, elapsed, metrics, modelFocus);
  }

  if (system.mode === "stage") {
    updateStage(system.stage, elapsed, metrics, modelFocus);
  }

  if (system.mode === "minimal") {
    updateMinimal(system.minimal, elapsed, metrics, modelFocus);
  }

  if (system.mode === "fireworks") {
    updateFireworksSky(system.fireworks, elapsed, metrics, modelFocus);
  }
}

function createNebulaScene(theme, textures) {
  const group = new THREE.Group();
  const materials = [];

  group.add(createAtmospherePlane(theme, 0, 0.52, materials));
  group.add(createStarField(theme, 2600, 11, 32, -15, 0.24, 0.026, materials));
  group.add(createStarField(theme, 850, 7, 18, -7, 0.32, 0.04, materials));

  for (let i = 0; i < 38; i += 1) {
    const material = new THREE.SpriteMaterial({
      map: textures.cloud,
      color: colorForRole(theme, i % 3 === 0 ? "haze" : "accent", hash(i * 3.1)),
      transparent: true,
      opacity: 0.045 + hash(i * 4.7) * 0.075,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const sprite = new THREE.Sprite(material);
    const radius = 4.4 + hash(i * 1.3) * 9.5;
    const angle = hash(i * 2.1) * TAU;
    sprite.position.set(
      Math.cos(angle) * radius,
      (hash(i * 3.2) - 0.5) * 6.6,
      -6.5 - hash(i * 5.4) * 10.5,
    );
    const scale = 3.8 + hash(i * 7.2) * 8.5;
    sprite.scale.set(scale * (1.35 + hash(i * 2.4)), scale, 1);
    sprite.rotation.z = hash(i * 8.8) * TAU;
    sprite.userData = {
      kind: "cloud",
      baseOpacity: material.opacity,
      baseScale: sprite.scale.clone(),
      speed: 0.025 + hash(i * 9.1) * 0.035,
      phase: hash(i * 6.3) * TAU,
    };
    group.add(sprite);
    materials.push({ material, role: i % 3 === 0 ? "haze" : "accent", opacity: material.opacity, mix: hash(i * 3.1) });
  }

  for (let i = 0; i < 9; i += 1) {
    const geometry = createSpiralGeometry(150, 0.4 + i * 0.18, 3.4 + i * 0.55, i * 0.5);
    const material = new THREE.LineBasicMaterial({
      color: colorForRole(theme, i % 2 === 0 ? "primary" : "accent"),
      transparent: true,
      opacity: 0.004 + i * 0.0008,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const line = new THREE.Line(geometry, material);
    line.position.z = -4.5 - i * 0.46;
    line.rotation.x = -0.24 + i * 0.015;
    line.rotation.z = i * 0.46;
    line.userData = {
      kind: "filament",
      baseOpacity: material.opacity,
      speed: 0.018 + i * 0.004,
      phase: i * 0.8,
    };
    group.add(line);
    materials.push({ material, role: i % 2 === 0 ? "primary" : "accent", opacity: material.opacity });
  }

  addAuroraCurtains(group, theme, materials);

  group.userData.materials = materials;
  return group;
}

function createStageScene(theme, textures) {
  const group = new THREE.Group();
  const materials = [];

  group.add(createAtmospherePlane(theme, 1, 0.5, materials));
  group.add(createStarField(theme, 900, 8, 24, -13, 0.12, 0.022, materials));

  for (let i = 0; i < 7; i += 1) {
    const material = new THREE.SpriteMaterial({
      map: textures.cloud,
      color: colorForRole(theme, i % 2 === 0 ? "haze" : "accent", hash(i * 3.8)),
      transparent: true,
      opacity: 0.05 + hash(i * 2.6) * 0.04,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const curtain = new THREE.Sprite(material);
    curtain.position.set((hash(i * 2.1) - 0.5) * 8.6, 1.4 + hash(i * 1.3) * 1.5, -6.2 - i * 0.5);
    curtain.scale.set(5.4 + hash(i * 4.1) * 4.2, 2.6 + hash(i * 6.2) * 1.8, 1);
    curtain.rotation.z = (hash(i * 7.3) - 0.5) * 0.32;
    curtain.userData = {
      kind: "backdropCurtain",
      baseOpacity: material.opacity,
      baseScale: curtain.scale.clone(),
      speed: 0.05 + hash(i * 4.4) * 0.05,
      phase: hash(i * 8.5) * TAU,
    };
    group.add(curtain);
    materials.push({ material, role: i % 2 === 0 ? "haze" : "accent", opacity: material.opacity, mix: hash(i * 3.8) });
  }

  for (let i = 0; i < 12; i += 1) {
    const material = new THREE.SpriteMaterial({
      map: textures.beam,
      color: colorForRole(theme, i % 2 === 0 ? "primary" : "accent", hash(i * 1.7)),
      transparent: true,
      opacity: 0.13 + hash(i * 3.3) * 0.08,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const beam = new THREE.Sprite(material);
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (1.25 + Math.floor(i / 2) * 0.58);
    beam.position.set(x, 0.55 + hash(i * 5.1) * 0.6, -4.8 - hash(i * 1.9) * 2.8);
    beam.scale.set(1.0 + hash(i * 7.3) * 0.75, 7.2 + hash(i * 4.6) * 2.4, 1);
    beam.rotation.z = side * (0.24 + hash(i * 8.2) * 0.24);
    beam.userData = {
      kind: "beam",
      baseOpacity: material.opacity,
      baseScale: beam.scale.clone(),
      speed: 0.25 + hash(i * 4.1) * 0.22,
      phase: hash(i * 9.9) * TAU,
    };
    group.add(beam);
    materials.push({ material, role: i % 2 === 0 ? "primary" : "accent", opacity: material.opacity, mix: hash(i * 1.7) });
  }

  for (let i = 0; i < 10; i += 1) {
    const material = new THREE.SpriteMaterial({
      map: textures.glow,
      color: colorForRole(theme, i % 2 === 0 ? "haze" : "rim"),
      transparent: true,
      opacity: 0.09 + hash(i * 2.8) * 0.08,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const halo = new THREE.Sprite(material);
    halo.position.set((hash(i * 1.1) - 0.5) * 7.6, -1.6 + hash(i * 2.2) * 0.55, -2.8 - hash(i * 3.2) * 4.5);
    const scale = 2.2 + hash(i * 5.4) * 3.2;
    halo.scale.set(scale * 1.8, scale * 0.62, 1);
    halo.userData = {
      kind: "floorGlow",
      baseOpacity: material.opacity,
      baseScale: halo.scale.clone(),
      speed: 0.18 + hash(i * 6.9) * 0.18,
      phase: hash(i * 8.1) * TAU,
    };
    group.add(halo);
    materials.push({ material, role: i % 2 === 0 ? "haze" : "rim", opacity: material.opacity });
  }

  for (let ring = 0; ring < 8; ring += 1) {
    const geometry = createEllipseGeometry(220, 2.4 + ring * 0.52, 0.46 + ring * 0.08, -1.35 + ring * 0.035);
    const material = new THREE.LineBasicMaterial({
      color: colorForRole(theme, ring % 2 === 0 ? "primary" : "accent"),
      transparent: true,
      opacity: 0.028 - ring * 0.0028,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const line = new THREE.Line(geometry, material);
    line.position.z = -3.6 - ring * 0.28;
    line.userData = {
      kind: "stageRing",
      baseOpacity: material.opacity,
      speed: 0.34 + ring * 0.06,
      phase: ring * 0.9,
    };
    group.add(line);
    materials.push({ material, role: ring % 2 === 0 ? "primary" : "accent", opacity: material.opacity });
  }

  group.userData.materials = materials;
  return group;
}

function createMinimalScene(theme, textures) {
  const group = new THREE.Group();
  const materials = [];

  group.add(createAtmospherePlane(theme, 3, 0.28, materials));
  group.add(createStarField(theme, 520, 8, 23, -14, 0.055, 0.02, materials));

  for (let i = 0; i < 4; i += 1) {
    const material = new THREE.SpriteMaterial({
      map: textures.glow,
      color: colorForRole(theme, i % 2 === 0 ? "rim" : "haze"),
      transparent: true,
      opacity: 0.035 + hash(i * 2.8) * 0.025,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const halo = new THREE.Sprite(material);
    halo.position.set((hash(i * 2.1) - 0.5) * 5.8, -0.2 + hash(i * 1.3) * 1.4, -6.5 - i * 1.1);
    const scale = 2.2 + hash(i * 5.4) * 3.4;
    halo.scale.set(scale * 1.8, scale, 1);
    halo.userData = {
      kind: "minimalHalo",
      baseOpacity: material.opacity,
      baseScale: halo.scale.clone(),
      speed: 0.05 + hash(i * 6.9) * 0.08,
      phase: hash(i * 8.1) * TAU,
    };
    group.add(halo);
    materials.push({ material, role: i % 2 === 0 ? "rim" : "haze", opacity: material.opacity });
  }

  group.userData.materials = materials;
  return group;
}

function createFireworksScene(theme, textures) {
  const group = new THREE.Group();
  const materials = [];

  group.add(createAtmospherePlane(theme, 2, 0.48, materials));
  group.add(createStarField(theme, 1800, 9, 28, -12, 0.2, 0.026, materials));

  for (let i = 0; i < 14; i += 1) {
    const material = new THREE.SpriteMaterial({
      map: textures.cloud,
      color: colorForRole(theme, i % 2 === 0 ? "haze" : "primary"),
      transparent: true,
      opacity: 0.035 + hash(i * 3.1) * 0.045,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const smoke = new THREE.Sprite(material);
    smoke.position.set((hash(i * 1.2) - 0.5) * 11, -1.15 + hash(i * 2.8) * 3.8, -5.8 - hash(i * 4.7) * 5.4);
    const scale = 3.4 + hash(i * 5.2) * 6.2;
    smoke.scale.set(scale * 1.45, scale, 1);
    smoke.rotation.z = hash(i * 9.2) * TAU;
    smoke.userData = {
      kind: "smoke",
      baseOpacity: material.opacity,
      baseScale: smoke.scale.clone(),
      speed: 0.03 + hash(i * 6.3) * 0.04,
      phase: hash(i * 8.4) * TAU,
    };
    group.add(smoke);
    materials.push({ material, role: i % 2 === 0 ? "haze" : "primary", opacity: material.opacity });
  }

  for (let i = 0; i < 11; i += 1) {
    const count = 170;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const burstRadius = 0.72 + hash(i * 7.1) * 1.35;
    for (let j = 0; j < count; j += 1) {
      const j3 = j * 3;
      const phi = Math.acos(2 * hash(j * 3.17 + i) - 1);
      const theta = TAU * hash(j * 6.43 + i);
      const radius = Math.sqrt(hash(j * 8.91 + i)) * burstRadius;
      positions[j3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[j3 + 1] = radius * Math.cos(phi);
      positions[j3 + 2] = radius * Math.sin(phi) * Math.sin(theta) * 0.55;
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: colorForRole(theme, i % 3 === 0 ? "rim" : i % 3 === 1 ? "primary" : "accent"),
      size: 0.034 + hash(i * 1.9) * 0.026,
      transparent: true,
      opacity: 0.18 + hash(i * 2.8) * 0.18,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geometry, material);
    points.position.set((hash(i * 1.1) - 0.5) * 9.8, 0.4 + hash(i * 2.2) * 4.2, -6.8 - hash(i * 3.7) * 6.2);
    points.userData = {
      kind: "distantBurst",
      baseOpacity: material.opacity,
      baseScale: 0.65 + hash(i * 6.2) * 0.65,
      speed: 0.065 + hash(i * 9.4) * 0.075,
      phase: hash(i * 4.5),
    };
    group.add(points);
    materials.push({
      material,
      role: i % 3 === 0 ? "rim" : i % 3 === 1 ? "primary" : "accent",
      opacity: material.opacity,
    });
  }

  for (let i = 0; i < 12; i += 1) {
    const geometry = createRocketTrailGeometry(i);
    const material = new THREE.LineBasicMaterial({
      color: colorForRole(theme, i % 2 === 0 ? "primary" : "accent"),
      transparent: true,
      opacity: 0.14 + hash(i * 4.4) * 0.12,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const trail = new THREE.Line(geometry, material);
    trail.position.z = -5.8 - hash(i * 3.4) * 4.6;
    trail.userData = {
      kind: "rocketTrail",
      baseOpacity: material.opacity,
      speed: 0.18 + hash(i * 2.6) * 0.12,
      phase: hash(i * 6.8),
    };
    group.add(trail);
    materials.push({ material, role: i % 2 === 0 ? "primary" : "accent", opacity: material.opacity });
  }

  group.userData.materials = materials;
  return group;
}

function updateAtmospheres(group, elapsed, metrics, modelFocus) {
  for (const child of group.children) {
    if (child.userData.kind !== "atmosphere") continue;
    child.material.uniforms.uTime.value = elapsed;
    child.material.uniforms.uAudio.value = metrics.level * 0.45 + metrics.beat * 0.45 + modelFocus * 0.12;
    child.rotation.z = Math.sin(elapsed * 0.035 + child.userData.phase) * child.userData.drift;
  }
}

function updateNebula(group, elapsed, metrics, modelFocus) {
  group.rotation.y = 0;
  group.rotation.z = 0;
  for (const child of group.children) {
    if (child.userData.kind === "stars") {
      child.rotation.y = elapsed * 0.006;
      child.rotation.z = Math.sin(elapsed * 0.03) * 0.018;
      child.material.opacity = child.userData.baseOpacity * (0.82 + metrics.treble * 0.32);
    }
    if (child.userData.kind === "cloud") {
      const breathe = 1 + Math.sin(elapsed * child.userData.speed + child.userData.phase) * 0.055 + metrics.beat * 0.04;
      child.scale.copy(child.userData.baseScale).multiplyScalar(breathe);
      child.material.opacity = child.userData.baseOpacity * (0.82 + metrics.level * 0.62 + metrics.treble * 0.3);
      child.rotation.z += 0.0008 + metrics.mid * 0.002;
    }
    if (child.userData.kind === "filament") {
      child.rotation.z += child.userData.speed * 0.012 + metrics.beat * 0.003;
      child.material.opacity = child.userData.baseOpacity * (0.8 + metrics.mid * 0.6 + modelFocus * 0.18);
    }
    if (child.userData.kind === "auroraCurtain") {
      child.position.y = child.userData.baseY + Math.sin(elapsed * child.userData.speed + child.userData.phase) * 0.18;
      child.rotation.z = child.userData.baseRotation + Math.sin(elapsed * 0.08 + child.userData.phase) * 0.035;
      child.material.opacity = child.userData.baseOpacity * (0.8 + metrics.level * 0.48 + modelFocus * 0.18);
    }
  }
}

function updateStage(group, elapsed, metrics, modelFocus) {
  group.rotation.z = 0;
  for (const child of group.children) {
    if (child.userData.kind === "stars") {
      child.rotation.y = elapsed * 0.004;
      child.material.opacity = child.userData.baseOpacity * (0.62 + metrics.treble * 0.42);
    }
    if (child.userData.kind === "backdropCurtain") {
      const drift = Math.sin(elapsed * child.userData.speed + child.userData.phase);
      child.scale.copy(child.userData.baseScale).multiplyScalar(1 + drift * 0.04 + metrics.level * 0.04);
      child.position.x += drift * 0.003;
      child.material.opacity = child.userData.baseOpacity * (0.78 + metrics.level * 0.62 + modelFocus * 0.12);
    }
    if (child.userData.kind === "beam") {
      const sway = Math.sin(elapsed * child.userData.speed + child.userData.phase);
      child.rotation.z += sway * 0.0008 + metrics.mid * 0.002;
      child.scale.copy(child.userData.baseScale).multiplyScalar(1 + sway * 0.035 + metrics.beat * 0.09);
      child.material.opacity = child.userData.baseOpacity * (0.82 + metrics.level * 0.74 + modelFocus * 0.15);
    }
    if (child.userData.kind === "floorGlow") {
      const pulse = 1 + Math.sin(elapsed * child.userData.speed + child.userData.phase) * 0.04 + metrics.kick * 0.12;
      child.scale.copy(child.userData.baseScale).multiplyScalar(pulse);
      child.material.opacity = child.userData.baseOpacity * (0.8 + metrics.bass * 0.7);
    }
    if (child.userData.kind === "stageRing") {
      child.scale.setScalar(1 + Math.sin(elapsed * child.userData.speed + child.userData.phase) * 0.02 + metrics.beat * 0.03);
      child.material.opacity = child.userData.baseOpacity * (0.72 + metrics.mid * 0.65);
    }
  }
}

function updateMinimal(group, elapsed, metrics) {
  for (const child of group.children) {
    if (child.userData.kind === "stars") {
      child.rotation.y = elapsed * 0.003;
      child.material.opacity = child.userData.baseOpacity * (0.75 + metrics.treble * 0.32);
    }
    if (child.userData.kind === "minimalHalo") {
      const pulse = 1 + Math.sin(elapsed * child.userData.speed + child.userData.phase) * 0.035 + metrics.kick * 0.08;
      child.scale.copy(child.userData.baseScale).multiplyScalar(pulse);
      child.material.opacity = child.userData.baseOpacity * (0.72 + metrics.level * 0.38);
    }
  }
}

function updateFireworksSky(group, elapsed, metrics, modelFocus) {
  for (const child of group.children) {
    if (child.userData.kind === "smoke") {
      const drift = Math.sin(elapsed * child.userData.speed + child.userData.phase) * 0.055;
      child.position.x += drift * 0.004;
      child.scale.copy(child.userData.baseScale).multiplyScalar(1 + drift + metrics.level * 0.04);
      child.material.opacity = child.userData.baseOpacity * (0.82 + metrics.level * 0.5);
    }
    if (child.userData.kind === "distantBurst") {
      const cycle = (elapsed * child.userData.speed + child.userData.phase) % 1;
      const fade = Math.sin(cycle * Math.PI);
      child.scale.setScalar(child.userData.baseScale * (0.76 + cycle * 1.45 + metrics.beat * 0.18));
      child.rotation.z += 0.0015 + metrics.treble * 0.004;
      child.material.opacity = child.userData.baseOpacity * fade * (0.65 + metrics.level * 0.75 + modelFocus * 0.2);
    }
    if (child.userData.kind === "rocketTrail") {
      const cycle = (elapsed * child.userData.speed + child.userData.phase) % 1;
      child.position.y = -0.6 + cycle * 1.4;
      child.material.opacity = child.userData.baseOpacity * (1 - cycle) * (0.72 + metrics.beat * 0.6);
    }
  }
}

function createAtmospherePlane(theme, mode, opacity, materials) {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    uniforms: {
      uTime: { value: 0 },
      uMode: { value: mode },
      uAudio: { value: 0 },
      uOpacity: { value: opacity },
      uColorA: { value: colorForRole(theme, "primary") },
      uColorB: { value: colorForRole(theme, "accent") },
      uColorC: { value: colorForRole(theme, "haze") },
      uRim: { value: colorForRole(theme, "rim") },
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;

      varying vec2 vUv;
      uniform float uTime;
      uniform float uMode;
      uniform float uAudio;
      uniform float uOpacity;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform vec3 uColorC;
      uniform vec3 uRim;

      float hash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
          mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amp = 0.52;
        mat2 rot = mat2(0.82, -0.58, 0.58, 0.82);
        for (int i = 0; i < 5; i++) {
          value += noise(p) * amp;
          p = rot * p * 2.04 + 0.19;
          amp *= 0.52;
        }
        return value;
      }

      float starLayer(vec2 uv, float scale, float threshold) {
        vec2 grid = uv * scale;
        vec2 id = floor(grid);
        vec2 cell = fract(grid) - 0.5;
        float rnd = hash12(id);
        float sparkle = smoothstep(threshold, 1.0, rnd);
        float d = length(cell);
        return sparkle * smoothstep(0.28, 0.0, d) * (0.55 + 0.45 * sin(uTime * (1.2 + rnd) + rnd * 20.0));
      }

      void main() {
        vec2 uv = vUv;
        vec2 p = (uv - 0.5) * vec2(1.85, 1.0);
        float time = uTime * 0.055;
        float vignette = smoothstep(1.14, 0.22, length(p * vec2(0.88, 1.24)));
        float clouds = fbm(p * 2.05 + vec2(time, -time * 0.62));
        float fine = fbm(p * 5.2 - vec2(time * 1.8, time));
        float ribbon = 0.0;
        float stage = 0.0;
        float burst = 0.0;
        float minimal = 0.0;

        for (int i = 0; i < 4; i++) {
          float fi = float(i);
          float wave = sin(p.x * (2.2 + fi * 0.45) + time * (2.4 + fi) + fi * 1.7) * (0.1 + fi * 0.018);
          ribbon += exp(-abs(p.y - 0.24 - wave + fi * 0.055) * (6.5 + fi * 1.8)) * (0.24 - fi * 0.025);
        }

        for (int i = 0; i < 5; i++) {
          float fi = float(i);
          float x = -0.78 + fi * 0.39 + sin(time * 1.6 + fi) * 0.08;
          float beam = smoothstep(0.1, 0.0, abs(p.x - x - p.y * (0.18 - fi * 0.06)));
          stage += beam * smoothstep(-0.52, 0.46, p.y) * (0.22 + uAudio * 0.12);
        }

        for (int i = 0; i < 7; i++) {
          float fi = float(i);
          vec2 center = vec2(sin(fi * 2.3) * 0.72, -0.05 + fract(fi * 0.37) * 0.72);
          float radius = length((p - center) * vec2(1.0, 1.35));
          float ring = smoothstep(0.035, 0.0, abs(radius - fract(time * (0.18 + fi * 0.018) + fi * 0.17) * 0.58));
          burst += ring * (0.18 + hash12(vec2(fi, 4.0)) * 0.16);
        }

        minimal = smoothstep(0.72, 0.02, length(p)) * (0.13 + fine * 0.08);

        vec3 color = vec3(0.0);
        float alpha = 0.0;
        float star = starLayer(uv + vec2(time * 0.06, 0.0), 95.0, 0.985);

        if (uMode < 0.5) {
          float nebula = smoothstep(0.3, 0.92, clouds) * vignette;
          color = mix(uColorC * 0.42, uColorA, nebula);
          color += uColorB * ribbon * (0.9 + uAudio * 0.35);
          color += uRim * star * 0.58;
          alpha = (nebula * 0.46 + ribbon * 0.52 + star * 0.18) * vignette;
        } else if (uMode < 1.5) {
          float floorGlow = exp(-abs(p.y + 0.47) * 4.2) * smoothstep(1.04, 0.2, abs(p.x));
          color = uColorC * clouds * 0.22 + uColorA * stage + uColorB * floorGlow * (0.55 + uAudio * 0.35);
          color += uRim * star * 0.32;
          alpha = (stage * 0.78 + floorGlow * 0.34 + clouds * 0.12 + star * 0.12) * vignette;
        } else if (uMode < 2.5) {
          float smoke = smoothstep(0.36, 0.88, clouds + p.y * 0.18) * 0.42;
          color = uColorC * smoke + uColorA * burst * 0.75 + uColorB * (star * 0.65 + burst * 0.35);
          alpha = (smoke * 0.28 + burst * (0.66 + uAudio * 0.28) + star * 0.18) * vignette;
        } else {
          color = uRim * minimal * 0.36 + uColorA * fine * 0.035 + uRim * star * 0.16;
          alpha = (minimal * 0.28 + star * 0.08) * vignette;
        }

        gl_FragColor = vec4(color, alpha * uOpacity);
      }
    `,
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(38, 48, 24), material);
  mesh.position.set(0, 0, 0);
  mesh.renderOrder = -100;
  mesh.userData = {
    kind: "atmosphere",
    phase: hash(mode * 11.7) * TAU,
    drift: 0.018 + mode * 0.006,
  };
  materials.push({ material, opacity, mix: 0.5 });
  return mesh;
}

function createStarField(theme, count, innerRadius, outerRadius, zOffset, opacity, size, materials) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    const radius = innerRadius + hash(i * 1.17) * (outerRadius - innerRadius);
    const theta = hash(i * 2.13) * TAU;
    const y = (hash(i * 3.41) - 0.5) * 11;
    positions[i3] = Math.cos(theta) * radius;
    positions[i3 + 1] = y;
    positions[i3 + 2] = Math.sin(theta) * radius + zOffset;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: colorForRole(theme, "rim"),
    size,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  materials.push({ material, role: "rim", opacity });
  const points = new THREE.Points(geometry, material);
  points.userData = { kind: "stars", baseOpacity: opacity };
  return points;
}

function addAuroraCurtains(group, theme, materials) {
  for (let band = 0; band < 7; band += 1) {
    const points = [];
    const width = 8.5 + band * 0.6;
    const y = 1.0 + band * 0.23;
    const z = -5.8 - band * 0.72;
    for (let i = 0; i < 180; i += 1) {
      const t = i / 179;
      const x = -width / 2 + t * width;
      const wave = Math.sin(t * TAU * (1.1 + band * 0.18) + band * 0.9) * (0.18 + band * 0.025);
      points.push(new THREE.Vector3(x, y + wave, z + Math.sin(t * Math.PI) * 0.42));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: colorForRole(theme, band % 2 === 0 ? "haze" : "accent"),
      transparent: true,
      opacity: 0.006 + band * 0.0008,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const line = new THREE.Line(geometry, material);
    line.rotation.x = -0.22 + band * 0.018;
    line.rotation.z = (band - 3) * 0.035;
    line.userData = {
      kind: "auroraCurtain",
      baseOpacity: material.opacity,
      baseY: line.position.y,
      baseRotation: line.rotation.z,
      speed: 0.055 + band * 0.012,
      phase: band * 0.76,
    };
    group.add(line);
    materials.push({ material, role: band % 2 === 0 ? "haze" : "accent", opacity: material.opacity });
  }
}

function createSpiralGeometry(segments, startRadius, endRadius, phase) {
  const points = [];
  for (let i = 0; i < segments; i += 1) {
    const t = i / (segments - 1);
    const angle = phase + t * TAU * 1.8;
    const radius = startRadius + (endRadius - startRadius) * t;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle * 0.7) * 0.55, Math.sin(angle) * radius * 0.35));
  }
  return new THREE.BufferGeometry().setFromPoints(points);
}

function createEllipseGeometry(segments, width, height, y) {
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * TAU;
    points.push(new THREE.Vector3(Math.cos(angle) * width, y + Math.sin(angle) * height, Math.sin(angle) * 0.45));
  }
  return new THREE.BufferGeometry().setFromPoints(points);
}

function createRocketTrailGeometry(index) {
  const points = [];
  const x = (hash(index * 1.9) - 0.5) * 8.6;
  const drift = (hash(index * 4.2) - 0.5) * 0.8;
  for (let i = 0; i < 38; i += 1) {
    const t = i / 37;
    points.push(
      new THREE.Vector3(
        x + Math.sin(t * Math.PI * 1.4 + index) * 0.1 + drift * t,
        -2.3 + t * (2.1 + hash(index * 7.1) * 1.8),
        Math.sin(t * Math.PI + index) * 0.12,
      ),
    );
  }
  return new THREE.BufferGeometry().setFromPoints(points);
}

function colorForRole(theme, role, mix = 0.5) {
  const primary = new THREE.Color(theme.primary);
  const accent = new THREE.Color(theme.accent);
  const haze = new THREE.Color(theme.haze ?? theme.accent);
  const rim = new THREE.Color(theme.rim ?? "#ffffff");

  if (role === "primary") return primary;
  if (role === "accent") return accent;
  if (role === "haze") return haze.lerp(primary, 0.22 + mix * 0.22);
  if (role === "rim") return rim.lerp(accent, 0.16 + mix * 0.16);
  return primary.clone().lerp(accent, mix);
}

function normalizeAudio(audio) {
  if (typeof audio === "number") {
    return { level: audio, bass: audio, mid: audio * 0.6, treble: audio * 0.35, beat: 0, kick: 0 };
  }
  return {
    level: audio?.level ?? 0,
    bass: audio?.bass ?? 0,
    mid: audio?.mid ?? 0,
    treble: audio?.treble ?? 0,
    beat: audio?.beat ?? 0,
    kick: audio?.kick ?? 0,
  };
}

function modelFocusValue(model) {
  if (model === "saturn") return 0.95;
  if (model === "flower") return 0.72;
  if (model === "fireworks") return 1;
  if (model === "text") return 0.42;
  return 0.55;
}

function createGlowTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,0.95)");
  gradient.addColorStop(0.2, "rgba(255,255,255,0.26)");
  gradient.addColorStop(0.65, "rgba(255,255,255,0.055)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return canvasTexture(canvas);
}

function createCloudTexture() {
  const size = 384;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, size, size);
  for (let i = 0; i < 18; i += 1) {
    const x = size * (0.22 + hash(i * 1.7) * 0.56);
    const y = size * (0.24 + hash(i * 3.3) * 0.52);
    const radius = size * (0.16 + hash(i * 4.4) * 0.28);
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(255,255,255,${0.13 + hash(i * 6.1) * 0.12})`);
    gradient.addColorStop(0.48, `rgba(255,255,255,${0.04 + hash(i * 2.1) * 0.035})`);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  return canvasTexture(canvas);
}

function createBeamTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  const horizontal = context.createLinearGradient(0, 0, canvas.width, 0);
  horizontal.addColorStop(0, "rgba(255,255,255,0)");
  horizontal.addColorStop(0.5, "rgba(255,255,255,0.34)");
  horizontal.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = horizontal;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const vertical = context.createLinearGradient(0, 0, 0, canvas.height);
  vertical.addColorStop(0, "rgba(255,255,255,0)");
  vertical.addColorStop(0.24, "rgba(255,255,255,0.82)");
  vertical.addColorStop(1, "rgba(255,255,255,0)");
  context.globalCompositeOperation = "destination-in";
  context.fillStyle = vertical;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvasTexture(canvas);
}

function createSparkTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.16, "rgba(255,255,255,0.55)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return canvasTexture(canvas);
}

function canvasTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
