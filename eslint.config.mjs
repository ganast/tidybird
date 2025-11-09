import js from "@eslint/js";
import globals from "globals";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import css from "@eslint/css";
import { defineConfig, globalIgnores } from "eslint/config";
//import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

export default defineConfig([
    {
      files: ["**/*.{js,mjs,cjs}"],
      plugins: { js },
      extends: [
        "js/recommended",
      ],
      languageOptions: {
        globals: {
          ...globals.browser,
          ...globals.webextensions,
          messenger: "readonly",
        }
      },
    },
    { files: ["**/*.json"], plugins: { json }, language: "json/json", extends: ["json/recommended"] },
    { files: ["**/*.md"], plugins: { markdown }, language: "markdown/gfm", extends: ["markdown/recommended"] },
    { files: ["**/*.css"], plugins: { css }, language: "css/css", extends: ["css/recommended"] },
    globalIgnores([
      "api/customui/",
      "options/sortablejs/",
      "package-lock.json",
    ]),
    //eslintPluginPrettierRecommended,
]);
