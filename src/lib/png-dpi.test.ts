import { describe, expect, it } from "vitest"
import { readPngDpi, withPngDpi } from "./png-dpi"

const ONE_PIXEL_PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  ),
  (char) => char.charCodeAt(0),
)

describe("png dpi", () => {
  it("writes a pHYs chunk for the selected dpi", () => {
    const encoded = withPngDpi(ONE_PIXEL_PNG, 300)
    expect(readPngDpi(encoded)).toBe(300)
    expect(readPngDpi(withPngDpi(encoded, 150))).toBe(150)
  })
})
