import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  clearPdfs,
  deletePdf,
  forgetExportDir,
  loadDay,
  loadPdf,
  queueFromStored,
  saveDay,
  savePdf,
  type StoredDay,
} from "@/lib/day-store"
import {
  imageExportName,
  pageExportName,
  zipExportName,
} from "@/lib/filename"
import { decideHotkey, isTypingTarget } from "@/lib/hotkeys"
import {
  filesFromDataTransfer,
  pickPdfs,
  queryRead,
  toIncoming,
  type IncomingFile,
} from "@/lib/intake"
import {
  ensureExportDir,
  SaveCancelled,
  writeExportFile,
  type SaveInfo,
} from "@/lib/save-file"
import { PdfOpenError, PdfSession } from "@/lib/pdf/session"
import {
  activeBook,
  addIncoming,
  applyDay,
  captureFinish,
  emptyQueue,
  finishAndNext,
  markExported,
  notePageCount,
  openBook,
  progressCompact,
  removeBook,
  setDpi,
  setPage,
  setZoom,
  shiftPage,
  todayString,
  setThumbTab,
  toggleThumb,
  undoFinish,
  type QueueState,
} from "@/lib/queue"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { clampThumbWidth, loadThumbWidth, saveThumbWidth, THUMB_MAX, THUMB_MIN } from "@/lib/thumb-width"
import { zipFiles } from "@/lib/zip-files"
import { zoomIn, zoomOut } from "@/lib/zoom"
import { CommandMenu, type CommandItem } from "./command-menu"
import { FileRail } from "./file-rail"
import { ThumbRail } from "./thumb-rail"
import { Toolbar } from "./toolbar"
import { Viewer } from "./viewer"

async function fileFromStore(
  book: { id: string; fileName: string; lastModified: number },
  handle: FileSystemFileHandle | null,
): Promise<File | null> {
  const saved = await loadPdf(book.id)
  if (saved) {
    return new File([saved], book.fileName, {
      type: "application/pdf",
      lastModified: book.lastModified,
    })
  }
  if (!handle || !(await queryRead(handle))) return null
  const file = await handle.getFile()
  await savePdf(book.id, file)
  return file
}

