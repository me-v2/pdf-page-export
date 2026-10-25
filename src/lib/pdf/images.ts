import {
  ImageKind,
  OPS,
  type PDFPageProxy,
} from "pdfjs-dist"

type Paintable = CanvasImageSource & {
  width?: number
  height?: number
  displayWidth?: number
  displayHeight?: number
}

type ImageRecord = {
  width?: number
  height?: number
  data?: Uint8Array | Uint8ClampedArray
  kind?: number
  bitmap?: Paintable
}

function paintableSize(source: Paintable, fallbackWidth = 0, fallbackHeight = 0) {
  return {
    width: Math.max(1, Math.floor(source.displayWidth || source.width || fallbackWidth)),
    height: Math.max(1, Math.floor(source.displayHeight || source.height || fallbackHeight)),
  }
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error(`PNG 编码失败 ${canvas.width}x${canvas.height}`))
    }, "image/png")
  })
}

type ObjectStore = {
  get(objId: string, callback?: (value: unknown) => void): unknown
}

function readObject(store: ObjectStore, name: string): Promise<unknown> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (value: unknown) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    try {
      const immediate = store.get(name, finish)
      if (immediate) finish(immediate)
    } catch {
      finish(undefined)
    }
    setTimeout(() => finish(undefined), 2000)
  })
}

async function imageByName(page: PDFPageProxy, name: string): Promise<unknown> {
  const local = await readObject(page.objs, name)
  if (local) return local
  return readObject(page.commonObjs, name)
}

function expandPacked(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
) {
  const rgba = new Uint8ClampedArray(width * height * 4)
  const stride = Math.ceil(width / 8)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const byte = data[y * stride + (x >> 3)] ?? 0
      const bit = (byte >> (7 - (x & 7))) & 1
      const color = bit ? 255 : 0
      const offset = (y * width + x) * 4
      rgba[offset] = color
      rgba[offset + 1] = color
      rgba[offset + 2] = color
      rgba[offset + 3] = 255
    }
  }
  return rgba
}

function toImageData(record: ImageRecord): ImageData | null {
  const width = record.width ?? 0
  const height = record.height ?? 0
  const data = record.data
  if (!width || !height || !data) return null
  if (data.length === width * height * 4) {
    return new ImageData(new Uint8ClampedArray(data), width, height)
  }
  if (data.length === width * height * 3 || record.kind === ImageKind.RGB_24BPP) {
    const rgba = new Uint8ClampedArray(width * height * 4)
    for (let index = 0, pixel = 0; index < data.length; index += 3, pixel += 4) {
      rgba[pixel] = data[index] ?? 0
      rgba[pixel + 1] = data[index + 1] ?? 0
      rgba[pixel + 2] = data[index + 2] ?? 0
      rgba[pixel + 3] = 255
    }
    return new ImageData(rgba, width, height)
  }
  if (data.length === width * height) {
    const rgba = new Uint8ClampedArray(width * height * 4)
    for (let index = 0; index < data.length; index += 1) {
      const color = data[index] ?? 0
      const pixel = index * 4
      rgba[pixel] = color
      rgba[pixel + 1] = color
      rgba[pixel + 2] = color
      rgba[pixel + 3] = 255
    }
    return new ImageData(rgba, width, height)
  }
  if (record.kind === ImageKind.GRAYSCALE_1BPP) {
    return new ImageData(expandPacked(data, width, height), width, height)
  }
  return null
}

async function recordToPng(record: ImageRecord): Promise<Blob | null> {
  if (record.bitmap) {
    const canvas = document.createElement("canvas")
    const size = paintableSize(record.bitmap, record.width, record.height)
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext("2d")
    if (!context) return null
    context.drawImage(record.bitmap, 0, 0, size.width, size.height)
    return canvasToPng(canvas)
  }
  const image = toImageData(record)
  if (!image) return null
  const canvas = document.createElement("canvas")
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext("2d")
  if (!context) return null
  context.putImageData(image, 0, 0)
  return canvasToPng(canvas)
}

function isRecord(value: unknown): value is ImageRecord {
  if (!value || typeof value !== "object") return false
  const record = value as ImageRecord
  return Boolean(record.bitmap || (record.width && record.height && record.data))
}

export async function extractPageImages(page: PDFPageProxy): Promise<Blob[]> {
  const operators = await page.getOperatorList()
  const blobs: Blob[] = []
  const seen = new Set<string>()

  for (let index = 0; index < operators.fnArray.length; index += 1) {
    const fn = operators.fnArray[index]
    const args = operators.argsArray[index] ?? []
    if (
      fn === OPS.paintImageXObject ||
      fn === OPS.paintImageMaskXObject ||
      fn === OPS.paintImageXObjectRepeat ||
      fn === OPS.paintImageMaskXObjectRepeat
    ) {
      const name = args[0]
      if (typeof name !== "string" || seen.has(name)) continue
      seen.add(name)
      const record = await imageByName(page, name)
      if (!isRecord(record)) continue
      const blob = await recordToPng(record)
      if (blob) blobs.push(blob)
      continue
    }
    if (fn === OPS.paintInlineImageXObject && isRecord(args[0])) {
      const blob = await recordToPng(args[0])
      if (blob) blobs.push(blob)
      continue
    }
    if (fn === OPS.paintInlineImageXObjectGroup && Array.isArray(args[0])) {
      for (const item of args[0]) {
        if (!isRecord(item)) continue
        const blob = await recordToPng(item)
        if (blob) blobs.push(blob)
      }
    }
  }
  return blobs
}
