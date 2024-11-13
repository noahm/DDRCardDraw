// import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

// import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";

/** @type {import("@typescript-eslint/utils").TSESLint.FlatConfig.Config}*/
const reactHooksConfig = {
  plugins: {
    "react-hooks": reactHooksPlugin,
  },
  rules: reactHooksPlugin.configs.recommended.rules,
};

export default tseslint.config(
  {
    ignores: ["scripts/", "surge-redirect/", "webpack.config.js"],
  },
  {
    settings: {
      node: {
        extensions: [".ts", ".json"],
      },
      react: {
        version: "detect",
      },
    },
  },
  // eslint.configs.recommended,
  ...tseslint.configs.recommended,
  // reactPlugin.configs.flat.recommended,
  // reactPlugin.configs.flat["jsx-runtime"],
  reactHooksConfig,
  eslintConfigPrettier,
);
