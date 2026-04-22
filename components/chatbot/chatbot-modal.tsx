"use client"

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { ChatHeader } from "./chat-header"
import { AssistantMessageCard } from "./assistant-message-card"
import { UserMessageBubble } from "./user-message-bubble"
import { SuggestionChips } from "./suggestion-chips"
import { SourcesBlock } from "./sources-block"
import { Composer } from "./composer"
import { TypingIndicator } from "./typing-indicator"
import {
  getSourceVariant,
  type AudioVariantId,
  type SourceVariantId,
} from "./prototype-config"
import type { SourcesPlacement } from "./prototype-config"
import { SourceLink } from "./source-link"
import { usePrototypeConversationFlow } from "./use-prototype-conversation-flow"
import { useVoiceInput } from "./use-voice-input"
import { getChatCopy, type ChatCopy, type ChatLocale } from "./chatbot-copy"
import { RichBlockLines, RichParagraph, renderWithBold } from "./render-rich-text"
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources"
import { getParkingCopy, type ParkingCopy } from "./parking-copy"
import { getHospitalAddressCopy } from "./hospital-address-copy"
import { cn } from "@/lib/utils"
import type { ChatAssistantMessage, ChatMessage } from "./demo-flow/types"
import { isAssistantMessage } from "./demo-flow/types"
import { MessageReadAloudControl } from "./message-read-aloud-control"
import { MessageReadAloudV2 } from "./message-read-aloud-v2"
import {
  applySpeechUtteranceOutputDefaults,
  estimateSpeechDurationMs,
  formatRemainingClock,
  getGreetingReadAloudPlainText,
  getReadAloudLabels,
  getReadAloudPlainText,
  getReadAloudV2Labels,
  getSpeechBcp47ForChatLocale,
  pickSpeechVoiceMatchingUtteranceLang,
  shouldAssignExplicitSpeechVoice,
  splitTextIntoSpeechChunks,
  STATIC_GREETING_READ_ALOUD_ID,
} from "./read-aloud-copy"

const VOICE_DRAFT_PLACEHOLDER_MS = 1000

export interface ChatbotModalProps {
  locale: ChatLocale
  onLocaleChange: (locale: ChatLocale) => void
  sourceVariant: SourceVariantId
  audioVariant: AudioVariantId
  runtimeResetEpoch: number
  onRequestClose?: () => void
}

function BelowBubbleSources({
  sources,
  triggerLabel,
}: {
  sources: { title: string; url: string }[]
  triggerLabel: string
}) {
  return (
    <Sources defaultOpen={false}>
      <SourcesTrigger count={sources.length} label={triggerLabel} />
      <SourcesContent>
        {sources.map((s) => (
          <Source key={s.url + s.title} href={s.url} title={s.title} />
        ))}
      </SourcesContent>
    </Sources>
  )
}

function ServicesV4SourcesSentence({ copy }: { copy: ChatCopy }) {
  const links = copy.v3.links
  const v = copy.v4
  return (
    <p className="mt-3 text-base text-foreground leading-relaxed">
      {v.servicesSourcesBeforeFirstLink}
      {links.map((link, i) => (
        <Fragment key={link.url}>
          {i > 0 ? v.servicesSourcesBetweenLinks : null}
          <SourceLink href={link.url} target="_blank" rel="noopener noreferrer">
            {link.title}
          </SourceLink>
        </Fragment>
      ))}
      {v.servicesSourcesAfterLastLink}
    </p>
  )
}

function ParkingV4SourcesSentence({ parkingCopy }: { parkingCopy: ParkingCopy }) {
  const link = parkingCopy.officialLinks[0]
  if (!link) return null
  const v = parkingCopy.v4
  return (
    <p className="mt-3 text-base text-foreground leading-relaxed">
      {v.sourcesBeforeLink}
      <SourceLink href={link.url} target="_blank" rel="noopener noreferrer">
        {link.title}
      </SourceLink>
      {v.sourcesAfterLink}
    </p>
  )
}

function assistantShowsAvatar(step: ChatAssistantMessage["step"]) {
  return (
    step === "services_first" ||
    step === "parking_body" ||
    step === "hospital_address" ||
    step === "services_combined_v4" ||
    step === "parking_combined_v4"
  )
}

