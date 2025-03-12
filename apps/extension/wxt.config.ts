import {
  presetAttributify,
  presetUno,
  presetWebFonts,
  transformerVariantGroup,
} from "unocss";

import type { ConfigEnv } from 'vite';
import UnoCSS from "unocss/vite";
import { defineConfig } from "wxt";
import presetRemToPx from "@unocss/preset-rem-to-px";
import { resolve } from 'path';

// See https://wxt.dev/api/config.html
export default defineConfig({
  extensionApi: "chrome",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: 'Tag',
    description: 'A better way to manage your tabs',
    version: '0.0.1',
    permissions: [
      'tabs',
      'bookmarks',
      'storage',
      'processes',
      'scripting'
    ],
    host_permissions: [
      '<all_urls>'
    ],
    action: {
      default_title: 'Tag',
      default_icon: {
        '16': '/src/assets/icon-16.png',
        '32': '/src/assets/icon-32.png',
        '48': '/src/assets/icon-48.png',
        '128': '/src/assets/icon-128.png'
      }
    },
    icons: {
      '16': '/src/assets/icon-16.png',
      '32': '/src/assets/icon-32.png',
      '48': '/src/assets/icon-48.png',
      '128': '/src/assets/icon-128.png'
    },
    commands: {
      'open-dialog': {
        suggested_key: {
          default: 'Alt+T'
        },
        description: 'Open Tag dialog'
      }
    }
  },
  runner: {
    startUrls: [
      "https://wxt.dev",
      "https://duckduckgo.com",
      "http://localhost:5173",
    ],
  },
  srcDir: resolve(__dirname, 'src'),
  entrypointsDir: resolve(__dirname, 'entrypoints'),
  outDir: resolve(__dirname, 'dist'),
  vite: (env: ConfigEnv) => ({
    plugins: [
      // React(),
      UnoCSS({
        rules: [
          [/^m-(\d+)$/, ([, d]) => ({ margin: `${Number(d) / 4}rem` })],
          [/^w-(\d+)$/, ([, d]) => ({ width: `${Number(d) / 4}rem` })],
          [/^p-(\d+)$/, (match) => ({ padding: `${Number(match[1]) / 4}rem` })],
        ],
        presets: [
          presetUno(),
          presetAttributify(),
          // https://www.joshwcomeau.com/css/surprising-truth-about-pixels-and-accessibility/If the value should increase with the default font size, I use rem. Otherwise, I use px.
          presetRemToPx(),
          presetWebFonts(),
        ],
        transformers: [transformerVariantGroup()],
      }),
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    }
  })
});
