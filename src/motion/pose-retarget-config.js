export const POSE_CONNECTIONS_LOCAL = [
  [11, 12],
  [11, 13],
  [13, 15],
  [15, 17],
  [15, 19],
  [15, 21],
  [17, 19],
  [12, 14],
  [14, 16],
  [16, 18],
  [16, 20],
  [16, 22],
  [18, 20],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [27, 29],
  [29, 31],
  [27, 31],
  [24, 26],
  [26, 28],
  [28, 30],
  [30, 32],
  [28, 32],
  [0, 11],
  [0, 12],
];

export const POSE_NODE_IDS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
export const POSE_DETAIL_NODE_IDS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
export const POSE_LEFT_IDS = new Set([1, 2, 3, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31]);
export const POSE_RIGHT_IDS = new Set([4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32]);
export const POSE_CORE_IDS = new Set([0, 11, 12, 23, 24]);

export const POSE_RETARGET_SPECS = [
  { bone: "spine", from: "hips", to: "shoulders", strength: 0.42 },
  { bone: "chest", from: "hips", to: "shoulders", strength: 0.34 },
  { bone: "neck", from: "shoulders", to: 0, strength: 0.36 },
  { bone: "head", from: "shoulders", to: 0, strength: 0.3 },
  { bone: "lupperarm", from: 11, to: 13, strength: 0.92 },
  { bone: "llowerarm", from: 13, to: 15, strength: 0.96 },
  { bone: "rupperarm", from: 12, to: 14, strength: 0.92 },
  { bone: "rlowerarm", from: 14, to: 16, strength: 0.96 },
  { bone: "lupperleg", from: 23, to: 25, strength: 0.9 },
  { bone: "llowerleg", from: 25, to: 27, strength: 0.94 },
  { bone: "rupperleg", from: 24, to: 26, strength: 0.9 },
  { bone: "rlowerleg", from: 26, to: 28, strength: 0.94 },
  { bone: "lfoot", from: 27, to: 31, strength: 0.72 },
  { bone: "rfoot", from: 28, to: 32, strength: 0.72 },
];

export const POSE_RETARGET_REQUIRED = ["lupperarm", "llowerarm", "rupperarm", "rlowerarm", "lupperleg", "llowerleg", "rupperleg", "rlowerleg"];

export const POSE_RETARGET_CHILD = {
  spine: "chest",
  chest: "neck",
  neck: "head",
  lshoulder: "lupperarm",
  lupperarm: "llowerarm",
  llowerarm: "lhand",
  rshoulder: "rupperarm",
  rupperarm: "rlowerarm",
  rlowerarm: "rhand",
  lupperleg: "llowerleg",
  llowerleg: "lfoot",
  lfoot: "ltoe",
  rupperleg: "rlowerleg",
  rlowerleg: "rfoot",
  rfoot: "rtoe",
};

export const POSE_RETARGET_ANGLE_LIMITS = {
  spine: 0.72,
  chest: 0.68,
  neck: 0.82,
  head: 0.78,
  lupperarm: 2.45,
  llowerarm: 2.55,
  rupperarm: 2.45,
  rlowerarm: 2.55,
  lupperleg: 1.85,
  llowerleg: 2.2,
  rupperleg: 1.85,
  rlowerleg: 2.2,
  lfoot: 1.05,
  rfoot: 1.05,
};

export const POSE_RETARGET_SIDE_POINTS = {
  left: { hip: 23, knee: 25, ankle: 27, heel: 29, toe: 31 },
  right: { hip: 24, knee: 26, ankle: 28, heel: 30, toe: 32 },
};

export function canonicalBoneName(name) {
  const raw = String(name ?? "").toLowerCase();
  let value = String(name ?? "")
    .toLowerCase()
    .replace(/mixamorig|armature|avatar|bip001|bip|j_bip|def|mch|org/g, "")
    .replace(/[^a-z0-9]/g, "");
  const compactSide = value.match(/^(l|r)(upper|lower|hand|foot|toe|shoulder|arm|leg|thigh|calf|hip|pelvis|knee|elbow|wrist|ankle)/);
  const side =
    value.includes("left") || /(^|[^a-z])l([^a-z]|$)/.test(raw) || compactSide?.[1] === "l"
      ? "l"
      : value.includes("right") || /(^|[^a-z])r([^a-z]|$)/.test(raw) || compactSide?.[1] === "r"
        ? "r"
        : "";
  value = value.replace(/left|right/g, "");
  if (side) {
    value = value.replace(/^[lr]/, "");
  }
  if (side && /hip|pelvis/.test(value)) return `${side}upperleg`;
  if (/hips|hip|pelvis|root/.test(value)) return "hips";
  if (/upperchest/.test(value)) return "upperchest";
  if (/chest|spine2|spine3/.test(value)) return "chest";
  if (/spine1|spine/.test(value)) return "spine";
  if (/neck/.test(value)) return "neck";
  if (/head/.test(value)) return "head";
  if (!side) return value;
  if (/shoulder|clavicle/.test(value)) return `${side}shoulder`;
  if (/elbow/.test(value)) return `${side}lowerarm`;
  if (/forearm|lowerarm|loarm/.test(value)) return `${side}lowerarm`;
  if (/upperarm|uparm|arm/.test(value)) return `${side}upperarm`;
  if (/wrist/.test(value)) return `${side}hand`;
  if (/hand|wrist/.test(value)) return `${side}hand`;
  if (/knee/.test(value)) return `${side}lowerleg`;
  if (/upleg|upperleg|thigh/.test(value)) return `${side}upperleg`;
  if (/lowerleg|leg|shin|calf/.test(value)) return `${side}lowerleg`;
  if (/toe/.test(value)) return `${side}toe`;
  if (/foot|ankle/.test(value)) return `${side}foot`;
  return `${side}${value}`;
}
