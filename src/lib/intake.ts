import { bookNameFromFile } from "./filename"

export type IncomingFile = {
  id: string
  fileName: string
  bookName: string
  size: number
  lastModified: number
  file: File
  handle: FileSystemFileHandle | null
}

export function incomingId(file: {
  name: string
  size: number
  lastModified: number
}): string {
  return `${file.name}:${file.size}:${file.lastModified}`
}

export function toIncoming(
  file: File,
  handle: FileSystemFileHandle | null,
): IncomingFile {
  return {
    id: incomingId(file),
    fileName: file.name,
    bookName: bookNameFromFile(file.name),
    size: file.size,
    lastModified: file.lastModified,
    file,
    handle,
  }
}

async function collectPdf(handle: FileSystemHandle, out: IncomingFile[]) {
  if (handle.kind === "file") {
    const fileHandle = handle as FileSystemFileHandle
    if (!fileHandle.name.toLowerCase().endsWith(".pdf")) return
    out.push(toIncoming(await fileHandle.getFile(), fileHandle))
    return
  }
  const directory = handle as FileSystemDirectoryHandle
  for await (const entry of directory.values()) {
    await collectPdf(entry, out)
  }
}

export async function filesFromDirectory(
  directory: FileSystemDirectoryHandle,
): Promise<IncomingFile[]> {
  const files: IncomingFile[] = []
  await collectPdf(directory, files)
  return files
}

export async function pickDirectory(): Promise<{
  files: IncomingFile[]
  directory: FileSystemDirectoryHandle
} | null> {
  const picker = (
    window as Window & {
      showDirectoryPicker?: (options?: {
        mode?: "read"
      }) => Promise<FileSystemDirectoryHandle>
    }
  ).showDirectoryPicker
  if (!picker) return null
  try {
    const directory = await picker({ mode: "read" })
    return { directory, files: await filesFromDirectory(directory) }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return null
    throw error
  }
}

type DropItem = {
  kind: string
  getAsFile: () => File | null
  getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>
}

export type DroppedEntry = {
  file: File | null
  handle: Promise<FileSystemHandle | null>
}

export function droppedEntries(items: DropItem[]): DroppedEntry[] {
  return items
    .filter((item) => item.kind === "file")
    .map((item) => ({
      file: item.getAsFile(),
      handle: item.getAsFileSystemHandle?.() ?? Promise.resolve(null),
    }))
}

function rememberPdf(files: IncomingFile[], incoming: IncomingFile) {
  if (files.some((file) => file.id === incoming.id)) return
  files.push(incoming)
}

export async function filesFromDropped(entries: DroppedEntry[]): Promise<{
  files: IncomingFile[]
  directory: FileSystemDirectoryHandle | null
}> {
  const files: IncomingFile[] = []
  let directory: FileSystemDirectoryHandle | null = null
  for (const entry of entries) {
    const handle = await entry.handle.catch(() => null)
    if (handle?.kind === "directory") {
      const folder = handle as FileSystemDirectoryHandle
      if (!directory) directory = folder
      for (const incoming of await filesFromDirectory(folder)) rememberPdf(files, incoming)
      continue
    }
    if (handle?.kind === "file") {
      const fileHandle = handle as FileSystemFileHandle
      if (fileHandle.name.toLowerCase().endsWith(".pdf")) {
        rememberPdf(files, toIncoming(await fileHandle.getFile(), fileHandle))
        continue
      }
    }
    const file = entry.file
    if (!file || !file.name.toLowerCase().endsWith(".pdf")) continue
    rememberPdf(files, toIncoming(file, null))
  }
  return { files, directory }
}

export async function filesFromDataTransfer(data: DataTransfer): Promise<{
  files: IncomingFile[]
  directory: FileSystemDirectoryHandle | null
}> {
  const items = [...data.items] as DropItem[]
  return filesFromDropped(droppedEntries(items))
}

export async function pickPdfs(): Promise<IncomingFile[] | null> {
  const picker = (
    window as Window & {
      showOpenFilePicker?: (options?: {
        multiple?: boolean
        excludeAcceptAllOption?: boolean
        types?: Array<{ description?: string; accept: Record<string, string[]> }>
      }) => Promise<FileSystemFileHandle[]>
    }
  ).showOpenFilePicker
  if (!picker) return null
  try {
    const handles = await picker({
      multiple: true,
      excludeAcceptAllOption: false,
      types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }],
    })
    const files: IncomingFile[] = []
    for (const handle of handles) {
      if (!handle.name.toLowerCase().endsWith(".pdf")) continue
      rememberPdf(files, toIncoming(await handle.getFile(), handle))
    }
    return files
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return []
    throw error
  }
}

type PermissionHandle = FileSystemHandle & {
  queryPermission?: (descriptor?: { mode?: "read" }) => Promise<PermissionState>
  requestPermission?: (descriptor?: { mode?: "read" }) => Promise<PermissionState>
}

export async function queryRead(handle: FileSystemHandle): Promise<boolean> {
  const withPermission = handle as PermissionHandle
  if (!withPermission.queryPermission) return false
  return (await withPermission.queryPermission({ mode: "read" })) === "granted"
}

export async function requestRead(handle: FileSystemHandle): Promise<boolean> {
  const withPermission = handle as PermissionHandle
  if (!withPermission.requestPermission) return false
  return (await withPermission.requestPermission({ mode: "read" })) === "granted"
}
