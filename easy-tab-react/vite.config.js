import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server:{
    port: 3030
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
