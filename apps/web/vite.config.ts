import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/Raccoon-Quest-Battle-LAB/",
  plugins: [react()],
  server: {
    port: 5173,
  },
});