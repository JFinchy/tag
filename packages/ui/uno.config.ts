import { defineConfig, presetAttributify, presetUno } from "unocss";

import { presetRemToPx } from "@unocss/preset-rem-to-px";
import transformerVariantGroup from "@unocss/transformer-variant-group";

export default defineConfig({
  presets: [presetUno(), presetAttributify(), presetRemToPx()],
  transformers: [transformerVariantGroup()],
  theme: {
    colors: {
      background: "var(--background)",
      foreground: "var(--foreground)",
      primary: {
        DEFAULT: "var(--primary)",
        foreground: "var(--primary-foreground)",
      },
      secondary: {
        DEFAULT: "var(--secondary)",
        foreground: "var(--secondary-foreground)",
      },
      destructive: {
        DEFAULT: "var(--destructive)",
        foreground: "var(--destructive-foreground)",
      },
      muted: {
        DEFAULT: "var(--muted)",
        foreground: "var(--muted-foreground)",
      },
      accent: {
        DEFAULT: "var(--accent)",
        foreground: "var(--accent-foreground)",
      },
    },
    borderRadius: {
      DEFAULT: "var(--radius)",
    },
  },
});
