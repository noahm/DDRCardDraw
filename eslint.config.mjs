import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

import reactHooksPlugin from "eslint-plugin-react-hooks";

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
  ...tseslint.configs.recommended,
  reactHooksPlugin.configs.recommended,
  eslintConfigPrettier,
);
