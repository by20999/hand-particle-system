export const MODEL_SCALE = 2.25;
export const START_SCALE = MODEL_SCALE * 0.86;
export const MP_HANDS_ASSET_BASE = `${import.meta.env.BASE_URL}mediapipe/hands/`;

const QUALITY_PROFILES = {
  compact: {
    id: "compact",
    label: "移动端",
    particleCount: 96000,
    maxPixelRatio: 1.45,
    modelComplexity: 0,
    video: { width: 640, height: 360 },
    frameInterval: 34,
  },
  balanced: {
    id: "balanced",
    label: "均衡",
    particleCount: 150000,
    maxPixelRatio: 1.75,
    modelComplexity: 1,
    video: { width: 800, height: 450 },
    frameInterval: 30,
  },
  desktop: {
    id: "desktop",
    label: "桌面高画质",
    particleCount: 220000,
    maxPixelRatio: 2,
    modelComplexity: 1,
    video: { width: 960, height: 540 },
    frameInterval: 28,
  },
  ultra: {
    id: "ultra",
    label: "超高画质",
    particleCount: 300000,
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
