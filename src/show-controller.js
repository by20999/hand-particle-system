import { THEMES } from "./themes.js";
import { SHOW_PRESET_LIBRARY } from "./show-presets/index.js";

export const CUSTOM_SHOW_STORAGE_KEY = "customShowPreset";
export const SHOW_MODELS = new Set(["heart", "flower", "saturn", "fireworks", "ring", "cake", "balloons", "text", "pose", "image", "mesh"]);
export const SHOW_BACKGROUNDS = new Set(["nebula", "stage", "minimal", "fireworks", "aurora", "lattice", "sunset"]);
export const SHOW_THEMES = new Set(THEMES.map((theme) => theme.id));
export const CAMERA_SHOTS = {
  front: { position: [0, 1.0, 8.2], target: [0, 0, 0] },
  close: { position: [0, 0.72, 5.35], target: [0, 0.08, 0] },
  wide: { position: [0, 1.2, 10.7], target: [0, 0, 0] },
  left: { position: [-5.25, 1.25, 6.45], target: [0, 0.05, 0] },
  right: { position: [5.25, 1.25, 6.45], target: [0, 0.05, 0] },
  top: { position: [0, 7.35, 4.55], target: [0, 0.05, 0] },
  low: { position: [0, -0.95, 6.35], target: [0, 0.1, 0] },
};

export const DEFAULT_CUSTOM_SHOW = {
  label: "自定义编排",
  steps: [
    {
      label: "开场爱心",
      theme: "neon",
      background: "nebula",
      model: "heart",
      camera: "front",
      modelBrightness: 1.06,
      backgroundBrightness: 1.08,
      duration: 9000,
    },
    {
      label: "近景花朵",
      theme: "rose",
      background: "stage",
      model: "flower",
      camera: "close",
      modelBrightness: 1.08,
      backgroundBrightness: 1.2,
      duration: 10000,
    },
    {
      label: "烟花收尾",
      theme: "laser",
      background: "fireworks",
      model: "fireworks",
      camera: "wide",
      backgroundBrightness: 1.25,
      burst: true,
      duration: 11000,
    },
  ],
};

export const SHOW_PRESETS = {
  auto: {
    label: "自动巡演",
    steps: [
      { label: "霓虹爱心", theme: "neon", background: "nebula", model: "heart", camera: "front", duration: 9500 },
      {
        label: "玫瑰舞台",
        theme: "rose",
        background: "stage",
        model: "flower",
        camera: "close",
        modelBrightness: 1.08,
        backgroundBrightness: 1.18,
        duration: 10500,
      },
      {
        label: "电紫土星",
        theme: "violet",
        background: "minimal",
        model: "saturn",
        camera: "left",
        modelBrightness: 1.12,
        backgroundBrightness: 0.9,
        duration: 9500,
      },
      {
        label: "夜空烟花",
        theme: "laser",
        background: "fireworks",
        model: "fireworks",
        camera: "wide",
        burst: true,
        duration: 11000,
      },
    ],
  },
  romance: {
    label: "玫瑰告白",
    steps: [
      {
        label: "玫红花朵",
        theme: "rose",
        background: "stage",
        model: "flower",
        camera: "close",
        modelBrightness: 1.06,
        backgroundBrightness: 1.12,
        duration: 11500,
      },
      {
        label: "文字告白",
        theme: "gold",
        background: "nebula",
        model: "text",
        text: "LOVE",
        camera: "front",
        modelBrightness: 1.1,
        duration: 10500,
      },
      {
        label: "暖光爱心",
        theme: "gold",
        background: "minimal",
        model: "heart",
        camera: "low",
        backgroundBrightness: 0.88,
        duration: 9500,
      },
    ],
  },
  club: {
    label: "夜场烟花",
    steps: [
      {
        label: "激光爱心",
        theme: "laser",
        background: "stage",
        model: "heart",
        camera: "front",
        backgroundBrightness: 1.22,
        burst: true,
        duration: 8500,
      },
      {
        label: "电紫土星",
        theme: "violet",
        background: "nebula",
        model: "saturn",
        camera: "right",
        modelBrightness: 1.18,
        duration: 8500,
      },
      {
        label: "爆场烟花",
        theme: "laser",
        background: "fireworks",
        model: "fireworks",
        camera: "wide",
        backgroundBrightness: 1.3,
        burst: true,
        duration: 12000,
      },
    ],
  },
  gallery: {
    label: "图形展台",
    steps: [
      {
        label: "图片点云",
        theme: "ice",
        background: "minimal",
        model: "image",
        camera: "front",
        imageBrightness: 3.0,
        imageSize: 1,
        duration: 10500,
      },
      {
        label: "3D 点云",
        theme: "blackGold",
        background: "stage",
        model: "mesh",
        camera: "wide",
        modelBrightness: 1.15,
        duration: 10500,
      },
      {
        label: "文字陈列",
        theme: "aurora",
        background: "nebula",
        model: "text",
        text: "PARTICLE",
        camera: "front",
        duration: 9500,
      },
      { label: "土星陈列", theme: "gold", background: "minimal", model: "saturn", camera: "top", duration: 9000 },
    ],
  },
  ...Object.fromEntries(
    SHOW_PRESET_LIBRARY.map((preset) => [
      preset.id,
      {
        label: preset.label,
        steps: preset.steps,
      },
    ]),
  ),
};

