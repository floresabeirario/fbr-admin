import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    // Espelha o alias "@/*" do tsconfig.json
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // O pool paralelo do vitest v4 rebenta ("Cannot read properties of
    // undefined (reading 'config')") ao carregar vários ficheiros de teste
    // ao mesmo tempo — falha no CI (ubuntu) e no preflight local (Windows).
    // Correr em série é fiável e rápido o suficiente (100 testes ~9s).
    fileParallelism: false,
  },
});
