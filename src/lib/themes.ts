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
    swatch: ["#fdf6ee", "#fffdfa", "#a06832"],
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
    hint: "Lavender-mint mist",
    mode: "light",
    swatch: ["#F2EAE0", "#ece4f6", "#9B8EC7"],
  },
  {
    id: "bara",
    label: "Bara",
    hint: "Coral rose blush",
    mode: "light",
    swatch: ["#FFF7F3", "#fffbf9", "#C599B6"],
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
    // bg #483434, surface #6B4F4F, primary caramel
    swatch: ["#483434", "#5a4040", "#d4a87a"],
  },
  {
    id: "kurai",
    label: "Kurai",
    hint: "Deep purple-slate",
    mode: "dark",
    // bg #393646, surface #4F4557, primary muted violet
    swatch: ["#393646", "#4F4557", "#9e6fc8"],
  },
  {
    id: "tsuki",
    label: "Tsuki",
    hint: "Charcoal slate & teal",
    mode: "dark",
    // deep blue-charcoal, cyan-teal accent
    swatch: ["#141c2b", "#1a2438", "#4ac8d8"],
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
