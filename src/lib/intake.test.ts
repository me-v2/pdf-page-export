import { describe, expect, it } from "vitest"
import { droppedEntries, filesFromDropped } from "./intake"

describe("multiple pdf intake", () => {
  it("reads every dropped file before any handle is awaited", async () => {
    const order: string[] = []
    const entries = droppedEntries([
      {
        kind: "file",
        getAsFile: () => {
          order.push("file:a.pdf")
          return new File(["a"], "a.pdf", { type: "application/pdf" })
        },
        getAsFileSystemHandle: () => {
          order.push("handle:a.pdf")
          return Promise.resolve(null)
        },
      },
      {
        kind: "file",
        getAsFile: () => {
          order.push("file:b.pdf")
          return new File(["b"], "b.pdf", { type: "application/pdf" })
        },
        getAsFileSystemHandle: () => {
          order.push("handle:b.pdf")
          return Promise.resolve(null)
        },
      },
      {
        kind: "file",
        getAsFile: () => new File(["c"], "notes.txt", { type: "text/plain" }),
        getAsFileSystemHandle: () => Promise.resolve(null),
      },
    ])
    expect(order).toEqual(["file:a.pdf", "handle:a.pdf", "file:b.pdf", "handle:b.pdf"])
    const dropped = await filesFromDropped(entries)
    expect(dropped.files.map((file) => file.fileName)).toEqual(["a.pdf", "b.pdf"])
  })
})
