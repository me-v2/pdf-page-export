export type HotkeyAction =
  | "prev"
  | "next"
  | "back10"
  | "forward10"
  | "first"
  | "last"
  | "export"
  | "extract"
  | "zoomIn"
  | "zoomOut"
  | "fitWidth"
  | "nextBook"
  | "toggleExported"
  | "goto"
  | "books"
  | "command"
  | "upload"

export type HotkeyInput = {
  key: string
  metaKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
  repeat?: boolean
  typing?: boolean
  dialog?: boolean
  busy?: boolean
}

export function decideHotkey(input: HotkeyInput): HotkeyAction | null {
  if (input.metaKey || input.ctrlKey || input.altKey) return null
  if (input.typing || input.dialog) return null
  const key = input.key
  const held = key === "x" || key === "X" || key === "i" || key === "I" || key === "a" || key === "A"
  if (held && (input.busy || input.repeat)) return null

  switch (key) {
    case "ArrowLeft":
    case "h":
      return "prev"
    case "ArrowRight":
    case "l":
      return "next"
    case "[":
      return "back10"
    case "]":
      return "forward10"
    case "Home":
      return "first"
    case "End":
      return "last"
    case "x":
    case "X":
      return "export"
    case "i":
    case "I":
      return "extract"
    case "=":
    case "+":
      return "zoomIn"
    case "-":
    case "_":
      return "zoomOut"
    case "0":
      return "fitWidth"
    case "n":
    case "N":
      return "nextBook"
    case "f":
    case "F":
      return "toggleExported"
    case "g":
      return "goto"
    case "b":
    case "B":
      return "books"
    case "k":
    case "K":
      return "command"
    case "a":
    case "A":
      return "upload"
    default:
      return null
  }
}

const INERT_INPUTS = new Set([
  "button",
  "checkbox",
  "radio",
  "range",
  "file",
  "color",
])

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  if (target instanceof HTMLElement && target.isContentEditable) return true
  const field = target.closest(
    'input, textarea, select, [contenteditable="true"], [role="listbox"], [role="option"], [role="dialog"]',
  )
  if (!field) return false
  if (field instanceof HTMLInputElement && INERT_INPUTS.has(field.type)) {
    return false
  }
  return true
}
