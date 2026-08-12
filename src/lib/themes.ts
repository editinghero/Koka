export type ThemePreset = {
  id: string;
  label: string;
  hint: string;
  mode: "light" | "dark";
  /** small swatch preview [bg, surface, primary] */
  swatch: [string, string, string];
};

export const LIGHT_THEMES: ThemePreset[] = [
  {
    id: "paper",
    label: "Paper",
    hint: "Warm neutral default",
    mode: "light",
    swatch: ["#faf9f6", "#ffffff", "#2f8f96"],
  },
  {
    id: "sakura",
    label: "Sakura — Spring",
    hint: "Soft blossom pink",
    mode: "light",
    swatch: ["#fdf5f6", "#ffffff", "#ef7688"],
  },
  {
    id: "natsu",
    label: "Natsu — Summer",
    hint: "Sun-warmed amber gold",
    mode: "light",
    swatch: ["#fdf8ee", "#ffffff", "#e08a2e"],
  },
  {
    id: "momiji",
    label: "Momiji — Autumn",
    hint: "Amber maple leaves",
    mode: "light",
    swatch: ["#fdf6ee", "#fffdfa", "#b56a20"],
  },
  {
    id: "yuki",
    label: "Yuki — Winter",
    hint: "Cool pale frost",
    mode: "light",
    swatch: ["#f5f7fa", "#ffffff", "#4a6fa5"],
  },
  {
    id: "matcha",
    label: "Matcha",
    hint: "Soft green tea",
    mode: "light",
    swatch: ["#f4f8f2", "#ffffff", "#3f8055"],
  },
];

export const DARK_THEMES: ThemePreset[] = [
  {
    id: "koka",
    label: "Koka",
    hint: "#141414 neutral black",
    mode: "dark",
    swatch: ["#141414", "#1c1c1c", "#6fd6dc"],
  },
  {
    id: "midnight",
    label: "Kintsugi",
    hint: "Ivory gold on #141414 black",
    mode: "dark",
    swatch: ["#141414", "#1e1e1e", "#FFFAF3"],
  },
  {
    id: "sumi",
    label: "Mocha",
    hint: "Rich dark coffee mocha",
    mode: "dark",
    swatch: ["#0f0705", "#130905ff", "#5e3d2eff"],
  },

  {
    id: "mori",
    label: "Mori",
    hint: "Forest green shadow",
    mode: "dark",
    swatch: ["#101613", "#18201c", "#68c99a"],
  },
  {
    id: "budou",
    label: "Budou",
    hint: "Muted plum violet",
    mode: "dark",
    swatch: ["#141019", "#1c1723", "#b58ce0"],
  },
  {
    id: "umi",
    label: "Ume",
    hint: "Warm coral rose",
    mode: "dark",
    swatch: ["#140f10", "#1c1517", "#ef7688"],
  },
];

export const ALL_THEMES = [...LIGHT_THEMES, ...DARK_THEMES];
