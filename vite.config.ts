import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: { tsconfigPaths: true },
  server: {
    host: "127.0.0.1",
    port: 3000,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 3000,
    strictPort: true,
  },
  optimizeDeps: {
    include: ["fflate", "pdfjs-dist"],
  },
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
})
