import { useEffect, useRef, useState } from "react"
import { planTiles, type Tile } from "@/lib/limits"
import type { PdfSession } from "@/lib/pdf/session"
import type { Zoom } from "@/lib/zoom"
import { useOpenedDocument } from "./use-opened-document"

type PageBox = {
  cssScale: number
  outputScale: number
  renderScale: number
  cssWidth: number
  cssHeight: number
  pixelWidth: number
  pixelHeight: number
  fitPercent: number
}

function usePageBox(
  session: PdfSession,
  documentId: string | null,
  openedId: string | null,
  pageNumber: number,
  zoom: Zoom,
  containerWidth: number,
) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    if (!documentId || openedId !== documentId) {
      setSize(null)
      return
    }
    let cancelled = false
    void session.pageSize(documentId, pageNumber).then((next) => {
      if (!cancelled) setSize(next)
    }).catch(() => {
      if (!cancelled) setSize(null)
    })
    return () => {
      cancelled = true
    }
  }, [session, documentId, openedId, pageNumber])

  if (!documentId || !size || containerWidth <= 0) return null
  const outputScale = Math.min(window.devicePixelRatio || 1, 2)
  const cssScale = zoom.kind === "fit" ? containerWidth / size.width : zoom.value / 100
  const renderScale = cssScale * outputScale
  return {
    cssScale,
    outputScale,
    renderScale,
    cssWidth: size.width * cssScale,
    cssHeight: size.height * cssScale,
    pixelWidth: Math.max(1, Math.floor(size.width * renderScale)),
    pixelHeight: Math.max(1, Math.floor(size.height * renderScale)),
    fitPercent: (containerWidth / size.width) * 100,
  } satisfies PageBox
}

function TileView({
  session,
  documentId,
  pageNumber,
  scale,
  tile,
  outputScale,
}: {
  session: PdfSession
  documentId: string
  pageNumber: number
  scale: number
  tile: Tile
  outputScale: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    let cancelled = false
    canvas.width = tile.width
    canvas.height = tile.height
    void session
      .renderRegion(documentId, pageNumber, scale, tile)
      .then((bitmap) => {
        if (cancelled || !ref.current) {
          bitmap.close()
          return
        }
        const context = ref.current.getContext("2d")
        context?.drawImage(bitmap, 0, 0)
        bitmap.close()
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [session, documentId, pageNumber, scale, tile.x, tile.y, tile.width, tile.height])

  return (
    <canvas
      ref={ref}
      className="absolute bg-paper"
      style={{
        left: tile.x / outputScale,
        top: tile.y / outputScale,
        width: tile.width / outputScale,
        height: tile.height / outputScale,
      }}
    />
  )
}

export function Viewer({
  session,
  documentId,
  pageNumber,
  zoom,
  onPage,
  onFitPercent,
}: {
  session: PdfSession
  documentId: string | null
  pageNumber: number
  zoom: Zoom
  onPage: (delta: number) => void
  onFitPercent: (percent: number) => void
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [scroll, setScroll] = useState({ top: 0, left: 0, width: 0, height: 0 })
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  const wheelLock = useRef(0)
  const openedId = useOpenedDocument(session)
  const box = usePageBox(session, documentId, openedId, pageNumber, zoom, containerWidth)

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const measure = () => {
      setContainerWidth(Math.max(scroller.clientWidth - 48, 1))
      setScroll({
        top: scroller.scrollTop,
        left: scroller.scrollLeft,
        width: scroller.clientWidth,
        height: scroller.clientHeight,
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [documentId])

  const fitPercent = box?.fitPercent

  useEffect(() => {
    if (fitPercent == null) return
    onFitPercent(fitPercent)
  }, [fitPercent, onFitPercent])

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: 0, left: 0 })
  }, [documentId, pageNumber])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey || event.deltaY === 0) return
      const atStart = scroller.scrollTop <= 0
      const atEnd = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1
      const scrolling = event.deltaY > 0 ? !atEnd : !atStart
      if (scrolling) return
      event.preventDefault()
      const now = Date.now()
      if (now < wheelLock.current) return
      wheelLock.current = now + 320
      onPage(event.deltaY > 0 ? 1 : -1)
    }
    scroller.addEventListener("wheel", onWheel, { passive: false })
    return () => scroller.removeEventListener("wheel", onWheel)
  }, [onPage])

  const tiles = box ? planTiles(box.pixelWidth, box.pixelHeight) : []
  const visible = tiles.filter((tile) => {
    if (!box) return false
    const top = scroll.top * box.outputScale
    const left = scroll.left * box.outputScale
    const bottom = top + scroll.height * box.outputScale
    const right = left + scroll.width * box.outputScale
    return (
      tile.y + tile.height >= top - 2048 &&
      tile.y <= bottom + 2048 &&
      tile.x + tile.width >= left - 2048 &&
      tile.x <= right + 2048
    )
  })

  const [panning, setPanning] = useState(false)

  return (
    <div
      ref={scrollerRef}
      className={`min-h-0 flex-1 overflow-auto bg-well ${
        documentId && box ? (panning ? "cursor-grabbing" : "cursor-grab") : ""
      }`}
      onScroll={(event) => {
        const scroller = event.currentTarget
        setScroll({
          top: scroller.scrollTop,
          left: scroller.scrollLeft,
          width: scroller.clientWidth,
          height: scroller.clientHeight,
        })
      }}
      onPointerDown={(event) => {
        if (event.button !== 0 || !scrollerRef.current) return
        drag.current = {
          x: event.clientX,
          y: event.clientY,
          left: scrollerRef.current.scrollLeft,
          top: scrollerRef.current.scrollTop,
        }
        setPanning(true)
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (!drag.current || !scrollerRef.current) return
        scrollerRef.current.scrollLeft = drag.current.left - (event.clientX - drag.current.x)
        scrollerRef.current.scrollTop = drag.current.top - (event.clientY - drag.current.y)
      }}
      onPointerUp={() => {
        drag.current = null
        setPanning(false)
      }}
    >
      {documentId && box ? (
        <div className="mx-auto my-5" style={{ width: box.cssWidth, height: box.cssHeight }}>
          <div
            className="relative bg-paper shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
            style={{ width: box.cssWidth, height: box.cssHeight }}
          >
            {visible.map((tile) => (
              <TileView
                key={`${documentId}-${pageNumber}-${tile.x}-${tile.y}`}
                session={session}
                documentId={documentId}
                pageNumber={pageNumber}
                scale={box.renderScale}
                tile={tile}
                outputScale={box.outputScale}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid h-full place-items-center px-6 text-center text-[13px] text-muted-foreground">
          {documentId ? "正在绘制这一页…" : "把今天的 PDF 拖进来"}
        </div>
      )}
    </div>
  )
}
