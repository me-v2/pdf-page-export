import { describe, expect, it } from "vitest"
import { saveStatusLines } from "./save-file"

describe("save status", () => {
  it("explains the one-time folder choice", () => {
    expect(saveStatusLines({ filename: null, folder: null, picking: true })).toEqual([
      "正在保存",
      "选一个普通文件夹，不要直接选「下载」。之后不再询问",
    ])
  })

  it("shows the file name and folder while saving", () => {
    expect(
      saveStatusLines({
        filename: "三体_p042_20261024-153012.png",
        folder: "挑页",
        picking: false,
      }),
    ).toEqual(["正在保存", "三体_p042_20261024-153012.png", "保存到 挑页"])
  })
})
