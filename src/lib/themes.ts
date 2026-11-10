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
    id: "umi",
    label: "Ume",
    hint: "Warm coral rose",
    mode: "dark",
    swatch: ["#191213", "#22191a", "#d66879"],
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
    id: "koka",
    label: "Coral",
    hint: "Neutral dark",
    mode: "dark",
    swatch: ["#141414", "#1c1c1c", "#6fd6dc"],
  },
  {
    id: "velvet",
    label: "Velvet",
    hint: "Charcoal with peach-to-violet gradient",
    mode: "dark",
    swatch: ["#212121", "#262626", "#DBAEC2"],
  },
  {
    id: "noir",
    label: "Noir",
    hint: "Ticket-stub black & hot pink",
    mode: "dark",
    swatch: ["#0e0c0d", "#161415", "#ff507b"],
  },
  {
    id: "wisteria",
    label: "Wisteria",
    hint: "Midnight indigo & golden cream",
    mode: "dark",
    swatch: ["#121128", "#1a1936", "#ebd9b4"],
  },
  {
    id: "abyss",
    label: "Abyss Coral",
    hint: "Deep teal & coral",
    mode: "dark",
    swatch: ["#0a1a1f", "#10252b", "#ff8a6b"],
  },
  {
    id: "vice",
    label: "Vice City",
    hint: "Indigo night & bubblegum pink",
    mode: "dark",
    swatch: ["#1c1c34", "#29294a", "#ffb2c6"],
  },
  {
    id: "cybermatcha",
    label: "Cyber Matcha",
    hint: "Obsidian carbon & neon matcha",
    mode: "dark",
    swatch: ["#0b0e0c", "#131916", "#3ce68a"],
  },
  {
    id: "espresso",
    label: "Smoked Espresso",
    hint: "Dark roast & copper amber",
    mode: "dark",
    swatch: ["#13100e", "#1c1714", "#e58553"],
  },
];

LIGHT_THEMES.push(
  {
    id: "pastel",
    label: "Pastel Snack Box",
    hint: "Foxnut cream, seafoam & berry",
    mode: "light",
    swatch: ["#faf7f0", "#f2ede2", "#267862"],
  },
  {
    id: "kyoto",
    label: "Kyoto Paper",
    hint: "Warm washi paper & persimmon",
    mode: "light",
    swatch: ["#f6f5f2", "#efece6", "#b83b24"],
  },
);

export const ALL_THEMES = [...LIGHT_THEMES, ...DARK_THEMES];

/** Page background of a theme — used for the browser / PWA bar colour. */
export function themeColor(id: string, dark: boolean): string {
  const key = id === "coral" ? "koka" : id;
  const found = ALL_THEMES.find((t) => t.id === key);
  return found ? found.swatch[0] : dark ? "#191213" : "#faf9f6";
}

/** Point <meta name="theme-color"> at the active theme so the browser / PWA bar matches. */
export function applyThemeColor(id: string, dark: boolean): void {
  if (typeof document === "undefined") return;
  let meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = themeColor(id, dark);
}
