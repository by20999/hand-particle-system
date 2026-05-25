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

export function classifyGestureCommand(hands) {
  if (!Array.isArray(hands) || hands.length === 0) {
    return { name: "none", pointing: false, pointX: 0, pointY: 0, pointZ: 0 };
  }

  if (hands.length >= 2 && isHeartGesture(hands[0], hands[1])) {
    return { name: "heart", pointing: false, pointX: 0, pointY: 0, pointZ: 0 };
  }

  const first = hands[0];
  if (isOkGesture(first)) {
    return { name: "ok", pointing: false, pointX: 0, pointY: 0, pointZ: 0 };
  }

  const pointing = pointingVector(first);
  if (pointing.active) {
    return { name: "point", pointing: true, pointX: pointing.x, pointY: pointing.y, pointZ: pointing.z };
  }

  return { name: "none", pointing: false, pointX: 0, pointY: 0, pointZ: 0 };
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

function isHeartGesture(left, right) {
  const palmA = Math.max(distance3(left[0], left[9]), distance3(left[5], left[17]), 0.045);
  const palmB = Math.max(distance3(right[0], right[9]), distance3(right[5], right[17]), 0.045);
  const palm = (palmA + palmB) * 0.5;
  const indexClose = distance3(left[8], right[8]) / palm;
  const thumbClose = distance3(left[4], right[4]) / palm;
  const wristGap = distance3(left[0], right[0]) / palm;
  return indexClose < 0.72 && thumbClose < 0.82 && wristGap > 1.12 && wristGap < 3.3;
}

function isOkGesture(hand) {
  const palm = Math.max(distance3(hand[0], hand[9]), distance3(hand[5], hand[17]), 0.045);
  const thumbIndex = distance3(hand[4], hand[8]) / palm;
  const middleOpen = fingerExtended(hand, FINGERS[1], palm);
  const ringOpen = fingerExtended(hand, FINGERS[2], palm);
  const pinkyOpen = fingerExtended(hand, FINGERS[3], palm);
  return thumbIndex < 0.44 && middleOpen > 0.56 && ringOpen > 0.48 && pinkyOpen > 0.42;
}

function pointingVector(hand) {
  const palm = Math.max(distance3(hand[0], hand[9]), distance3(hand[5], hand[17]), 0.045);
  const indexOpen = fingerExtended(hand, FINGERS[0], palm);
  const middleOpen = fingerExtended(hand, FINGERS[1], palm);
  const ringOpen = fingerExtended(hand, FINGERS[2], palm);
  const pinkyOpen = fingerExtended(hand, FINGERS[3], palm);
  const active = indexOpen > 0.72 && middleOpen < 0.48 && ringOpen < 0.42 && pinkyOpen < 0.42;
  if (!active) {
    return { active: false, x: 0, y: 0, z: 0 };
  }

  const dx = hand[8].x - hand[5].x;
  const dy = hand[8].y - hand[5].y;
  const dz = (hand[8].z ?? 0) - (hand[5].z ?? 0);
  const length = Math.hypot(dx, dy, dz) || 1;
  return {
    active: true,
    x: clamp((dx / length) * 1.4, -1, 1),
    y: clamp((-dy / length) * 1.35, -1, 1),
    z: clamp((-dz / length) * 1.4, -1, 1),
  };
}

function fingerExtended(hand, finger, palm) {
  const tipReach = distance3(hand[finger.tip], hand[0]) / palm;
  const pipReach = distance3(hand[finger.pip], hand[0]) / palm;
  const angle = jointAngle(hand[finger.mcp], hand[finger.pip], hand[finger.tip]);
  return smoothClamp((tipReach - pipReach + 0.16) / 0.46) * 0.46 + smoothClamp((angle - 1.7) / 0.9) * 0.54;
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
