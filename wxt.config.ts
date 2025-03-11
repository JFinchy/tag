import { presetAttributify, presetUno, presetWebFonts, transformerVariantGroup } from 'unocss'

import UnoCSS from 'unocss/vite'
import { defineConfig } from 'wxt';
import presetRemToPx from '@unocss/preset-rem-to-px'

// See https://wxt.dev/api/config.html
export default defineConfig({
  extensionApi: 'chrome',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    permissions: ['storage', 'tabs', 'topSites', 'bookmarks', 'activeTab', 'browsingData', 'history', 'pageCapture' , 'tabGroups', 'tabCapture'],
  },
  vite: () => ({
    plugins: [
      // React(),
      UnoCSS({
        presets: [
          presetUno(),
          presetAttributify(),
          // https://www.joshwcomeau.com/css/surprising-truth-about-pixels-and-accessibility/If the value should increase with the default font size, I use rem. Otherwise, I use px.
          presetRemToPx(),
          presetWebFonts()
        ],
        transformers: [
          transformerVariantGroup()
        ]
      }),
    ],
  })
});
