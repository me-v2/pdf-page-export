import { useEffect, useState } from "react"
import type { PdfSession } from "@/lib/pdf/session"

export function useOpenedDocument(session: PdfSession) {
  const [id, setId] = useState<string | null>(session.id)
  useEffect(() => session.subscribe(setId), [session])
  return id
}
