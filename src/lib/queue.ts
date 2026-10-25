import type { Zoom } from "./zoom"

export type Dpi = 150 | 300 | 600
export type BookStatus = "unread" | "reading" | "done"
export type ThumbTab = "all" | "exported"

export type BookRecord = {
  id: string
  fileName: string
  bookName: string
  size: number
  lastModified: number
  pageCount: number | null
  status: BookStatus
  currentPage: number
  exportedPages: number[]
}

export type IncomingBook = {
  id: string
  fileName: string
  bookName: string
  size: number
  lastModified: number
}

export type QueueState = {
  day: string
  dpi: Dpi
  activeId: string | null
  zoom: Zoom
  thumbTab: ThumbTab
  books: BookRecord[]
}

const DPI_VALUES: Dpi[] = [150, 300, 600]

export function todayString(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function emptyQueue(day: string): QueueState {
  return {
    day,
    dpi: 300,
    activeId: null,
    zoom: { kind: "fit" },
    thumbTab: "all",
    books: [],
  }
}

export function activeBook(state: QueueState): BookRecord | null {
  return state.books.find((book) => book.id === state.activeId) ?? null
}

function byFileName(a: BookRecord, b: BookRecord): number {
  return a.fileName.localeCompare(b.fileName, "zh", {
    numeric: true,
    sensitivity: "base",
  })
}

function reading(book: BookRecord): BookRecord {
  return book.status === "unread" ? { ...book, status: "reading" } : book
}

export function addIncoming(
  state: QueueState,
  incoming: IncomingBook[],
): QueueState {
  const known = new Set(state.books.map((book) => book.id))
  const added: BookRecord[] = incoming
    .filter((item) => !known.has(item.id))
    .map((item) => ({
      id: item.id,
      fileName: item.fileName,
      bookName: item.bookName,
      size: item.size,
      lastModified: item.lastModified,
      pageCount: null,
      status: "unread",
      currentPage: 1,
      exportedPages: [],
    }))
  if (added.length === 0) return state

  let books = [...state.books, ...added].sort(byFileName)
  let activeId = state.activeId
  if (!activeId) {
    const first = books.find((book) => book.status !== "done")
    if (first) {
      activeId = first.id
      books = books.map((book) => (book.id === first.id ? reading(book) : book))
    }
  }
  return { ...state, books, activeId }
}

export function openBook(state: QueueState, id: string): QueueState {
  if (!state.books.some((book) => book.id === id)) return state
  return {
    ...state,
    activeId: id,
    books: state.books.map((book) => (book.id === id ? reading(book) : book)),
  }
}

export function notePageCount(
  state: QueueState,
  id: string,
  pageCount: number,
): QueueState {
  return {
    ...state,
    books: state.books.map((book) =>
      book.id === id
        ? {
            ...book,
            pageCount,
            currentPage: Math.min(book.currentPage, Math.max(pageCount, 1)),
          }
        : book,
    ),
  }
}

export function setPage(state: QueueState, page: number): QueueState {
  if (!state.activeId) return state
  return {
    ...state,
    books: state.books.map((book) => {
      if (book.id !== state.activeId) return book
      const max = book.pageCount ?? Math.max(1, page)
      const next = Math.min(Math.max(1, Math.floor(page)), max)
      return { ...book, currentPage: next }
    }),
  }
}

export function shiftPage(state: QueueState, delta: number): QueueState {
  const book = activeBook(state)
  if (!book) return state
  return setPage(state, book.currentPage + delta)
}

export function setBookName(state: QueueState, bookName: string): QueueState {
  if (!state.activeId) return state
  return {
    ...state,
    books: state.books.map((book) =>
      book.id === state.activeId ? { ...book, bookName } : book,
    ),
  }
}

export function markExported(
  state: QueueState,
  bookId: string,
  page: number,
): QueueState {
  return {
    ...state,
    books: state.books.map((book) => {
      if (book.id !== bookId) return book
      const exportedPages = book.exportedPages.includes(page)
        ? book.exportedPages
        : [...book.exportedPages, page].sort((a, b) => a - b)
      return { ...book, exportedPages, status: reading(book).status }
    }),
  }
}

export type FinishMark = {
  bookId: string
  status: BookStatus
  activeId: string
}

export function captureFinish(state: QueueState): FinishMark | null {
  const book = activeBook(state)
  if (!book || !state.activeId) return null
  return { bookId: book.id, status: book.status, activeId: state.activeId }
}

export function undoFinish(state: QueueState, mark: FinishMark): QueueState {
  if (!state.books.some((book) => book.id === mark.bookId)) return state
  const activeExists = state.books.some((book) => book.id === mark.activeId)
  return {
    ...state,
    activeId: activeExists ? mark.activeId : state.activeId,
    books: state.books.map((book) =>
      book.id === mark.bookId ? { ...book, status: mark.status } : book,
    ),
  }
}

export function finishAndNext(state: QueueState): QueueState {
  if (!state.activeId) return state
  const books = state.books.map((book) =>
    book.id === state.activeId ? { ...book, status: "done" as const } : book,
  )
  const currentIndex = books.findIndex((book) => book.id === state.activeId)
  const later = books.slice(currentIndex + 1)
  const earlier = books.slice(0, currentIndex)
  const next = [...later, ...earlier].find((book) => book.status !== "done")
  if (!next) return { ...state, books }
  return {
    ...state,
    activeId: next.id,
    books: books.map((book) => (book.id === next.id ? reading(book) : book)),
  }
}

export function removeBook(state: QueueState, id: string): QueueState {
  const books = state.books.filter((book) => book.id !== id)
  if (state.activeId !== id) return { ...state, books }
  const next = books.find((book) => book.status !== "done") ?? books[0] ?? null
  if (!next) return { ...state, books, activeId: null }
  return {
    ...state,
    activeId: next.id,
    books: books.map((book) => (book.id === next.id ? reading(book) : book)),
  }
}

export function setDpi(state: QueueState, dpi: number): QueueState {
  const next = DPI_VALUES.find((value) => value === dpi)
  return next ? { ...state, dpi: next } : state
}

export function setZoom(state: QueueState, zoom: Zoom): QueueState {
  return { ...state, zoom }
}

export function setThumbTab(state: QueueState, thumbTab: ThumbTab): QueueState {
  if (state.thumbTab === thumbTab) return state
  return { ...state, thumbTab }
}

export function toggleThumb(state: QueueState): QueueState {
  return setThumbTab(state, state.thumbTab === "all" ? "exported" : "all")
}

export function applyDay(state: QueueState, today: string): QueueState {
  if (state.day === today) return state
  return { ...emptyQueue(today), dpi: state.dpi }
}

export function progress(state: QueueState): {
  total: number
  done: number
  exported: number
} {
  return {
    total: state.books.length,
    done: state.books.filter((book) => book.status === "done").length,
    exported: state.books.reduce(
      (sum, book) => sum + book.exportedPages.length,
      0,
    ),
  }
}

export function progressLabel(state: QueueState): string {
  const counts = progress(state)
  return `今天 ${counts.total} 本 · 已看完 ${counts.done} · 已导出 ${counts.exported} 页`
}

export function progressCompact(state: QueueState): string {
  const counts = progress(state)
  if (counts.total === 0) return "今天"
  return `今天 ${counts.done}/${counts.total} · ${counts.exported} 页`
}

export function batchDone(state: QueueState): boolean {
  return (
    state.books.length > 0 && state.books.every((book) => book.status === "done")
  )
}

export function statusLabel(status: BookStatus): string {
  if (status === "done") return "已看完"
  if (status === "reading") return "进行中"
  return "未看"
}
