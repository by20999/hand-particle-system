const PALM_IDS = [0, 5, 9, 13, 17];
const FINGERS = [
  { mcp: 5, pip: 6, tip: 8 },
  { mcp: 9, pip: 10, tip: 12 },
  { mcp: 13, pip: 14, tip: 16 },
  { mcp: 17, pip: 18, tip: 20 },
];

export function calculateHandOpenness(hand) {
  const wrist = hand[0];
  const middleMcp = hand[9];
  const palm = Math.max(distance3(wrist, middleMcp), distance3(hand[5], hand[17]) * 0.92, 0.045);
  const center = palmCenter3(hand);

  const reach = FINGERS.reduce((sum, finger) => sum + distance3(hand[finger.tip], center) / palm, 0) / FINGERS.length;
  const reachScore = smoothClamp((reach - 1.02) / 0.92);

  const straightness =
    FINGERS.reduce((sum, finger) => {
      const angle = jointAngle(hand[finger.mcp], hand[finger.pip], hand[finger.tip]);
      return sum + smoothClamp((angle - 1.72) / 0.96);
    }, 0) / FINGERS.length;

  const fingertipSpread = (distance3(hand[8], hand[20]) + distance3(hand[4], hand[8]) * 0.72) / palm;
  const spreadScore = smoothClamp((fingertipSpread - 1.0) / 1.18);

  const wristReach =
    FINGERS.reduce((sum, finger) => sum + distance3(hand[finger.tip], wrist) / palm, 0) / FINGERS.length;
  const wristReachScore = smoothClamp((wristReach - 1.35) / 0.9);
  const thumbReach = smoothClamp((distance3(hand[4], center) / palm - 0.72) / 0.72);
  const raw =
    reachScore * 0.3 + straightness * 0.28 + spreadScore * 0.22 + wristReachScore * 0.14 + thumbReach * 0.06;

  return clamp(Math.pow(raw, 1.18), 0, 1);
}

export function palmCenter(hand) {
  const center = PALM_IDS.reduce(
    (sum, id) => {
      sum.x += hand[id].x;
      sum.y += hand[id].y;
      return sum;
    },
    { x: 0, y: 0 },
  );
  center.x /= PALM_IDS.length;
  center.y /= PALM_IDS.length;
  return center;
}

export function fistViewPose(hand) {
  const center = palmCenter(hand);
  return {
    centerY: center.y,
    roll: Math.atan2(hand[17].y - hand[5].y, hand[17].x - hand[5].x),
  };
}

export function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function lerpAngle(from, to, amount) {
  return from + normalizeAngle(to - from) * amount;
}

export function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

function palmCenter3(hand) {
  const center = PALM_IDS.reduce(
    (sum, id) => {
      sum.x += hand[id].x;
      sum.y += hand[id].y;
      sum.z += hand[id].z ?? 0;
      return sum;
    },
    { x: 0, y: 0, z: 0 },
  );
  center.x /= PALM_IDS.length;
  center.y /= PALM_IDS.length;
  center.z /= PALM_IDS.length;
  return center;
}

function distance3(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
}

function jointAngle(a, b, c) {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const abz = (a.z ?? 0) - (b.z ?? 0);
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const cbz = (c.z ?? 0) - (b.z ?? 0);
  const dot = abx * cbx + aby * cby + abz * cbz;
  const lenA = Math.hypot(abx, aby, abz);
  const lenC = Math.hypot(cbx, cby, cbz);
  return Math.acos(clamp(dot / Math.max(lenA * lenC, 0.000001), -1, 1));
}

function smoothClamp(value) {
  const x = clamp(value, 0, 1);
  return x * x * (3 - 2 * x);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
