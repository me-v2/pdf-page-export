import { useEffect, useRef, useState } from "react"
import { CheckIcon } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { PdfSession } from "@/lib/pdf/session"
import type { ThumbTab } from "@/lib/queue"
import { useOpenedDocument } from "./use-opened-document"

class Lane {
  private pending = 0
  private waiters: Array<() => void> = []

  run<T>(job: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const start = () => {
        this.pending += 1
        job()
          .then(resolve, reject)
          .finally(() => {
            this.pending -= 1
            this.waiters.shift()?.()
          })
      }
      if (this.pending >= 2) this.waiters.push(start)
      else start()
    })
  }
}

export function ThumbRail({
  session,
  documentId,
  pageCount,
  currentPage,
  exportedPages,
  tab,
  onTab,
  onSelect,
}: {
  session: PdfSession
  documentId: string | null
  pageCount: number | null
  currentPage: number
  exportedPages: number[]
  tab: ThumbTab
  onTab: (tab: ThumbTab) => void
  onSelect: (page: number) => void
}) {
  const shellRef = useRef<HTMLDivElement>(null)
  const openedId = useOpenedDocument(session)
  const [images, setImages] = useState<Record<number, string>>({})
  const imagesRef = useRef(images)
  imagesRef.current = images
  const pendingRef = useRef(new Set<number>())
  const laneRef = useRef(new Lane())
  const exported = new Set(exportedPages)
  const pages = Array.from({ length: pageCount ?? 0 }, (_, index) => index + 1).filter(
    (page) => tab === "all" || exported.has(page),
  )

  useEffect(() => {
    pendingRef.current.clear()
    setImages((current) => {
      for (const url of Object.values(current)) URL.revokeObjectURL(url)
      return {}
    })
  }, [documentId])

  useEffect(() => {
    const root = shellRef.current?.querySelector("[data-slot=scroll-area-viewport]")
    if (!root || !documentId || openedId !== documentId) {
      session.setWantedThumbs(null, [])
      return
    }
    const visible = new Set<number>()
    const publish = () => session.setWantedThumbs(documentId, [...visible])
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const page = Number((entry.target as HTMLElement).dataset.page)
          if (!page) continue
          if (entry.isIntersecting) visible.add(page)
          else visible.delete(page)
        }
        publish()
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const page = Number((entry.target as HTMLElement).dataset.page)
          if (!page || imagesRef.current[page] || pendingRef.current.has(page)) continue
          pendingRef.current.add(page)
          void laneRef.current
            .run(async () => {
              const bitmap = await session.renderThumb(documentId, page)
              const canvas = document.createElement("canvas")
              canvas.width = bitmap.width
              canvas.height = bitmap.height
              canvas.getContext("2d")?.drawImage(bitmap, 0, 0)
              bitmap.close()
              const blob = await new Promise<Blob | null>((resolve) => {
                canvas.toBlob(resolve, "image/png")
              })
              if (!blob) return ""
              return URL.createObjectURL(blob)
            })
            .then((url) => {
              if (!url) {
                pendingRef.current.delete(page)
                return
              }
              setImages((current) => ({ ...current, [page]: url }))
            })
            .catch(() => {
              pendingRef.current.delete(page)
            })
        }
      },
      { root, rootMargin: "240px" },
    )
    for (const node of root.querySelectorAll("[data-page]")) observer.observe(node)
    return () => {
      observer.disconnect()
      session.setWantedThumbs(null, [])
    }
  }, [documentId, openedId, pages.join(","), session])

  useEffect(() => {
    const root = shellRef.current?.querySelector("[data-slot=scroll-area-viewport]")
    root?.querySelector(`[data-page="${currentPage}"]`)?.scrollIntoView({ block: "nearest" })
  }, [currentPage, documentId])

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden bg-background [&_[data-slot=scroll-area-scrollbar]]:hidden [&_[data-slot=scroll-area-viewport]>div]:!block [&_[data-slot=scroll-area-viewport]>div]:!w-full">
      <div className="flex h-8 shrink-0 items-center gap-1 border-b px-2">
        <button
          type="button"
          aria-pressed={tab === "all"}
          onClick={() => onTab("all")}
          className={`h-6 rounded-sm px-2 text-[12px] ${
            tab === "all"
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          全部
          {pageCount != null ? (
            <span className="ml-1.5 font-mono tabular-nums text-muted-foreground">{pageCount}</span>
          ) : null}
        </button>
        <button
          type="button"
          aria-pressed={tab === "exported"}
          onClick={() => onTab("exported")}
          className={`h-6 rounded-sm px-2 text-[12px] ${
            tab === "exported"
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          已导出
          {exportedPages.length > 0 ? (
            <span className="ml-1 font-mono tabular-nums text-exported">{exportedPages.length}</span>
          ) : null}
        </button>
      </div>
      <div ref={shellRef} className="min-h-0 flex-1">
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-1.5 p-2">
            {pages.length === 0 ? (
              <p className="px-1 py-6 text-center text-[12px] text-muted-foreground">
                还没有导出过的页面
              </p>
            ) : (
              pages.map((page) => {
                const current = page === currentPage
                const done = exported.has(page)
                return (
                  <button
                    key={page}
                    type="button"
                    data-page={page}
                    onClick={() => onSelect(page)}
                    className={`relative block overflow-hidden bg-paper text-left outline-none ${
                      current
                        ? "ring-2 ring-primary ring-offset-1 ring-offset-background"
                        : "ring-1 ring-border hover:ring-muted-foreground/40"
                    }`}
                  >
                    {images[page] ? (
                      <img src={images[page]} alt={`第 ${page} 页`} className="block w-full" />
                    ) : (
                      <span className="block h-28 bg-muted/50" />
                    )}
                    <span className="absolute bottom-0 left-0 bg-background/80 px-1 py-px font-mono text-[10px] tabular-nums text-foreground">
                      {page}
                    </span>
                    {done ? (
                      <span className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-exported text-white">
                        <CheckIcon className="size-2.5" />
                      </span>
                    ) : null}
                  </button>
                )
              })
            )}
          </div>
        </ScrollArea>
      </div>
    </aside>
  )
}
