// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only; this project uses node-server for Render),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const useVercel = process.env.VERCEL === "1" || process.env.NITRO_PRESET === "vercel";

export default defineConfig({
  nitro: useVercel
    ? { preset: "vercel" }
    : { preset: "node-server" },
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            const moduleId = id.replaceAll("\\", "/");
            if (!moduleId.includes("/node_modules/")) return undefined;
            if (moduleId.includes("/node_modules/@supabase/")) return "supabase-vendor";
            if (moduleId.includes("/node_modules/recharts/")) return "charts-vendor";
            if (
              moduleId.includes("/node_modules/leaflet/") ||
              moduleId.includes("/node_modules/leaflet-draw/") ||
              moduleId.includes("/node_modules/react-leaflet/")
            ) return "maps-vendor";
            if (moduleId.includes("/node_modules/jspdf/") || moduleId.includes("/node_modules/jspdf-autotable/")) {
              return "reports-vendor";
            }
            return undefined;
          },
        },
      },
      chunkSizeWarningLimit: 650,
    },
    server: {
      allowedHosts: true,
      // Headers de seguridad en desarrollo (producción los maneja Render/Vercel a nivel de plataforma)
      headers: {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
      },
    },
  },
});
