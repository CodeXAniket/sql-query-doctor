import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("node-sql-parser")) return "vendor-sqlparser";
            if (/[\\/](@codemirror|@uiw|@lezer|codemirror)[\\/]/.test(id)) return "vendor-editor";
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
