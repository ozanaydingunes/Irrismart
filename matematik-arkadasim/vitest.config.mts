import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Testler proje klasörüne sayaç dosyası yazmasın
    // LOCAL_SOLVER_FIRST=0: mevcut sağlayıcı testleri sahte modele gerçekten ulaşsın (yerel motor ayrıca test edilir)
    env: { COUNTER_STORE: "memory", LOCAL_SOLVER_FIRST: "0" },
    include: ["tests/**/*.test.ts"],
  },
});
