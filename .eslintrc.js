module.exports = {
  env: {
    browser: true,
    es2021: true,
    webextensions: true, // set webextensions globals
    node: true, // eslint runs in node: set "module" global for eslint config
  },
  extends: [
    "plugin:mozilla/recommended", // requires also: eslint-plugin-html, eslint-plugin-fetch-options, eslint-plugin-json
    //'prettier' // deactives rules that conflict with prettier, deactivated as mozilla includes this
  ],
  plugins: ["mozilla"],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: "module",
  },
  rules: {
    "spaced-comment": "off",
    "no-console": "off",
  },
  globals: {
    messenger: true,
  }
};
