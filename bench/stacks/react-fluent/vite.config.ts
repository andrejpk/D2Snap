import { defineConfig } from "vite";

export default defineConfig({
  base: "/fixture/",
  build: { outDir: "dist", emptyOutDir: true },
});
