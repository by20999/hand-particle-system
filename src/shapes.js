const TAU = Math.PI * 2;
const textPointCache = new Map();

const ROSE_OUTER_PETALS = [
  { angle: 2.95, length: 0.86, width: 0.22, baseX: -0.04, baseY: 0.1, z: 0.05, cup: 0.22, mix: 0.14 },
  { angle: 0.1, length: 0.94, width: 0.24, baseX: 0.02, baseY: 0.1, z: 0.03, cup: 0.24, mix: 0.2 },
  { angle: 2.32, length: 0.72, width: 0.2, baseX: -0.08, baseY: 0.18, z: 0.1, cup: 0.2, mix: 0.18 },
  { angle: 0.78, length: 0.72, width: 0.2, baseX: 0.08, baseY: 0.18, z: 0.1, cup: 0.2, mix: 0.22 },
  { angle: -2.32, length: 0.62, width: 0.18, baseX: -0.04, baseY: 0.02, z: -0.02, cup: 0.16, mix: 0.28 },
  { angle: -0.72, length: 0.7, width: 0.18, baseX: 0.05, baseY: 0.02, z: -0.02, cup: 0.16, mix: 0.3 },
  { angle: 1.58, length: 0.62, width: 0.18, baseX: 0.0, baseY: 0.16, z: 0.16, cup: 0.18, mix: 0.16 },
];

const ROSE_MID_PETALS = [
  { angle: 2.85, length: 0.5, width: 0.15, baseX: -0.03, baseY: 0.2, z: 0.18, cup: 0.16, mix: 0.12 },
  { angle: 0.25, length: 0.54, width: 0.16, baseX: 0.03, baseY: 0.2, z: 0.18, cup: 0.16, mix: 0.18 },
  { angle: 1.35, length: 0.48, width: 0.14, baseX: 0.02, baseY: 0.24, z: 0.24, cup: 0.2, mix: 0.1 },
  { angle: 2.08, length: 0.42, width: 0.13, baseX: -0.02, baseY: 0.24, z: 0.22, cup: 0.18, mix: 0.16 },
  { angle: 0.96, length: 0.42, width: 0.13, baseX: 0.04, baseY: 0.23, z: 0.2, cup: 0.18, mix: 0.2 },
];

const ROSE_PETALS = [
  { angle: 2.95, length: 1.08, width: 0.34, baseX: 0.1, baseY: 0.18, z: 0.03, cup: 0.25, curl: 0.23, mix: 0.03 },
  { angle: 0.18, length: 1.0, width: 0.35, baseX: 0.02, baseY: 0.16, z: 0.05, cup: 0.26, curl: 0.24, mix: 0.05 },
  { angle: 2.35, length: 0.78, width: 0.27, baseX: 0.02, baseY: 0.31, z: 0.16, cup: 0.24, curl: 0.18, mix: 0.08 },
  { angle: 0.78, length: 0.76, width: 0.26, baseX: 0.08, baseY: 0.31, z: 0.15, cup: 0.24, curl: 0.18, mix: 0.09 },
  { angle: -2.48, length: 0.66, width: 0.24, baseX: 0.02, baseY: 0.11, z: -0.01, cup: 0.2, curl: 0.17, mix: 0.1 },
  { angle: -0.68, length: 0.7, width: 0.23, baseX: 0.1, baseY: 0.1, z: 0.0, cup: 0.19, curl: 0.17, mix: 0.12 },
  { angle: 1.62, length: 0.66, width: 0.23, baseX: 0.06, baseY: 0.3, z: 0.23, cup: 0.28, curl: 0.16, mix: 0.06 },
  { angle: 2.86, length: 0.56, width: 0.18, baseX: 0.06, baseY: 0.36, z: 0.28, cup: 0.22, curl: 0.14, mix: 0.04 },
  { angle: 0.34, length: 0.56, width: 0.18, baseX: 0.06, baseY: 0.36, z: 0.3, cup: 0.22, curl: 0.14, mix: 0.07 },
  { angle: 1.18, length: 0.48, width: 0.16, baseX: 0.08, baseY: 0.39, z: 0.36, cup: 0.25, curl: 0.13, mix: 0.05 },
  { angle: 2.02, length: 0.44, width: 0.15, baseX: 0.04, baseY: 0.38, z: 0.35, cup: 0.24, curl: 0.13, mix: 0.08 },
];

const FIREWORK_CENTERS = [
  { x: -0.94, y: 0.58, z: -0.98, launchX: -1.58, launchZ: -0.34, scale: 0.74, hue: 0.08, depth: 1.12, tilt: 0.4 },
  { x: 0.94, y: 0.62, z: 0.92, launchX: 1.52, launchZ: 0.28, scale: 0.78, hue: 0.22, depth: 1.05, tilt: -0.7 },
  { x: -0.46, y: -0.08, z: 0.42, launchX: -0.92, launchZ: 0.78, scale: 0.56, hue: 0.48, depth: 0.92, tilt: 1.2 },
  { x: 0.5, y: -0.13, z: -0.52, launchX: 0.82, launchZ: -0.86, scale: 0.54, hue: 0.72, depth: 0.9, tilt: -1.45 },
  { x: 0.02, y: 0.28, z: 0.08, launchX: 0.04, launchZ: -0.18, scale: 0.58, hue: 0.9, depth: 0.78, tilt: 2.1 },
];

const CAKE_CANDLES = [
  { x: -0.42, z: -0.02, hue: 0.04 },
  { x: -0.2, z: 0.16, hue: 0.58 },
  { x: 0.02, z: -0.08, hue: 0.84 },
  { x: 0.24, z: 0.14, hue: 0.18 },
  { x: 0.46, z: -0.03, hue: 0.42 },
];

const BALLOON_CLUSTER = [
  { x: -0.92, y: 0.26, z: 0.03, scale: 0.5, mix: 0.04 },
  { x: -0.45, y: 0.58, z: -0.16, scale: 0.56, mix: 0.18 },
  { x: 0.0, y: 0.34, z: 0.1, scale: 0.62, mix: 0.36 },
  { x: 0.48, y: 0.62, z: -0.1, scale: 0.54, mix: 0.66 },
  { x: 0.92, y: 0.28, z: 0.08, scale: 0.5, mix: 0.86 },
];

