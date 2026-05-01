"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { ChatbotModal } from "./chatbot-modal"
import { ChatLauncherFab } from "./chat-launcher-fab"
import { ChatLauncherTooltip } from "./chat-launcher-tooltip"
import { getChatLauncherTooltipCopy } from "./chat-launcher-copy"
import { getChatCopy, type ChatLocale } from "./chatbot-copy"
import { useWebsiteLocale } from "@/lib/use-website-locale"
import type { AudioVariantId, SourceVariantId } from "./prototype-config"

export interface ChatPrototypeShellProps {
  locale: ChatLocale
  onLocaleChange: (locale: ChatLocale) => void
  sourceVariant: SourceVariantId
  audioVariant: AudioVariantId
  runtimeResetEpoch: number
  /** When the chat panel opens or closes (e.g. to set `inert` on sibling UI). */
  onChatOpenChange?: (open: boolean) => void
}

export function ChatPrototypeShell({
  locale,
  onLocaleChange,
  sourceVariant,
  audioVariant,
  runtimeResetEpoch,
  onChatOpenChange,
}: ChatPrototypeShellProps) {
  const [isChatOpen, setIsChatOpen] = useState(false)
  const launcherFabRef = useRef<HTMLButtonElement>(null)
  const copy = getChatCopy(locale)
  /** Mirrors the host website (e.g. ciussscentreouest.ca) lang — independent of the widget toggle. */
  const websiteLocale = useWebsiteLocale("fr")
  const launcherTooltipCopy = getChatLauncherTooltipCopy(websiteLocale)
  const [launcherTooltipDismissed, setLauncherTooltipDismissed] =
    useState(false)
  const [delayReady, setDelayReady] = useState(false)

  useEffect(() => {
    if (runtimeResetEpoch === 0) return
    setLauncherTooltipDismissed(false)
    setDelayReady(false)
    setIsChatOpen(false)
  }, [runtimeResetEpoch])

  useEffect(() => {
    if (launcherTooltipDismissed || isChatOpen) {
      setDelayReady(false)
      return
    }
    const id = window.setTimeout(() => setDelayReady(true), 2000)
    return () => window.clearTimeout(id)
  }, [launcherTooltipDismissed, isChatOpen])

  useEffect(() => {
    onChatOpenChange?.(isChatOpen)
  }, [isChatOpen, onChatOpenChange])

  const handleOpenFromFab = () => {
    setLauncherTooltipDismissed(true)
    setIsChatOpen(true)
  }

  const handleTooltipDismiss = () => {
    setLauncherTooltipDismissed(true)
  }

  const showLauncherTooltip =
    !isChatOpen && !launcherTooltipDismissed && delayReady

  const handleRequestClose = () => {
    setIsChatOpen(false)
    requestAnimationFrame(() => {
      launcherFabRef.current?.focus()
    })
  }

  return (
    <>
      <div
        className={cn(
          "flex w-full min-w-0 flex-col",
          isChatOpen &&
            "fixed inset-0 z-40 h-[100dvh] max-w-none md:static md:inset-auto md:z-auto md:h-auto md:max-w-4xl",
          !isChatOpen && "hidden",
        )}
      >
        <ChatbotModal
          locale={locale}
          onLocaleChange={onLocaleChange}
          sourceVariant={sourceVariant}
          audioVariant={audioVariant}
          runtimeResetEpoch={runtimeResetEpoch}
          isActive={isChatOpen}
          onRequestClose={handleRequestClose}
        />
      </div>

      {!isChatOpen && (
        <div
          lang={websiteLocale}
          className={cn(
            "fixed z-[35] flex flex-col items-end gap-2",
            "bottom-[max(1rem,env(safe-area-inset-bottom))]",
            "right-[max(1rem,env(safe-area-inset-right))]",
          )}
        >
          {showLauncherTooltip && (
            <ChatLauncherTooltip
              message={launcherTooltipCopy.message}
              dismissAriaLabel={launcherTooltipCopy.dismissAriaLabel}
              onDismiss={handleTooltipDismiss}
            />
          )}
          <ChatLauncherFab
            ref={launcherFabRef}
            ariaLabel={copy.launcherFabAriaLabel}
            onOpen={handleOpenFromFab}
          />
        </div>
      )}
    </>
  )
}
