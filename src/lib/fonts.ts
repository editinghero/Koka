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
  {
    id: "spacegrotesk",
    label: "Space Grotesk",
    description: "Techy geometric",
    fontStack: '"Space Grotesk", "Inter", sans-serif',
  },
  {
    id: "nunito",
    label: "Nunito",
    description: "Soft & rounded",
    fontStack: '"Nunito", "Inter", sans-serif',
  },
  {
    id: "agravepro",
    label: "Agrave Pro",
    description: "Hand-drawn & condensed",
    fontStack: '"Agrave Pro", "Inter", sans-serif',
  },
  {
    id: "playfair",
    label: "Playfair Display",
    description: "Elegant serif",
    fontStack: '"Playfair Display", Georgia, serif',
  },
];

/**
 * Add a stylesheet <link> once. If it fails to load (for example a weight that
 * the family does not offer), retry with `fallbackHref` so the font still loads.
 */
function injectFontLink(id: string, href: string, fallbackHref?: string) {
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  if (fallbackHref) {
    link.onerror = () => {
      link.onerror = null;
      link.href = fallbackHref;
    };
  }
  document.head.appendChild(link);
}

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
  } else if (font === "spacegrotesk") {
    if (!document.getElementById("font-link-spacegrotesk")) {
      const link = document.createElement("link");
      link.id = "font-link-spacegrotesk";
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap";
      document.head.appendChild(link);
    }
  } else if (font === "nunito") {
    if (!document.getElementById("font-link-nunito")) {
      const link = document.createElement("link");
      link.id = "font-link-nunito";
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap";
      document.head.appendChild(link);
    }
  } else if (font === "agravepro") {
    injectFontLink(
      "font-link-agravepro",
      "https://fonts.googleapis.com/css2?family=Agrave+Pro:wght@300;400;700&display=swap",
      "https://fonts.googleapis.com/css2?family=Agrave+Pro&display=swap",
    );
  } else if (font === "playfair") {
    injectFontLink(
      "font-link-playfair",
      "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800&display=swap",
    );
  }
}
