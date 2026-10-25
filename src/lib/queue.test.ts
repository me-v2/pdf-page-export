import { describe, expect, it } from "vitest"
import {
  addIncoming,
  applyDay,
  captureFinish,
  emptyQueue,
  finishAndNext,
  markExported,
  openBook,
  setThumbTab,
  undoFinish,
} from "./queue"

function book(fileName: string) {
  return {
    id: fileName,
    fileName,
    bookName: fileName.replace(/\.pdf$/, ""),
    size: 10,
    lastModified: 1,
  }
}

describe("queue", () => {
  it("finishes a book that exported nothing and opens the next unread one", () => {
    const started = addIncoming(emptyQueue("2026-10-24"), [
      book("b.pdf"),
      book("a.pdf"),
    ])
    expect(started.activeId).toBe("a.pdf")
    const finished = finishAndNext(started)
    const first = finished.books.find((item) => item.id === "a.pdf")
    expect(first?.status).toBe("done")
    expect(first?.exportedPages).toEqual([])
    expect(finished.activeId).toBe("b.pdf")
    expect(finished.books.find((item) => item.id === "b.pdf")?.status).toBe(
      "reading",
    )
  })

  it("returns to the book that was just marked done", () => {
    const started = addIncoming(emptyQueue("2026-10-24"), [
      book("b.pdf"),
      book("a.pdf"),
    ])
    const marked = markExported(started, "a.pdf", 2)
    const mark = captureFinish(marked)
    const finished = finishAndNext(marked)
    const restored = undoFinish(finished, mark!)
    expect(restored.activeId).toBe("a.pdf")
    expect(restored.books.find((item) => item.id === "a.pdf")).toMatchObject({
      status: "reading",
      exportedPages: [2],
    })
  })

  it("keeps a finished book finished when it is opened again", () => {
    const finished = finishAndNext(
      addIncoming(emptyQueue("2026-10-24"), [book("a.pdf")]),
    )
    const reopened = openBook(finished, "a.pdf")
    expect(reopened.books[0]?.status).toBe("done")
  })

  it("records an export on the book that was current when export started", () => {
    const started = addIncoming(emptyQueue("2026-10-24"), [book("a.pdf")])
    const marked = markExported(started, "a.pdf", 4)
    expect(marked.books[0]?.exportedPages).toEqual([4])
  })

  it("selects the thumb tab that was clicked", () => {
    const started = emptyQueue("2026-10-24")
    const exported = setThumbTab(started, "exported")
    expect(exported.thumbTab).toBe("exported")
    expect(setThumbTab(exported, "exported")).toBe(exported)
    expect(setThumbTab(exported, "all").thumbTab).toBe("all")
  })

  it("clears the shelf when the day changes and keeps the chosen dpi", () => {
    const started = {
      ...addIncoming(emptyQueue("2026-10-24"), [book("a.pdf")]),
      dpi: 600 as const,
    }
    const next = applyDay(started, "2026-10-25")
    expect(next.books).toEqual([])
    expect(next.activeId).toBeNull()
    expect(next.dpi).toBe(600)
    expect(next.day).toBe("2026-10-25")
  })
})
