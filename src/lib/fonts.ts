import type { FontOption } from "./types";

export type FontPreset = {
  id: FontOption;
  label: string;
  description: string;
  fontStack: string;
};

export const FONT_OPTIONS: FontPreset[] = [
  {
    id: "default",
    label: "Default",
    description: "Sora / Manrope",
    fontStack: '"Sora", "Manrope", sans-serif',
  },
  {
    id: "satoshi",
    label: "Satoshi",
    description: "Satoshi + Inter",
    fontStack: '"Satoshi", "Inter", sans-serif',
  },
  {
    id: "baloo2",
    label: "Baloo 2",
    description: "Baloo 2",
    fontStack: '"Baloo 2", cursive, sans-serif',
  },
  {
    id: "outfit",
    label: "Outfit",
    description: "Outfit",
    fontStack: '"Outfit", sans-serif',
  },
];

export function loadFontAssets(font: FontOption) {
  if (typeof document === "undefined") return;

  if (font === "satoshi") {
    if (!document.getElementById("font-link-satoshi")) {
      const link1 = document.createElement("link");
      link1.id = "font-link-satoshi";
      link1.rel = "stylesheet";
      link1.href =
        "https://api.fontshare.com/v2/css?f[]=satoshi@500,700&display=swap";
      document.head.appendChild(link1);
    }
    if (!document.getElementById("font-link-inter")) {
      const link2 = document.createElement("link");
      link2.id = "font-link-inter";
      link2.rel = "stylesheet";
      link2.href =
        "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
      document.head.appendChild(link2);
    }
  } else if (font === "baloo2") {
    if (!document.getElementById("font-link-baloo2")) {
      const link = document.createElement("link");
      link.id = "font-link-baloo2";
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700&display=swap";
      document.head.appendChild(link);
    }
  } else if (font === "outfit") {
    if (!document.getElementById("font-link-outfit")) {
      const link = document.createElement("link");
      link.id = "font-link-outfit";
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap";
      document.head.appendChild(link);
    }
  }
}
