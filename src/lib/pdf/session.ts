import {
  getDocument,
  GlobalWorkerOptions,
  InvalidPDFException,
  PasswordException,
  type PDFDocumentProxy,
  type PDFPageProxy,
} from "pdfjs-dist"
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"
import { exportTooLarge, type Tile } from "../limits"
import { withPngDpi } from "../png-dpi"
import { extractPageImages } from "./images"
import { Preempted, RenderScheduler, type CancelScope } from "./scheduler"

let configured = false

export function configurePdfjs() {
  if (configured || typeof window === "undefined") return
  GlobalWorkerOptions.workerSrc = workerUrl
  configured = true
}

export class PdfOpenError extends Error {
  constructor() {
    super("仅支持无加密 PDF")
    this.name = "PdfOpenError"
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error("PNG 编码失败"))
    }, "image/png")
  })
}

export class PdfSession {
  private doc: PDFDocumentProxy | null = null
  private loading: { destroy: () => Promise<void> } | null = null
  private documentId: string | null = null
  private ticket = 0
  private scheduler = new RenderScheduler()
  private listeners = new Set<(id: string | null) => void>()

  get id() {
    return this.documentId
  }

  setWantedThumbs(documentId: string | null, pages: number[]) {
    const allowed = new Set(pages.map((page) => `${documentId}:${page}`))
    this.scheduler.setThumbKeep((key) => documentId != null && allowed.has(key))
  }

  subscribe(listener: (id: string | null) => void) {
    this.listeners.add(listener)
    listener(this.documentId)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify() {
    for (const listener of this.listeners) listener(this.documentId)
  }

  private async release() {
    const loading = this.loading
    this.loading = null
    this.doc = null
    this.documentId = null
    this.notify()
    await loading?.destroy()
  }

  async open(documentId: string, data: Uint8Array): Promise<number> {
    configurePdfjs()
    this.scheduler.dropKind("preview")
    this.scheduler.dropKind("thumb")
    const ticket = ++this.ticket
    await this.release()
    let loading: { destroy: () => Promise<void>; promise: Promise<PDFDocumentProxy> } | null =
      null
    try {
      loading = getDocument({
        data,
        cMapUrl: "/pdfjs/cmaps/",
        cMapPacked: true,
        standardFontDataUrl: "/pdfjs/standard_fonts/",
        wasmUrl: "/pdfjs/wasm/",
        iccUrl: "/pdfjs/iccs/",
      })
      const doc = await loading.promise
      if (ticket !== this.ticket) {
        await loading.destroy()
        return doc.numPages
      }
      this.loading = loading
      this.doc = doc
      this.documentId = documentId
      this.notify()
      return doc.numPages
    } catch (error) {
      await loading?.destroy().catch(() => undefined)
      if (
        error instanceof PasswordException ||
        error instanceof InvalidPDFException
      ) {
        throw new PdfOpenError()
      }
      throw error
    }
  }

  async close() {
    this.ticket += 1
    this.scheduler.dropKind("preview")
    this.scheduler.dropKind("thumb")
    await this.release()
  }

  private async page(documentId: string, pageNumber: number): Promise<PDFPageProxy> {
    if (!this.doc || this.documentId !== documentId) {
      throw new Error("文档已切换")
    }
    return this.doc.getPage(pageNumber)
  }

  async pageSize(documentId: string, pageNumber: number) {
    const page = await this.page(documentId, pageNumber)
    const viewport = page.getViewport({ scale: 1 })
    return { width: viewport.width, height: viewport.height }
  }

  private async renderCanvas(
    page: PDFPageProxy,
    scale: number,
    tile: Tile,
    scope: CancelScope,
    intent?: "print",
  ): Promise<HTMLCanvasElement> {
    if (scope.cancelled) throw new Preempted()
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, tile.width)
    canvas.height = Math.max(1, tile.height)
    const context = canvas.getContext("2d")
    if (!context) throw new Error("无法创建画布")
    const transform = tile.x || tile.y ? [1, 0, 0, 1, -tile.x, -tile.y] : undefined
    const task = page.render({
      canvas: null,
      canvasContext: context,
      viewport,
      transform,
      intent,
    })
    scope.onCancel(() => {
      task.cancel()
    })
    try {
      await task.promise
    } catch (error) {
      if (scope.cancelled) throw new Preempted()
      throw error
    }
    if (scope.cancelled) throw new Preempted()
    return canvas
  }

