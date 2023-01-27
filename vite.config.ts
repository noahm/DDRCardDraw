import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import fs from "fs";
import { basename, resolve } from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), VitePWA()],
  define: {
    __DATA_FILES__: JSON.stringify(
      fs.readdirSync(resolve(__dirname, "src/songs")).map((file) => ({
        name: basename(file, ".json"),
        display: JSON.parse(
          fs.readFileSync(resolve(__dirname, "src/songs", file), {
            encoding: "utf-8",
          })
        ).i18n.en.name,
      }))
    ),
  },
  css: {
    modules: {
      generateScopedName: "[local]__[hash:base64:5]",
    },
  },
});
