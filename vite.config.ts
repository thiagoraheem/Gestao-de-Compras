import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? []
      : []),
  ],
  define: {
    'import.meta.env.VITE_BASE_API_URL': JSON.stringify(process.env.BASE_API_URL),
    'import.meta.env.VITE_HMR_PORT': JSON.stringify('5201'),
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    host: 'localhost',
    port: 5201,
    hmr: false, // Disable HMR to avoid WebSocket conflicts
    allowedHosts: [
      'localhost',
      '*.replit.dev',
      '*.repl.co'
    ]
  },
});
