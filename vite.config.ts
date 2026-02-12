import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import legacy from "@vitejs/plugin-legacy"; // <--- Importação adicionada

export default defineConfig(({ mode }) => {
  // Carrega variáveis .env
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      // <--- Configuração do Legacy para iOS --->
      legacy({
        targets: ['defaults', 'not IE 11', 'iOS >= 12'],
        additionalLegacyPolyfills: ['regenerator-runtime/runtime']
      }),
      ...(process.env.NODE_ENV !== "production" &&
      process.env.REPL_ID !== undefined
        ? []
        : []),
    ],
    define: {
      'import.meta.env.VITE_BASE_API_URL': JSON.stringify(env.BASE_API_URL ?? ""),
      'import.meta.env.VITE_WEBSOCKET_URL': JSON.stringify(env.WEBSOCKET_URL ?? ""),
    },
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
    },
    root: path.resolve(import.meta.dirname, "client"),
    optimizeDeps: {
      esbuildOptions: {
        target: "es2015", // <--- Alterado de esnext para es2015
      },
    },
    build: {
      target: "es2015", // <--- Alterado de esnext para es2015
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
      sourcemap: false, // Opcional: desativa mapas para economizar espaço
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
  };
});