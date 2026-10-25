import { describe, expect, it } from "vitest"
import { THUMB_DEFAULT, THUMB_MAX, clampThumbWidth, readThumbWidth } from "./thumb-width"

describe("thumb width", () => {
  it("caps the column at one and a half times the current width", () => {
    expect(THUMB_MAX).toBe(THUMB_DEFAULT * 1.5)
    expect(clampThumbWidth(200)).toBe(200)
    expect(clampThumbWidth(400)).toBe(300)
    expect(clampThumbWidth(100)).toBe(160)
    expect(readThumbWidth(null)).toBe(200)
  })
})
