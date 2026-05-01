"use client"

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react"
import { flushSync } from "react-dom"
import { ArrowDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChatHeader } from "./chat-header"
import { AssistantMessageCard } from "./assistant-message-card"
import { UserMessageBubble } from "./user-message-bubble"
import { SuggestionChips } from "./suggestion-chips"
import { SourcesBlock } from "./sources-block"
import { Composer } from "./composer"
import { NotificationBanner } from "./notification-banner"
import { TypingIndicator } from "./typing-indicator"
import {
  getSourceVariant,
  isFullScreenAudioVariant,
  usesV2StyleReadAloudFooter,
  type AudioVariantId,
  type SourceVariantId,
} from "./prototype-config"
import type { SourcesPlacement } from "./prototype-config"
import { SourceLink } from "./source-link"
import { usePrototypeConversationFlow } from "./use-prototype-conversation-flow"
import { useVoiceInput, type VoiceTranscriptMeta } from "./use-voice-input"
import {
  getChatCopy,
  getSuggestionChipAriaLabel,
  type ChatCopy,
  type ChatLocale,
} from "./chatbot-copy"
import { getFocusableElements } from "./focus-utils"
import { RichBlockLines, RichParagraph, renderWithBold } from "./render-rich-text"
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources"
import { getParkingCopy, type ParkingCopy } from "./parking-copy"
import { cn } from "@/lib/utils"
import { getHospitalAddressCopy } from "./hospital-address-copy"
import type { ChatAssistantMessage, ChatMessage } from "./demo-flow/types"
import { isAssistantMessage, isUserMessage } from "./demo-flow/types"
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

/** Below this distance from scrollport top, pin scroll uses `auto` instead of `smooth`. */
const CHAT_PIN_SCROLL_INSTANT_THRESHOLD_PX = 8
/** Space left between the scroll viewport top and the user bubble when pinned (header breathing room). */
const CHAT_PIN_USER_TOP_GAP_PX = 12

function getLastUserMessage(
  messages: readonly ChatMessage[]
): Extract<ChatMessage, { kind: "user" }> | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m && isUserMessage(m)) return m
  }
  return null
}

function queryUserAnchorEl(
  root: HTMLDivElement,
  userMessageId: string
): HTMLElement | null {
  const escaped =
    typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(userMessageId)
      : userMessageId.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  return root.querySelector<HTMLElement>(
    `[data-chat-user-anchor="${escaped}"]`
  )
}

function scrollUserAnchorToTop(root: HTMLDivElement, userMessageId: string) {
  const el = queryUserAnchorEl(root, userMessageId)
  if (!el) return

  const rootRect = root.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  const delta = elRect.top - rootRect.top
  const nextTop = root.scrollTop + delta - CHAT_PIN_USER_TOP_GAP_PX
  const maxTop = Math.max(0, root.scrollHeight - root.clientHeight)
  const clamped = Math.min(Math.max(0, nextTop), maxTop)
  const distFromGap = Math.abs(delta - CHAT_PIN_USER_TOP_GAP_PX)
  const behavior: ScrollBehavior =
    distFromGap < CHAT_PIN_SCROLL_INSTANT_THRESHOLD_PX ? "auto" : "smooth"
  root.scrollTo({ top: clamped, behavior })
}

/** Instant nudge toward top; returns true when anchor is within tolerance of scrollport top. */
function nudgeUserAnchorTowardTop(
  root: HTMLDivElement,
  userMessageId: string,
  tolerancePx: number
): boolean {
  const el = queryUserAnchorEl(root, userMessageId)
  if (!el) return true

  const rootRect = root.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  const delta = elRect.top - rootRect.top

  if (Math.abs(delta - CHAT_PIN_USER_TOP_GAP_PX) <= tolerancePx) {
    return true
  }

  const nextTop = root.scrollTop + delta - CHAT_PIN_USER_TOP_GAP_PX
  const maxTop = Math.max(0, root.scrollHeight - root.clientHeight)
  const clamped = Math.min(Math.max(0, nextTop), maxTop)
  root.scrollTo({ top: clamped, behavior: "auto" })
  return false
}

function scrollConversationToTop(root: HTMLDivElement) {
  root.scrollTop = 0
}

const CHAT_SCROLL_DOWN_EDGE_PX = 40
/** Matches previous `pt-3` on the chat scroll body when the beta banner is dismissed. */
const CHAT_SCROLL_BODY_TOP_PADDING_PX = 12

