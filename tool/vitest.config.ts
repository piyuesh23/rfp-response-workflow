import { defineConfig } from "vitest/config";
import path from "path";

const alias = { "@": path.resolve(__dirname, "./src") };

export default defineConfig({
  resolve: { alias },
  test: {
    globals: true,
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: ["src/__tests__/unit/**/*.test.ts", "src/__tests__/unit/**/*.test.tsx"],
          environment: "node",
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["src/__tests__/integration/**/*.test.ts"],
          environment: "node",
          globalSetup: ["src/__tests__/integration/setup/global-setup.ts"],
          hookTimeout: 60_000,
          testTimeout: 30_000,
          fileParallelism: false, // shared DB — run files serially to prevent interference
          pool: "forks",
          singleFork: true,
        },
      },
    ],
  },
});
