import comments from "eslint-plugin-eslint-comments";
import fp from "eslint-plugin-fp";
import globals from "globals";
import htmlPlugins from "eslint-plugin-html";
import importLint from "eslint-plugin-import";
import jsonPlugin from "eslint-plugin-json";
import jsxA11yPlugin from "eslint-plugin-jsx-a11y";
import noBarrelFiles from "eslint-plugin-no-barrel-files";
import noSecrets from "eslint-plugin-no-secrets";
import playwrite from "eslint-plugin-playwright";
import pluginJs from "@eslint/js";
import prettierPlugin from "eslint-plugin-prettier/recommended";
import promise from "eslint-plugin-promise";
import reactHooksPlugin from "eslint-plugin-react";
import reactPlugin from "eslint-plugin-react";
import security from "eslint-plugin-security";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import sonarjs from "eslint-plugin-sonarjs";
import standard from "eslint-config-standard";
import testingLibrary from "eslint-plugin-testing-library";
import treeShake from "eslint-plugin-tree-shaking";
import tsDoc from "eslint-plugin-tsdoc";
import tseslint from "typescript-eslint";
import unicorn from "eslint-plugin-unicorn";
import vitest from "eslint-plugin-vitest";
import yaml from "eslint-plugin-yml";

/** @type {import('eslint').Linter.Config[]} */
export default [
  { files: ["**/*.{js,mjs,cjs,ts,html}"] },
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  // UI
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat["jsx-runtime"],
  reactHooksPlugin.configs.flat.recommended,
  {
    plugins: {
      a11y: jsxA11yPlugin.configs.recommended,
    },
  },
  htmlPlugins,

  // extra langs
  {
    plugins: {
      jsonPlugin,
      comments,
    },
  },
  // bad - TypeError: Unexpected array.
  // yaml.configs['flat/recommended'],
  {
    plugins: {
      tsdoc: tsDoc,
    },
  },
  // "eslint-plugin-node",

  // package management
  {
    plugins: {
      importLint,
      simpleImportSort,
      noSecrets,
      noBarrelFiles,
      security: security.configs.recommended,
      treeShake,
    },
  },
  // "eslint-plugin-import-helpers",
  // "eslint-plugin-canonical",

  // strict standards and code quality
  {
    plugins: {
      fp: fp.configs.recommended,
      sonar: sonarjs.configs.recommended,
      unicoren: unicorn.configs.recommended,
      promise,
      standard: standard.plugins,
    },
  },

  // testing
  {
    plugins: {
      vitest: vitest.configs.recommended,
      playwrite: playwrite.configs.recommended,
    },
  },
  testingLibrary.configs["flat/react"],

  prettierPlugin,
];