export interface ChatbotModalProps {
  locale: ChatLocale
  onLocaleChange: (locale: ChatLocale) => void
  sourceVariant: SourceVariantId
  audioVariant: AudioVariantId
  runtimeResetEpoch: number
  onRequestClose?: () => void
  /** When false, skip focus trap, Escape-to-close, and initial focus (widget hidden but mounted). */
  isActive?: boolean
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
  isActive = true,
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
    isProgressiveRevealActive,
  } = usePrototypeConversationFlow({
    sourceVariant,
    locale,
    runtimeResetEpoch,
  })

  const showThinkingRef = useRef(showThinking)
  const progressiveRevealActiveRef = useRef(isProgressiveRevealActive)
  showThinkingRef.current = showThinking
  progressiveRevealActiveRef.current = isProgressiveRevealActive

  const useV2StyleBubbleFooter = usesV2StyleReadAloudFooter(audioVariant)

  const [draft, setDraft] = useState("")
  const [isVoiceTranscribing, setIsVoiceTranscribing] = useState(false)
  const draftTranscriptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  /** Next send after a voice transcript (until the user types in the field). */
  const lastSubmitSourceRef = useRef<"keyboard" | "voice">("keyboard")

  const queueTranscriptIntoDraft = useCallback(
    (text: string, meta: VoiceTranscriptMeta) => {
      const d = meta.detectedLocale
      if ((d === "en" || d === "fr") && d !== locale) {
        flushSync(() => {
          onLocaleChange(d)
        })
      }
      if (draftTranscriptTimeoutRef.current) {
        clearTimeout(draftTranscriptTimeoutRef.current)
        draftTranscriptTimeoutRef.current = null
      }
      setDraft("")
      if (meta.source === "server") {
        lastSubmitSourceRef.current = "voice"
        setDraft(text)
        setIsVoiceTranscribing(false)
        return
      }
      setIsVoiceTranscribing(true)
      draftTranscriptTimeoutRef.current = setTimeout(() => {
        draftTranscriptTimeoutRef.current = null
        lastSubmitSourceRef.current = "voice"
        setDraft(text)
        setIsVoiceTranscribing(false)
      }, VOICE_DRAFT_PLACEHOLDER_MS)
    },
    [locale, onLocaleChange]
  )

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
    onAwaitingServerTranscript: setIsVoiceTranscribing,
    messages: {
      noSpeechRecognized: copy.voiceNoSpeechRecognized,
      voiceWebSpeechNoMatch: copy.voiceWebSpeechNoMatch,
      serverTranscriptionFailed: copy.voiceServerTranscriptionFailed,
      serverNotConfigured: copy.voiceServerNotConfigured,
      recordingTooShort: copy.voiceRecordingTooShort,
    },
  })

  const [betaBannerDismissed, setBetaBannerDismissed] = useState(false)
  const betaBannerMeasureRef = useRef<HTMLDivElement>(null)
  const [speechErrorBannerDismissed, setSpeechErrorBannerDismissed] =
    useState(false)

  useEffect(() => {
    if (voiceError != null) {
      setSpeechErrorBannerDismissed(false)
    }
  }, [voiceError])

  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesColumnRef = useRef<HTMLDivElement>(null)
  const modalRootRef = useRef<HTMLDivElement>(null)
  /** When true, do not scroll to bottom on layout/resize (pinned user turn). */
  const suppressBottomFollowRef = useRef(false)
  /** Last user message id we already ran pin-to-top for. */
  const lastPinnedUserMessageIdRef = useRef<string | null>(null)
  /** True once the active user anchor is within tolerance of the scrollport top. */
  const userBubblePinnedRef = useRef(false)
  /** User wheel/touch during thinking or progressive reveal cancels pin chase. */
  const userCancelledPinChaseRef = useRef(false)

  const [scrollDownSuppressed, setScrollDownSuppressed] = useState(false)
  const [showScrollDownButton, setShowScrollDownButton] = useState(false)
  const scrollDownSuppressedRef = useRef(false)
  scrollDownSuppressedRef.current = scrollDownSuppressed

  const updateScrollDownVisibility = useCallback(() => {
    const root = scrollAreaRef.current
    if (!root) return
    const nearBottom =
      root.scrollTop + root.clientHeight >=
      root.scrollHeight - CHAT_SCROLL_DOWN_EDGE_PX
    const botBusy =
      showThinkingRef.current || progressiveRevealActiveRef.current
    const show =
      !nearBottom && !botBusy && !scrollDownSuppressedRef.current
    setShowScrollDownButton(show)
  }, [])

  const scrollConversationToBottom = () => {
    const root = scrollAreaRef.current
    if (!root) return
    root.scrollTop = root.scrollHeight
  }

  useLayoutEffect(() => {
    const root = scrollAreaRef.current
    if (!root) return

    const lastUser = getLastUserMessage(messages)

    if (!lastUser) {
      suppressBottomFollowRef.current = false
      lastPinnedUserMessageIdRef.current = null
      userBubblePinnedRef.current = false
      userCancelledPinChaseRef.current = false
      scrollConversationToTop(root)
      const id = requestAnimationFrame(() => {
        const r = scrollAreaRef.current
        if (r) scrollConversationToTop(r)
      })
      return () => cancelAnimationFrame(id)
    }

    const userId = lastUser.id
    const isNewUserTurn = lastPinnedUserMessageIdRef.current !== userId

    if (isNewUserTurn) {
      suppressBottomFollowRef.current = true
      lastPinnedUserMessageIdRef.current = userId
      userBubblePinnedRef.current = false
      userCancelledPinChaseRef.current = false
      scrollUserAnchorToTop(root, userId)
      const id = requestAnimationFrame(() => {
        const r = scrollAreaRef.current
        if (r) scrollUserAnchorToTop(r, userId)
      })
      return () => cancelAnimationFrame(id)
    }

    if (
      suppressBottomFollowRef.current &&
      !userBubblePinnedRef.current &&
      !userCancelledPinChaseRef.current
    ) {
      if (
        nudgeUserAnchorTowardTop(
          root,
          userId,
          CHAT_PIN_SCROLL_INSTANT_THRESHOLD_PX
        )
      ) {
        userBubblePinnedRef.current = true
      }
    }

    return undefined
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
      if (suppressBottomFollowRef.current) {
        if (
          !userBubblePinnedRef.current &&
          !userCancelledPinChaseRef.current &&
          lastPinnedUserMessageIdRef.current
        ) {
          const pinId = lastPinnedUserMessageIdRef.current
          if (
            nudgeUserAnchorTowardTop(
              root,
              pinId,
              CHAT_PIN_SCROLL_INSTANT_THRESHOLD_PX
            )
          ) {
            userBubblePinnedRef.current = true
          }
        }
        updateScrollDownVisibility()
        return
      }
      const lastUser = getLastUserMessage(messages)
      /** Greeting-only thread: do not scroll to bottom (would hide the top under the beta banner). */
      if (lastUser != null) {
        root.scrollTop = root.scrollHeight
      }
      updateScrollDownVisibility()
    })
    ro.observe(inner)
    return () => ro.disconnect()
  }, [updateScrollDownVisibility, messages])

  useEffect(() => {
    const root = scrollAreaRef.current
    if (!root) return
    const cancelChaseOnUserGesture = () => {
      const generationActive =
        showThinkingRef.current || progressiveRevealActiveRef.current
      if (generationActive && !userBubblePinnedRef.current) {
        userCancelledPinChaseRef.current = true
      }
    }
    root.addEventListener("wheel", cancelChaseOnUserGesture, { passive: true })
    root.addEventListener("touchmove", cancelChaseOnUserGesture, {
      passive: true,
    })
    return () => {
      root.removeEventListener("wheel", cancelChaseOnUserGesture)
      root.removeEventListener("touchmove", cancelChaseOnUserGesture)
    }
  }, [])

  useEffect(() => {
    const root = scrollAreaRef.current
    if (!root) return
    const onScroll = () => updateScrollDownVisibility()
    root.addEventListener("scroll", onScroll, { passive: true })
    return () => root.removeEventListener("scroll", onScroll)
  }, [updateScrollDownVisibility])

  useEffect(() => {
    updateScrollDownVisibility()
  }, [
    messages,
    showThinking,
    isProgressiveRevealActive,
    scrollDownSuppressed,
    betaBannerDismissed,
    updateScrollDownVisibility,
  ])

  useEffect(() => {
    if (!showThinking && !isProgressiveRevealActive) {
      setScrollDownSuppressed(false)
    }
  }, [showThinking, isProgressiveRevealActive])

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
    setScrollDownSuppressed(true)
    const submitSource = lastSubmitSourceRef.current
    onManualSubmit(t, { submitSource })
    setDraft("")
    lastSubmitSourceRef.current = "keyboard"
  }

  const handleScrollDownClick = () => {
    const root = scrollAreaRef.current
    if (!root) return
    const top = Math.max(0, root.scrollHeight - root.clientHeight)
    root.scrollTo({ top, behavior: "smooth" })
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
  const readAloudFullTextRef = useRef<string | null>(null)
  const readAloudSeekResumePausedRef = useRef(false)
  const readAloudStatusRef = useRef(readAloudStatus)
  const readAloudActiveIdRef = useRef(readAloudActiveId)
  readAloudStatusRef.current = readAloudStatus
  readAloudActiveIdRef.current = readAloudActiveId

  const isV3FocusLayout =
    isFullScreenAudioVariant(audioVariant) &&
    readAloudActiveId != null &&
    readAloudStatus !== "idle"

  const handleLogKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (isV3FocusLayout) return
      const root = scrollAreaRef.current
      if (!root) return
      if (e.key === "ArrowDown") {
        e.preventDefault()
        root.scrollTop = Math.min(
          root.scrollHeight - root.clientHeight,
          root.scrollTop + 48,
        )
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        root.scrollTop = Math.max(0, root.scrollTop - 48)
      }
    },
    [isV3FocusLayout],
  )

  /** Imperative padding avoids a first paint with state still 0 (overlap). */
  useLayoutEffect(() => {
    const scroll = scrollAreaRef.current
    if (!scroll) return

    const applyInset = (bannerHeightPx: number) => {
      scroll.style.paddingTop = isV3FocusLayout
        ? `${bannerHeightPx}px`
        : betaBannerDismissed
          ? `${CHAT_SCROLL_BODY_TOP_PADDING_PX}px`
          : `${bannerHeightPx + CHAT_SCROLL_BODY_TOP_PADDING_PX}px`
    }

    if (betaBannerDismissed) {
      applyInset(0)
      return () => {
        scroll.style.removeProperty("padding-top")
      }
    }

    const el = betaBannerMeasureRef.current
    if (!el) {
      applyInset(0)
      return () => {
        scroll.style.removeProperty("padding-top")
      }
    }

    const apply = () => {
      applyInset(el.offsetHeight)
      updateScrollDownVisibility()
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => {
      ro.disconnect()
      scroll.style.removeProperty("padding-top")
    }
  }, [betaBannerDismissed, isV3FocusLayout, locale, updateScrollDownVisibility])

  const clearReadAloudUi = useCallback(() => {
    readAloudOffsetMsRef.current = 0
    readAloudAnchorMsRef.current = null
    readAloudFullTextRef.current = null
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

  const beginReadAloudSynthesis = useCallback(
    (
      messageId: string,
      speakText: string,
      myGen: number,
      timeline: "fromStart" | "fromSeek"
    ) => {
      if (typeof window === "undefined") return
      const trimmed = speakText.trim()
      if (!trimmed) return

      const lang = getSpeechBcp47ForChatLocale(locale)
      const chunks = splitTextIntoSpeechChunks(trimmed)
      if (chunks.length === 0) return

      let hasStarted = false

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
            if (readAloudSeekResumePausedRef.current) {
              readAloudSeekResumePausedRef.current = false
              readAloudAnchorMsRef.current = null
              try {
                synth.pause()
              } catch {
                /* ignore */
              }
              setReadAloudStatus("paused")
              setReadAloudTick((t) => t + 1)
              return
            }
            if (timeline === "fromSeek" && index === 0) {
              readAloudAnchorMsRef.current = Date.now()
              setReadAloudTick((t) => t + 1)
              return
            }
            if (
              index === 0 &&
              isFullScreenAudioVariant(audioVariant) &&
              timeline === "fromStart"
            ) {
              readAloudOffsetMsRef.current = 0
              readAloudAnchorMsRef.current = Date.now()
              setReadAloudTick((t) => t + 1)
            }
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
          if (
            index === 0 &&
            !isFullScreenAudioVariant(audioVariant) &&
            timeline === "fromStart"
          ) {
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
    [audioVariant, clearReadAloudUi, locale]
  )

  const startReadAloud = useCallback(
    (messageId: string, text: string) => {
      if (typeof window === "undefined" || !text.trim()) return
      window.speechSynthesis.cancel()
      utteranceGenRef.current++
      const myGen = utteranceGenRef.current
      readAloudSeekResumePausedRef.current = false

      const full = text.trim()
      readAloudFullTextRef.current = full
      readAloudEstimateMsRef.current = estimateSpeechDurationMs(full, locale)
      readAloudOffsetMsRef.current = 0
      readAloudAnchorMsRef.current = null

      if (isFullScreenAudioVariant(audioVariant)) {
        setReadAloudActiveId(messageId)
        setReadAloudStatus("playing")
        setReadAloudTick((t) => t + 1)
      }

      beginReadAloudSynthesis(messageId, full, myGen, "fromStart")
    },
    [audioVariant, beginReadAloudSynthesis]
  )

  const seekReadAloud = useCallback(
    (fraction: number) => {
      if (typeof window === "undefined") return
      const activeId = readAloudActiveIdRef.current
      const status = readAloudStatusRef.current
      if (activeId == null || status === "idle") return
      const full = readAloudFullTextRef.current
      if (full == null || !full.length) return

      const f = Math.min(1, Math.max(0, fraction))
      const idx = Math.min(full.length, Math.floor(f * full.length))
      const remaining = full.slice(idx).trim()
      if (idx >= full.length || !remaining.length) {
        stopReadAloud()
        return
      }

      const total = readAloudEstimateMsRef.current
      readAloudOffsetMsRef.current = Math.min(total, f * total)
      readAloudEstimateMsRef.current =
        readAloudOffsetMsRef.current + estimateSpeechDurationMs(remaining, locale)
      readAloudAnchorMsRef.current = null

      window.speechSynthesis.cancel()
      utteranceGenRef.current++
      const myGen = utteranceGenRef.current

      readAloudSeekResumePausedRef.current = status === "paused"

      beginReadAloudSynthesis(activeId, remaining, myGen, "fromSeek")
      setReadAloudTick((t) => t + 1)
    },
    [beginReadAloudSynthesis, stopReadAloud, locale]
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

  /** Escape: stop V3 read-aloud first; otherwise close widget. Tab wraps within the modal. */
  useEffect(() => {
    if (!isActive) return

    const onKeyDown = (e: KeyboardEvent) => {
      const root = modalRootRef.current
      if (!root) return

      if (e.key === "Escape") {
        if (isV3FocusLayout) {
          e.preventDefault()
          stopReadAloud()
          return
        }
        e.preventDefault()
        stopReadAloud()
        onRequestClose?.()
        return
      }

      if (e.key !== "Tab") return
      const active = document.activeElement
      if (!(active instanceof HTMLElement) || !root.contains(active)) return

      const list = getFocusableElements(root)
      if (list.length === 0) return
      const first = list[0]!
      const last = list[list.length - 1]!

      if (e.shiftKey) {
        if (active === first) {
          e.preventDefault()
          last.focus()
        }
      } else if (active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [isActive, isV3FocusLayout, stopReadAloud, onRequestClose])

  /** Move focus into the widget when it becomes active (e.g. opened from FAB). */
  useEffect(() => {
    if (!isActive) return
    const root = modalRootRef.current
    if (!root) return
    const id = window.requestAnimationFrame(() => {
      const list = getFocusableElements(root)
      list[0]?.focus()
    })
    return () => window.cancelAnimationFrame(id)
  }, [isActive])

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
          estimatedDurationMs={
            isThisActive && mode !== "idle"
              ? readAloudEstimateMsRef.current
              : 0
          }
          onStart={() => {
            if (plain) startReadAloud(msg.id, plain)
          }}
          onPause={pauseReadAloud}
          onResume={resumeReadAloud}
          onStop={stopReadAloud}
          onSeekCommit={
            isThisActive && mode !== "idle" ? seekReadAloud : undefined
          }
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
      seekReadAloud,
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
        estimatedDurationMs={
          isThisActive && mode !== "idle"
            ? readAloudEstimateMsRef.current
            : 0
        }
        onStart={() => {
          if (plain) startReadAloud(STATIC_GREETING_READ_ALOUD_ID, plain)
        }}
        onPause={pauseReadAloud}
        onResume={resumeReadAloud}
        onStop={stopReadAloud}
        onSeekCommit={
          isThisActive && mode !== "idle" ? seekReadAloud : undefined
        }
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
    seekReadAloud,
  ])

  const assistantReadAloudSlots = useCallback(
    (msg: ChatAssistantMessage, omitReadAloudUi: boolean) =>
      omitReadAloudUi
        ? { actions: undefined, footer: undefined }
        : {
            actions: useV2StyleBubbleFooter
              ? undefined
              : readAloudControlForMessage(msg),
            footer: useV2StyleBubbleFooter
              ? readAloudFooterForMessage(msg)
              : undefined,
          },
    [useV2StyleBubbleFooter, readAloudControlForMessage, readAloudFooterForMessage]
  )

  const v3FocusReadAloudFooterMetrics = useMemo(() => {
    if (!isV3FocusLayout) {
      return { progress: 0, remainingClock: formatRemainingClock(0) }
    }
    const elapsed =
      readAloudStatus === "playing" &&
      readAloudAnchorMsRef.current != null
        ? readAloudOffsetMsRef.current +
          (Date.now() - readAloudAnchorMsRef.current)
        : readAloudOffsetMsRef.current
    const est = readAloudEstimateMsRef.current
    const progress = est > 0 ? Math.min(1, elapsed / est) : 0
    const remainingClock = formatRemainingClock(
      Math.max(0, (est - elapsed) / 1000)
    )
    return { progress, remainingClock }
  }, [isV3FocusLayout, readAloudStatus, readAloudTick])

  const renderServicesCombinedV4 = (
    msg: ChatAssistantMessage,
    omitReadAloudUi = false,
    v3FocusBubble = false
  ) => {
    const { actions, footer } = assistantReadAloudSlots(msg, omitReadAloudUi)
    const showTail = msg.playbackStructured || msg.combinedTailVisible
    return (
      <AssistantMessageCard
        showAvatar={v3FocusBubble ? false : assistantShowsAvatar(msg.step)}
        v3FocusBubble={v3FocusBubble}
        actions={actions}
        footer={footer}
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

  const renderParkingCombinedV4 = (
    msg: ChatAssistantMessage,
    omitReadAloudUi = false,
    v3FocusBubble = false
  ) => {
    const { actions, footer } = assistantReadAloudSlots(msg, omitReadAloudUi)
    const showTail = msg.playbackStructured || msg.combinedTailVisible
    return (
      <AssistantMessageCard
        showAvatar={v3FocusBubble ? false : assistantShowsAvatar(msg.step)}
        v3FocusBubble={v3FocusBubble}
        actions={actions}
        footer={footer}
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
    pl: SourcesPlacement,
    omitReadAloudUi = false,
    v3FocusBubble = false
  ) => {
    const { actions, footer } = assistantReadAloudSlots(msg, omitReadAloudUi)
    const belowWrapClass = omitReadAloudUi
      ? "mt-2 ml-0 max-w-none"
      : "ml-[44px] sm:ml-[52px] mt-2"
    const belowWrapClassWide = omitReadAloudUi
      ? "mt-2 ml-0 max-w-none"
      : "ml-[44px] sm:ml-[52px] mt-2 max-w-[min(90%,32rem)] sm:max-w-[min(90%,36rem)]"
    const showInlineSourcesBlock =
      pl === "inline" && msg.revealComplete && copy.sourcesInline.length > 0
    const showBelowAiSources =
      pl === "below" && msg.revealComplete && copy.sourcesInline.length > 0

    if (msg.playbackStructured) {
      return (
        <div
          className={cn(
            "flex flex-col",
            v3FocusBubble && "h-full min-h-0 min-w-0 w-full flex-1"
          )}
        >
          <AssistantMessageCard
            showAvatar={v3FocusBubble ? false : assistantShowsAvatar(msg.step)}
            v3FocusBubble={v3FocusBubble}
            actions={actions}
            footer={footer}
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
            {v3FocusBubble && pl === "below" && (
              <div className="mt-4 border-t border-border pt-3">
                <BelowBubbleSources
                  sources={copy.sourcesInline}
                  triggerLabel={copy.sourcesCollapsibleLabel}
                />
              </div>
            )}
          </AssistantMessageCard>
          {!v3FocusBubble && pl === "below" && (
            <div className={belowWrapClass}>
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
      <div
        className={cn(
          "flex flex-col",
          v3FocusBubble && "h-full min-h-0 min-w-0 w-full flex-1"
        )}
      >
        <AssistantMessageCard
          showAvatar={v3FocusBubble ? false : assistantShowsAvatar(msg.step)}
          v3FocusBubble={v3FocusBubble}
          actions={actions}
          footer={footer}
        >
          <RichBlockLines text={msg.displayText} />
          {showInlineSourcesBlock && (
            <SourcesBlock
              sources={copy.sourcesInline}
              heading={copy.sourcesHeading}
              className="mt-4 pt-3 border-t border-border"
            />
          )}
          {v3FocusBubble && showBelowAiSources && (
            <div className="mt-4 border-t border-border pt-3">
              <BelowBubbleSources
                sources={copy.sourcesInline}
                triggerLabel={copy.sourcesCollapsibleLabel}
              />
            </div>
          )}
        </AssistantMessageCard>
        {!v3FocusBubble && showBelowAiSources && (
          <div className={belowWrapClassWide}>
            <BelowBubbleSources
              sources={copy.sourcesInline}
              triggerLabel={copy.sourcesCollapsibleLabel}
            />
          </div>
        )}
      </div>
    )
  }

  const renderServicesV3 = (
    msg: ChatAssistantMessage,
    omitReadAloudUi = false,
    v3FocusBubble = false
  ) => {
    const { actions, footer } = assistantReadAloudSlots(msg, omitReadAloudUi)
    return (
    <AssistantMessageCard
      showAvatar={false}
      v3FocusBubble={v3FocusBubble}
      actions={actions}
      footer={footer}
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
  }

  const renderServicesFollowUp = (
    msg: ChatAssistantMessage,
    omitReadAloudUi = false,
    v3FocusBubble = false
  ) => {
    const { actions, footer } = assistantReadAloudSlots(msg, omitReadAloudUi)
    return (
    <AssistantMessageCard
      showAvatar={false}
      v3FocusBubble={v3FocusBubble}
      actions={actions}
      footer={footer}
    >
      {msg.playbackStructured ? (
        <RichParagraph text={copy.assistantFollowUp} />
      ) : (
        <RichBlockLines text={msg.displayText} />
      )}
    </AssistantMessageCard>
    )
  }

  const renderParkingBody = (
    msg: ChatAssistantMessage,
    omitReadAloudUi = false,
    v3FocusBubble = false
  ) => {
    const { actions, footer } = assistantReadAloudSlots(msg, omitReadAloudUi)
    return (
    <AssistantMessageCard
      showAvatar={v3FocusBubble ? false : assistantShowsAvatar(msg.step)}
      v3FocusBubble={v3FocusBubble}
      actions={actions}
      footer={footer}
    >
      <RichBlockLines
        text={msg.revealComplete ? parkingCopy.body : msg.displayText}
      />
    </AssistantMessageCard>
    )
  }

  const renderHospitalAddress = (
    msg: ChatAssistantMessage,
    omitReadAloudUi = false,
    v3FocusBubble = false
  ) => {
    const { actions, footer } = assistantReadAloudSlots(msg, omitReadAloudUi)
    const body =
      msg.revealComplete && msg.playbackStructured
        ? getHospitalAddressCopy(locale)
        : msg.displayText
    return (
      <AssistantMessageCard
        showAvatar={v3FocusBubble ? false : assistantShowsAvatar(msg.step)}
        v3FocusBubble={v3FocusBubble}
        actions={actions}
        footer={footer}
      >
        <RichBlockLines text={body} inlineLinks />
      </AssistantMessageCard>
    )
  }

  const renderParkingSource = (
    pl: SourcesPlacement,
    msg: ChatAssistantMessage,
    omitReadAloudUi = false,
    v3FocusBubble = false
  ) => {
    const { actions, footer } = assistantReadAloudSlots(msg, omitReadAloudUi)
    const links = parkingCopy.officialLinks
    if (pl === "inline") {
      return (
        <AssistantMessageCard
          showAvatar={false}
          v3FocusBubble={v3FocusBubble}
          actions={actions}
          footer={footer}
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
          v3FocusBubble={v3FocusBubble}
          actions={actions}
          footer={footer}
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
        v3FocusBubble={v3FocusBubble}
        actions={actions}
        footer={footer}
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

  const renderParkingFollowUp = (
    msg: ChatAssistantMessage,
    omitReadAloudUi = false,
    v3FocusBubble = false
  ) => {
    const { actions, footer } = assistantReadAloudSlots(msg, omitReadAloudUi)
    return (
    <AssistantMessageCard
      showAvatar={false}
      v3FocusBubble={v3FocusBubble}
      actions={actions}
      footer={footer}
    >
      {msg.playbackStructured || msg.revealComplete ? (
        <RichParagraph text={parkingCopy.followUp} />
      ) : (
        <RichBlockLines text={msg.displayText} />
      )}
    </AssistantMessageCard>
    )
  }

  const renderMessage = (
    m: ChatMessage,
    omitReadAloudUi = false,
    v3FocusBubble = false
  ) => {
    if (m.kind === "user") {
      return (
        <div data-chat-user-anchor={m.id}>
          <UserMessageBubble>
            <p>{m.text}</p>
          </UserMessageBubble>
        </div>
      )
    }

    const msg = m
    switch (msg.step) {
      case "services_first":
        return renderServicesFirst(msg, placement, omitReadAloudUi, v3FocusBubble)
      case "services_v3":
        return renderServicesV3(msg, omitReadAloudUi, v3FocusBubble)
      case "services_followup":
        return renderServicesFollowUp(msg, omitReadAloudUi, v3FocusBubble)
      case "services_combined_v4":
        return renderServicesCombinedV4(msg, omitReadAloudUi, v3FocusBubble)
      case "parking_body":
        return renderParkingBody(msg, omitReadAloudUi, v3FocusBubble)
      case "hospital_address":
        return renderHospitalAddress(msg, omitReadAloudUi, v3FocusBubble)
      case "parking_source":
        return renderParkingSource(placement, msg, omitReadAloudUi, v3FocusBubble)
      case "parking_followup":
        return renderParkingFollowUp(msg, omitReadAloudUi, v3FocusBubble)
      case "parking_combined_v4":
        return renderParkingCombinedV4(msg, omitReadAloudUi, v3FocusBubble)
      default:
        return null
    }
  }

  const suggestionChipAria = useCallback(
    (s: { label: string }) => getSuggestionChipAriaLabel(copy, s.label),
    [copy],
  )

  return (
    <div
      ref={modalRootRef}
      className="flex h-[100dvh] min-h-0 w-full max-w-none flex-col overflow-hidden rounded-none border-0 bg-background shadow-none md:h-[min(96dvh,calc(100dvh-3rem))] md:max-w-4xl md:rounded-2xl md:border md:border-border md:shadow-2xl"
    >
      <ChatHeader
        locale={locale}
        onLocaleChange={onLocaleChange}
        closeAriaLabel={copy.closeAriaLabel}
        onClose={() => {
          stopReadAloud()
          onRequestClose?.()
        }}
      />

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={scrollAreaRef}
          role={!isV3FocusLayout ? "log" : undefined}
          aria-live={!isV3FocusLayout ? "polite" : undefined}
          aria-atomic={!isV3FocusLayout ? false : undefined}
          aria-relevant={!isV3FocusLayout ? "additions" : undefined}
          tabIndex={!isV3FocusLayout ? 0 : undefined}
          onKeyDown={!isV3FocusLayout ? handleLogKeyDown : undefined}
          className={cn(
            "min-h-0 flex-1",
            isV3FocusLayout ? "pb-0" : "pb-3",
            isV3FocusLayout
              ? "flex flex-col overflow-hidden px-0"
              : "overflow-y-auto px-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          )}
        >
          {isV3FocusLayout ? (
            <div
              ref={messagesColumnRef}
              className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
            >
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                {readAloudActiveId === STATIC_GREETING_READ_ALOUD_ID ? (
                  <AssistantMessageCard
                    v3FocusBubble
                    actions={undefined}
                    footer={undefined}
                  >
                    <RichParagraph text={copy.greeting.line1} />
                    <RichParagraph text={copy.greeting.line2} className="mt-2" />
                    <RichParagraph text={copy.greeting.disclaimer} className="mt-2" />
                  </AssistantMessageCard>
                ) : (
                  (() => {
                    const m = messages.find(
                      (x): x is ChatAssistantMessage =>
                        isAssistantMessage(x) && x.id === readAloudActiveId
                    )
                    if (!m) return null
                    return renderMessage(m, true, true)
                  })()
                )}
              </div>
            </div>
          ) : (
            <div ref={messagesColumnRef} className="flex min-h-full flex-col gap-4">
              <AssistantMessageCard
                actions={
                  useV2StyleBubbleFooter ? undefined : readAloudControlForGreeting()
                }
                footer={
                  useV2StyleBubbleFooter ? readAloudFooterForGreeting() : undefined
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
                        statusText={copy.typingIndicatorAriaLabel}
                      />
                    )}
                </Fragment>
              ))}

              {suggestionRowsVisible ? (
                <div className="mt-auto shrink-0 pb-0">
                  {showInitialChips ? (
                    <SuggestionChips
                      suggestions={copy.initialSuggestions}
                      onSelect={onSuggestionSelect}
                      getChipAriaLabel={suggestionChipAria}
                    />
                  ) : null}
                  {showServicesFollowUpChips ? (
                    <SuggestionChips
                      className={showInitialChips ? "mt-2" : undefined}
                      suggestions={copy.followUpSuggestions}
                      onSelect={onSuggestionSelect}
                      getChipAriaLabel={suggestionChipAria}
                    />
                  ) : null}
                  {showParkingFollowUpChips ? (
                    <SuggestionChips
                      className={
                        showInitialChips || showServicesFollowUpChips
                          ? "mt-2"
                          : undefined
                      }
                      suggestions={parkingCopy.followUpSuggestions}
                      onSelect={onSuggestionSelect}
                      getChipAriaLabel={suggestionChipAria}
                    />
                  ) : null}
                </div>
              ) : (
                <div aria-hidden className="h-px shrink-0" />
              )}
            </div>
          )}
        </div>

        {!betaBannerDismissed ? (
          <div
            ref={betaBannerMeasureRef}
            className="pointer-events-auto absolute inset-x-0 top-0 z-20 w-full"
          >
            <NotificationBanner
              variant="beta"
              message={copy.betaDisclaimerBanner}
              dismissAriaLabel={copy.notificationBannerDismissAria}
              onDismiss={() => setBetaBannerDismissed(true)}
            />
          </div>
        ) : null}

        {showScrollDownButton && !isV3FocusLayout ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-4">
            <Button
              type="button"
              variant="primaryMuted"
              onClick={handleScrollDownClick}
              aria-label={copy.scrollDownLabel}
              className="pointer-events-auto h-9 gap-2 rounded-[14px] px-3"
            >
              <ArrowDown className="h-4 w-4 shrink-0" aria-hidden />
              {copy.scrollDownLabel}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex w-full min-w-0 flex-col border-t border-border bg-white shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-3">
        {voiceError != null && !speechErrorBannerDismissed ? (
          <NotificationBanner
            variant="error"
            message={copy.voiceCaptureErrorBanner}
            dismissAriaLabel={copy.notificationBannerDismissAria}
            onDismiss={() => setSpeechErrorBannerDismissed(true)}
          />
        ) : null}
        <div className="flex min-w-0 flex-col gap-3 px-3 pt-3 md:px-4">
          {isV3FocusLayout ? (
            <MessageReadAloudV2
              mode={readAloudStatus === "paused" ? "paused" : "playing"}
              labels={readAloudV2Labels}
              progress={v3FocusReadAloudFooterMetrics.progress}
              remainingClock={v3FocusReadAloudFooterMetrics.remainingClock}
              estimatedDurationMs={readAloudEstimateMsRef.current}
              onStart={() => {}}
              onPause={pauseReadAloud}
              onResume={resumeReadAloud}
              onStop={stopReadAloud}
              onSeekCommit={seekReadAloud}
            />
          ) : (
            <Composer
              value={draft}
              onChange={setDraftFromInput}
              onSubmit={handleSend}
              placeholder={copy.composerPlaceholder}
              transcriptionLoadingPlaceholder={
                copy.composerTranscriptionLoadingPlaceholder
              }
              inputAriaLabel={copy.composerInputAriaLabel}
              sendAriaLabel={copy.composerSendLabel}
              micAriaLabel={copy.composerMicAriaLabel}
              primaryActionUnavailableAriaLabel={
                copy.composerPrimaryActionUnavailableAriaLabel
              }
              sendModeAnnouncement={copy.composerSendModeAnnouncement}
              voiceModeAnnouncement={copy.composerVoiceModeAnnouncement}
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
            />
          )}
        </div>
      </div>
    </div>
  )
}
