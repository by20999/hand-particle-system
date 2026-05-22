const TAU = Math.PI * 2;

export function writeShapeTargets(model, buffers) {
  const generators = {
    heart: heartPoint,
    flower: flowerPoint,
    saturn: saturnPoint,
    buddha: buddhaPoint,
    fireworks: fireworksPoint,
  };
  const generator = generators[model] ?? heartPoint;
  const { count, targets, randomness, colorMixes, brightnesses, targetRadii, targetDirX, targetDirY, targetDirZ } =
    buffers;

  for (let i = 0; i < count; i += 1) {
    const p = generator(i / count, randomness[i], i);
    const i3 = i * 3;
    targets[i3] = p.x;
    targets[i3 + 1] = p.y;
    targets[i3 + 2] = p.z;
    colorMixes[i] = p.mix ?? hash(i * 2.37);
    brightnesses[i] = p.glow ?? 1;

    const radius = Math.hypot(p.x, p.y, p.z) + 0.001;
    targetRadii[i] = radius;
    targetDirX[i] = p.x / radius;
    targetDirY[i] = p.y / radius;
    targetDirZ[i] = p.z / radius;
  }
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
    const p = heartCurvePoint(TAU * t);
    x = p.x * Math.sqrt(r);
    y = p.y * Math.sqrt(r);
  }

  const centerWeight = 1 - clamp(Math.hypot(x * 0.68, (y + 0.05) * 0.78), 0, 1);
  const topWeight = clamp(y + 0.18, 0, 1);
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
  const angle = t * TAU;
  const p = heartCurvePoint(angle);
  const topWeight = clamp(p.y + 0.18, 0, 1);
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
  const angle = t * TAU;
  const p = heartCurvePoint(angle);
  const drift = 1.04 + hash(i * 4.19) * 0.13;
  const topWeight = clamp(p.y + 0.18, 0, 1);
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
  const angle = local * TAU + layer * 0.42;
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

function saturnPoint(t, r, i) {
  if (t < 0.58) {
    const p = spherePoint(r, t / 0.58, i);
    return { x: p.x * 0.82, y: p.y * 0.82, z: p.z * 0.82, mix: 0.15 + r * 0.25 };
  }
  const angle = ((t - 0.58) / 0.42) * TAU;
  const radius = 1.08 + r * 0.62;
  const tiltY = Math.sin(angle) * radius * 0.22;
  return {
    x: Math.cos(angle) * radius,
    y: tiltY,
    z: Math.sin(angle) * radius * 0.58 + (hash(i * 12.41) - 0.5) * 0.05,
    mix: 0.72 + r * 0.28,
  };
}

function buddhaPoint(t, r, i) {
  if (t < 0.16) {
    const p = spherePoint(r, t / 0.16, i);
    return { x: p.x * 0.34, y: p.y * 0.34 + 0.72, z: p.z * 0.26, mix: 0.35 };
  }
  if (t < 0.42) {
    const p = spherePoint(r, (t - 0.16) / 0.26, i);
    return { x: p.x * 0.72, y: p.y * 0.62 - 0.03, z: p.z * 0.32, mix: 0.52 };
  }
  if (t < 0.72) {
    const side = t < 0.57 ? -1 : 1;
    const local = ((t - 0.42) / 0.3) * Math.PI;
    return {
      x: side * (0.25 + Math.sin(local) * 0.98 * Math.sqrt(r)),
      y: -0.58 + Math.cos(local) * 0.24 * r,
      z: (hash(i * 10.83) - 0.5) * 0.22,
      mix: 0.7,
    };
  }
  if (t < 0.9) {
    const angle = ((t - 0.72) / 0.18) * TAU;
    const radius = 0.62 + r * 0.18;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius + 0.54,
      z: -0.18,
      mix: 0.94,
    };
  }
  const angle = ((t - 0.9) / 0.1) * TAU;
  const radius = 0.45 + r * 0.74;
  return {
    x: Math.cos(angle) * radius,
    y: -0.92 + Math.sin(angle) * radius * 0.22,
    z: (hash(i * 8.19) - 0.5) * 0.18,
    mix: 0.82,
  };
}

function fireworksPoint(t, r, i) {
  const burst = Math.floor(t * 12);
  const local = (t * 12) % 1;
  const phi = Math.acos(2 * hash(i * 9.17) - 1);
  const theta = TAU * hash(i * 3.31 + burst);
  const radius = 0.18 + Math.sqrt(local) * (0.5 + hash(burst * 2.7) * 0.95);
  const centerAngle = (burst / 12) * TAU;
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

function spherePoint(r, t, i) {
  const phi = Math.acos(1 - 2 * r);
  const theta = TAU * t;
  const radius = Math.cbrt(hash(i * 1.97 + t * 8.13 + r * 3.31));
  return {
    x: radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta),
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function hash(value) {
  return Math.abs(Math.sin(value * 43758.5453)) % 1;
}
