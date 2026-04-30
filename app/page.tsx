"use client"

import { useEffect, useState } from "react"
import { ChatPrototypeShell } from "@/components/chatbot/chat-prototype-shell"
import { PrototypeSettings } from "@/components/chatbot/prototype-settings"
import type { ChatLocale } from "@/components/chatbot/chatbot-copy"
import {
  DEFAULT_AUDIO_VARIANT,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SOURCE_VARIANT,
  type AudioVariantId,
  type PrimaryColorId,
  type SourceVariantId,
} from "@/components/chatbot/prototype-config"

export default function Home() {
  const [locale, setLocale] = useState<ChatLocale>("fr")
  const [chatOpen, setChatOpen] = useState(false)
  const [sourceVariant, setSourceVariant] =
    useState<SourceVariantId>(DEFAULT_SOURCE_VARIANT)
  const [audioVariant, setAudioVariant] =
    useState<AudioVariantId>(DEFAULT_AUDIO_VARIANT)
  const [primaryColor, setPrimaryColor] = useState<PrimaryColorId>(
    DEFAULT_PRIMARY_COLOR
  )
  const [runtimeResetEpoch, setRuntimeResetEpoch] = useState(0)

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-prototype-primary",
      primaryColor
    )
  }, [primaryColor])

  const handlePrototypeSave = (next: {
    sourceVariant: SourceVariantId
    audioVariant: AudioVariantId
    primaryColor: PrimaryColorId
  }) => {
    setSourceVariant(next.sourceVariant)
    setAudioVariant(next.audioVariant)
    setPrimaryColor(next.primaryColor)
    setRuntimeResetEpoch((n) => n + 1)
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-gray-100 to-gray-200 px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
      <div className="relative flex w-full min-h-0 min-w-0 max-w-4xl flex-1 flex-col items-center justify-center">
        <div
          className="hidden md:flex fixed right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] z-[45] sm:right-6 sm:top-6"
          inert={chatOpen ? true : undefined}
          aria-hidden={chatOpen ? true : undefined}
        >
          <PrototypeSettings
            locale={locale}
            committedSource={sourceVariant}
            committedAudio={audioVariant}
            committedPrimary={primaryColor}
            onSave={handlePrototypeSave}
          />
        </div>
        <ChatPrototypeShell
          locale={locale}
          onLocaleChange={setLocale}
          sourceVariant={sourceVariant}
          audioVariant={audioVariant}
          runtimeResetEpoch={runtimeResetEpoch}
          onChatOpenChange={setChatOpen}
        />
      </div>
    </main>
  )
}
