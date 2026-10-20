import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    ...(mode === "analyze"
      ? [
          visualizer({
            filename: "dist/bundle-report.html",
            gzipSize: true,
            brotliSize: true,
          }),
        ]
      : []),
  ],
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.js"],
    include: ["src/**/*.{test,spec}.{js,jsx}", "server/**/*.test.js"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/**/*.{js,jsx}"],
      exclude: ["src/**/*.test.{js,jsx}", "src/**/*.spec.{js,jsx}", "src/test/**", "src/main.jsx"],
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  // `vite preview` serves the built bundle. The e2e suite runs against it
  // instead of the dev server: the dev server transforms ~3000 modules on the
  // first request, and a parallel Playwright run against it times out
  // intermittently. The built app is deterministic.
  preview: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
}));
