import { useEffect, useRef, useState } from "react"
import { CheckIcon } from "lucide-react"
import { Kbd } from "@/components/ui/kbd"

export type CommandItem = {
  id: string
  label: string
  shortcut?: string
  disabled?: boolean
  checked?: boolean
  group?: string
  run: () => void
}

function grouped(items: CommandItem[]) {
  const groups: Array<{ name: string; items: CommandItem[] }> = []
  for (const item of items) {
    const name = item.group ?? ""
    const last = groups.at(-1)
    if (last && last.name === name) last.items.push(item)
    else groups.push({ name, items: [item] })
  }
  return groups
}

export function CommandMenu({
  open,
  items,
  onClose,
}: {
  open: boolean
  items: CommandItem[]
  onClose: () => void
}) {
  const [query, setQuery] = useState("")
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const needle = query.trim().toLowerCase()
  const filtered = items.filter((item) => item.label.toLowerCase().includes(needle))
  const safeIndex = filtered.length === 0 ? 0 : Math.min(index, filtered.length - 1)
  const active = filtered[safeIndex]
  const groups = grouped(filtered)
  let cursor = -1

  useEffect(() => {
    if (!open) {
      setQuery("")
      setIndex(0)
      return
    }
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [open])

  const activeId = active?.id
  useEffect(() => {
    if (!open || !activeId) return
    document.getElementById(`command-${activeId}`)?.scrollIntoView({ block: "nearest" })
  }, [open, activeId, query])

  if (!open) return null

  const choose = (item: CommandItem | undefined) => {
    if (!item || item.disabled) return
    onClose()
    setTimeout(() => item.run(), 0)
  }

  const move = (delta: number) => {
    if (filtered.length === 0) return
    setIndex((current) => {
      const start = Math.min(current, filtered.length - 1)
      return (start + delta + filtered.length) % filtered.length
    })
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/50" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="命令"
        className="mx-auto mt-[12vh] w-[28rem] max-w-[calc(100%-2rem)] overflow-hidden rounded-md border bg-popover shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault()
            event.stopPropagation()
            move(1)
          } else if (event.key === "ArrowUp") {
            event.preventDefault()
            event.stopPropagation()
            move(-1)
          } else if (event.key === "Enter") {
            event.preventDefault()
            event.stopPropagation()
            choose(active)
          } else if (event.key === "Escape") {
            event.preventDefault()
            event.stopPropagation()
            onClose()
          }
        }}
      >
        <input
          ref={inputRef}
          aria-label="命令"
          aria-controls="command-list"
          aria-activedescendant={active ? `command-${active.id}` : undefined}
          value={query}
          placeholder="命令 · 快捷键"
          autoComplete="off"
          onChange={(event) => {
            setQuery(event.target.value)
            setIndex(0)
          }}
          className="h-11 w-full border-b bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
        />
        <ul id="command-list" role="listbox" className="max-h-[min(32rem,70vh)] overflow-auto py-1">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-sm text-muted-foreground">没有匹配的命令</li>
          ) : (
            groups.flatMap((group) => {
              const header = group.name ? (
                <li
                  key={`group-${group.name}`}
                  role="presentation"
                  className="px-3 pt-2 pb-1 font-mono text-[10px] text-muted-foreground"
                >
                  {group.name}
                </li>
              ) : null
              const rows = group.items.map((item) => {
                cursor += 1
                const itemIndex = cursor
                return (
                  <li key={item.id} role="presentation">
                    <button
                      id={`command-${item.id}`}
                      type="button"
                      role="option"
                      aria-selected={itemIndex === safeIndex}
                      disabled={item.disabled}
                      className={`flex h-8 w-full items-center gap-2 px-3 text-left text-[13px] disabled:opacity-40 ${
                        itemIndex === safeIndex ? "bg-accent" : ""
                      }`}
                      onMouseEnter={() => setIndex(itemIndex)}
                      onMouseDown={(event) => {
                        event.preventDefault()
                        choose(item)
                      }}
                    >
                      <span className="grid size-4 shrink-0 place-items-center">
                        {item.checked ? <CheckIcon className="size-3.5 text-primary" /> : null}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.shortcut ? <Kbd>{item.shortcut}</Kbd> : null}
                    </button>
                  </li>
                )
              })
              return header ? [header, ...rows] : rows
            })
          )}
        </ul>
      </div>
    </div>
  )
}
