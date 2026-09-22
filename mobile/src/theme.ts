// The same palette as the web app, so the two feel like one product.
//
// Taken from the CSS custom properties in ../../app/globals.css. They can't be
// imported here — React Native has no CSS — which is a small, concrete example
// of what does and doesn't cross the platform boundary: logic travels, styling
// does not (MOBILE_PLAN.md §3).

export interface Palette {
  background: string;
  foreground: string;
  mutedForeground: string;
  subtleForeground: string;
  accent: string;
  card: string;
  cardBorder: string;
  surfaceMuted: string;
  success: string;
  danger: string;
}

export const DARK: Palette = {
  background: "#0a0a0c",
  foreground: "#e7e7ea",
  mutedForeground: "#8b8b94",
  subtleForeground: "#6b6b74",
  accent: "#0ea5e9",
  card: "#101014",
  cardBorder: "rgba(255, 255, 255, 0.08)",
  surfaceMuted: "rgba(255, 255, 255, 0.035)",
  success: "#10b981",
  danger: "#f87171",
};

export const LIGHT: Palette = {
  background: "#fbfbfc",
  foreground: "#0a0a0b",
  mutedForeground: "#5a5a63",
  subtleForeground: "#74747d",
  accent: "#0284c7",
  card: "#ffffff",
  cardBorder: "rgba(0, 0, 0, 0.1)",
  surfaceMuted: "rgba(0, 0, 0, 0.03)",
  success: "#059669",
  danger: "#dc2626",
};

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const RADIUS = { control: 8, card: 14 } as const;