export function Workspace() {
  const session = useMemo(() => new PdfSession(), [])
  const [queue, setQueue] = useState<QueueState | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saveInfo, setSaveInfo] = useState<SaveInfo | null>(null)
  const [dragging, setDragging] = useState(false)
  const [booksOpen, setBooksOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [thumbWidth, setThumbWidth] = useState(loadThumbWidth)
  const thumbWidthRef = useRef(thumbWidth)
  const initialThumbWidth = useRef(thumbWidth).current
  thumbWidthRef.current = thumbWidth
  const [openNonce, setOpenNonce] = useState(0)
  const filesRef = useRef(new Map<string, File>())
  const queueRef = useRef(queue)
  const lockRef = useRef(false)
  const pageInputRef = useRef<HTMLInputElement>(null)
  const fitPercentRef = useRef(100)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const booksOpenRef = useRef(false)
  const commandOpenRef = useRef(false)
  queueRef.current = queue
  booksOpenRef.current = booksOpen
  commandOpenRef.current = commandOpen

  useEffect(() => {
    let cancelled = false
    void loadDay()
      .then(async (stored) => {
        if (cancelled) return
        const today = todayString()
        if (!stored) {
          setQueue(emptyQueue(today))
          setHydrated(true)
          return
        }
        const next = applyDay(queueFromStored(stored), today)
        if (stored.day !== today) {
          await clearPdfs()
          if (cancelled) return
          setQueue(next)
          setHydrated(true)
          return
        }
        const rawBooks = stored.books as Array<{
          id: string
          handle?: FileSystemFileHandle | null
        }>
        const kept = []
        for (const book of next.books) {
          const handle = rawBooks.find((item) => item.id === book.id)?.handle ?? null
          const file = await fileFromStore(book, handle).catch(() => null)
          if (cancelled) return
          if (!file) continue
          filesRef.current.set(book.id, file)
          kept.push(book)
        }
        const activeId = kept.some((book) => book.id === next.activeId)
          ? next.activeId
          : (kept.find((book) => book.status !== "done")?.id ?? null)
        setQueue({ ...next, books: kept, activeId })
        setHydrated(true)
      })
      .catch(() => {
        if (!cancelled) {
          setQueue(emptyQueue(todayString()))
          setHydrated(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hydrated || !queue) return
    const stored: StoredDay = {
      day: queue.day,
      dpi: queue.dpi,
      activeId: queue.activeId,
      zoom: queue.zoom,
      thumbTab: queue.thumbTab,
      books: queue.books,
    }
    void saveDay(stored)
  }, [hydrated, queue])

  useEffect(() => () => {
    void session.close()
  }, [session])

  const takeFiles = useCallback((files: IncomingFile[]) => {
    if (files.length === 0) return
    for (const file of files) filesRef.current.set(file.id, file.file)
    void Promise.all(files.map((file) => savePdf(file.id, file.file)))
      .catch(() => undefined)
      .finally(() => {
        const current = queueRef.current
        if (!current) return
        const known = new Set(current.books.map((book) => book.id))
        const next = addIncoming(current, files)
        setQueue(next)
        setOpenNonce((value) => value + 1)
        if (files.some((file) => !known.has(file.id)) && files.length > 1) setBooksOpen(true)
      })
  }, [])

  useEffect(() => {
    const id = queue?.activeId
    if (!id) return
    let cancelled = false
    void (async () => {
      const file = filesRef.current.get(id) ?? null
      if (cancelled) return
      if (!file) {
        filesRef.current.delete(id)
        void deletePdf(id)
        setQueue((current) => (current ? removeBook(current, id) : current))
        return
      }
      try {
        const count = await session.open(id, new Uint8Array(await file.arrayBuffer()))
        if (cancelled) return
        setQueue((current) => (current ? notePageCount(current, id, count) : current))
      } catch (error) {
        if (cancelled) return
        if (error instanceof PdfOpenError) {
          toast("仅支持无加密 PDF")
          filesRef.current.delete(id)
          void deletePdf(id)
          setQueue((current) => (current ? removeBook(current, id) : current))
          return
        }
        toast("这一本打不开")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [queue?.activeId, openNonce, session])

  const beginSave = useCallback(async () => {
    setSaveInfo({ filename: null, folder: null, picking: false })
    const dir = await ensureExportDir(() => {
      setSaveInfo({ filename: null, folder: null, picking: true })
    })
    setSaveInfo({ filename: null, folder: dir.name, picking: false })
    return dir
  }, [])

  const finishSave = useCallback(
    async (dir: FileSystemDirectoryHandle, blob: Blob, filename: string) => {
      setSaveInfo({ filename, folder: dir.name, picking: false })
      try {
        await writeExportFile(dir, filename, blob)
      } catch (error) {
        await forgetExportDir().catch(() => undefined)
        throw error
      }
    },
    [],
  )

  const exportCurrent = useCallback(async () => {
    const current = queueRef.current
    const book = current ? activeBook(current) : null
    if (!current || !book?.pageCount || lockRef.current) return
    lockRef.current = true
    setBusy(true)
    const bookId = book.id
    const page = book.currentPage
    const bookName = book.bookName
    const pageCount = book.pageCount
    try {
      const dir = await beginSave()
      const result = await session.exportPng(bookId, page, current.dpi)
      if (result.status === "too-large") {
        toast("分辨率过高，请降低清晰度")
        return
      }
      const filename = pageExportName(bookName, page, pageCount, new Date())
      await finishSave(dir, result.blob, filename)
      setQueue((state) => (state ? markExported(state, bookId, page) : state))
      toast(`✅ 已导出 ${filename}`)
    } catch (error) {
      if (error instanceof SaveCancelled) return
      toast("导出失败")
    } finally {
      lockRef.current = false
      setBusy(false)
      setSaveInfo(null)
    }
  }, [beginSave, finishSave, session])

  const extractCurrent = useCallback(async () => {
    const current = queueRef.current
    const book = current ? activeBook(current) : null
    if (!current || !book?.pageCount || lockRef.current) return
    lockRef.current = true
    setBusy(true)
    const bookId = book.id
    const page = book.currentPage
    const bookName = book.bookName
    const pageCount = book.pageCount
    const stamp = new Date()
    try {
      const dir = await beginSave()
      const blobs = await session.extractImages(bookId, page)
      if (blobs.length === 0) {
        toast("这一页没有可提取的内嵌图片")
        return
      }
      if (blobs.length === 1) {
        const filename = imageExportName(bookName, page, pageCount, 1, stamp)
        await finishSave(dir, blobs[0], filename)
        toast(`✅ 已导出 ${filename}`)
      } else {
        const files: Record<string, Uint8Array> = {}
        for (let index = 0; index < blobs.length; index += 1) {
          const name = imageExportName(bookName, page, pageCount, index + 1, stamp)
          files[name] = new Uint8Array(await blobs[index].arrayBuffer())
        }
        const zipped = await zipFiles(files)
        const filename = zipExportName(bookName, page, pageCount, stamp)
        const bytes = zipped.buffer.slice(
          zipped.byteOffset,
          zipped.byteOffset + zipped.byteLength,
        ) as ArrayBuffer
        await finishSave(dir, new Blob([bytes], { type: "application/zip" }), filename)
        toast(`✅ 已导出 ${filename}`)
      }
      setQueue((state) => (state ? markExported(state, bookId, page) : state))
    } catch (error) {
      if (error instanceof SaveCancelled) return
      console.error(error)
      toast("提取失败")
    } finally {
      lockRef.current = false
      setBusy(false)
      setSaveInfo(null)
    }
  }, [beginSave, finishSave, session])

  const finishBook = useCallback(() => {
    const current = queueRef.current
    if (!current) return
    const mark = captureFinish(current)
    if (!mark) return
    const next = finishAndNext(current)
    setQueue(next)
    if (mark.status === "done" && next.activeId === current.activeId) return
    toast("已标为看完", {
      duration: 5000,
      action: {
        label: "撤销",
        onClick: () => {
          setQueue((state) => (state ? undoFinish(state, mark) : state))
        },
      },
    })
  }, [])

  const upload = useCallback(() => {
    void pickPdfs()
      .then((picked) => {
        if (picked == null) {
          fileInputRef.current?.click()
          return
        }
        takeFiles(picked)
      })
      .catch(() => {
        fileInputRef.current?.click()
      })
  }, [takeFiles])

  const applyAction = useCallback(
    (action: NonNullable<ReturnType<typeof decideHotkey>>) => {
      if (action === "export") {
        void exportCurrent()
        return
      }
      if (action === "extract") {
        void extractCurrent()
        return
      }
      if (action === "goto") {
        pageInputRef.current?.focus()
        pageInputRef.current?.select()
        return
      }
      if (action === "books") {
        setBooksOpen((open) => !open)
        return
      }
      if (action === "command") {
        setCommandOpen(true)
        return
      }
      if (action === "upload") {
        upload()
        return
      }
      if (action === "nextBook") {
        finishBook()
        return
      }
      setQueue((state) => {
        if (!state) return state
        if (action === "prev") return shiftPage(state, -1)
        if (action === "next") return shiftPage(state, 1)
        if (action === "back10") return shiftPage(state, -10)
        if (action === "forward10") return shiftPage(state, 10)
        if (action === "first") return setPage(state, 1)
        if (action === "last") return setPage(state, activeBook(state)?.pageCount ?? 1)
        if (action === "zoomIn") return setZoom(state, zoomIn(state.zoom, fitPercentRef.current))
        if (action === "zoomOut") return setZoom(state, zoomOut(state.zoom, fitPercentRef.current))
        if (action === "fitWidth") return setZoom(state, { kind: "fit" })
        if (action === "toggleExported") return toggleThumb(state)
        return state
      })
    },
    [exportCurrent, extractCurrent, finishBook, upload],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof Element && event.target.getAttribute("role") === "separator") {
        return
      }
      if (event.key === "Escape") {
        if (commandOpenRef.current) {
          event.preventDefault()
          setCommandOpen(false)
          return
        }
        if (booksOpenRef.current && !isTypingTarget(event.target)) {
          event.preventDefault()
          setBooksOpen(false)
          return
        }
      }
      const action = decideHotkey({
        key: event.key,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        repeat: event.repeat,
        typing: isTypingTarget(event.target),
        dialog: commandOpenRef.current,
        busy: lockRef.current,
      })
      if (!action) return
      event.preventDefault()
      applyAction(action)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [applyAction])

  const isFileDrag = (event: DragEvent) =>
    [...(event.dataTransfer?.types ?? [])].includes("Files")

  const rememberFit = useCallback((percent: number) => {
    fitPercentRef.current = percent
  }, [])

  if (!queue) {
    return (
      <main className="grid h-dvh place-items-center bg-well text-[13px] text-muted-foreground">
        正在打开挑页…
      </main>
    )
  }

  const book = activeBook(queue)
  const commandItems: CommandItem[] = [
    {
      id: "export",
      group: "动作",
      label: "导出当前页",
      shortcut: "X",
      disabled: busy || !book?.pageCount,
      run: () => void exportCurrent(),
    },
    {
      id: "next",
      group: "动作",
      label: "下一本",
      shortcut: "N",
      disabled: !book,
      run: finishBook,
    },
    {
      id: "extract",
      group: "动作",
      label: "提取原图",
      shortcut: "I",
      disabled: busy || !book?.pageCount,
      run: () => void extractCurrent(),
    },
    {
      id: "goto",
      group: "动作",
      label: "跳到页",
      shortcut: "G",
      disabled: !book?.pageCount,
      run: () => {
        pageInputRef.current?.focus()
        pageInputRef.current?.select()
      },
    },
    {
      id: "upload",
      group: "动作",
      label: "上传 PDF",
      shortcut: "A",
      run: upload,
    },
    {
      id: "thumbs",
      group: "视图",
      label: queue.thumbTab === "all" ? "只看已导出" : "显示全部",
      shortcut: "F",
      disabled: !book,
      run: () => setQueue((state) => (state ? toggleThumb(state) : state)),
    },
    {
      id: "zoom-in",
      group: "视图",
      label: "放大",
      shortcut: "=",
      disabled: !book,
      run: () =>
        setQueue((state) =>
          state ? setZoom(state, zoomIn(state.zoom, fitPercentRef.current)) : state,
        ),
    },
    {
      id: "zoom-out",
      group: "视图",
      label: "缩小",
      shortcut: "-",
      disabled: !book,
      run: () =>
        setQueue((state) =>
          state ? setZoom(state, zoomOut(state.zoom, fitPercentRef.current)) : state,
        ),
    },
    {
      id: "fit",
      group: "视图",
      label: "适配宽度",
      shortcut: "0",
      disabled: !book,
      run: () => setQueue((state) => (state ? setZoom(state, { kind: "fit" }) : state)),
    },
    ...([150, 300, 600] as const).map((dpi) => ({
      id: `dpi-${dpi}`,
      group: "清晰度",
      label:
        dpi === 150 ? "清晰度 · 屏幕 150" : dpi === 300 ? "清晰度 · 印刷 300" : "清晰度 · 精细 600",
      checked: queue.dpi === dpi,
      run: () => setQueue((state) => (state ? setDpi(state, dpi) : state)),
    })),
    {
      id: "books",
      group: "书单",
      label: "今天的书",
      shortcut: "B",
      run: () => setBooksOpen((open) => !open),
    },
  ]

  return (
    <main
      className="relative flex h-dvh flex-col overflow-hidden"
      onDragEnter={(event) => {
        if (!isFileDrag(event)) return
        event.preventDefault()
        dragDepth.current += 1
        setDragging(true)
      }}
      onDragOver={(event) => {
        if (!isFileDrag(event)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = "copy"
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (dragDepth.current === 0) setDragging(false)
      }}
      onDrop={(event) => {
        if (!isFileDrag(event)) return
        event.preventDefault()
        dragDepth.current = 0
        setDragging(false)
        void filesFromDataTransfer(event.dataTransfer).then((dropped) => {
          takeFiles(dropped.files)
        })
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={(event) => {
          const selected = [...(event.target.files ?? [])].map((file) =>
            toIncoming(file, null),
          )
          event.target.value = ""
          takeFiles(selected)
        }}
      />
      <Toolbar
        bookId={book?.id ?? null}
        bookName={book?.bookName ?? ""}
        fileName={book?.fileName ?? ""}
        page={book?.currentPage ?? 1}
        pageCount={book?.pageCount ?? null}
        exported={book ? book.exportedPages.includes(book.currentPage) : false}
        zoom={queue.zoom}
        busy={busy}
        saveInfo={saveInfo}
        progress={progressCompact(queue)}
        booksOpen={booksOpen}
        pageInputRef={pageInputRef}
        onProgress={() => setBooksOpen((open) => !open)}
        onPage={(page) => setQueue((state) => (state ? setPage(state, page) : state))}
        onZoomOut={() =>
          setQueue((state) =>
            state ? setZoom(state, zoomOut(state.zoom, fitPercentRef.current)) : state,
          )
        }
        onZoomIn={() =>
          setQueue((state) =>
            state ? setZoom(state, zoomIn(state.zoom, fitPercentRef.current)) : state,
          )
        }
        onFit={() => setQueue((state) => (state ? setZoom(state, { kind: "fit" }) : state))}
        onUpload={upload}
        onCommand={() => setCommandOpen(true)}
        onExport={() => void exportCurrent()}
        onNext={finishBook}
      />
      {book ? (
        <div className="min-h-0 flex-1">
          <ResizablePanelGroup
            orientation="horizontal"
            className="h-full"
            onLayoutChanged={(_layout, meta) => {
              if (meta.isUserInteraction) saveThumbWidth(thumbWidthRef.current)
            }}
          >
            <ResizablePanel
              id="thumbs"
              defaultSize={initialThumbWidth}
              minSize={THUMB_MIN}
              maxSize={THUMB_MAX}
              groupResizeBehavior="preserve-pixel-size"
              onResize={(size) => {
                const next = clampThumbWidth(Math.round(size.inPixels))
                if (next === thumbWidthRef.current) return
                thumbWidthRef.current = next
                setThumbWidth(next)
              }}
            >
              <ThumbRail
                session={session}
                documentId={book.id}
                pageCount={book.pageCount}
                currentPage={book.currentPage}
                exportedPages={book.exportedPages}
                tab={queue.thumbTab}
                onTab={(next) => setQueue((state) => (state ? setThumbTab(state, next) : state))}
                onSelect={(page) => setQueue((state) => (state ? setPage(state, page) : state))}
              />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel id="page" minSize="30%" className="min-w-0">
              <div
                className="flex h-full min-h-0 min-w-0 flex-col"
                onPointerDown={() => {
                  if (booksOpen) setBooksOpen(false)
                }}
              >
                <Viewer
                  session={session}
                  documentId={book.id}
                  pageNumber={book.currentPage}
                  zoom={queue.zoom}
                  onPage={(delta) => setQueue((state) => (state ? shiftPage(state, delta) : state))}
                  onFitPercent={rememberFit}
                />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      ) : (
        <div
          className="grid min-h-0 flex-1 place-items-center bg-well px-6"
          onPointerDown={() => {
            if (booksOpen) setBooksOpen(false)
          }}
        >
          <div className="flex w-full max-w-md flex-col items-center gap-4 border border-dashed border-border px-8 py-14 text-center">
            <p className="text-[15px] text-foreground">把今天的 PDF 拖进来</p>
            <p className="text-[12px] text-muted-foreground">或按 A 上传</p>
            <Button type="button" onClick={upload}>
              上传
            </Button>
          </div>
        </div>
      )}
      {booksOpen ? (
        <div
          className="absolute top-9 bottom-0 left-0 z-30 max-w-full overflow-hidden border-r border-border bg-background"
          style={{ width: thumbWidth }}
        >
          <FileRail
            queue={queue}
            onOpen={(id) => {
              setQueue((state) => (state ? openBook(state, id) : state))
              setBooksOpen(false)
            }}
            onUpload={upload}
          />
        </div>
      ) : null}
      {dragging ? (
        <div className="pointer-events-none absolute inset-0 z-50 grid place-items-center bg-background/88">
          <div className="border border-dashed border-primary px-10 py-8 text-[15px] text-primary">
            松开，加入今天的书单
          </div>
        </div>
      ) : null}
      <CommandMenu open={commandOpen} items={commandItems} onClose={() => setCommandOpen(false)} />
    </main>
  )
}
