export const THEMES = [
  {
    id: "neon",
    label: "霓虹粉蓝",
    primary: "#ff4f8f",
    accent: "#52d7de",
    background: "#06080d",
    glowA: "rgba(255, 79, 143, 0.15)",
    glowB: "rgba(63, 208, 212, 0.14)",
  },
  {
    id: "gold",
    label: "金色暖光",
    primary: "#ffd166",
    accent: "#ff7a59",
    background: "#080606",
    glowA: "rgba(255, 209, 102, 0.15)",
    glowB: "rgba(255, 122, 89, 0.13)",
  },
  {
    id: "ice",
    label: "冰蓝",
    primary: "#82f7ff",
    accent: "#7aa8ff",
    background: "#040911",
    glowA: "rgba(130, 247, 255, 0.14)",
    glowB: "rgba(122, 168, 255, 0.12)",
  },
  {
    id: "aurora",
    label: "紫绿",
    primary: "#b66cff",
    accent: "#68f5a6",
    background: "#07070f",
    glowA: "rgba(182, 108, 255, 0.15)",
    glowB: "rgba(104, 245, 166, 0.13)",
  },
  {
    id: "blackGold",
    label: "黑金",
    primary: "#f7c76b",
    accent: "#fff2b0",
    background: "#030303",
    glowA: "rgba(247, 199, 107, 0.13)",
    glowB: "rgba(255, 242, 176, 0.08)",
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
}
