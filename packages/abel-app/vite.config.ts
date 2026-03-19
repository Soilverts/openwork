import os from "node:os";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import solid from "vite-plugin-solid";

const portValue = Number.parseInt(process.env.PORT ?? "", 10);
const devPort = Number.isFinite(portValue) && portValue > 0 ? portValue : 5174;

const allowedHosts = new Set<string>();
const envAllowedHosts = process.env.VITE_ALLOWED_HOSTS ?? "";

const addHost = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) return;
  allowedHosts.add(trimmed);
};

envAllowedHosts.split(",").forEach(addHost);
addHost(process.env.OPENWORK_PUBLIC_HOST ?? null);
const hostname = os.hostname();
addHost(hostname);
const shortHostname = hostname.split(".")[0];
if (shortHostname && shortHostname !== hostname) {
  addHost(shortHostname);
}

export default defineConfig({
  plugins: [tailwindcss(), solid()],
  resolve: {
    alias: {
      // Redirect the original OpenWork logo component to Abel's logo
      "../../app/src/app/components/openwork-logo": resolve(__dirname, "src/abel-logo.tsx"),
      "../components/openwork-logo": resolve(__dirname, "src/abel-logo.tsx"),
      "./openwork-logo": resolve(__dirname, "src/abel-logo.tsx"),
    },
    dedupe: [
      "solid-js",
      "solid-js/web",
      "solid-js/store",
      "@solidjs/router",
      "@tauri-apps/api",
      "@tauri-apps/plugin-opener",
      "@tauri-apps/plugin-process",
      "@tauri-apps/plugin-dialog",
      "@tauri-apps/plugin-http",
      "@tauri-apps/plugin-updater",
      "@tauri-apps/plugin-deep-link",
      "@opencode-ai/sdk",
    ],
  },
  server: {
    port: devPort,
    strictPort: true,
    ...(allowedHosts.size > 0 ? { allowedHosts: Array.from(allowedHosts) } : {}),
  },
  build: {
    target: "esnext",
  },
});
