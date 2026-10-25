export const THUMB_DEFAULT = 200
export const THUMB_MIN = 160
export const THUMB_MAX = 300
export const THUMB_KEY = "tiaoye-thumb-width"

export function clampThumbWidth(value: number): number {
  if (!Number.isFinite(value)) return THUMB_DEFAULT
  return Math.min(THUMB_MAX, Math.max(THUMB_MIN, Math.round(value)))
}

export function readThumbWidth(stored: string | null): number {
  if (stored == null || stored === "") return THUMB_DEFAULT
  return clampThumbWidth(Number(stored))
}

export function loadThumbWidth(): number {
  if (typeof localStorage === "undefined") return THUMB_DEFAULT
  try {
    return readThumbWidth(localStorage.getItem(THUMB_KEY))
  } catch {
    return THUMB_DEFAULT
  }
}

export function saveThumbWidth(value: number): number {
  const next = clampThumbWidth(value)
  try {
    localStorage.setItem(THUMB_KEY, String(next))
  } catch {
    return next
  }
  return next
}
