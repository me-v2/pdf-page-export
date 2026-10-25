async (page) => {
  const root = "/Users/hiro/Projects/pdf-page-export/fixtures"
  const notes = []
  const downloads = []
  page.on("download", (download) => {
    downloads.push(download)
  })

  const waitFor = async (label, predicate, timeout = 8000) => {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      if (await predicate()) return
      await page.waitForTimeout(100)
    }
    const text = await page.locator("body").innerText()
    throw new Error(`${label}\n${text}\n${downloads.map((item) => item.suggestedFilename()).join(", ")}`)
  }

  await page.evaluate(() => indexedDB.deleteDatabase("tiaoye"))
  await page.reload()
  await page.getByRole("button", { name: "放下今天的 PDF" }).waitFor()

  await page.locator("input[type=file]").setInputFiles([
    `${root}/三体.pdf`,
    `${root}/tall.pdf`,
    `${root}/images.pdf`,
    `${root}/encrypted.pdf`,
    `${root}/two-pages.pdf`,
    `${root}/huge.pdf`,
  ])

  await waitFor("shelf", async () => (await page.locator("body").innerText()).includes("今天 6 本"))
  await waitFor("canvas", () =>
    page.evaluate(() => {
      const canvas = document.querySelector("main canvas")
      return Boolean(canvas && canvas.width > 100)
    }),
  )

  const blur = () =>
    page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    })

  await blur()
  await page.evaluate(() => {
    const fire = () =>
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "x", bubbles: true }))
    fire()
    fire()
  })
  await waitFor("one export", async () => downloads.length >= 1)
  await page.waitForTimeout(700)
  notes.push(`double-x-downloads:${downloads.length}`)

  const readDownload = async (download) => {
    const stream = await download.createReadStream()
    const chunks = []
    for await (const chunk of stream) chunks.push(chunk)
    return Buffer.concat(chunks)
  }
  const pageFile = downloads[0]
  const pageName = pageFile.suggestedFilename()
  const png = await readDownload(pageFile)
  const phys = png.indexOf("pHYs")
  const ppm = phys >= 0 ? png.readUInt32BE(phys + 4) : 0
  const body = await page.locator("body").innerText()
  notes.push(`page:${pageName}`)
  notes.push(`png-sig:${png.subarray(0, 8).toString("hex")}`)
  notes.push(`ppm:${ppm}`)
  notes.push(`toast:${body.includes(`✅ 已导出 ${pageName}`)}`)

  await blur()
  await page.keyboard.press("f")
  await waitFor("exported tab", async () =>
    (await page.getByRole("tab", { name: "已导出" }).getAttribute("aria-selected")) === "true",
  )
  const exportedCount = await page.evaluate(
    () => document.querySelectorAll("[data-page]").length,
  )
  notes.push(`exported-thumbs:${exportedCount}`)

  await blur()
  await page.keyboard.press("i")
  await waitFor("image extract", async () => downloads.length >= 2)
  notes.push(`image:${downloads[1].suggestedFilename()}`)

  await blur()
  await page.keyboard.press("n")
  await waitFor("encrypted toast", async () =>
    (await page.locator("body").innerText()).includes("仅支持无加密 PDF"),
  )
  await waitFor("encrypted gone", async () =>
    !(await page.locator("body").innerText()).includes("encrypted"),
  )
  notes.push("encrypted-skipped")

  await page.getByRole("button", { name: /^images/ }).click()
  await waitFor("images open", () =>
    page.evaluate(() => {
      const canvas = document.querySelector("main canvas")
      return Boolean(canvas && canvas.width > 50)
    }),
  )
  await blur()
  await page.keyboard.press("i")
  await waitFor("zip", async () => downloads.length >= 3)
  const zip = downloads[2]
  const zipBytes = await readDownload(zip)
  notes.push(`zip:${zip.suggestedFilename()}`)
  notes.push(`zip-magic:${zipBytes.subarray(0, 2).toString("latin1")}`)
  if ((await page.locator("body").innerText()).includes("重新授权")) {
    throw new Error("文件在刷新前就丢了")
  }

  await page.getByRole("button", { name: /^tall/ }).click()
  await waitFor(
    "tall open",
    async () => (await page.getByRole("textbox", { name: "书名" }).inputValue()) === "tall",
  )
  await waitFor("tall canvas", () =>
    page.evaluate(() => {
      const canvas = document.querySelector("main canvas")
      return Boolean(canvas && canvas.height > canvas.width)
    }),
  )
  await blur()
  const fit = await page.evaluate(() => {
    const scroller = document.querySelector("section .overflow-auto")
    return { scroll: scroller.scrollHeight, client: scroller.clientHeight }
  })
  await page.evaluate(() => {
    document.querySelector("section .overflow-auto").dispatchEvent(
      new WheelEvent("wheel", { deltaY: -120, bubbles: true, cancelable: true }),
    )
  })
  await waitFor("zoom", async () => /(?:100|150|200|300|400)%/.test(await page.locator("body").innerText()))
  const zoomed = await page.evaluate(() => {
    const scroller = document.querySelector("section .overflow-auto")
    return { scroll: scroller.scrollHeight, client: scroller.clientHeight }
  })
  notes.push(`tall-fit-scrolls:${fit.scroll > fit.client}`)
  notes.push(`tall-zoom-scrolls:${zoomed.scroll > zoomed.client}`)
  notes.push(`tall-zoom-taller:${zoomed.scroll > fit.scroll}`)

  await page.getByRole("button", { name: /^two-pages/ }).click()
  await waitFor("two pages", async () => (await page.locator("body").innerText()).includes("/ 2"))
  await blur()
  await page.keyboard.press("ArrowRight")
  await waitFor("page 2", async () =>
    (await page.getByRole("textbox", { name: "页码" }).inputValue()) === "2",
  )
  notes.push("arrow-turned")
  await blur()
  await page.keyboard.press("n")
  await waitFor("two-pages done", async () => {
    const text = await page.locator("body").innerText()
    return text.includes("two-pages") && text.includes("已看完")
  })
  notes.push("zero-export-finished")

  await page.getByRole("combobox", { name: "清晰度" }).click()
  await page.getByRole("option", { name: "精细 600" }).click()
  await page.getByRole("button", { name: /^huge/ }).click()
  await waitFor(
    "huge open",
    async () => (await page.getByRole("textbox", { name: "书名" }).inputValue()) === "huge",
  )
  const beforeHuge = downloads.length
  await blur()
  await page.keyboard.press("x")
  await waitFor("too large", async () =>
    (await page.locator("body").innerText()).includes("分辨率过高，请降低清晰度"),
  )
  await page.waitForTimeout(400)
  notes.push(`huge-no-download:${downloads.length === beforeHuge}`)

  await page.reload()
  await waitFor("resume", async () =>
    (await page.locator("body").innerText()).includes("刷新后需要重新授权今天的文件夹"),
  )
  const resumed = await page.locator("body").innerText()
  notes.push(`resume-san-ti:${resumed.includes("三体")}`)
  notes.push(`resume-images:${resumed.includes("images")}`)
  notes.push(resumed.split("\n").find((line) => line.startsWith("今天")) ?? "no-progress")
  return notes
}
