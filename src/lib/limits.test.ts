import { describe, expect, it } from "vitest"
import { exportTooLarge, planTiles } from "./limits"

describe("preview tiles", () => {
  it("keeps an ordinary page in one tile", () => {
    expect(planTiles(1200, 1600)).toEqual([
      { x: 0, y: 0, width: 1200, height: 1600 },
    ])
  })

  it("slices a long page into vertical tiles", () => {
    const tiles = planTiles(1000, 20000)
    expect(tiles.length).toBeGreaterThan(1)
    expect(tiles[0]).toMatchObject({ x: 0, y: 0, height: 2048 })
    expect(tiles.at(-1)?.y).toBe(2048 * (tiles.length - 1))
  })
})

describe("export limits", () => {
  it("accepts an A4 page at 300 DPI and rejects an oversized raster", () => {
    expect(exportTooLarge(2480, 3508)).toBe(false)
    expect(exportTooLarge(9000, 1000)).toBe(true)
    expect(exportTooLarge(7000, 7000)).toBe(true)
  })
})
