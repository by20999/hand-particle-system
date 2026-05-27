self.addEventListener("message", async (event) => {
  const { id, file, options, targetCount } = event.data ?? {};
  try {
    const points = await createImagePointCloud(file, { ...(options ?? {}), jobId: id }, targetCount);
    self.postMessage({ id, points });
  } catch (error) {
    self.postMessage({ id, error: error?.message ?? String(error) });
  }
});

function postProgress(id, value, label) {
  if (id === undefined || id === null) return;
  self.postMessage({ id, progress: { value, label } });
}

async function createImagePointCloud(file, options, targetCount) {
  if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas === "undefined") {
    throw new Error("当前浏览器不支持 Worker 图片采样");
  }

  postProgress(options.jobId, 0.1, "正在解码图片");
  const bitmap = await createImageBitmap(file);
  const requestedMaxSide = Number(options.maxSide);
  const maxSideCap = Number.isFinite(requestedMaxSide) && requestedMaxSide > 0 ? requestedMaxSide : 1800;
  const maxSide = Math.min(maxSideCap, Math.max(900, Math.round(Math.sqrt(targetCount) * 2.6)));
  const scale = Math.min(maxSide / bitmap.width, maxSide / bitmap.height, 1);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.clearRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  postProgress(options.jobId, 0.22, "正在读取像素");
  const image = context.getImageData(0, 0, width, height);
  const totalPixels = width * height;
  const grayscale = new Float32Array(totalPixels);
  const alpha = new Float32Array(totalPixels);
  const foreground = new Uint8Array(totalPixels);
  const gradient = new Float32Array(totalPixels);
  const blurred = new Float32Array(totalPixels);
  const contourStrength = clamp(options.contourStrength ?? 0.75, 0, 1);
  const interiorRatio = clamp(options.interiorRatio ?? 0.35, 0.2, 0.5);
  const colorMode = options.colorMode ?? "original";
  const mono = hexToDisplayRgb(options.monoColor ?? "#ff4f8f");
  const globalAlpha = clamp(options.globalAlpha ?? 1, 0, 1);
  const alphaThreshold = options.logoMode ? 0.1 : 0.035;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = y * width + x;
      const index = pixelIndex * 4;
      const a = image.data[index + 3] / 255;
      const r = image.data[index] / 255;
      const g = image.data[index + 1] / 255;
      const b = image.data[index + 2] / 255;
      alpha[pixelIndex] = a;
      grayscale[pixelIndex] = r * 0.2126 + g * 0.7152 + b * 0.0722;
    }
  }

  postProgress(options.jobId, 0.38, "正在分析轮廓和纹理");
  gaussianBlur3x3(grayscale, blurred, width, height);

  let threshold = 0;
  let logoPolarity = 1;
  if (options.logoMode) {
    threshold = otsuThreshold(blurred, alpha);
    logoPolarity = chooseLogoPolarity(blurred, alpha, threshold);
  }

  const candidates = [];
  const strongGradients = [];
  let minX = width;
  let minY = height;
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
      return createImagePointCloud(file, { ...options, logoMode: false }, targetCount);
    }
    throw new Error("图片没有可采样的不透明像素");
  }

  strongGradients.sort((a, b) => a - b);
  postProgress(options.jobId, 0.58, "正在建立采样候选");
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
    return createImagePointCloud(file, { ...options, logoMode: false }, targetCount);
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const maxDim = Math.max(maxX - minX, maxY - minY, 1);
  const target = Math.max(1, targetCount);
  postProgress(options.jobId, 0.78, "正在分配高密度采样点");
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
    mix: clamp((point.g * 0.45 + point.b * 0.65) / (point.r + point.g + point.b + 0.001), 0, 1),
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
    histogram[Math.round(clamp(values[i], 0, 1) * 255)] += 1;
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
    const value = clamp((i + offset) * stride + jitter, 0, total - Number.EPSILON);
    picked.push(candidates[lowerBound(cumulative, value)] ?? candidates[candidates.length - 1]);
  }
  return picked;
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

function hash01(value) {
  return Math.abs(Math.sin(value * 43758.5453)) % 1;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