export const TEXT_FONT_PRESETS = [
  {
    id: "modern",
    label: "现代黑体",
    weight: 620,
    stack: '"HarmonyOS Sans SC", "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif',
    scaleX: 1,
    tracking: 0,
  },
  {
    id: "serif",
    label: "优雅宋体",
    weight: 600,
    stack: '"Noto Serif SC", "Source Han Serif SC", "Songti SC", "SimSun", serif',
    scaleX: 0.94,
    tracking: 6,
    stroke: 2,
  },
  {
    id: "rounded",
    label: "柔和圆体",
    weight: 620,
    stack: '"Alibaba PuHuiTi", "YouYuan", "Microsoft YaHei UI", "PingFang SC", sans-serif',
    scaleX: 1.04,
    tracking: 3,
  },
  {
    id: "cinema",
    label: "电影标题",
    weight: 760,
    stack: '"Impact", "Arial Black", "Microsoft YaHei", sans-serif',
    scaleX: 1.14,
    tracking: 4,
    skew: -0.08,
  },
  {
    id: "bubble",
    label: "圆润泡泡",
    weight: 820,
    stack: '"汉仪乐喵体简", "HYLeMiaoTiJ", "YouYuan", "Arial Rounded MT Bold", "Microsoft YaHei UI", "PingFang SC", sans-serif',
    scaleX: 1.12,
    tracking: 8,
    stroke: 10,
    baselineWave: 4,
  },
  {
    id: "comic",
    label: "俏皮动漫",
    weight: 820,
    stack: '"汉仪乐喵体简", "HYLeMiaoTiJ", "Comic Sans MS", "Marker Felt", "YouYuan", "Microsoft YaHei UI", cursive',
    scaleX: 1.16,
    tracking: 12,
    wobble: 0.28,
    baselineWave: 14,
    stroke: 5,
    dotScale: 1.25,
  },
  {
    id: "candy",
    label: "糖果手写",
    weight: 720,
    stack: '"汉仪小麦体简", "HYXiaoMaiTiJ", "Comic Sans MS", "Segoe Print", "Bradley Hand ITC", "YouYuan", cursive',
    scaleX: 1.04,
    tracking: 10,
    wobble: -0.2,
    baselineWave: 10,
    skew: -0.16,
    stroke: 2,
  },
  {
    id: "wheat",
    label: "小麦手写",
    weight: 680,
    stack: '"汉仪小麦体简", "HYXiaoMaiTiJ", "方正苏新诗柳楷简体", "FZSuXinShiLiuKaiS-R-GB", "KaiTi", cursive',
    scaleX: 0.98,
    tracking: 9,
    wobble: -0.1,
    baselineWave: 7,
    skew: -0.08,
    stroke: 1.5,
  },
  {
    id: "meow",
    label: "乐喵圆体",
    weight: 820,
    stack: '"汉仪乐喵体简", "HYLeMiaoTiJ", "站酷快乐体", "ZCOOL KuaiLe", "YouYuan", "Microsoft YaHei UI", sans-serif',
    scaleX: 1.18,
    tracking: 12,
    wobble: 0.24,
    baselineWave: 12,
    stroke: 8,
    dotScale: 1.45,
  },
  {
    id: "yan",
    label: "书坊颜体",
    weight: 760,
    stack: '"书体坊颜体", "STFangsong", "FangSong", "KaiTi", serif',
    scaleX: 1.02,
    tracking: 8,
    wobble: 0.08,
    baselineWave: 5,
    stroke: 2,
  },
];

export function writeShapeTargets(model, buffers) {
  const generators = {
    heart: heartPoint,
    flower: rosePoint,
    saturn: saturnPoint,
    fireworks: fireworksPoint,
    ring: ringPoint,
    cake: cakePoint,
    balloons: balloonsPoint,
  };
  const generator = generators[model] ?? heartPoint;
  const {
    count,
    targets,
    randomness,
    colorMixes,
    brightnesses,
    targetRadii,
    targetDirX,
    targetDirY,
    targetDirZ,
    targetKinds,
  } = buffers;

  for (let i = 0; i < count; i += 1) {
    const p = generator(i / count, randomness[i], i);
    const i3 = i * 3;
    targets[i3] = p.x;
    targets[i3 + 1] = p.y;
    targets[i3 + 2] = p.z;
    colorMixes[i] = p.mix ?? hash(i * 2.37);
    brightnesses[i] = p.glow ?? 1;
    if (targetKinds) {
      targetKinds[i] = p.kind ?? 0;
    }

    const dirX = p.dirX ?? p.x;
    const dirY = p.dirY ?? p.y;
    const dirZ = p.dirZ ?? p.z;
    const radius = Math.hypot(dirX, dirY, dirZ) + 0.001;
    targetRadii[i] = radius;
    targetDirX[i] = dirX / radius;
    targetDirY[i] = dirY / radius;
    targetDirZ[i] = dirZ / radius;
  }
}

export function writeTextTargets(text, buffers, fontId = "modern") {
  const normalized = normalizeText(text);
  const points = getTextPoints(normalized, fontId);
  const { count, targets, colorMixes, brightnesses, targetRadii, targetDirX, targetDirY, targetDirZ, targetKinds } =
    buffers;

  for (let i = 0; i < count; i += 1) {
    const point = points[Math.floor(hash(i * 11.31) * points.length)] ?? { x: 0, y: 0, alpha: 1 };
    const jitter = 0.0035 + (1 - point.alpha) * 0.005;
    const x = point.x + (hash(i * 3.71) - 0.5) * jitter;
    const y = point.y + (hash(i * 4.91) - 0.5) * jitter;
    const z = (hash(i * 7.43) - 0.5) * (0.045 + point.alpha * 0.055);
    const i3 = i * 3;

    targets[i3] = x;
    targets[i3 + 1] = y;
    targets[i3 + 2] = z;
    colorMixes[i] = 0.2 + point.alpha * 0.3 + hash(i * 2.17) * 0.14;
    brightnesses[i] = 0.46 + point.alpha * 0.28 + hash(i * 1.91) * 0.08;
    if (targetKinds) {
      targetKinds[i] = 0;
    }

    const radius = Math.hypot(x, y, z) + 0.001;
    targetRadii[i] = radius;
    targetDirX[i] = x / radius;
    targetDirY[i] = y / radius;
    targetDirZ[i] = z / radius;
  }
}

