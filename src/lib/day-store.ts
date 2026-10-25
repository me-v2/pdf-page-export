import { shortBookName } from "./filename"
import type { BookRecord, Dpi, QueueState, ThumbTab } from "./queue"
import type { Zoom } from "./zoom"

const DB_NAME = "tiaoye"
const DB_VERSION = 2
const STORE = "day"
const FILES = "pdfs"
const KEY = "current"
const EXPORT_DIR = "export-dir"

export type StoredDay = {
  day: string
  dpi: Dpi
  activeId: string | null
  zoom: Zoom
  thumbTab: ThumbTab
  books: BookRecord[]
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
      if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function loadDay(): Promise<StoredDay | null> {
  const db = await openDb()
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY)
      request.onsuccess = () => resolve((request.result as StoredDay | undefined) ?? null)
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

export async function saveDay(value: StoredDay): Promise<void> {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const request = db
        .transaction(STORE, "readwrite")
        .objectStore(STORE)
        .put(value, KEY)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

export async function savePdf(id: string, blob: Blob): Promise<void> {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(FILES, "readwrite").objectStore(FILES).put(blob, id)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

export async function loadPdf(id: string): Promise<Blob | null> {
  const db = await openDb()
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(FILES, "readonly").objectStore(FILES).get(id)
      request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null)
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

export async function deletePdf(id: string): Promise<void> {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(FILES, "readwrite").objectStore(FILES).delete(id)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

export async function clearPdfs(): Promise<void> {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(FILES, "readwrite").objectStore(FILES).clear()
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

export async function loadExportDir(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDb()
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(EXPORT_DIR)
      request.onsuccess = () => {
        const value = request.result as FileSystemDirectoryHandle | undefined
        resolve(value?.kind === "directory" ? value : null)
      }
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

export async function saveExportDir(dir: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(dir, EXPORT_DIR)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

export async function forgetExportDir(): Promise<void> {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE, "readwrite").objectStore(STORE).delete(EXPORT_DIR)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

export function queueFromStored(stored: StoredDay): QueueState {
  return {
    day: stored.day,
    dpi: stored.dpi,
    activeId: stored.activeId,
    zoom: stored.zoom,
    thumbTab: stored.thumbTab,
    books: stored.books.map((storedBook) => ({
      id: storedBook.id,
      fileName: storedBook.fileName,
      bookName: shortBookName(storedBook.bookName),
      size: storedBook.size,
      lastModified: storedBook.lastModified,
      pageCount: storedBook.pageCount,
      status: storedBook.status,
      currentPage: storedBook.currentPage,
      exportedPages: storedBook.exportedPages,
    })),
  }
}
