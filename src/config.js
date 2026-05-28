export const MODEL_SCALE = 2.25;
export const START_SCALE = MODEL_SCALE * 0.86;
export const MP_HANDS_ASSET_BASE = `${import.meta.env.BASE_URL}mediapipe/hands/`;
export const MP_POSE_ASSET_BASE = `${import.meta.env.BASE_URL}mediapipe/pose/`;

const QUALITY_PROFILES = {
  compact: {
    id: "compact",
    label: "移动端",
    particleCount: 160000,
    imageSampleMultiplier: 2.8,
    maxImageSamples: 600000,
    imageMaxSide: 1500,
    meshSampleMultiplier: 1,
    maxMeshSamples: 220000,
    maxPixelRatio: 1.45,
    modelComplexity: 0,
    video: { width: 640, height: 360 },
    frameInterval: 34,
  },
  balanced: {
    id: "balanced",
    label: "均衡",
    particleCount: 320000,
    imageSampleMultiplier: 3.2,
    maxImageSamples: 1000000,
    imageMaxSide: 1800,
    meshSampleMultiplier: 1.08,
    maxMeshSamples: 360000,
    maxPixelRatio: 1.75,
    modelComplexity: 1,
    video: { width: 800, height: 450 },
    frameInterval: 30,
  },
  desktop: {
    id: "desktop",
    label: "桌面高画质",
    particleCount: 520000,
    imageSampleMultiplier: 3.4,
    maxImageSamples: 1600000,
    imageMaxSide: 2160,
    meshSampleMultiplier: 1.12,
    maxMeshSamples: 620000,
    maxPixelRatio: 2,
    modelComplexity: 1,
    video: { width: 960, height: 540 },
    frameInterval: 28,
  },
  ultra: {
    id: "ultra",
    label: "超高画质",
    particleCount: 900000,
    imageSampleMultiplier: 3.6,
    maxImageSamples: 2400000,
    imageMaxSide: 2560,
    meshSampleMultiplier: 1.18,
    maxMeshSamples: 980000,
    maxPixelRatio: 2,
    modelComplexity: 1,
    video: { width: 960, height: 540 },
    frameInterval: 28,
  },
};

export function selectQualityProfile() {
  const forced = new URLSearchParams(window.location.search).get("quality");
  if (forced && QUALITY_PROFILES[forced]) {
    return QUALITY_PROFILES[forced];
  }

  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const smallViewport = Math.min(window.innerWidth, window.innerHeight) < 720;
  const limitedMemory = navigator.deviceMemory && navigator.deviceMemory <= 4;
  const highDprTablet = window.devicePixelRatio > 2 && Math.max(window.innerWidth, window.innerHeight) < 1200;

  if (coarsePointer || smallViewport || limitedMemory) {
    return QUALITY_PROFILES.compact;
  }

  if (highDprTablet) {
    return QUALITY_PROFILES.balanced;
  }

  return QUALITY_PROFILES.desktop;
}

export function renderPixelRatio(profile) {
  return Math.min(window.devicePixelRatio || 1, profile.maxPixelRatio);
}