  async renderRegion(
    documentId: string,
    pageNumber: number,
    scale: number,
    tile: Tile,
  ): Promise<ImageBitmap> {
    return this.scheduler.enqueue({
      kind: "preview",
      key: `${documentId}:${pageNumber}:${scale}`,
      run: async (scope) => {
        if (scope.cancelled) throw new Preempted()
        const page = await this.page(documentId, pageNumber)
        const canvas = await this.renderCanvas(page, scale, tile, scope)
        if (scope.cancelled) throw new Preempted()
        return createImageBitmap(canvas)
      },
    })
  }

  async renderThumb(documentId: string, pageNumber: number): Promise<ImageBitmap> {
    return this.scheduler.enqueue({
      kind: "thumb",
      key: `${documentId}:${pageNumber}`,
      run: async (scope) => {
        if (scope.cancelled) throw new Preempted()
        const size = await this.pageSize(documentId, pageNumber)
        if (scope.cancelled) throw new Preempted()
        const outputScale = Math.min(window.devicePixelRatio || 1, 2)
        const scale = (112 * outputScale) / Math.max(size.width, 1)
        const page = await this.page(documentId, pageNumber)
        const canvas = await this.renderCanvas(
          page,
          scale,
          {
            x: 0,
            y: 0,
            width: Math.max(1, Math.floor(size.width * scale)),
            height: Math.max(1, Math.floor(size.height * scale)),
          },
          scope,
        )
        if (scope.cancelled) throw new Preempted()
        return createImageBitmap(canvas)
      },
    })
  }

  async exportPng(
    documentId: string,
    pageNumber: number,
    dpi: number,
  ): Promise<{ status: "ok"; blob: Blob } | { status: "too-large" }> {
    return this.scheduler.enqueue({
      kind: "export",
      key: `export:${documentId}:${pageNumber}:${dpi}`,
      run: async (scope) => {
        if (scope.cancelled) throw new Preempted()
        const page = await this.page(documentId, pageNumber)
        if (scope.cancelled) throw new Preempted()
        const viewport = page.getViewport({ scale: dpi / 72 })
        if (exportTooLarge(viewport.width, viewport.height)) {
          return { status: "too-large" as const }
        }
        const canvas = await this.renderCanvas(
          page,
          dpi / 72,
          {
            x: 0,
            y: 0,
            width: Math.max(1, Math.floor(viewport.width)),
            height: Math.max(1, Math.floor(viewport.height)),
          },
          scope,
          "print",
        )
        if (scope.cancelled) throw new Preempted()
        const raw = new Uint8Array(await (await canvasToPng(canvas)).arrayBuffer())
        if (scope.cancelled) throw new Preempted()
        const encoded = withPngDpi(raw, dpi)
        return {
          status: "ok" as const,
          blob: new Blob([toArrayBuffer(encoded)], { type: "image/png" }),
        }
      },
    })
  }

  async extractImages(documentId: string, pageNumber: number): Promise<Blob[]> {
    return this.scheduler.enqueue({
      kind: "extract",
      key: `extract:${documentId}:${pageNumber}`,
      run: async (scope) => {
        if (scope.cancelled) throw new Preempted()
        const page = await this.page(documentId, pageNumber)
        if (scope.cancelled) throw new Preempted()
        return extractPageImages(page)
      },
    })
  }
}
