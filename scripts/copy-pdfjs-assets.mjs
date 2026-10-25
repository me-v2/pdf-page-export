import { cpSync, existsSync, mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"

const require = createRequire(import.meta.url)
const root = dirname(require.resolve("pdfjs-dist/package.json"))
const destRoot = join(process.cwd(), "public/pdfjs")
mkdirSync(destRoot, { recursive: true })

for (const name of ["cmaps", "standard_fonts", "wasm", "iccs", "image_decoders"]) {
  const source = join(root, name)
  if (!existsSync(source)) continue
  cpSync(source, join(destRoot, name), { recursive: true })
}
