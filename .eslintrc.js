module.exports = {
  env: {
    browser: true,
    es2021: true,
    webextensions: true, // set webextensions globals
    node: true, // eslint runs in node: set "module" global for eslint config
  },
  extends: [
    "plugin:mozilla/recommended", //TODO standard can be removed from deps
    // disabled as normally, mozilla should handle them
    //'prettier' // deactives rules that conflict with prettier
  ],
  plugins: ["mozilla"],
  parserOptions: {
    ecmaVersion: 12,
  },
  rules: {
    "spaced-comment": "off",
  },
};
