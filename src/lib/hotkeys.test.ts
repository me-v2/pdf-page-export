import { describe, expect, it } from "vitest"
import { decideHotkey } from "./hotkeys"

describe("decideHotkey", () => {
  it("leaves browser shortcuts alone", () => {
    expect(decideHotkey({ key: "s", ctrlKey: true })).toBeNull()
    expect(decideHotkey({ key: "p", metaKey: true })).toBeNull()
    expect(decideHotkey({ key: "e", altKey: true })).toBeNull()
  })

  it("does nothing while a field or dialog has focus", () => {
    expect(decideHotkey({ key: "x", typing: true })).toBeNull()
    expect(decideHotkey({ key: "ArrowRight", dialog: true })).toBeNull()
  })

  it("ignores a repeated or in-progress export key but still turns the page", () => {
    expect(decideHotkey({ key: "x", busy: true })).toBeNull()
    expect(decideHotkey({ key: "i", repeat: true })).toBeNull()
    expect(decideHotkey({ key: "ArrowLeft", busy: true })).toBe("prev")
  })

  it("maps the single keys used for the daily job", () => {
    expect(decideHotkey({ key: "x" })).toBe("export")
    expect(decideHotkey({ key: "I" })).toBe("extract")
    expect(decideHotkey({ key: "n" })).toBe("nextBook")
    expect(decideHotkey({ key: "=" })).toBe("zoomIn")
    expect(decideHotkey({ key: "-" })).toBe("zoomOut")
    expect(decideHotkey({ key: "0" })).toBe("fitWidth")
    expect(decideHotkey({ key: "f" })).toBe("toggleExported")
    expect(decideHotkey({ key: "b" })).toBe("books")
    expect(decideHotkey({ key: "k" })).toBe("command")
    expect(decideHotkey({ key: "a" })).toBe("upload")
    expect(decideHotkey({ key: "A" })).toBe("upload")
    expect(decideHotkey({ key: "a", repeat: true })).toBeNull()
    expect(decideHotkey({ key: "ArrowRight" })).toBe("next")
  })
})
