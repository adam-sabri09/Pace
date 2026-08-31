import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    // .tsx tests get jsdom (React Testing Library); .ts tests stay on node.
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["src/tests/**/*.test.ts"],
        },
        resolve: {
          alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
          },
        },
      },
      {
        test: {
          name: "component",
          environment: "jsdom",
          include: ["src/tests/**/*.test.tsx"],
          setupFiles: ["./src/tests/setup-dom.ts"],
        },
        resolve: {
          alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
            // server-only is a Next.js guard that throws in non-server contexts.
            // In jsdom tests we stub it out so component tests can import server modules.
            "server-only": fileURLToPath(new URL("./src/tests/__mocks__/server-only.ts", import.meta.url)),
          },
        },
      },
    ],
  },
});
