import { describe, expect, it } from "vitest"
import { zoomIn, zoomOut } from "./zoom"

describe("zoom", () => {
  it("steps past the fitted width instead of shrinking it", () => {
    expect(zoomIn({ kind: "fit" }, 184)).toEqual({ kind: "percent", value: 200 })
    expect(zoomOut({ kind: "fit" }, 184)).toEqual({ kind: "percent", value: 150 })
  })

  it("uses the next fixed step from a percentage", () => {
    expect(zoomIn({ kind: "percent", value: 150 })).toEqual({ kind: "percent", value: 200 })
    expect(zoomOut({ kind: "percent", value: 150 })).toEqual({ kind: "percent", value: 100 })
  })
})
