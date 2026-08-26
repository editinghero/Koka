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
    swatch: ["#faf9f6", "#fefefe", "#3d90a0"],
  },
  {
    id: "sakura",
    label: "Sakura — Spring",
    hint: "Soft blossom pink",
    mode: "light",
    swatch: ["#fdf5f6", "#fef8f9", "#d97580"],
  },
  {
    id: "natsu",
    label: "Natsu — Summer",
    hint: "Sun-warmed amber gold",
    mode: "light",
    swatch: ["#fdf8ee", "#fdfaf2", "#c08a45"],
  },
  {
    id: "momiji",
    label: "Momiji — Autumn",
    hint: "Amber maple leaves",
    mode: "light",
    swatch: ["#f7ece0", "#fdf8f2", "#a66228"],
  },
  {
    id: "yuki",
    label: "Yuki — Winter",
    hint: "Cool pale frost",
    mode: "light",
    swatch: ["#f5f7fa", "#f9fafe", "#4060a0"],
  },
  {
    id: "matcha",
    label: "Matcha",
    hint: "Soft green tea",
    mode: "light",
    swatch: ["#f4f8f2", "#f9fdf8", "#3a7a52"],
  },
  {
    id: "haze",
    label: "Haze",
    hint: "Lavender & slate mist",
    mode: "light",
    swatch: ["#F2EAE0", "#f2edf8", "#98A1BC"],
  },
  {
    id: "bara",
    label: "Bara",
    hint: "Coral rose blush",
    mode: "light",
    swatch: ["#F9ECEB", "#fef6f6", "#C599B6"],
  },
  {
    id: "suna",
    label: "Suna",
    hint: "Warm sand & biscuit",
    mode: "light",
    swatch: ["#F9F8F6", "#F3EDE6", "#9E683E"],
  },
];

export const DARK_THEMES: ThemePreset[] = [
  {
    id: "koka",
    label: "Koka",
    hint: "Neutral dark",
    mode: "dark",
    swatch: ["#141414", "#1c1c1c", "#6fd6dc"],
  },
  {
    id: "midnight",
    label: "Kintsugi",
    hint: "Ivory gold",
    mode: "dark",
    swatch: ["#141414", "#1e1e1e", "#FFFAF3"],
  },
  {
    id: "sumi",
    label: "Mocha",
    hint: "Rich dark coffee mocha",
    mode: "dark",
    swatch: ["#1F150C", "#3E3232", "#a88864"],
  },
  {
    id: "kurai",
    label: "Kurai",
    hint: "Deep purple-slate",
    mode: "dark",
    swatch: ["#393646", "#4F4557", "#6D5D6E"],
  },
  {
    id: "tsuki",
    label: "Tsuki",
    hint: "Charcoal slate & teal",
    mode: "dark",
    swatch: ["#141c2b", "#1a2438", "#4ac8d8"],
  },
  {
    id: "mono",
    label: "Mono",
    hint: "Pure black & white",
    mode: "dark",
    swatch: ["#121212", "#1a1a1a", "#eeeeee"],
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
