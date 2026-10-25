import { describe, expect, it } from "vitest"
import { Preempted, RenderScheduler } from "./scheduler"

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe("render scheduler", () => {
  it("paints a queued preview before a queued export", async () => {
    const scheduler = new RenderScheduler()
    const order: string[] = []
    const exported = scheduler.enqueue({
      kind: "export",
      key: "export",
      run: async () => {
        order.push("export")
      },
    })
    const preview = scheduler.enqueue({
      kind: "preview",
      key: "page-2",
      run: async () => {
        order.push("preview")
      },
    })
    await Promise.all([exported, preview])
    expect(order).toEqual(["preview", "export"])
  })

  it("drops a preview for a page that is no longer open", async () => {
    const scheduler = new RenderScheduler()
    const first = scheduler.enqueue({
      kind: "preview",
      key: "page-1",
      run: (scope) =>
        new Promise((_resolve, reject) => {
          scope.onCancel(() => reject(new Preempted()))
        }),
    })
    await tick()
    const second = scheduler.enqueue({
      kind: "preview",
      key: "page-2",
      run: async () => "page-2",
    })
    await expect(first).rejects.toBeInstanceOf(Preempted)
    await expect(second).resolves.toBe("page-2")
  })

  it("finishes the export after the current page has painted", async () => {
    const scheduler = new RenderScheduler()
    const order: string[] = []
    let starts = 0
    const exported = scheduler.enqueue({
      kind: "export",
      key: "export",
      run: (scope) =>
        new Promise((resolve, reject) => {
          starts += 1
          order.push(`export-${starts}`)
          if (starts === 1) {
            scope.onCancel(() => reject(new Preempted()))
            return
          }
          order.push("export-done")
          resolve("ok")
        }),
    })
    await tick()
    const preview = scheduler.enqueue({
      kind: "preview",
      key: "page-2",
      run: async () => {
        order.push("preview")
      },
    })
    await Promise.all([exported, preview])
    expect(order).toEqual(["export-1", "preview", "export-2", "export-done"])
  })

  it("drops thumbnails that have left the list", async () => {
    const scheduler = new RenderScheduler()
    const thumb = scheduler.enqueue({
      kind: "thumb",
      key: "doc:3",
      run: async () => "thumb",
    })
    scheduler.setThumbKeep(() => false)
    await expect(thumb).rejects.toBeInstanceOf(Preempted)
  })

  it("keeps sibling tiles of the same page", async () => {
    const scheduler = new RenderScheduler()
    let cancelled = false
    const first = scheduler.enqueue({
      kind: "preview",
      key: "page-1",
      run: (scope) =>
        new Promise((resolve) => {
          scope.onCancel(() => {
            cancelled = true
          })
          setTimeout(() => resolve("tile-a"), 20)
        }),
    })
    await tick()
    const second = scheduler.enqueue({
      kind: "preview",
      key: "page-1",
      run: async () => "tile-b",
    })
    await expect(first).resolves.toBe("tile-a")
    await expect(second).resolves.toBe("tile-b")
    expect(cancelled).toBe(false)
  })
})
