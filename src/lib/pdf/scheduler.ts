export class Preempted extends Error {
  constructor() {
    super("绘制已让路")
    this.name = "Preempted"
  }
}

export class CancelScope {
  cancelled = false
  private hooks: Array<() => void> = []

  onCancel(hook: () => void) {
    this.hooks.push(hook)
    if (this.cancelled) hook()
  }

  cancel() {
    if (this.cancelled) return
    this.cancelled = true
    for (const hook of this.hooks) hook()
  }
}

export type JobKind = "preview" | "export" | "extract" | "thumb"

type Item = {
  kind: JobKind
  key: string
  requeue: boolean
  settled: boolean
  obsolete: () => boolean
  run: (scope: CancelScope) => Promise<unknown>
  resolve: (value: unknown) => void
  reject: (error: unknown) => void
}

const RANK: Record<JobKind, number> = {
  preview: 0,
  export: 1,
  extract: 1,
  thumb: 2,
}

export class RenderScheduler {
  private pending: Item[] = []
  private pumping = false
  private scheduled = false
  private active: Item | null = null
  private scope: CancelScope | null = null
  private thumbKeep: (key: string) => boolean = () => true

  enqueue<T>(options: {
    kind: JobKind
    key: string
    run: (scope: CancelScope) => Promise<T>
  }): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const item: Item = {
        kind: options.kind,
        key: options.key,
        requeue: options.kind !== "preview",
        settled: false,
        obsolete: () => options.kind === "thumb" && !this.thumbKeep(options.key),
        run: options.run as Item["run"],
        resolve: (value) => resolve(value as T),
        reject,
      }
      if (options.kind === "preview") this.dropQueuedPreviews(options.key)
      this.pending.push(item)
      if (options.kind === "preview") this.preemptFor(options.key)
      this.schedule()
    })
  }

  private schedule() {
    if (this.pumping || this.scheduled) return
    this.scheduled = true
    queueMicrotask(() => {
      this.scheduled = false
      void this.pump()
    })
  }

  setThumbKeep(keep: (key: string) => boolean) {
    this.thumbKeep = keep
    const dropped = this.pending.filter((item) => item.kind === "thumb" && !keep(item.key))
    this.pending = this.pending.filter((item) => item.kind !== "thumb" || keep(item.key))
    for (const item of dropped) this.fail(item, new Preempted())
    if (this.active?.kind === "thumb" && !keep(this.active.key)) this.scope?.cancel()
  }

  dropKind(kind: "preview" | "thumb") {
    const dropped = this.pending.filter((item) => item.kind === kind)
    this.pending = this.pending.filter((item) => item.kind !== kind)
    for (const item of dropped) this.fail(item, new Preempted())
    if (this.active?.kind === kind) this.scope?.cancel()
  }

  private dropQueuedPreviews(keepKey: string) {
    const dropped = this.pending.filter((item) => item.kind === "preview" && item.key !== keepKey)
    this.pending = this.pending.filter((item) => item.kind !== "preview" || item.key === keepKey)
    for (const item of dropped) this.fail(item, new Preempted())
  }

  private preemptFor(previewKey: string) {
    if (!this.active || !this.scope || this.scope.cancelled) return
    if (this.active.kind === "preview" && this.active.key === previewKey) return
    this.scope.cancel()
  }

  private fail(item: Item, error: unknown) {
    if (item.settled) return
    item.settled = true
    item.reject(error)
  }

  private succeed(item: Item, value: unknown) {
    if (item.settled) return
    item.settled = true
    item.resolve(value)
  }

  private pick() {
    let best = 0
    let bestRank = RANK[this.pending[0].kind]
    for (let index = 1; index < this.pending.length; index += 1) {
      const rank = RANK[this.pending[index].kind]
      if (rank < bestRank) {
        best = index
        bestRank = rank
      }
    }
    return best
  }

  private async pump() {
    if (this.pumping) return
    this.pumping = true
    try {
      while (this.pending.length > 0) {
        const item = this.pending.splice(this.pick(), 1)[0]
        if (item.obsolete()) {
          this.fail(item, new Preempted())
          continue
        }
        const scope = new CancelScope()
        this.scope = scope
        this.active = item
        try {
          const value = await item.run(scope)
          this.succeed(item, value)
        } catch (error) {
          if (scope.cancelled && item.requeue && !item.settled && !item.obsolete()) {
            this.pending.push(item)
          } else {
            this.fail(item, error)
          }
        } finally {
          this.active = null
          this.scope = null
        }
      }
    } finally {
      this.pumping = false
      if (this.pending.length > 0) this.schedule()
    }
  }
}
