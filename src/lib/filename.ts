const ILLEGAL = /[\\/:*?"<>|\u0000-\u001f]/g

export function safeBookName(name: string): string {
  const cleaned = name.replace(ILLEGAL, " ").replace(/\s+/g, " ").trim()
  return cleaned || "未命名"
}

const TRAILING_ID = /^(.*?)[（(【\[]([^）)】\]]+)[）)】\]]$/

export function shortBookName(name: string): string {
  const cleaned = safeBookName(name)
  const match = TRAILING_ID.exec(cleaned)
  if (!match) return cleaned
  const title = match[1].trim()
  const inside = match[2].replace(/[\s._-]/g, "")
  if (!title || inside.length < 8 || !/^[A-Za-z0-9]+$/.test(inside)) return cleaned
  return title
}

export function bookNameFromFile(fileName: string): string {
  return shortBookName(fileName.replace(/\.pdf$/i, ""))
}

export function pageTag(page: number, pageCount: number): string {
  const width = Math.max(3, String(Math.max(pageCount, 1)).length)
  return `p${String(page).padStart(width, "0")}`
}

export function localStamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

export function pageExportName(
  book: string,
  page: number,
  pageCount: number,
  date: Date,
): string {
  return `${shortBookName(book)}_${pageTag(page, pageCount)}_${localStamp(date)}.png`
}

export function imageExportName(
  book: string,
  page: number,
  pageCount: number,
  index: number,
  date: Date,
): string {
  const ordinal = String(index).padStart(2, "0")
  return `${shortBookName(book)}_${pageTag(page, pageCount)}_i${ordinal}_${localStamp(date)}.png`
}

export function zipExportName(
  book: string,
  page: number,
  pageCount: number,
  date: Date,
): string {
  return `${shortBookName(book)}_${pageTag(page, pageCount)}_${localStamp(date)}.zip`
}
