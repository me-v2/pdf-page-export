import { zipSync } from "fflate"

type ZipRequest = {
  files: Record<string, Uint8Array>
}

self.onmessage = (event: MessageEvent<ZipRequest>) => {
  const zipped = zipSync(event.data.files, { level: 0 })
  self.postMessage({ zipped }, { transfer: [zipped.buffer] })
}
