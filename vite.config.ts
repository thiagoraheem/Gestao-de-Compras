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
    // Allow overriding the WebSocket URL for production deployments where
    // the app is served on one port and the Node server listens on another.
    'import.meta.env.VITE_WEBSOCKET_URL': JSON.stringify(process.env.WEBSOCKET_URL || ''),
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
    host: true,
    allowedHosts: [
      'localhost',
      '*.replit.dev',
      '*.repl.co'
    ]
  },
});
