"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { ChatbotModal } from "./chatbot-modal"
import { ChatLauncherFab } from "./chat-launcher-fab"
import { ChatLauncherTooltip } from "./chat-launcher-tooltip"
import {
  CHAT_LAUNCHER_TOOLTIP_DISMISS_ARIA,
  CHAT_LAUNCHER_TOOLTIP_FR,
} from "./chat-launcher-copy"
import { getChatCopy, type ChatLocale } from "./chatbot-copy"
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
          className={cn(
            "fixed z-[35] flex flex-col items-end gap-2",
            "bottom-[max(1rem,env(safe-area-inset-bottom))]",
            "right-[max(1rem,env(safe-area-inset-right))]",
          )}
        >
          {showLauncherTooltip && (
            <ChatLauncherTooltip
              message={CHAT_LAUNCHER_TOOLTIP_FR}
              dismissAriaLabel={CHAT_LAUNCHER_TOOLTIP_DISMISS_ARIA}
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