export function showPresetOptionList() {
  return [
    ...Object.entries(SHOW_PRESETS).map(([id, preset]) => ({ id, label: preset.label })),
    { id: "custom", label: "自定义编排" },
  ];
}

export function normalizeShowPreset(input, fallbackLabel = "自定义编排") {
  const source = Array.isArray(input) ? { label: fallbackLabel, steps: input } : input;
  const rawSteps = Array.isArray(source?.steps)
    ? source.steps
    : source && typeof source === "object" && source.model
      ? [source]
      : DEFAULT_CUSTOM_SHOW.steps;
  const steps = rawSteps.slice(0, 80).map((step, index) => normalizeShowStep(step, index));
  return {
    label: normalizeShowPresetLabel(source?.label ?? fallbackLabel),
    steps: steps.length > 0 ? steps : DEFAULT_CUSTOM_SHOW.steps.map((step, index) => normalizeShowStep(step, index)),
  };
}

export function normalizeShowStep(step = {}, index = 0) {
  const duration = normalizeShowDuration(step.duration ?? step.seconds);
  return {
    label: normalizeShowLabel(step.label, index),
    duration,
    theme: SHOW_THEMES.has(step.theme) ? step.theme : "neon",
    background: SHOW_BACKGROUNDS.has(step.background) ? step.background : "nebula",
    model: SHOW_MODELS.has(step.model) ? step.model : "heart",
    text: normalizeShowText(step.text ?? "LOVE"),
    camera: normalizeCameraSpec(step.camera),
    cameraDuration: normalizeShowDuration(step.cameraDuration ?? 1400, 300, 6000),
    modelBrightness: normalizeShowRatio(step.modelBrightness, 1, 0.45, 2.2),
    backgroundBrightness: normalizeShowRatio(step.backgroundBrightness, 1, 0.35, 2.2),
    imageBrightness: normalizeShowRatio(step.imageBrightness, 2.8, 0.6, 4.8),
    imageSize: normalizeShowRatio(step.imageSize, 1, 0.45, 1),
    burst: normalizeShowBoolean(step.burst),
    freeze: normalizeShowBoolean(step.freeze),
  };
}

export function cloneShowPreset(preset) {
  return JSON.parse(JSON.stringify(preset));
}

export function nextStepLabel(label, count) {
  const base = String(label ?? "片段").replace(/\s+\d+$/, "").slice(0, 14).trim() || "片段";
  return `${base} ${count}`;
}

export function vectorArray(value) {
  if (!Array.isArray(value) || value.length < 3) return null;
  const vector = value.slice(0, 3).map(Number);
  return vector.every(Number.isFinite) ? vector : null;
}

function normalizeShowDuration(value, min = 2000, max = 120000) {
  const numeric = Number(value);
  const milliseconds = numeric > 0 && numeric <= 120 ? numeric * 1000 : numeric;
  return Math.round(clamp(Number.isFinite(milliseconds) ? milliseconds : 10000, min, max));
}

function normalizeShowRatio(value, fallback, min, max) {
  if (value === undefined || value === null || value === "") return fallback;
  const numeric = Number(String(value).replace("%", ""));
  const ratio = numeric > 10 ? numeric / 100 : numeric;
  return clamp(Number.isFinite(ratio) ? ratio : fallback, min, max);
}

function normalizeShowBoolean(value) {
  if (typeof value === "string") {
    return value === "1" || value.toLowerCase() === "true" || value === "是";
  }
  return Boolean(value);
}

function normalizeShowPresetLabel(label) {
  const trimmed = String(label ?? "").trim();
  return trimmed.length > 0 ? trimmed.slice(0, 24) : "自定义编排";
}

function normalizeShowLabel(label, index) {
  const trimmed = String(label ?? "").trim();
  return trimmed.length > 0 ? trimmed.slice(0, 18) : `片段 ${index + 1}`;
}

function normalizeShowText(text) {
  const trimmed = String(text ?? "").trim();
  return trimmed.length > 0 ? trimmed.slice(0, 18) : "LOVE";
}

function normalizeCameraSpec(cameraSpec) {
  if (!cameraSpec || cameraSpec === "hold") return "hold";
  if (typeof cameraSpec === "string") {
    return CAMERA_SHOTS[cameraSpec] ? cameraSpec : "hold";
  }
  const position = vectorArray(cameraSpec.position);
  const target = vectorArray(cameraSpec.target);
  if (!position || !target) return "hold";
  return { position, target };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
