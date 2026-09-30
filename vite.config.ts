import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// PGlite ships a WebAssembly build of Postgres; it must be excluded from
// Vite's dependency pre-bundling so the .wasm/.data assets resolve correctly.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ["@electric-sql/pglite"],
  },
  worker: {
    format: "es",
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("node-sql-parser")) return "vendor-sqlparser";
            if (/[\\/](@codemirror|@uiw|@lezer|codemirror)[\\/]/.test(id)) return "vendor-editor";
            if (/[\\/]d3-/.test(id)) return "vendor-d3";
            if (/[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "vendor-react";
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
  },
});
