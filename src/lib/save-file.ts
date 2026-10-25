import { forgetExportDir, loadExportDir, saveExportDir } from "./day-store"

export class SaveCancelled extends Error {
  constructor() {
    super("save cancelled")
    this.name = "SaveCancelled"
  }
}

export type SaveInfo = {
  filename: string | null
  folder: string | null
  picking: boolean
}

type WritableDirectory = FileSystemDirectoryHandle & {
  queryPermission?: (descriptor: { mode: "readwrite" }) => Promise<PermissionState>
  requestPermission?: (descriptor: { mode: "readwrite" }) => Promise<PermissionState>
}

export function saveStatusLines(info: SaveInfo): string[] {
  const where = info.picking
    ? "选一个普通文件夹，不要直接选「下载」。之后不再询问"
    : info.folder
      ? `保存到 ${info.folder}`
      : null
  return ["正在保存", ...(info.filename ? [info.filename] : []), ...(where ? [where] : [])]
}

async function permissionOf(dir: FileSystemDirectoryHandle): Promise<PermissionState | null> {
  const handle = dir as WritableDirectory
  if (!handle.queryPermission) return null
  return handle.queryPermission({ mode: "readwrite" })
}

async function requestWrite(dir: FileSystemDirectoryHandle): Promise<boolean> {
  const handle = dir as WritableDirectory
  if (!handle.requestPermission) return false
  return (await handle.requestPermission({ mode: "readwrite" })) === "granted"
}

function pickExportDir(): Promise<FileSystemDirectoryHandle> {
  const picker = (
    window as Window & {
      showDirectoryPicker?: (options?: {
        id?: string
        mode?: "readwrite"
      }) => Promise<FileSystemDirectoryHandle>
    }
  ).showDirectoryPicker
  if (!picker) throw new Error("directory picker missing")
  return picker({ id: "tiaoye-pages", mode: "readwrite" })
}

export async function ensureExportDir(onPick?: () => void): Promise<FileSystemDirectoryHandle> {
  const stored = await loadExportDir().catch(() => null)
  if (stored) {
    const permission = await permissionOf(stored)
    if (permission === "granted") return stored
    if (permission === "prompt" && (await requestWrite(stored))) return stored
    await forgetExportDir().catch(() => undefined)
  }
  onPick?.()
  try {
    const picked = await pickExportDir()
    await saveExportDir(picked)
    return picked
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new SaveCancelled()
    throw error
  }
}

export async function writeExportFile(
  dir: FileSystemDirectoryHandle,
  filename: string,
  blob: Blob,
): Promise<void> {
  const file = await dir.getFileHandle(filename, { create: true })
  const writable = await file.createWritable()
  try {
    await writable.write(blob)
  } finally {
    await writable.close()
  }
}
