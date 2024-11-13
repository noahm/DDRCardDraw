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
    // files: ["src/**/*.{js,mjs,cjs,ts,jsx,tsx}"],
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
  {
    rules: {
      // "comma-dangle": 0,
      // "no-trailing-spaces": "off",
      // "import/extensions": 0,
      // "@typescript-eslint/ban-ts-ignore": 0,
      // "@typescript-eslint/explicit-function-return-type": 0,
      // "@typescript-eslint/no-empty-function": "off",
      // "@typescript-eslint/no-explicit-any": "off",
    },
    // overrides: [
    //   {
    //     files: ["src/**/*"],
    //     rules: {
    //       "max-lines": "off",
    //       "max-nested-callbacks": "off",
    //       "max-statements": "off",
    //     },
    //   },
    // ],
  },
);
