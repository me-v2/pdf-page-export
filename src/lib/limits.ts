export const MAX_EDGE = 8192
export const MAX_PREVIEW_PIXELS = 16_000_000
export const MAX_EXPORT_PIXELS = 40_000_000
export const TILE_SIZE = 2048

export type Tile = {
  x: number
  y: number
  width: number
  height: number
}

export function planTiles(pixelWidth: number, pixelHeight: number): Tile[] {
  const width = Math.max(1, Math.floor(pixelWidth))
  const height = Math.max(1, Math.floor(pixelHeight))
  const tooBig =
    width > MAX_EDGE ||
    height > MAX_EDGE ||
    width * height > MAX_PREVIEW_PIXELS
  if (!tooBig) return [{ x: 0, y: 0, width, height }]

  const tiles: Tile[] = []
  for (let y = 0; y < height; y += TILE_SIZE) {
    for (let x = 0; x < width; x += TILE_SIZE) {
      tiles.push({
        x,
        y,
        width: Math.min(TILE_SIZE, width - x),
        height: Math.min(TILE_SIZE, height - y),
      })
    }
  }
  return tiles
}

export function exportTooLarge(width: number, height: number): boolean {
  return (
    width > MAX_EDGE || height > MAX_EDGE || width * height > MAX_EXPORT_PIXELS
  )
}
