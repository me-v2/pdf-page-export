import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"

export const Route = createFileRoute("/")({
  ssr: false,
  component: Home,
})

function Home() {
  const [View, setView] = useState<React.ComponentType | null>(null)

  useEffect(() => {
    void import("@/components/workspace/workspace").then((mod) => {
      setView(() => mod.Workspace)
    })
  }, [])

  if (!View) {
    return (
      <main className="grid h-dvh place-items-center bg-well text-[13px] text-muted-foreground">
        正在打开挑页…
      </main>
    )
  }

  return <View />
}
