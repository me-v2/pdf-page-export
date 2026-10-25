import { describe, expect, it } from "vitest"
import {
  bookNameFromFile,
  imageExportName,
  pageExportName,
  pageTag,
  safeBookName,
  shortBookName,
  zipExportName,
} from "./filename"

const stamp = new Date(2026, 9, 24, 15, 30, 12)

describe("filename", () => {
  it("uses the file name without the pdf extension", () => {
    expect(bookNameFromFile("三体.pdf")).toBe("三体")
    expect(bookNameFromFile("Notes.PDF")).toBe("Notes")
  })

  it("removes characters that cannot appear in a download name", () => {
    expect(safeBookName('a/b:c*?"<>|')).toBe("a b c")
  })

  it("drops a trailing document id so the file name stays readable", () => {
    const long =
      "曹县汉服花型AI智能设计系统服务项目磋商文件（SDGP37172100020260200009920261019001）"
    expect(shortBookName(long)).toBe("曹县汉服花型AI智能设计系统服务项目磋商文件")
    expect(bookNameFromFile(`${long}.pdf`)).toBe("曹县汉服花型AI智能设计系统服务项目磋商文件")
    expect(shortBookName("报告（草案）")).toBe("报告（草案）")
    expect(pageExportName(long, 39, 40, stamp)).toBe(
      "曹县汉服花型AI智能设计系统服务项目磋商文件_p039_20261024-153012.png",
    )
  })

  it("pads the page to at least three digits", () => {
    expect(pageTag(42, 312)).toBe("p042")
    expect(pageTag(42, 1200)).toBe("p0042")
  })

  it("builds the page, image, and zip names from the same stamp", () => {
    expect(pageExportName("三体", 42, 312, stamp)).toBe(
      "三体_p042_20261024-153012.png",
    )
    expect(imageExportName("三体", 42, 312, 1, stamp)).toBe(
      "三体_p042_i01_20261024-153012.png",
    )
    expect(zipExportName("三体", 42, 312, stamp)).toBe(
      "三体_p042_20261024-153012.zip",
    )
  })
})