export function writePointCloudTargets(points, buffers, limit = buffers.count) {
  const safePoints = Array.isArray(points) && points.length > 0 ? points : [{ x: 0, y: 0, z: 0, mix: 0.4, glow: 1 }];
  const { count, targets, colorMixes, particleColors, brightnesses, targetRadii, targetDirX, targetDirY, targetDirZ, targetKinds } =
    buffers;
  const writeCount = Math.max(1, Math.min(count, Math.round(limit)));

  for (let i = 0; i < writeCount; i += 1) {
    const pointIndex =
      safePoints.length >= writeCount
        ? Math.min(safePoints.length - 1, Math.floor(((i + hash(i * 4.19)) / writeCount) * safePoints.length))
        : Math.floor(hash(i * 11.31) * safePoints.length);
    const point = safePoints[pointIndex] ?? safePoints[0];
    const jitter = point.jitter ?? 0.006;
    const x = point.x + (hash(i * 3.71) - 0.5) * jitter;
    const y = point.y + (hash(i * 4.91) - 0.5) * jitter;
    const z = (point.z ?? 0) + (hash(i * 7.43) - 0.5) * jitter * 1.6;
    const i3 = i * 3;

    targets[i3] = x;
    targets[i3 + 1] = y;
    targets[i3 + 2] = z;
    colorMixes[i] = point.mix ?? (0.2 + hash(i * 2.17) * 0.42);
    if (particleColors) {
      const i4 = i * 4;
      particleColors[i4] = point.r ?? 1;
      particleColors[i4 + 1] = point.g ?? 1;
      particleColors[i4 + 2] = point.b ?? 1;
      particleColors[i4 + 3] = point.a ?? 1;
    }
    brightnesses[i] = point.glow ?? (0.62 + hash(i * 1.91) * 0.28);
    if (targetKinds) {
      targetKinds[i] = point.kind ?? 0;
    }

    const radius = Math.hypot(x, y, z) + 0.001;
    targetRadii[i] = radius;
    targetDirX[i] = x / radius;
    targetDirY[i] = y / radius;
    targetDirZ[i] = z / radius;
  }
}

function normalizeText(text) {
  const trimmed = String(text ?? "").trim();
  return trimmed.length > 0 ? trimmed.slice(0, 18) : "LOVE";
}

