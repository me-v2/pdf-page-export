import { CheckIcon } from "lucide-react"
import { activeBook, type BookStatus, type QueueState } from "@/lib/queue"

function StatusMark({ status }: { status: BookStatus }) {
  if (status === "done") {
    return (
      <span className="grid size-3.5 place-items-center rounded-full bg-exported/20">
        <CheckIcon className="size-2.5 text-exported" />
      </span>
    )
  }
  return (
    <span
      className={`size-1.5 rounded-full ${
        status === "reading" ? "bg-primary" : "border border-muted-foreground"
      }`}
    />
  )
}

export function FileRail({
  queue,
  onOpen,
  onUpload,
}: {
  queue: QueueState
  onOpen: (id: string) => void
  onUpload: () => void
}) {
  const current = activeBook(queue)?.id
  return (
    <aside
      title="双击上传 PDF"
      className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background"
      onDoubleClick={(event) => {
        if (event.target instanceof Element && event.target.closest("button")) return
        onUpload()
      }}
    >
      <div className="flex h-8 items-center border-b px-3 text-[12px] font-medium tracking-wide text-muted-foreground">
        今天的书
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex w-full flex-col py-1">
          {queue.books.length === 0 ? (
            <p className="px-3 py-6 text-[13px] text-muted-foreground">把今天的 PDF 拖进来。</p>
          ) : (
            queue.books.map((book) => (
              <button
                key={book.id}
                type="button"
                title={book.bookName}
                onClick={() => onOpen(book.id)}
                className={`flex h-9 w-full min-w-0 items-center gap-2 px-3 text-left ${
                  book.id === current ? "bg-accent" : "hover:bg-muted/60"
                }`}
              >
                <span className="grid size-4 shrink-0 place-items-center">
                  <StatusMark status={book.status} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px]">{book.bookName}</span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                  {book.exportedPages.length > 0
                    ? `${book.exportedPages.length} 页`
                    : `p${book.currentPage}`}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </aside>
  )
}
