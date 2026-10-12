import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// ANALYZE=1 bun run build -> dist/stats.html (bundle audit, run once).
export default defineConfig(async () => {
  const plugins: PluginOption[] = [react(), tailwindcss()];
  if (process.env.ANALYZE) {
    const { visualizer } = await import("rollup-plugin-visualizer");
    plugins.push(visualizer({ filename: "dist/stats.html", gzipSize: true }));
  }
  return {
    plugins,
    clearScreen: false,
    server: { port: 1420, strictPort: true, watch: { ignored: ["**/src-tauri/**"] } },
    build: { target: "es2022", assetsInlineLimit: 0, chunkSizeWarningLimit: 600 },
  };
});
