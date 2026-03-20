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
      abel: {
        primary: "var(--abel-primary)",
        "primary-hover": "var(--abel-primary-hover)",
        "primary-light": "var(--abel-primary-light)",
        secondary: "var(--abel-secondary)",
        "secondary-light": "var(--abel-secondary-light)",
        bg: "var(--abel-bg)",
        "bg-elevated": "var(--abel-bg-elevated)",
        "bg-sunken": "var(--abel-bg-sunken)",
        ink: "var(--abel-ink)",
        "ink-secondary": "var(--abel-ink-secondary)",
        "ink-tertiary": "var(--abel-ink-tertiary)",
        border: "var(--abel-border)",
        "border-strong": "var(--abel-border-strong)",
        success: "var(--abel-success)",
        warning: "var(--abel-warning)",
        error: "var(--abel-error)",
        info: "var(--abel-info)",
      },
      white: "#ffffff",
      black: "#000000",
    },
    extend: {
      fontFamily: {
        display: ["Satoshi", "DM Sans", "Noto Sans SC", "sans-serif"],
        body: ["DM Sans", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", "sans-serif"],
        code: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        "abel-sm": "var(--abel-radius-sm)",
        "abel-md": "var(--abel-radius-md)",
        "abel-lg": "var(--abel-radius-lg)",
      },
      boxShadow: {
        "abel-sm": "var(--abel-shadow-sm)",
        "abel-md": "var(--abel-shadow-md)",
        "abel-lg": "var(--abel-shadow-lg)",
      },
    },
  },
};
