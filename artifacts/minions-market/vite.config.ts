import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        // Для аудио-стримов отключаем буферизацию
        configure: (proxy) => {
          proxy.on("proxyReq", (_proxyReq, req) => {
            if (req.url?.startsWith("/api/radio/stream")) {
              // не буферизировать ответ стрима
            }
          });
        },
      },
    },
  },
});
