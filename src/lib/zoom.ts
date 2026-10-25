export const ZOOM_STEPS = [100, 150, 200, 300, 400] as const

export type ZoomPercent = (typeof ZOOM_STEPS)[number]

export type Zoom = { kind: "fit" } | { kind: "percent"; value: ZoomPercent }

export function zoomIn(zoom: Zoom, fittedPercent = 100): Zoom {
  const current = zoom.kind === "fit" ? fittedPercent : zoom.value
  const next = ZOOM_STEPS.find((step) => step > current + 0.01) ?? 400
  return { kind: "percent", value: next }
}

export function zoomOut(zoom: Zoom, fittedPercent = 100): Zoom {
  const current = zoom.kind === "fit" ? fittedPercent : zoom.value
  const previous = [...ZOOM_STEPS].reverse().find((step) => step < current - 0.01) ?? 100
  return { kind: "percent", value: previous }
}

export function zoomLabel(zoom: Zoom): string {
  return zoom.kind === "fit" ? "适配宽" : `${zoom.value}%`
}

export function zoomCompact(zoom: Zoom): string {
  return zoom.kind === "fit" ? "适配" : `${zoom.value}%`
}
