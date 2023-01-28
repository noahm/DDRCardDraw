import { defineConfig, splitVendorChunkPlugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import fs from "fs";
import { basename, resolve } from "path";
import faviconsPlugin from "@darkobits/vite-plugin-favicons";

const iconSource = "./public/ddr-tools-256.png";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("@blueprintjs/")) {
            return "blueprint";
          }
          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
      },
    },
  },
  plugins: [
    react(),
    faviconsPlugin({
      appName: "DDR Tools - card draw and more!",
      appShortName: "DDR Tools",
      theme_color: "#28b6ea",
      display: "standalone",
      scope: "/",
      start_url: "/",
      manifestMaskable: true,
      icons: {
        android: {
          source: iconSource,
          offset: 15,
        },
        appleIcon: {
          source: iconSource,
          offset: 10,
        },
        favicons: {
          source: iconSource,
        },
        appleStartup: {
          source: iconSource,
        },
      },
    }),
    VitePWA({
      manifest: false,
    }),
  ],
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
