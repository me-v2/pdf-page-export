export function zipFiles(
  files: Record<string, Uint8Array>,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../workers/zip.worker.ts", import.meta.url), {
      type: "module",
    })
    const finish = (zipped: Uint8Array) => {
      worker.terminate()
      resolve(zipped)
    }
    worker.onmessage = (event: MessageEvent<{ zipped: Uint8Array }>) => {
      finish(event.data.zipped)
    }
    worker.onerror = (error) => {
      worker.terminate()
      reject(error.error ?? error)
    }
    const transfers = Object.values(files).map((file) => file.buffer)
    worker.postMessage({ files }, transfers)
  })
}