function getTextPoints(text, fontId) {
  const preset = getTextFontPreset(fontId);
  const cacheKey = `${preset.id}:${text}`;
  if (textPointCache.has(cacheKey)) {
    return textPointCache.get(cacheKey);
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1400;
  canvas.height = 440;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.textBaseline = "middle";

  const lines = wrapText(context, text, preset);
  const fontSize = lines.length > 1 ? 124 : 158;
  context.font = `${preset.weight} ${fontSize}px ${preset.stack}`;
  context.lineJoin = "round";
  context.lineCap = "round";
  const lineHeight = fontSize * 1.05;
  const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;

  for (let i = 0; i < lines.length; i += 1) {
    drawTextLine(context, lines[i], canvas.width / 2, startY + i * lineHeight, preset, fontSize, i);
  }

  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const raw = [];
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < canvas.height; y += 2) {
    for (let x = 0; x < canvas.width; x += 2) {
      const alpha = image.data[(y * canvas.width + x) * 4 + 3] / 255;
      if (alpha <= 0.18) continue;
      raw.push({ x, y, alpha });
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (raw.length === 0) {
    return [{ x: 0, y: 0, alpha: 1 }];
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const maxDim = Math.max(maxX - minX, maxY - minY, 1);
  const points = raw.map((point) => ({
    x: ((point.x - centerX) / maxDim) * 2.58,
    y: -((point.y - centerY) / maxDim) * 2.58,
    alpha: point.alpha,
  }));

  textPointCache.set(cacheKey, points);
  return points;
}

function wrapText(context, text, preset) {
  context.font = `${preset.weight} 126px ${preset.stack}`;
  if (context.measureText(text).width <= 1120 || text.length <= 8) {
    return [text];
  }

  const splitAt = Math.ceil(text.length / 2);
  return [text.slice(0, splitAt), text.slice(splitAt)];
}

function drawTextLine(context, line, centerX, centerY, preset, fontSize, lineIndex) {
  const chars = [...line];
  const tracking = preset.tracking ?? 0;
  const skew = preset.skew ?? 0;

  if (!preset.wobble && !tracking && !skew && !preset.stroke && (preset.scaleX ?? 1) === 1) {
    context.fillText(line, centerX, centerY);
    return;
  }

  context.save();
  context.translate(centerX, centerY);
  context.transform(preset.scaleX ?? 1, 0, skew, 1, 0, 0);
  context.font = `${preset.weight} ${fontSize}px ${preset.stack}`;

  const widths = chars.map((char) => context.measureText(char).width);
  const totalWidth = widths.reduce((total, width) => total + width, 0) + tracking * Math.max(0, chars.length - 1);
  let cursor = -totalWidth / 2;

  for (let i = 0; i < chars.length; i += 1) {
    const char = chars[i];
    const width = widths[i];
    const x = cursor + width / 2;
    const wave = preset.baselineWave ? Math.sin(i * 1.18 + lineIndex * 0.7) * preset.baselineWave : 0;
    const rotation = preset.wobble ? Math.sin(i * 1.7 + lineIndex) * preset.wobble : 0;
    context.save();
    context.translate(x, wave);
    context.rotate(rotation);
    if (preset.stroke) {
      context.strokeStyle = "#ffffff";
      context.lineWidth = preset.stroke;
      context.strokeText(char, 0, 0);
    }
    context.fillText(char, 0, 0);
    if (preset.dotScale && hash(char.charCodeAt(0) * 0.37 + i) > 0.62) {
      context.beginPath();
      context.arc(width * 0.22, -fontSize * 0.34, preset.dotScale * 5.2, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
    cursor += width + tracking;
  }

  context.restore();
}

function getTextFontPreset(fontId) {
  return TEXT_FONT_PRESETS.find((preset) => preset.id === fontId) ?? TEXT_FONT_PRESETS[0];
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

function ringPoint(t, r, i) {
  const type = hash(i * 0.41);
  if (type < 0.7) {
    const angle = TAU * hash(i * 5.17);
    const tube = TAU * hash(i * 9.83);
    const major = 0.82 + Math.sin(angle * 2.0) * 0.025;
    const minor = 0.075 + hash(i * 4.1) * 0.038;
    const rim = major + Math.cos(tube) * minor;
    const yOval = 0.68;
    const tilt = -0.16;
    const rawY = Math.sin(angle) * yOval + Math.sin(tube) * minor * 0.44 - 0.18;
    const rawZ = Math.sin(tube) * minor * 0.95 + Math.sin(angle) * 0.08;
    return {
      x: Math.cos(angle) * rim,
      y: rawY * Math.cos(tilt) - rawZ * Math.sin(tilt),
      z: rawY * Math.sin(tilt) + rawZ * Math.cos(tilt),
      mix: 0.58 + hash(i * 1.91) * 0.2,
      glow: 0.58 + Math.max(0, Math.cos(tube)) * 0.1,
      kind: 0,
      dirX: Math.cos(angle) * 0.96,
      dirY: Math.sin(angle) * 0.72,
      dirZ: rawZ,
    };
  }

  if (type < 0.84) {
    const facet = Math.floor(hash(i * 2.91) * 8);
    const u = hash(i * 3.83) ** 0.58;
    const v = (hash(i * 6.27) - 0.5) * 2;
    const angle = (facet / 8) * TAU + v * 0.18;
    const crown = type < 0.68;
    const radius = (crown ? 0.22 : 0.14) * (1 - u * 0.32) * (0.72 + Math.abs(v) * 0.28);
    const y = 0.42 + u * (crown ? 0.34 : -0.2) + Math.abs(v) * 0.03;
    return {
      x: Math.cos(angle) * radius,
      y,
      z: Math.sin(angle) * radius * 0.72,
      mix: 0.08 + hash(i * 1.7) * 0.16,
      glow: 0.5 + (1 - u) * 0.16,
      kind: 1,
      dirX: Math.cos(angle) * (0.28 + u * 0.42),
      dirY: 0.42 + u * 0.3,
      dirZ: Math.sin(angle) * 0.36,
    };
  }

  const sparkleAngle = TAU * hash(i * 3.17);
  const radius = 0.42 + hash(i * 4.31) * 0.72;
  const height = 0.1 + hash(i * 7.61) * 0.72;
  return {
    x: Math.cos(sparkleAngle) * radius,
    y: 0.18 + height,
    z: Math.sin(sparkleAngle) * radius * 0.5 + (hash(i * 9.9) - 0.5) * 0.18,
    mix: 0.12 + hash(i * 5.4) * 0.12,
    glow: 0.32 + hash(i * 8.1) * 0.42,
    kind: 2,
    dirX: Math.cos(sparkleAngle) * 0.75,
    dirY: 0.68 + hash(i * 2.8) * 0.42,
    dirZ: Math.sin(sparkleAngle) * 0.55,
  };
}

function cakePoint(t, r, i) {
  const type = hash(i * 0.57);
  if (type < 0.5) {
    const layer = Math.floor(hash(i * 2.11) * 3);
    const yBase = [-0.62, -0.26, 0.06][layer];
    const height = [0.32, 0.28, 0.24][layer];
    const radiusX = [1.08, 0.86, 0.64][layer];
    const radiusZ = [0.48, 0.39, 0.31][layer];
    const angle = TAU * hash(i * 4.61);
    const radius = Math.sqrt(hash(i * 3.83));
    const side = smoothstep(0.62, 1, radius);
    const sprinkle = hash(i * 12.9) > 0.94;
    return {
      x: Math.cos(angle) * radiusX * radius,
      y: yBase + hash(i * 5.37) * height + Math.sin(angle * 7 + layer) * side * 0.018,
      z: Math.sin(angle) * radiusZ * radius,
      mix: sprinkle ? hash(i * 6.4) : 0.14 + layer * 0.08 + hash(i * 1.7) * 0.12,
      glow: sprinkle ? 1.08 : 0.52 + side * 0.14,
      kind: sprinkle ? 2 : 0,
    };
  }

  if (type < 0.62) {
    const layer = Math.floor(hash(i * 2.61) * 3);
    const angle = TAU * hash(i * 4.91);
    const radiusX = [1.1, 0.88, 0.66][layer];
    const radiusZ = [0.5, 0.41, 0.33][layer];
    const y = [-0.28, 0.04, 0.3][layer] + Math.sin(angle * 8 + layer) * 0.035;
    const drip = hash(i * 7.2) > 0.72 ? hash(i * 9.1) * 0.18 : 0;
    return {
      x: Math.cos(angle) * radiusX * (0.96 + hash(i * 3.2) * 0.06),
      y: y - drip,
      z: Math.sin(angle) * radiusZ * (0.96 + hash(i * 5.2) * 0.06),
      mix: 0.05 + hash(i * 1.9) * 0.08,
      glow: 0.58 + drip * 0.32,
      kind: 1,
      dirX: Math.cos(angle) * 0.82,
      dirY: -0.08 - drip,
      dirZ: Math.sin(angle) * 0.42,
    };
  }

  if (type < 0.78) {
    const candle = CAKE_CANDLES[Math.floor(hash(i * 1.13) * CAKE_CANDLES.length)] ?? CAKE_CANDLES[0];
    const angle = TAU * hash(i * 5.41);
    const radius = 0.035 + hash(i * 7.23) * 0.02;
    const stripe = Math.sin(hash(i * 3.7) * 16) > 0;
    return {
      x: candle.x + Math.cos(angle) * radius,
      y: 0.34 + hash(i * 2.91) * 0.46,
      z: candle.z + Math.sin(angle) * radius * 0.82,
      mix: stripe ? candle.hue : 0.04,
      glow: 0.54,
      kind: 2,
      dirX: Math.cos(angle) * 0.08,
      dirY: 0.54,
      dirZ: Math.sin(angle) * 0.08,
    };
  }

  if (type < 0.87) {
    const candle = CAKE_CANDLES[Math.floor(hash(i * 1.19) * CAKE_CANDLES.length)] ?? CAKE_CANDLES[0];
    const angle = TAU * hash(i * 5.73);
    const u = hash(i * 3.87) ** 0.48;
    const radius = Math.sin(u * Math.PI) * (0.05 + hash(i * 4.2) * 0.035);
    return {
      x: candle.x + Math.cos(angle) * radius,
      y: 0.82 + u * 0.32,
      z: candle.z + Math.sin(angle) * radius * 0.55,
      mix: 0.24 + hash(i * 7.1) * 0.12,
      glow: 0.92 + (1 - u) * 0.2,
      kind: 3,
      dirX: Math.cos(angle) * 0.18,
      dirY: 0.86,
      dirZ: Math.sin(angle) * 0.12,
    };
  }

  const angle = TAU * hash(i * 8.13);
  const radius = 0.4 + hash(i * 2.43) * 1.08;
  return {
    x: Math.cos(angle) * radius,
    y: -0.1 + hash(i * 6.17) * 1.36,
    z: Math.sin(angle) * radius * 0.42,
    mix: hash(i * 4.7),
    glow: 0.38 + hash(i * 3.1) * 0.42,
    kind: 4,
    dirX: Math.cos(angle) * 0.9,
    dirY: 0.7 + hash(i * 7.2) * 0.44,
    dirZ: Math.sin(angle) * 0.48,
  };
}

function balloonsPoint(t, r, i) {
  const type = hash(i * 0.63);
  if (type < 0.76) {
    const balloon = BALLOON_CLUSTER[Math.floor(hash(i * 1.31) * BALLOON_CLUSTER.length)] ?? BALLOON_CLUSTER[0];
    const p = spherePoint(hash(i * 5.17), hash(i * 7.41), i);
    const squash = 1 + Math.max(0, p.y) * 0.22;
    return {
      x: balloon.x + p.x * balloon.scale * 0.7,
      y: balloon.y + p.y * balloon.scale * squash,
      z: balloon.z + p.z * balloon.scale * 0.48,
      mix: balloon.mix + hash(i * 2.7) * 0.08,
      glow: 0.68 + Math.max(0, p.y) * 0.18,
      kind: 0,
      dirX: p.x * 0.86,
      dirY: p.y * 1.1,
      dirZ: p.z * 0.54,
    };
  }

  if (type < 0.9) {
    const balloon = BALLOON_CLUSTER[Math.floor(hash(i * 1.71) * BALLOON_CLUSTER.length)] ?? BALLOON_CLUSTER[0];
    const u = hash(i * 4.11);
    const wave = Math.sin(u * Math.PI * 4 + balloon.x * 2) * 0.045;
    return {
      x: balloon.x * (1 - u * 0.35) + wave,
      y: balloon.y - balloon.scale * 0.48 - u * 1.1,
      z: balloon.z * (1 - u * 0.3) + Math.sin(u * Math.PI * 3) * 0.035,
      mix: 0.04,
      glow: 0.32,
      kind: 1,
      dirX: wave,
      dirY: -0.72,
      dirZ: 0,
    };
  }

  const angle = TAU * hash(i * 3.9);
  const radius = 0.35 + hash(i * 6.3) * 1.2;
  return {
    x: Math.cos(angle) * radius,
    y: -0.92 + hash(i * 5.8) * 2.16,
    z: Math.sin(angle) * radius * 0.46,
    mix: hash(i * 8.7),
    glow: 0.38 + hash(i * 4.2) * 0.5,
    kind: 2,
    dirX: Math.cos(angle) * 0.82,
    dirY: 0.6 + hash(i * 1.8) * 0.72,
    dirZ: Math.sin(angle) * 0.48,
  };
}

function rosePoint(t, r, i) {
  if (t < 0.07) {
    return roseStemPoint(t / 0.07, i);
  }

  if (t < 0.12) {
    return roseLeafPoint((t - 0.07) / 0.05, i);
  }

  if (t < 0.19) {
    return roseSepalPoint((t - 0.12) / 0.07, i);
  }

  const petalPick = hash(i * 0.83);
  const petalLocal = hash(i * 1.37 + t * 9.7);
  if (petalPick < 0.32) {
    return roseGuardPetal(petalLocal, r, i, petalPick > 0.2);
  }

  if (petalPick < 0.63) {
    return rosePetal3D(0, petalLocal, r, i, petalPick > 0.54);
  }

  if (petalPick < 0.83) {
    return rosePetal3D(1, petalLocal, r, i, petalPick > 0.76);
  }

  if (petalPick < 0.96) {
    return rosePetal3D(2, petalLocal, r, i, petalPick > 0.9);
  }

  return roseInnerWhorl(petalLocal, r, i);
}

function roseStemPoint(stemT, i) {
  const bend = Math.sin(stemT * Math.PI * 0.82) * 0.08 - stemT * 0.04;
  const angle = hash(i * 13.7) * TAU;
  const radius = 0.016 + hash(i * 8.1) * 0.024;
  return {
    x: bend + Math.cos(angle) * radius,
    y: -1.34 + stemT * 1.05,
    z: -0.03 + Math.sin(angle) * radius,
    mix: 1.55 + hash(i * 2.1) * 0.16,
    glow: 0.18,
    kind: 3,
    dirX: bend * 0.8,
    dirY: -0.48,
    dirZ: -0.02,
  };
}

function roseLeafPoint(local, i) {
  const side = Math.floor(local * 4) % 2 === 0 ? -1 : 1;
  const u = hash(i * 4.73) ** 0.66;
  const v = (hash(i * 7.17) - 0.5) * 2;
  const baseY = -0.92 + hash(i * 1.61) * 0.28;
  const angle = (side < 0 ? 2.46 : 0.68) + (hash(i * 2.8) - 0.5) * 0.18;
  const axisX = Math.cos(angle);
  const axisZ = Math.sin(angle);
  const normalX = -axisZ;
  const normalZ = axisX;
  const width = 0.12 * Math.sin(u * Math.PI) * (1 - u * 0.15);
  const x = side * 0.03 + axisX * u * 0.52 + normalX * v * width;
  const y = baseY + u * 0.18 + Math.abs(v) * width * 0.18;
  const z = -0.03 + axisZ * u * 0.28 + normalZ * v * width;
  const vein = Math.abs(v) < 0.14 ? 0.13 : 0;

  return {
    x,
    y,
    z,
    mix: 1.42 + vein + hash(i * 6.31) * 0.14,
    glow: 0.2 + vein * 0.2,
    kind: 3,
    dirX: side * 0.42,
    dirY: 0.08,
    dirZ: -0.02,
  };
}

function roseSepalPoint(local, i) {
  const sepal = Math.floor(local * 9);
  const u = hash(i * 3.11) ** 0.72;
  const v = (hash(i * 3.9) - 0.5) * 2;
  const angle = (sepal / 9) * TAU + (hash(sepal * 1.7) - 0.5) * 0.16;
  const length = 0.32 + hash(sepal * 2.7) * 0.22;
  const width = (0.026 + hash(i * 4.2) * 0.028) * Math.sin(u * Math.PI);
  const radius = 0.13 + u * length;
  const droop = u * u * 0.24;

  return {
    x: Math.cos(angle) * radius - Math.sin(angle) * v * width,
    y: -0.23 - droop + Math.abs(v) * width * 0.18,
    z: Math.sin(angle) * radius + Math.cos(angle) * v * width,
    mix: 1.5 + hash(i * 4.11) * 0.16,
    glow: 0.24,
    kind: 3,
    dirX: Math.cos(angle) * 0.38,
    dirY: -0.24,
    dirZ: Math.sin(angle) * 0.38,
  };
}

function roseGuardPetal(local, r, i, rimOnly) {
  const petalCount = 8;
  const petalIndex = Math.floor(hash(i * 2.43 + local * 5.1) * petalCount);
  const petalBias = hash(petalIndex * 8.71);
  const baseAngle =
    (petalIndex / petalCount) * TAU +
    (hash(petalIndex * 6.7) - 0.5) * 0.48 +
    Math.sin(petalIndex * 1.63) * 0.08;
  const u = rimOnly ? hash(i * 3.37) ** 0.54 : hash(i * 4.17 + local * 2.9) ** 0.74;
  const side = hash(i * 5.31) > 0.5 ? 1 : -1;
  const v = rimOnly ? side * (0.7 + hash(i * 4.89) * 0.3) : (hash(i * 7.43) - 0.5) * 2;
  const edge = Math.abs(v);
  const tip = smoothstep(0.48, 1, u);
  const petalLength = 0.62 + petalBias * 0.22;
  const petalWidth = 0.26 + hash(petalIndex * 3.19) * 0.1;
  const width = petalWidth * Math.sin(u * Math.PI) ** 0.52 * (1.18 - u * 0.18);
  const foldedSide = Math.sin(petalIndex * 2.11) * 0.18 + side * tip * edge * 0.12;
  const theta = baseAngle + v * (0.42 + petalBias * 0.22) * Math.sin(u * Math.PI) ** 0.7 + tip * foldedSide;
  const radius = 0.14 + u * petalLength + edge * edge * (0.06 + tip * 0.18) + Math.sin(u * Math.PI * 2.3 + petalIndex) * 0.018;
  const cup = (1 - edge * 0.36) * Math.sin(u * Math.PI) * (0.2 + petalBias * 0.1);
  const rolledRim = edge ** 2 * (0.08 + tip * (0.28 + petalBias * 0.14));
  const droop = u * u * (0.32 + hash(petalIndex * 9.13) * 0.18);
  const y =
    -0.26 +
    u * (0.42 + petalBias * 0.14) -
    droop +
    cup +
    rolledRim +
    (hash(petalIndex * 4.1 + i * 0.02) - 0.5) * 0.2;
  const x = Math.cos(theta) * radius;
  const z = Math.sin(theta) * radius;
  const vein =
    Math.sin((v + 1) * Math.PI * 10 + u * 13) * 0.014 * (1 - edge) * (1 - u * 0.18) +
    Math.sin(u * 38 + petalIndex * 1.7) * 0.01 * (1 - edge * 0.5);
  const lopsided = Math.sin(u * Math.PI) * (hash(petalIndex * 5.9) - 0.5) * 0.08;

  return {
    x: x + Math.cos(theta + Math.PI / 2) * lopsided,
    y: y + vein,
    z: z + Math.sin(theta + Math.PI / 2) * lopsided,
    mix: 0.01 + hash(i * 2.17) * 0.055 + (rimOnly ? 0.05 : 0),
    glow: 0.42 + tip * 0.2 + (rimOnly ? 0.54 : 0),
    kind: rimOnly ? 1 : 0,
    dirX: Math.cos(theta) * (0.62 + u * 0.86),
    dirY: -0.04 + u * 0.22,
    dirZ: Math.sin(theta) * (0.62 + u * 0.86),
  };
}

function rosePetal3D(layer, local, r, i, rimOnly) {
  const layerConfig = [
    { petals: 14, radius: 0.09, length: 0.62, width: 0.25, y: -0.18, lift: 0.58, droop: 0.3, curl: 0.36, spread: 0.5 },
    { petals: 16, radius: 0.05, length: 0.5, width: 0.2, y: -0.03, lift: 0.58, droop: 0.14, curl: 0.38, spread: 0.58 },
    { petals: 13, radius: 0.02, length: 0.34, width: 0.13, y: 0.11, lift: 0.54, droop: 0.04, curl: 0.56, spread: 0.74 },
  ][layer];
  const petalIndex = Math.floor(local * layerConfig.petals);
  const petalLocal = (local * layerConfig.petals) % 1;
  const petalRand = hash(petalIndex * 19.23 + layer * 7.61);
  const petalRandB = hash(petalIndex * 5.77 + layer * 11.3);
  const petalRandC = hash(petalIndex * 13.37 + layer * 3.8);
  const petalLength = layerConfig.length * (0.88 + petalRand * 0.28);
  const petalWidth = layerConfig.width * (0.84 + petalRandB * 0.34);
  const petalLift = layerConfig.lift * (0.9 + petalRandC * 0.22);
  const petalDroop = layerConfig.droop * (0.72 + petalRand * 0.62);
  const petalCurl = layerConfig.curl * (0.82 + petalRandB * 0.42);
  const baseAngle =
    (petalIndex / layerConfig.petals) * TAU +
    layer * 0.58 +
    (hash(petalIndex * 3.71 + layer * 12.4) - 0.5) * 0.42 +
    Math.sin(petalIndex * 1.41 + layer) * 0.08;
  const u = rimOnly ? hash(i * 3.37) ** 0.54 : hash(i * 4.17 + petalLocal) ** 0.7;
  const edgeSide = hash(i * 5.31) > 0.5 ? 1 : -1;
  const v = rimOnly ? edgeSide * (0.72 + hash(i * 4.89) * 0.28) : (hash(i * 7.43) - 0.5) * 2;
  const edge = Math.abs(v);
  const tip = smoothstep(0.55, 1, u);
  const width = petalWidth * Math.sin(u * Math.PI) ** 0.55 * (1.1 - u * 0.18);
  const twist =
    (layer === 2 ? u * (0.9 + petalRand * 0.58) : Math.sin(u * Math.PI) * (0.12 + petalRandB * 0.2)) +
    Math.sin(u * Math.PI * 2.4 + petalIndex) * 0.045;
  const theta = baseAngle + v * layerConfig.spread * (0.86 + petalRandC * 0.28) * Math.sin(u * Math.PI) ** 0.72 + twist;
  const radius =
    layerConfig.radius +
    u * petalLength +
    edge * edge * petalCurl * (0.08 + tip * 0.32) -
    layer * 0.012;
  const cup = (1 - edge * 0.43) * Math.sin(u * Math.PI) * (0.16 + layer * 0.075 + petalRand * 0.07);
  const edgeCurl = edge ** 2 * petalCurl * (0.09 + tip * (0.28 + petalRandC * 0.12));
  const vein =
    Math.sin((v + 1) * Math.PI * 9 + u * 11 + hash(i * 0.27)) * 0.014 * (1 - edge) * (1 - u * 0.25) +
    Math.sin(u * 42 + v * 3.6 + petalIndex) * 0.009 * (1 - edge * 0.55);
  const layerBlend = (hash(i * 10.7 + petalIndex * 0.43) - 0.5) * (0.24 - layer * 0.045);
  const y =
    layerConfig.y +
    (petalRand - 0.5) * (0.13 - layer * 0.018) +
    layerBlend +
    u * petalLift -
    u * u * petalDroop +
    cup +
    edgeCurl +
    vein;
  const x = Math.cos(theta) * radius;
  const z = Math.sin(theta) * radius;
  const rimBoost = rimOnly ? 0.42 : 0;
  const lopsided = Math.sin(u * Math.PI) * (petalRandB - 0.5) * (0.07 - layer * 0.012);

  return {
    x: x + Math.cos(theta + Math.PI / 2) * lopsided,
    y,
    z: z + Math.sin(theta + Math.PI / 2) * lopsided,
    mix: 0.02 + layer * 0.05 + hash(i * 2.17) * 0.06 + rimBoost * 0.08,
    glow: (rimOnly ? 0.62 : 0.36) + (1 - u) * 0.08 + tip * 0.12 + rimBoost,
    kind: rimOnly ? 1 : 0,
    dirX: Math.cos(theta) * (0.45 + u * 0.75),
    dirY: 0.14 + u * 0.18,
    dirZ: Math.sin(theta) * (0.45 + u * 0.75),
  };
}

function roseInnerWhorl(local, r, i) {
  const band = Math.floor(local * 6);
  const u = hash(i * 4.37) ** 0.62;
  const side = hash(i * 5.9) > 0.5 ? 1 : -1;
  const v = side * (0.42 + hash(i * 8.3) * 0.58);
  const angle = band * 0.78 + u * TAU * (0.62 + band * 0.07) + v * 0.42;
  const radius = 0.025 + u * (0.12 + band * 0.015) + Math.abs(v) * 0.018;
  const curl = smoothstep(0.32, 1, u);
  const x = Math.cos(angle) * radius;
  const y = 0.35 + band * 0.035 + u * 0.18 + curl * 0.08;
  const z = Math.sin(angle) * radius;

  return {
    x,
    y,
    z,
    mix: 0.02 + hash(i * 2.31) * 0.05,
    glow: 0.62 + curl * 0.18,
    kind: 1,
    dirX: Math.cos(angle) * 0.34,
    dirY: Math.sin(angle) * 0.22,
    dirZ: 0.48,
  };
}

function saturnPoint(t, r, i) {
  if (t < 0.48) {
    const p = spherePoint(r, t / 0.48, i);
    const band = 0.5 + 0.5 * Math.sin((p.y * 6.8 + hash(i * 0.33)) * Math.PI);
    return {
      x: p.x * 0.82,
      y: p.y * 0.68,
      z: p.z * 0.82,
      mix: 0.12 + band * 0.22 + hash(i * 1.73) * 0.06,
      glow: 0.72 + band * 0.2,
    };
  }

  const ringT = (t - 0.48) / 0.52;
  const bandIndex = Math.floor(ringT * 6);
  const local = (ringT * 6) % 1;
  const angle = hash(i * 5.17) * TAU;
  const gap = bandIndex === 2 ? 0.13 : 0;
  const radius = 1.05 + bandIndex * 0.16 + local * (0.15 + gap) + r * 0.05;
  const thickness = (hash(i * 8.23) - 0.5) * (0.035 + bandIndex * 0.005);
  const tilt = -0.36;
  const rawY = Math.sin(angle) * radius * 0.16 + thickness;
  const rawZ = Math.sin(angle) * radius * 0.62;
  const y = rawY * Math.cos(tilt) - rawZ * Math.sin(tilt);
  const z = rawY * Math.sin(tilt) + rawZ * Math.cos(tilt);
  return {
    x: Math.cos(angle) * radius,
    y,
    z,
    mix: 0.56 + bandIndex * 0.055 + hash(i * 2.17) * 0.1,
    glow: bandIndex === 2 ? 0.5 : 1.08,
    dirX: Math.cos(angle) * 1.2,
    dirY: rawY,
    dirZ: Math.sin(angle) * 0.72,
  };
}

function fireworksPoint(t, r, i) {
  const type = hash(i * 0.31);
  const centerPick = hash(i * 0.71);
  const centerIndex =
    centerPick < 0.24
      ? 0
      : centerPick < 0.46
        ? 1
        : centerPick < 0.66
          ? 2
          : centerPick < 0.84
            ? 3
            : 4;
  const center = FIREWORK_CENTERS[centerIndex] ?? FIREWORK_CENTERS[0];

  if (type < 0.12) {
    const trailT = hash(i * 3.41) ** 0.56;
    const tailWobble = Math.sin(trailT * Math.PI * 2.4 + center.x * 3) * 0.018;
    const sideArc = Math.sin(trailT * Math.PI) * (0.16 + hash(i * 4.4) * 0.05);
    const launchX = center.launchX ?? 0;
    const launchZ = center.launchZ ?? 0;
    const launchAngle = Math.atan2(center.z - launchZ, center.x - launchX);
    const taper = 1 - trailT;
    return {
      x:
        launchX * (1 - trailT) +
        center.x * trailT +
        Math.cos(launchAngle + Math.PI / 2) * sideArc +
        tailWobble +
        (hash(i * 9.3) - 0.5) * 0.012 * taper,
      y: -1.48 + trailT * (center.y + 1.48),
      z:
        launchZ * (1 - trailT) +
        center.z * trailT +
        Math.sin(launchAngle + Math.PI / 2) * sideArc * 0.7 +
        (hash(i * 7.73) - 0.5) * 0.018 * taper,
      mix: 0.72 + center.hue * 0.2,
      glow: 0.28 + trailT * 0.62,
      kind: 0,
      dirX: 0,
      dirY: 0,
      dirZ: 0,
    };
  }

  if (type < 0.18) {
    const coreRadius = 0.018 + hash(i * 5.7) * 0.06;
    const coreAngle = hash(i * 2.1) * TAU;
    const coreDepth = (hash(i * 6.8) - 0.5) * coreRadius;
    return {
      x: center.x + Math.cos(coreAngle) * coreRadius,
      y: center.y + Math.sin(coreAngle) * coreRadius * 0.82,
      z: center.z + coreDepth,
      mix: 0.08 + center.hue * 0.36,
      glow: 1.18,
      kind: 1,
      dirX: Math.cos(coreAngle) * (0.18 + hash(i * 3.4) * 0.16),
      dirY: Math.sin(coreAngle) * (0.16 + hash(i * 5.2) * 0.14),
      dirZ: (hash(i * 8.2) - 0.5) * 0.22,
    };
  }

  const spokeCount = 30 + Math.floor(hash(centerIndex * 17 + i * 0.002) * 16);
  const spoke = Math.floor(hash(i * 4.61) * spokeCount);
  const theta = (spoke / spokeCount) * TAU + (hash(i * 8.31) - 0.5) * 0.022;
  const rayT = hash(i * 3.13) ** 0.72;
  const split = hash(spoke * 9.17 + i * 0.011);
  const fork = split > 0.68 ? (split > 0.84 ? -1 : 1) * (0.045 + hash(i * 2.21) * 0.12) : 0;
  const finalTheta = theta + fork * smoothstep(0.38, 1, rayT);
  const shell = (0.18 + rayT * (1.92 + hash(i * 2.7) * 0.46)) * center.scale;
  const ringTightness = 0.96 + Math.sin(spoke * 1.7 + centerIndex) * 0.035;
  const arc = (hash(i * 6.17) - 0.5) * 0.06;
  const petalLift = Math.sin(rayT * Math.PI) * (0.08 + hash(i * 4.8) * 0.08);
  const verticalBias = arc + petalLift;
  const shimmer = hash(i * 7.19);
  const coreJitter = 0.012 + hash(i * 9.9) * 0.018;

  return {
    x: center.x + Math.cos(finalTheta) * coreJitter,
    y: center.y + Math.sin(finalTheta) * coreJitter * 0.82,
    z: center.z + (hash(i * 6.1) - 0.5) * coreJitter * center.depth,
    mix: 0.12 + ((center.hue + shimmer * 0.46) % 1) * 0.78,
    glow: 0.56 + (1 - Math.abs(rayT - 0.64)) * 0.26 + shimmer * 0.16,
    kind: 2,
    dirX: Math.cos(finalTheta) * shell * ringTightness,
    dirY: (Math.sin(finalTheta) * 0.98 + verticalBias - rayT * rayT * 0.12) * shell,
    dirZ:
      (Math.sin(finalTheta + center.tilt) * 0.2 + (hash(i * 11.71) - 0.5) * 0.18) *
      shell *
      center.depth,
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

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function hash(value) {
  return Math.abs(Math.sin(value * 43758.5453)) % 1;
}
