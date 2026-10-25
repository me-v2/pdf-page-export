import { CheckIcon, Minus, Plus, Upload } from "lucide-react"
import { useEffect, useState, type RefObject } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { saveStatusLines, type SaveInfo } from "@/lib/save-file"
import { zoomCompact, type Zoom } from "@/lib/zoom"

function exportLabel(busy: boolean, saveInfo: SaveInfo | null) {
  if (!busy) return "导出"
  if (saveInfo?.picking) return "选文件夹…"
  if (saveInfo?.filename) return "写出…"
  return "正在导出…"
}

export function Toolbar({
  bookId,
  bookName,
  fileName,
  page,
  pageCount,
  exported,
  zoom,
  busy,
  saveInfo,
  progress,
  booksOpen,
  pageInputRef,
  onProgress,
  onPage,
  onZoomOut,
  onZoomIn,
  onFit,
  onUpload,
  onCommand,
  onExport,
  onNext,
}: {
  bookId: string | null
  bookName: string
  fileName: string
  page: number
  pageCount: number | null
  exported: boolean
  zoom: Zoom
  busy: boolean
  saveInfo: SaveInfo | null
  progress: string
  booksOpen: boolean
  pageInputRef: RefObject<HTMLInputElement | null>
  onProgress: () => void
  onPage: (page: number) => void
  onZoomOut: () => void
  onZoomIn: () => void
  onFit: () => void
  onUpload: () => void
  onCommand: () => void
  onExport: () => void
  onNext: () => void
}) {
  const [draft, setDraft] = useState(String(page))

  useEffect(() => {
    setDraft(String(page))
  }, [page])

  const commitPage = () => {
    const next = Number(draft)
    if (Number.isFinite(next)) onPage(next)
  }

  return (
    <div
      className="flex h-9 select-none items-center gap-1 border-b border-border bg-background px-2"
      title="滚轮翻页 · A 上传 · X 导出 · B 书单 · K 命令 · N 下一本"
    >
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-expanded={booksOpen}
        onClick={onProgress}
        className={`h-7 gap-2 px-2 font-medium ${booksOpen ? "bg-accent text-accent-foreground" : ""}`}
      >
        <span className="size-1.5 shrink-0 bg-primary" aria-hidden />
        <span className="font-mono text-[13px] tabular-nums">{progress}</span>
      </Button>
      {bookId ? (
        <span
          className="h-7 min-w-0 max-w-2xl truncate px-2 text-[13px] leading-7"
          title={fileName || bookName}
        >
          {bookName || fileName || "未命名"}
        </span>
      ) : null}
      {bookId ? (
        <div className="flex shrink-0 items-center gap-1">
          {exported ? (
            <span
              className="grid size-4 place-items-center rounded-full bg-exported text-white"
              title="这一页已导出"
            >
              <CheckIcon className="size-2.5" />
            </span>
          ) : (
            <span className="size-4" aria-hidden />
          )}
          <Input
            ref={pageInputRef}
            aria-label="页码"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitPage}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                commitPage()
                event.currentTarget.blur()
              }
              if (event.key === "Escape") {
                event.preventDefault()
                event.stopPropagation()
                setDraft(String(page))
                event.currentTarget.blur()
              }
            }}
            className="h-7 w-12 border-border bg-secondary px-1 text-center font-mono text-[13px] tabular-nums shadow-none"
          />
          <span className="font-mono text-[13px] tabular-nums text-muted-foreground">
            / {pageCount ?? "–"}
          </span>
        </div>
      ) : null}
      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        {bookId ? (
          <div className="mr-1 flex items-center">
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              disabled={!bookId}
              aria-label="缩小"
              title="缩小 (−)"
              onClick={onZoomOut}
            >
              <Minus />
            </Button>
            <Button
              type="button"
              size="sm"
              variant={zoom.kind === "fit" ? "secondary" : "ghost"}
              disabled={!bookId}
              title="适配宽度 (0)"
              onClick={onFit}
              className="h-7 min-w-12 px-2 font-mono text-[12px] tabular-nums"
            >
              {zoomCompact(zoom)}
            </Button>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              disabled={!bookId}
              aria-label="放大"
              title="放大 (=)"
              onClick={onZoomIn}
            >
              <Plus />
            </Button>
          </div>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          title="上传 PDF"
          onClick={onUpload}
          className="h-7 px-2"
        >
          <Upload />
          上传
          <Kbd>A</Kbd>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          title="命令 (K)"
          onClick={onCommand}
          className="h-7 px-1.5"
        >
          <Kbd>K</Kbd>
        </Button>
        {bookId ? (
          <>
            <Tooltip open={saveInfo != null}>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy || !pageCount}
                    onClick={onExport}
                    className="h-7 min-w-[5.5rem] px-2.5"
                  >
                    {exportLabel(busy, saveInfo)}
                    <Kbd className="border-primary-foreground/25 bg-primary-foreground/15 text-primary-foreground">
                      X
                    </Kbd>
                  </Button>
                </span>
              </TooltipTrigger>
              {saveInfo ? (
                <TooltipContent side="bottom" sideOffset={8} className="max-w-sm text-left">
                  {saveStatusLines(saveInfo).map((line) => (
                    <p key={line} className="break-all">
                      {line}
                    </p>
                  ))}
                </TooltipContent>
              ) : null}
            </Tooltip>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!bookId}
              onClick={onNext}
              className="h-7 px-2.5"
            >
              下一本
              <Kbd>N</Kbd>
            </Button>
          </>
        ) : null}
      </div>
    </div>
  )
}
