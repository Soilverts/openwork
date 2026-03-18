import { radixColors, tailwindSafelist } from "../app/src/styles/tailwind-colors";

export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "../app/src/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  safelist: [tailwindSafelist],
  theme: {
    colors: {
      ...radixColors,
      dls: {
        surface: "var(--dls-surface)",
        sidebar: "var(--dls-sidebar)",
        border: "var(--dls-border)",
        accent: "var(--dls-accent)",
        text: "var(--dls-text-primary)",
        secondary: "var(--dls-text-secondary)",
        hover: "var(--dls-hover)",
        active: "var(--dls-active)",
      },
      white: "#ffffff",
      black: "#000000",
    },
  },
};
