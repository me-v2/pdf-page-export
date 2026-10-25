import type { ReactNode } from "react"
import { cn } from "cn"

export function Kbd({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <kbd
      className={cn(
        "inline-flex h-4 min-w-4 items-center justify-center rounded-[3px] border border-border bg-secondary px-1 font-mono text-[10px] leading-none font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </kbd>
  )
}
