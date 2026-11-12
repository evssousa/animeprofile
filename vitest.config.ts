import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Separado do vite.config.ts: o plugin do React Router não roda dentro do Vitest.
export default defineConfig({
  resolve: { alias: { "~": fileURLToPath(new URL("./app", import.meta.url)) } },
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 20_000,
    hookTimeout: 300_000, // o primeiro teste com banco baixa o MySQL descartável
  },
});