export function ChatbotModal({
  locale,
  onLocaleChange,
  sourceVariant,
  audioVariant,
  runtimeResetEpoch,
  onRequestClose,
}: ChatbotModalProps) {
  const copy = getChatCopy(locale)
  const parkingCopy = getParkingCopy(locale)
  const placement = getSourceVariant(sourceVariant).sourcesPlacement

  const {
    messages,
    showThinking,
    thinkingAfterUserId,
    typingIndicatorTallBubble,
    parkingResponseInProgress,
    conversationBusy,
    onSuggestionSelect,
    onManualSubmit,
    showFollowUpChips,
  } = usePrototypeConversationFlow({
    sourceVariant,
    locale,
    runtimeResetEpoch,
  })

  const useV2AudioUi = audioVariant === "v2_full_screen_reader"

  const [draft, setDraft] = useState("")
  const [isVoiceTranscribing, setIsVoiceTranscribing] = useState(false)
  const draftTranscriptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  /** Next send after a voice transcript (until the user types in the field). */
  const lastSubmitSourceRef = useRef<"keyboard" | "voice">("keyboard")

  const queueTranscriptIntoDraft = useCallback((text: string) => {
    if (draftTranscriptTimeoutRef.current) {
      clearTimeout(draftTranscriptTimeoutRef.current)
    }
    setDraft("")
    setIsVoiceTranscribing(true)
    draftTranscriptTimeoutRef.current = setTimeout(() => {
      draftTranscriptTimeoutRef.current = null
      lastSubmitSourceRef.current = "voice"
      setDraft(text)
      setIsVoiceTranscribing(false)
    }, VOICE_DRAFT_PLACEHOLDER_MS)
  }, [])

  const setDraftFromInput = useCallback((value: string) => {
    lastSubmitSourceRef.current = "keyboard"
    setDraft(value)
  }, [])

  useEffect(
    () => () => {
      if (draftTranscriptTimeoutRef.current) {
        clearTimeout(draftTranscriptTimeoutRef.current)
      }
    },
    []
  )

  const {
    isRecording,
    errorMessage: voiceError,
    micStream,
    timelineVisualizationActive,
    startRecording,
    cancelRecording,
    confirmRecording,
    clearError: clearVoiceError,
  } = useVoiceInput({
    locale,
    onTranscript: queueTranscriptIntoDraft,
  })

  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesColumnRef = useRef<HTMLDivElement>(null)

  const scrollConversationToBottom = () => {
    const root = scrollAreaRef.current
    if (!root) return
    root.scrollTop = root.scrollHeight
  }

  useLayoutEffect(() => {
    scrollConversationToBottom()
    const id = requestAnimationFrame(scrollConversationToBottom)
    return () => cancelAnimationFrame(id)
  }, [
    locale,
    messages,
    showThinking,
    thinkingAfterUserId,
    parkingResponseInProgress,
    isRecording,
    isVoiceTranscribing,
  ])

  useEffect(() => {
    const root = scrollAreaRef.current
    const inner = messagesColumnRef.current
    if (!root || !inner) return
    const ro = new ResizeObserver(() => {
      root.scrollTop = root.scrollHeight
    })
    ro.observe(inner)
    return () => ro.disconnect()
  }, [])

  const hasParkingFollowUpComplete = messages.some(
    (m) =>
      isAssistantMessage(m) &&
      ((m.step === "parking_followup" && m.revealComplete) ||
        (m.step === "parking_combined_v4" && m.revealComplete))
  )

  const hasParkingAssistantInThread = messages.some(
    (m) =>
      isAssistantMessage(m) &&
      (m.step === "parking_body" ||
        m.step === "parking_source" ||
        m.step === "parking_followup" ||
        m.step === "parking_combined_v4")
  )

  const hasHospitalAddressInThread = messages.some(
    (m) => isAssistantMessage(m) && m.step === "hospital_address"
  )

  const showInitialChips =
    messages.length === 0 &&
    !parkingResponseInProgress &&
    !hasParkingFollowUpComplete
  const showParkingFollowUpChips =
    !parkingResponseInProgress && hasParkingFollowUpComplete
  const showServicesFollowUpChips =
    !parkingResponseInProgress &&
    showFollowUpChips &&
    !hasParkingAssistantInThread

  /** Hospital-address flow hides initial/services chips only; parking follow-up chips must still show after a parking reply. */
  const suggestionRowsVisible =
    !isRecording &&
    !isVoiceTranscribing &&
    (showParkingFollowUpChips ||
      (!hasHospitalAddressInThread &&
        (showInitialChips || showServicesFollowUpChips)))

  const handleSend = () => {
    const t = draft.trim()
    if (!t) return
    const submitSource = lastSubmitSourceRef.current
    onManualSubmit(t, { submitSource })
    setDraft("")
    lastSubmitSourceRef.current = "keyboard"
  }

  const readAloudLabels = useMemo(() => getReadAloudLabels(locale), [locale])
  const readAloudV2Labels = useMemo(() => getReadAloudV2Labels(locale), [locale])

  const [readAloudActiveId, setReadAloudActiveId] = useState<string | null>(null)
  const [readAloudStatus, setReadAloudStatus] = useState<
    "idle" | "playing" | "paused"
  >("idle")
  const [readAloudTick, setReadAloudTick] = useState(0)
  const utteranceGenRef = useRef(0)
  const readAloudOffsetMsRef = useRef(0)
  const readAloudAnchorMsRef = useRef<number | null>(null)
  const readAloudEstimateMsRef = useRef(8000)

  const clearReadAloudUi = useCallback(() => {
    readAloudOffsetMsRef.current = 0
    readAloudAnchorMsRef.current = null
    setReadAloudActiveId(null)
    setReadAloudStatus("idle")
  }, [])

  const stopReadAloud = useCallback(() => {
    if (typeof window !== "undefined") {
      window.speechSynthesis.cancel()
    }
    utteranceGenRef.current++
    clearReadAloudUi()
  }, [clearReadAloudUi])

  const startReadAloud = useCallback(
    (messageId: string, text: string) => {
      if (typeof window === "undefined" || !text.trim()) return
      window.speechSynthesis.cancel()
      utteranceGenRef.current++
      const myGen = utteranceGenRef.current
      let hasStarted = false

      readAloudEstimateMsRef.current = estimateSpeechDurationMs(text, locale)
      readAloudOffsetMsRef.current = 0
      readAloudAnchorMsRef.current = null

      const lang = getSpeechBcp47ForChatLocale(locale)
      const chunks = splitTextIntoSpeechChunks(text)
      if (chunks.length === 0) return

      const speakNow = () => {
        if (hasStarted || utteranceGenRef.current !== myGen) return
        const synth = window.speechSynthesis
        if (synth.getVoices().length === 0) return
        hasStarted = true

        const resumeSynth = () => {
          try {
            synth.resume()
          } catch {
            /* ignore */
          }
        }

        /** Wait until the engine is idle so we don't hide controls while audio is still routed. */
        const clearUiWhenSynthesisIdle = () => {
          const t0 = Date.now()
          const poll = () => {
            if (utteranceGenRef.current !== myGen) return
            const speaking = synth.speaking
            const pending = "pending" in synth ? synth.pending : false
            if (!speaking && !pending) {
              clearReadAloudUi()
              return
            }
            if (Date.now() - t0 > 180_000) {
              clearReadAloudUi()
              return
            }
            window.setTimeout(poll, 48)
          }
          window.setTimeout(poll, 48)
        }

        const speakChunk = (index: number) => {
          if (utteranceGenRef.current !== myGen) return
          if (index < 0 || index >= chunks.length) {
            clearReadAloudUi()
            return
          }
          const u = new SpeechSynthesisUtterance(chunks[index]!)
          u.lang = lang
          applySpeechUtteranceOutputDefaults(u)
          if (shouldAssignExplicitSpeechVoice()) {
            const voice = pickSpeechVoiceMatchingUtteranceLang(
              synth.getVoices(),
              lang
            )
            if (voice) u.voice = voice
          }
          u.onstart = () => {
            resumeSynth()
          }
          u.onend = () => {
            if (utteranceGenRef.current !== myGen) return
            if (index + 1 >= chunks.length) {
              clearUiWhenSynthesisIdle()
            } else {
              speakChunk(index + 1)
            }
          }
          u.onerror = () => {
            if (utteranceGenRef.current !== myGen) return
            clearReadAloudUi()
          }
          if (index === 0) {
            setReadAloudActiveId(messageId)
            setReadAloudStatus("playing")
            readAloudOffsetMsRef.current = 0
            readAloudAnchorMsRef.current = Date.now()
            setReadAloudTick((t) => t + 1)
          }
          synth.speak(u)
          resumeSynth()
          window.setTimeout(resumeSynth, 0)
          window.setTimeout(resumeSynth, 120)
          if ("paused" in synth && (synth as SpeechSynthesis & { paused: boolean }).paused) {
            resumeSynth()
          }
        }

        speakChunk(0)
      }

      const synth = window.speechSynthesis
      void synth.getVoices()

      /** Chromium: defer speak to after voice list + frames — avoids silent output when `speak` runs too early in the event turn. */
      const scheduleChromiumSpeak = () => {
        if (utteranceGenRef.current !== myGen) return
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (utteranceGenRef.current !== myGen) return
            speakNow()
          })
        })
      }

      if (shouldAssignExplicitSpeechVoice()) {
        const run = () => {
          if (utteranceGenRef.current !== myGen) return
          scheduleChromiumSpeak()
        }
        synth.addEventListener("voiceschanged", run, { once: true })
        queueMicrotask(run)
        window.setTimeout(run, 500)
        return
      }

      if (synth.getVoices().length > 0) {
        speakNow()
        return
      }
      const onVoices = () => {
        synth.removeEventListener("voiceschanged", onVoices)
        speakNow()
      }
      synth.addEventListener("voiceschanged", onVoices)
      void synth.getVoices()
      window.setTimeout(() => {
        if (utteranceGenRef.current !== myGen) return
        synth.removeEventListener("voiceschanged", onVoices)
        speakNow()
      }, 300)
    },
    [clearReadAloudUi, locale]
  )

  const pauseReadAloud = useCallback(() => {
    if (typeof window === "undefined") return
    if (readAloudAnchorMsRef.current != null) {
      readAloudOffsetMsRef.current += Date.now() - readAloudAnchorMsRef.current
      readAloudAnchorMsRef.current = null
    }
    try {
      window.speechSynthesis.pause()
      setReadAloudStatus("paused")
    } catch {
      setReadAloudStatus("paused")
    }
  }, [])

  const resumeReadAloud = useCallback(() => {
    if (typeof window === "undefined") return
    readAloudAnchorMsRef.current = Date.now()
    try {
      window.speechSynthesis.resume()
      setReadAloudStatus("playing")
    } catch {
      setReadAloudStatus("playing")
    }
  }, [])

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") {
        window.speechSynthesis.cancel()
      }
      utteranceGenRef.current++
    }
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.speechSynthesis.cancel()
    }
    utteranceGenRef.current++
    setReadAloudActiveId(null)
    setReadAloudStatus("idle")
  }, [locale, runtimeResetEpoch])

  useEffect(() => {
    if (!readAloudActiveId) return
    const exists =
      readAloudActiveId === STATIC_GREETING_READ_ALOUD_ID ||
      messages.some((m) => m.id === readAloudActiveId)
    if (!exists) {
      if (typeof window !== "undefined") {
        window.speechSynthesis.cancel()
      }
      utteranceGenRef.current++
      clearReadAloudUi()
    }
  }, [messages, readAloudActiveId, clearReadAloudUi])

  useEffect(() => {
    if (readAloudStatus !== "playing" || !readAloudActiveId) return
    const id = window.setInterval(() => setReadAloudTick((x) => x + 1), 200)
    return () => clearInterval(id)
  }, [readAloudStatus, readAloudActiveId])

  const readAloudControlForMessage = useCallback(
    (msg: ChatAssistantMessage) => {
      const plain = getReadAloudPlainText(msg, copy, parkingCopy, placement, locale)
      const isThisActive = readAloudActiveId === msg.id
      const mode: "idle" | "playing" | "paused" = isThisActive
        ? readAloudStatus
        : "idle"

      return (
        <MessageReadAloudControl
          hidden={!plain}
          mode={mode}
          labels={readAloudLabels}
          onStart={() => {
            if (plain) startReadAloud(msg.id, plain)
          }}
          onPause={pauseReadAloud}
          onResume={resumeReadAloud}
          onStop={stopReadAloud}
        />
      )
    },
    [
      copy,
      parkingCopy,
      placement,
      locale,
      readAloudActiveId,
      readAloudStatus,
      readAloudLabels,
      startReadAloud,
      pauseReadAloud,
      resumeReadAloud,
      stopReadAloud,
    ]
  )

  const readAloudFooterForMessage = useCallback(
    (msg: ChatAssistantMessage) => {
      const plain = getReadAloudPlainText(msg, copy, parkingCopy, placement, locale)
      const isThisActive = readAloudActiveId === msg.id
      const mode: "idle" | "playing" | "paused" = isThisActive
        ? readAloudStatus
        : "idle"

      let progress = 0
      let remainingClock = formatRemainingClock(0)
      if (isThisActive && mode !== "idle") {
        const elapsed =
          readAloudStatus === "playing" &&
          readAloudAnchorMsRef.current != null
            ? readAloudOffsetMsRef.current +
              (Date.now() - readAloudAnchorMsRef.current)
            : readAloudOffsetMsRef.current
        const est = readAloudEstimateMsRef.current
        progress = est > 0 ? Math.min(1, elapsed / est) : 0
        remainingClock = formatRemainingClock(
          Math.max(0, (est - elapsed) / 1000)
        )
      }

      return (
        <MessageReadAloudV2
          hidden={!plain}
          mode={mode}
          labels={readAloudV2Labels}
          progress={progress}
          remainingClock={remainingClock}
          onStart={() => {
            if (plain) startReadAloud(msg.id, plain)
          }}
          onPause={pauseReadAloud}
          onResume={resumeReadAloud}
          onStop={stopReadAloud}
        />
      )
    },
    [
      copy,
      parkingCopy,
      placement,
      locale,
      readAloudActiveId,
      readAloudStatus,
      readAloudV2Labels,
      readAloudTick,
      startReadAloud,
      pauseReadAloud,
      resumeReadAloud,
      stopReadAloud,
    ]
  )

  const readAloudControlForGreeting = useCallback(() => {
    const plain = getGreetingReadAloudPlainText(copy)
    const isThisActive = readAloudActiveId === STATIC_GREETING_READ_ALOUD_ID
    const mode: "idle" | "playing" | "paused" = isThisActive
      ? readAloudStatus
      : "idle"

    return (
      <MessageReadAloudControl
        hidden={!plain}
        mode={mode}
        labels={readAloudLabels}
        onStart={() => {
          if (plain) startReadAloud(STATIC_GREETING_READ_ALOUD_ID, plain)
        }}
        onPause={pauseReadAloud}
        onResume={resumeReadAloud}
        onStop={stopReadAloud}
      />
    )
  }, [
    copy,
    readAloudActiveId,
    readAloudStatus,
    readAloudLabels,
    startReadAloud,
    pauseReadAloud,
    resumeReadAloud,
    stopReadAloud,
  ])

  const readAloudFooterForGreeting = useCallback(() => {
    const plain = getGreetingReadAloudPlainText(copy)
    const isThisActive = readAloudActiveId === STATIC_GREETING_READ_ALOUD_ID
    const mode: "idle" | "playing" | "paused" = isThisActive
      ? readAloudStatus
      : "idle"

    let progress = 0
    let remainingClock = formatRemainingClock(0)
    if (isThisActive && mode !== "idle") {
      const elapsed =
        readAloudStatus === "playing" && readAloudAnchorMsRef.current != null
          ? readAloudOffsetMsRef.current +
            (Date.now() - readAloudAnchorMsRef.current)
          : readAloudOffsetMsRef.current
      const est = readAloudEstimateMsRef.current
      progress = est > 0 ? Math.min(1, elapsed / est) : 0
      remainingClock = formatRemainingClock(
        Math.max(0, (est - elapsed) / 1000)
      )
    }

    return (
      <MessageReadAloudV2
        hidden={!plain}
        mode={mode}
        labels={readAloudV2Labels}
        progress={progress}
        remainingClock={remainingClock}
        onStart={() => {
          if (plain) startReadAloud(STATIC_GREETING_READ_ALOUD_ID, plain)
        }}
        onPause={pauseReadAloud}
        onResume={resumeReadAloud}
        onStop={stopReadAloud}
      />
    )
  }, [
    copy,
    readAloudActiveId,
    readAloudStatus,
    readAloudV2Labels,
    readAloudTick,
    startReadAloud,
    pauseReadAloud,
    resumeReadAloud,
    stopReadAloud,
  ])

  const renderServicesCombinedV4 = (msg: ChatAssistantMessage) => {
    const showTail = msg.playbackStructured || msg.combinedTailVisible
    return (
      <AssistantMessageCard
        showAvatar={assistantShowsAvatar(msg.step)}
        actions={
          useV2AudioUi ? undefined : readAloudControlForMessage(msg)
        }
        footer={
          useV2AudioUi ? readAloudFooterForMessage(msg) : undefined
        }
      >
        {msg.playbackStructured ? (
          <>
            <RichParagraph
              text={copy.assistantFirst.intro}
              className="mb-3"
            />
            <ul className="mt-0 space-y-2 text-foreground">
              {copy.assistantFirst.bullets.map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <span className="text-primary-on-background font-bold">•</span>
                  <span className="min-w-0 text-foreground leading-relaxed">
                    {renderWithBold(line)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <RichBlockLines
            text={msg.displayText}
            firstLineClassName="mb-3"
          />
        )}
        {showTail && (
          <>
            <ServicesV4SourcesSentence copy={copy} />
            <RichParagraph text={copy.assistantFollowUp} className="mt-3" />
          </>
        )}
      </AssistantMessageCard>
    )
  }

  const renderParkingCombinedV4 = (msg: ChatAssistantMessage) => {
    const showTail = msg.playbackStructured || msg.combinedTailVisible
    return (
      <AssistantMessageCard
        showAvatar={assistantShowsAvatar(msg.step)}
        actions={
          useV2AudioUi ? undefined : readAloudControlForMessage(msg)
        }
        footer={
          useV2AudioUi ? readAloudFooterForMessage(msg) : undefined
        }
      >
        <RichBlockLines
          text={
            msg.playbackStructured ||
            (msg.revealComplete && msg.combinedTailVisible)
              ? parkingCopy.body
              : msg.displayText
          }
        />
        {showTail && (
          <>
            <ParkingV4SourcesSentence parkingCopy={parkingCopy} />
            <RichParagraph text={parkingCopy.followUp} className="mt-3" />
          </>
        )}
      </AssistantMessageCard>
    )
  }

  const renderServicesFirst = (
    msg: ChatAssistantMessage,
    pl: SourcesPlacement
  ) => {
    const showInlineSourcesBlock =
      pl === "inline" && msg.revealComplete && copy.sourcesInline.length > 0
    const showBelowAiSources =
      pl === "below" && msg.revealComplete && copy.sourcesInline.length > 0

    if (msg.playbackStructured) {
      return (
        <div className="flex flex-col">
          <AssistantMessageCard
            showAvatar={assistantShowsAvatar(msg.step)}
            actions={
          useV2AudioUi ? undefined : readAloudControlForMessage(msg)
        }
        footer={
          useV2AudioUi ? readAloudFooterForMessage(msg) : undefined
        }
          >
            <RichParagraph text={copy.assistantFirst.intro} />
            <ul className="mt-4 space-y-2 text-foreground">
              {copy.assistantFirst.bullets.map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <span className="text-primary-on-background font-bold">•</span>
                  <span className="min-w-0 text-foreground leading-relaxed">
                    {renderWithBold(line)}
                  </span>
                </li>
              ))}
            </ul>
            {pl === "inline" && (
              <SourcesBlock
                sources={copy.sourcesInline}
                heading={copy.sourcesHeading}
                className="mt-4 pt-3 border-t border-border"
              />
            )}
          </AssistantMessageCard>
          {pl === "below" && (
            <div className="ml-[44px] sm:ml-[52px] mt-2">
              <BelowBubbleSources
                sources={copy.sourcesInline}
                triggerLabel={copy.sourcesCollapsibleLabel}
              />
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="flex flex-col">
        <AssistantMessageCard
          showAvatar={assistantShowsAvatar(msg.step)}
          actions={
          useV2AudioUi ? undefined : readAloudControlForMessage(msg)
        }
        footer={
          useV2AudioUi ? readAloudFooterForMessage(msg) : undefined
        }
        >
          <RichBlockLines text={msg.displayText} />
          {showInlineSourcesBlock && (
            <SourcesBlock
              sources={copy.sourcesInline}
              heading={copy.sourcesHeading}
              className="mt-4 pt-3 border-t border-border"
            />
          )}
        </AssistantMessageCard>
        {showBelowAiSources && (
          <div className="ml-[44px] sm:ml-[52px] mt-2 max-w-[min(90%,32rem)] sm:max-w-[min(90%,36rem)]">
            <BelowBubbleSources
              sources={copy.sourcesInline}
              triggerLabel={copy.sourcesCollapsibleLabel}
            />
          </div>
        )}
      </div>
    )
  }

  const renderServicesV3 = (msg: ChatAssistantMessage) => (
    <AssistantMessageCard
      showAvatar={false}
      actions={
        useV2AudioUi ? undefined : readAloudControlForMessage(msg)
      }
      footer={
        useV2AudioUi ? readAloudFooterForMessage(msg) : undefined
      }
    >
      <RichParagraph text={copy.v3.intro} />
      <ul className="mt-4 space-y-2 text-foreground">
        {copy.v3.links.map((link) => (
          <li key={link.url} className="flex items-start gap-2">
            <span className="text-primary-on-background font-bold">•</span>
            <SourceLink href={link.url} target="_blank" rel="noopener noreferrer">
              {link.title}
            </SourceLink>
          </li>
        ))}
      </ul>
    </AssistantMessageCard>
  )

  const renderServicesFollowUp = (msg: ChatAssistantMessage) => (
    <AssistantMessageCard
      showAvatar={false}
      actions={
        useV2AudioUi ? undefined : readAloudControlForMessage(msg)
      }
      footer={
        useV2AudioUi ? readAloudFooterForMessage(msg) : undefined
      }
    >
      {msg.playbackStructured ? (
        <RichParagraph text={copy.assistantFollowUp} />
      ) : (
        <RichBlockLines text={msg.displayText} />
      )}
    </AssistantMessageCard>
  )

  const renderParkingBody = (msg: ChatAssistantMessage) => (
    <AssistantMessageCard
      showAvatar={assistantShowsAvatar(msg.step)}
      actions={
        useV2AudioUi ? undefined : readAloudControlForMessage(msg)
      }
      footer={
        useV2AudioUi ? readAloudFooterForMessage(msg) : undefined
      }
    >
      <RichBlockLines
        text={msg.revealComplete ? parkingCopy.body : msg.displayText}
      />
    </AssistantMessageCard>
  )

  const renderHospitalAddress = (msg: ChatAssistantMessage) => {
    const body =
      msg.revealComplete && msg.playbackStructured
        ? getHospitalAddressCopy(locale)
        : msg.displayText
    return (
      <AssistantMessageCard
        showAvatar={assistantShowsAvatar(msg.step)}
        actions={
          useV2AudioUi ? undefined : readAloudControlForMessage(msg)
        }
        footer={
          useV2AudioUi ? readAloudFooterForMessage(msg) : undefined
        }
      >
        <RichBlockLines text={body} inlineLinks />
      </AssistantMessageCard>
    )
  }

  const renderParkingSource = (
    pl: SourcesPlacement,
    msg: ChatAssistantMessage
  ) => {
    const links = parkingCopy.officialLinks
    if (pl === "inline") {
      return (
        <AssistantMessageCard
          showAvatar={false}
          actions={
          useV2AudioUi ? undefined : readAloudControlForMessage(msg)
        }
        footer={
          useV2AudioUi ? readAloudFooterForMessage(msg) : undefined
        }
        >
          <SourcesBlock
            sources={links}
            heading={parkingCopy.sourcesHeading}
            className=""
          />
        </AssistantMessageCard>
      )
    }
    if (pl === "below") {
      return (
        <AssistantMessageCard
          showAvatar={false}
          actions={
          useV2AudioUi ? undefined : readAloudControlForMessage(msg)
        }
        footer={
          useV2AudioUi ? readAloudFooterForMessage(msg) : undefined
        }
        >
          <div className="ml-0 max-w-[min(90%,32rem)] sm:max-w-[min(90%,36rem)]">
            <BelowBubbleSources
              sources={links}
              triggerLabel={copy.sourcesCollapsibleLabel}
            />
          </div>
        </AssistantMessageCard>
      )
    }
    return (
      <AssistantMessageCard
        showAvatar={false}
        actions={
          useV2AudioUi ? undefined : readAloudControlForMessage(msg)
        }
        footer={
          useV2AudioUi ? readAloudFooterForMessage(msg) : undefined
        }
      >
        <RichParagraph text={parkingCopy.sourcesHeading} />
        <ul className="mt-4 space-y-2 text-foreground">
          {links.map((link) => (
            <li key={link.url} className="flex items-start gap-2">
              <span className="text-primary-on-background font-bold">•</span>
              <SourceLink href={link.url} target="_blank" rel="noopener noreferrer">
                {link.title}
              </SourceLink>
            </li>
          ))}
        </ul>
      </AssistantMessageCard>
    )
  }

  const renderParkingFollowUp = (msg: ChatAssistantMessage) => (
    <AssistantMessageCard
      showAvatar={false}
      actions={
        useV2AudioUi ? undefined : readAloudControlForMessage(msg)
      }
      footer={
        useV2AudioUi ? readAloudFooterForMessage(msg) : undefined
      }
    >
      {msg.playbackStructured || msg.revealComplete ? (
        <RichParagraph text={parkingCopy.followUp} />
      ) : (
        <RichBlockLines text={msg.displayText} />
      )}
    </AssistantMessageCard>
  )

  const renderMessage = (m: ChatMessage) => {
    if (m.kind === "user") {
      return (
        <UserMessageBubble>
          <p>{m.text}</p>
        </UserMessageBubble>
      )
    }

    const msg = m
    switch (msg.step) {
      case "services_first":
        return renderServicesFirst(msg, placement)
      case "services_v3":
        return renderServicesV3(msg)
      case "services_followup":
        return renderServicesFollowUp(msg)
      case "services_combined_v4":
        return renderServicesCombinedV4(msg)
      case "parking_body":
        return renderParkingBody(msg)
      case "hospital_address":
        return renderHospitalAddress(msg)
      case "parking_source":
        return renderParkingSource(placement, msg)
      case "parking_followup":
        return renderParkingFollowUp(msg)
      case "parking_combined_v4":
        return renderParkingCombinedV4(msg)
      default:
        return null
    }
  }

  return (
    <div className="flex h-[100dvh] min-h-0 w-full max-w-none flex-col overflow-hidden rounded-none border-0 bg-background shadow-none md:h-[min(96dvh,calc(100dvh-3rem))] md:max-w-4xl md:rounded-2xl md:border md:border-border md:shadow-2xl">
      <ChatHeader
        locale={locale}
        onLocaleChange={onLocaleChange}
        closeAriaLabel={copy.closeAriaLabel}
        onClose={() => {
          stopReadAloud()
          onRequestClose?.()
        }}
      />

      <div
        ref={scrollAreaRef}
        className="flex-1 overflow-y-auto px-4 pt-4 pb-4 min-h-0 md:px-5 md:pt-5 md:pb-4"
      >
        <div ref={messagesColumnRef} className="flex min-h-full flex-col gap-4">
          <AssistantMessageCard
            actions={
              useV2AudioUi ? undefined : readAloudControlForGreeting()
            }
            footer={
              useV2AudioUi ? readAloudFooterForGreeting() : undefined
            }
          >
            <RichParagraph text={copy.greeting.line1} />
            <RichParagraph text={copy.greeting.line2} className="mt-2" />
            <RichParagraph text={copy.greeting.disclaimer} className="mt-2" />
          </AssistantMessageCard>

          {messages.map((m) => (
            <Fragment key={m.id}>
              {renderMessage(m)}
              {m.kind === "user" &&
                thinkingAfterUserId === m.id &&
                showThinking && (
                  <TypingIndicator
                    showAvatar
                    tallBubble={typingIndicatorTallBubble}
                    ariaLabel={copy.typingIndicatorAriaLabel}
                  />
                )}
            </Fragment>
          ))}

          {suggestionRowsVisible ? (
            <div className="mt-auto shrink-0 pb-0">
              {showInitialChips && (
                <SuggestionChips
                  suggestions={copy.initialSuggestions}
                  onSelect={onSuggestionSelect}
                />
              )}
              {showServicesFollowUpChips && (
                <SuggestionChips
                  className={showInitialChips ? "mt-2" : undefined}
                  suggestions={copy.followUpSuggestions}
                />
              )}
              {showParkingFollowUpChips && (
                <SuggestionChips
                  className={
                    showInitialChips || showServicesFollowUpChips
                      ? "mt-2"
                      : undefined
                  }
                  suggestions={parkingCopy.followUpSuggestions}
                />
              )}
            </div>
          ) : (
            <div aria-hidden className="h-px shrink-0" />
          )}
        </div>
      </div>

      <div
        className={cn(
          "border-t border-border bg-background shrink-0 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-5 md:pb-4",
          isRecording || isVoiceTranscribing ? "pt-3" : "pt-4"
        )}
      >
        <Composer
          value={draft}
          onChange={setDraftFromInput}
          onSubmit={handleSend}
          placeholder={copy.composerPlaceholder}
          transcriptionLoadingPlaceholder={copy.composerTranscriptionLoadingPlaceholder}
          sendAriaLabel={copy.composerSendLabel}
          micAriaLabel={copy.composerMicAriaLabel}
          cancelRecordingAriaLabel={copy.voiceRecordingCancelAriaLabel}
          confirmRecordingAriaLabel={copy.voiceRecordingConfirmAriaLabel}
          disabled={conversationBusy || isVoiceTranscribing}
          isRecording={isRecording}
          isVoiceTranscribing={isVoiceTranscribing}
          onMicClick={() => {
            clearVoiceError()
            void startRecording()
          }}
          micDisabled={conversationBusy || isRecording || isVoiceTranscribing}
          micStream={micStream}
          timelineVisualizationActive={timelineVisualizationActive}
          onRecordingCancel={cancelRecording}
          onRecordingConfirm={confirmRecording}
          voiceError={voiceError}
        />
      </div>
    </div>
  )
}
