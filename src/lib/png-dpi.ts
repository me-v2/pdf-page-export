const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let crc = n
    for (let k = 0; k < 8; k += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
    }
    table[n] = crc >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  )
}

function writeUint32(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = (value >>> 24) & 0xff
  bytes[offset + 1] = (value >>> 16) & 0xff
  bytes[offset + 2] = (value >>> 8) & 0xff
  bytes[offset + 3] = value & 0xff
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  writeUint32(out, 0, data.length)
  out.set(
    [type.charCodeAt(0), type.charCodeAt(1), type.charCodeAt(2), type.charCodeAt(3)],
    4,
  )
  out.set(data, 8)
  writeUint32(out, 8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

function chunkType(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(
    bytes[offset + 4],
    bytes[offset + 5],
    bytes[offset + 6],
    bytes[offset + 7],
  )
}

export function withPngDpi(png: Uint8Array, dpi: number): Uint8Array {
  for (let index = 0; index < PNG_SIGNATURE.length; index += 1) {
    if (png[index] !== PNG_SIGNATURE[index]) throw new Error("不是 PNG")
  }
  const length = readUint32(png, 8)
  if (chunkType(png, 8) !== "IHDR") throw new Error("PNG 缺少 IHDR")
  const ihdrEnd = 8 + 12 + length
  let restStart = ihdrEnd
  if (restStart + 8 <= png.length && chunkType(png, restStart) === "pHYs") {
    restStart += 12 + readUint32(png, restStart)
  }

  const ppm = Math.round(dpi / 0.0254)
  const data = new Uint8Array(9)
  writeUint32(data, 0, ppm)
  writeUint32(data, 4, ppm)
  data[8] = 1
  const phys = chunk("pHYs", data)

  const out = new Uint8Array(ihdrEnd + phys.length + (png.length - restStart))
  out.set(png.subarray(0, ihdrEnd), 0)
  out.set(phys, ihdrEnd)
  out.set(png.subarray(restStart), ihdrEnd + phys.length)
  return out
}

export function readPngDpi(png: Uint8Array): number | null {
  let offset = 8
  while (offset + 12 <= png.length) {
    const length = readUint32(png, offset)
    const type = chunkType(png, offset)
    if (type === "pHYs") {
      return Math.round(readUint32(png, offset + 8) * 0.0254)
    }
    if (type === "IEND") break
    offset += 12 + length
  }
  return null
}
