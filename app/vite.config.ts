import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "node:path"

export default defineConfig({
  // GitHub Pages serves a project (non-custom-domain) site at
  // https://<user>.github.io/<repo>/, so every asset URL needs that repo
  // name as a base path in production. Local dev/preview still wants "/".
  base: process.env.GITHUB_PAGES ? "/fit-lab/" : "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
})
