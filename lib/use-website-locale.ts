"use client"

import { useEffect, useState } from "react"
import type { ChatLocale } from "@/components/chatbot/chatbot-copy"

/**
 * Read the host page's language (e.g. ciussscentreouest.ca) from `<html lang>` so the
 * launcher tooltip — which lives outside the widget locale toggle — speaks the website's
 * language, not the widget's. Falls back to French (Quebec) when the attribute is missing
 * or unrecognised.
 *
 * The widget's own locale toggle must NOT change this value: read it once on mount and only
 * react to changes made by the host page itself (via MutationObserver).
 */
export function useWebsiteLocale(fallback: ChatLocale = "fr"): ChatLocale {
  const [locale, setLocale] = useState<ChatLocale>(fallback)

  useEffect(() => {
    if (typeof document === "undefined") return

    const read = (): ChatLocale => {
      const raw = document.documentElement.getAttribute("lang")?.toLowerCase().trim()
      if (!raw) return fallback
      if (raw.startsWith("fr")) return "fr"
      if (raw.startsWith("en")) return "en"
      return fallback
    }

    setLocale(read())

    const obs = new MutationObserver(() => {
      setLocale(read())
    })
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    })
    return () => obs.disconnect()
  }, [fallback])

  return locale
}
