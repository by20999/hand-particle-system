export const THEMES = [
  {
    id: "neon",
    label: "霓虹粉蓝",
    primary: "#ff3f8f",
    accent: "#40e4ff",
    background: "#06080d",
    glowA: "rgba(255, 79, 143, 0.15)",
    glowB: "rgba(63, 208, 212, 0.14)",
    shadow: "#02030a",
    haze: "#7b3cff",
    rim: "#ffffff",
    mood: "cyber",
  },
  {
    id: "gold",
    label: "金色暖光",
    primary: "#ffd36f",
    accent: "#ff5f7a",
    background: "#080606",
    glowA: "rgba(255, 209, 102, 0.15)",
    glowB: "rgba(255, 122, 89, 0.13)",
    shadow: "#090302",
    haze: "#8f4b16",
    rim: "#fff4c2",
    mood: "opera",
  },
  {
    id: "ice",
    label: "冰蓝",
    primary: "#6ff4ff",
    accent: "#8ba2ff",
    background: "#040911",
    glowA: "rgba(130, 247, 255, 0.14)",
    glowB: "rgba(122, 168, 255, 0.12)",
    shadow: "#020611",
    haze: "#2e7bff",
    rim: "#e8fbff",
    mood: "glacier",
  },
  {
    id: "aurora",
    label: "紫绿",
    primary: "#b45cff",
    accent: "#43ffb4",
    background: "#07070f",
    glowA: "rgba(182, 108, 255, 0.15)",
    glowB: "rgba(104, 245, 166, 0.13)",
    shadow: "#03050a",
    haze: "#2dffbd",
    rim: "#efffe8",
    mood: "aurora",
  },
  {
    id: "blackGold",
    label: "黑金",
    primary: "#f7c76b",
    accent: "#fff2b0",
    background: "#030303",
    glowA: "rgba(247, 199, 107, 0.13)",
    glowB: "rgba(255, 242, 176, 0.08)",
    shadow: "#000000",
    haze: "#6c4a14",
    rim: "#fff8d6",
    mood: "noir",
  },
  {
    id: "rose",
    label: "玫红花火",
    primary: "#ff315d",
    accent: "#ffb0c8",
    background: "#09030a",
    glowA: "rgba(255, 49, 93, 0.16)",
    glowB: "rgba(255, 176, 200, 0.1)",
    shadow: "#030006",
    haze: "#b2163d",
    rim: "#fff0f4",
    mood: "rose",
  },
  {
    id: "laser",
    label: "激光夜场",
    primary: "#39ff88",
    accent: "#ff3df2",
    background: "#020706",
    glowA: "rgba(57, 255, 136, 0.13)",
    glowB: "rgba(255, 61, 242, 0.13)",
    shadow: "#010203",
    haze: "#00b86b",
    rim: "#e8fff4",
    mood: "laser",
  },
  {
    id: "sunset",
    label: "落日珊瑚",
    primary: "#ff7b54",
    accent: "#ffe66d",
    background: "#090407",
    glowA: "rgba(255, 123, 84, 0.15)",
    glowB: "rgba(255, 230, 109, 0.11)",
    shadow: "#030104",
    haze: "#b33b5e",
    rim: "#fff5cf",
    mood: "sunset",
  },
  {
    id: "violet",
    label: "电紫青蓝",
    primary: "#7c5cff",
    accent: "#28f0ff",
    background: "#050612",
    glowA: "rgba(124, 92, 255, 0.16)",
    glowB: "rgba(40, 240, 255, 0.12)",
    shadow: "#01020a",
    haze: "#3f46ff",
    rim: "#edf3ff",
    mood: "violet",
  },
];

export function getTheme(themeId) {
  return THEMES.find((theme) => theme.id === themeId) ?? THEMES[0];
}

export function applyThemeToDocument(theme) {
  const root = document.documentElement;
  root.style.setProperty("--theme-bg", theme.background);
  root.style.setProperty("--theme-glow-a", theme.glowA);
  root.style.setProperty("--theme-glow-b", theme.glowB);
  root.style.setProperty("--accent-primary", theme.primary);
  root.style.setProperty("--accent-secondary", theme.accent);
  root.style.setProperty("--theme-shadow", theme.shadow ?? "#02030a");
  root.style.setProperty("--theme-haze", theme.haze ?? theme.accent);
  root.style.setProperty("--theme-rim", theme.rim ?? "#ffffff");
  root.dataset.themeMood = theme.mood ?? theme.id;
}
