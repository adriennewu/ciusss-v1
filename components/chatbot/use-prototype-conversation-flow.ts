"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  DEMO_ASSISTANT_STAGGER_MS,
  DEMO_THINKING_DURATION_MS,
  PROGRESSIVE_CHUNK_MS,
  SERVICES_SUGGESTION_ID,
  getSourceVariant,
  type SourceVariantId,
} from "./prototype-config"
import type { ChatLocale } from "./chatbot-copy"
import {
  getAssistantFirstPlainText,
  getAssistantSecondPlainText,
  getChatCopy,
  splitProgressiveChunks,
} from "./chatbot-copy"
import { getParkingCopy } from "./parking-copy"
import { getHospitalAddressCopy } from "./hospital-address-copy"
import type {
  ChatAssistantMessage,
  ChatMessage,
  ChatUserMessage,
} from "./demo-flow/types"

export interface UsePrototypeConversationFlowOptions {
  sourceVariant: SourceVariantId
  locale: ChatLocale
  runtimeResetEpoch?: number
}

export interface UsePrototypeConversationFlowResult {
  messages: ChatMessage[]
  showThinking: boolean
  thinkingAfterUserId: string | null
  typingIndicatorTallBubble: boolean
  /** True while a manual parking turn is running (typing + assistant messages until fully complete) */
  parkingResponseInProgress: boolean
  /** True while a queued turn is running */
  conversationBusy: boolean
  onSuggestionSelect: (suggestionId: string) => void
  onManualSubmit: (
    text: string,
    options?: { submitSource?: "keyboard" | "voice" }
  ) => void
  /** True when at least one services follow-up assistant message exists in the thread */
  showFollowUpChips: boolean
  /** True while `runProgressiveReveal` has at least one in-flight reveal (depth > 0). */
  isProgressiveRevealActive: boolean
}

function nextId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function createUserMessage(
  text: string,
  origin: ChatUserMessage["origin"]
): ChatUserMessage {
  return {
    id: nextId(),
    kind: "user",
    text,
    origin,
  }
}

function createAssistantMessage(
  step: ChatAssistantMessage["step"],
  playbackStructured: boolean,
  displayText: string,
  revealComplete: boolean
): ChatAssistantMessage {
  return {
    id: nextId(),
    kind: "assistant",
    step,
    displayText,
    revealComplete,
    playbackStructured,
  }
}

function useLatestRef<T>(value: T) {
  const ref = useRef(value)
  ref.current = value
  return ref
}

export function usePrototypeConversationFlow({
  sourceVariant,
  locale,
  runtimeResetEpoch = 0,
}: UsePrototypeConversationFlowOptions): UsePrototypeConversationFlowResult {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [showThinking, setShowThinking] = useState(false)
  const [thinkingAfterUserId, setThinkingAfterUserId] = useState<string | null>(null)
  const [parkingResponseInProgress, setParkingResponseInProgress] = useState(false)
  const [conversationBusy, setConversationBusy] = useState(false)
  const [progressiveRevealDepth, setProgressiveRevealDepth] = useState(0)

  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const queueRef = useRef<((onDone: () => void) => void)[]>([])
  const processingRef = useRef(false)

  const optsRef = useLatestRef({ sourceVariant, locale })

  const clearTimers = useCallback(() => {
    for (const id of timeoutsRef.current) {
      clearTimeout(id)
    }
    timeoutsRef.current = []
  }, [])

  const resetFlow = useCallback(() => {
    clearTimers()
    queueRef.current = []
    processingRef.current = false
    setMessages([])
    setShowThinking(false)
    setThinkingAfterUserId(null)
    setParkingResponseInProgress(false)
    setConversationBusy(false)
    setProgressiveRevealDepth(0)
  }, [clearTimers])

  useEffect(() => {
    resetFlow()
  }, [sourceVariant, runtimeResetEpoch, resetFlow])

  const pushTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms)
    timeoutsRef.current.push(id)
    return id
  }, [])

  const updateAssistant = useCallback((id: string, patch: Partial<ChatAssistantMessage>) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.kind === "assistant" && m.id === id ? { ...m, ...patch } : m
      )
    )
  }, [])

  const runProgressiveReveal = useCallback(
    (
      fullText: string,
      setText: (s: string) => void,
      onComplete: () => void
    ) => {
      const lines = splitProgressiveChunks(fullText)
      if (lines.length === 0) {
        onComplete()
        return
      }

      setProgressiveRevealDepth((d) => d + 1)
      let i = 0
      let acc = ""

      const endReveal = () => {
        setProgressiveRevealDepth((d) => Math.max(0, d - 1))
      }

      const step = () => {
        if (i >= lines.length) {
          onComplete()
          endReveal()
          return
        }
        acc = i === 0 ? lines[0]! : `${acc}\n${lines[i]!}`
        setText(acc)
        i++
        if (i >= lines.length) {
          onComplete()
          endReveal()
          return
        }
        pushTimeout(step, PROGRESSIVE_CHUNK_MS)
      }
      step()
    },
    [pushTimeout]
  )

  const runQueue = useCallback(() => {
    if (processingRef.current) return
    const job = queueRef.current.shift()
    if (!job) return
    processingRef.current = true
    job(() => {
      processingRef.current = false
      if (queueRef.current.length === 0) {
        setConversationBusy(false)
      }
      runQueue()
    })
  }, [])

  const enqueueTurn = useCallback(
    (job: (onDone: () => void) => void) => {
      queueRef.current.push(job)
      setConversationBusy(true)
      runQueue()
    },
    [runQueue]
  )

  const runServicesTurn = useCallback(
    (done: () => void) => {
      const { sourceVariant: sv, locale: loc } = optsRef.current
      const placement = getSourceVariant(sv).sourcesPlacement
      const copy = getChatCopy(loc)

      const user = createUserMessage(copy.userServicesQuestion, "services")
      setMessages((prev) => [...prev, user])
      setThinkingAfterUserId(user.id)
      setShowThinking(true)

      if (placement === "combined_in_main") {
        const firstFull = getAssistantFirstPlainText(copy, placement)
        const beginCombined = () => {
          setShowThinking(false)
          setThinkingAfterUserId(null)
          const am = createAssistantMessage(
            "services_combined_v4",
            false,
            "",
            false
          )
          setMessages((prev) => [...prev, am])
          runProgressiveReveal(
            firstFull,
            (t) => updateAssistant(am.id, { displayText: t }),
            () => {
              updateAssistant(am.id, {
                revealComplete: true,
                combinedTailVisible: true,
              })
              pushTimeout(done, DEMO_ASSISTANT_STAGGER_MS)
            }
          )
        }
        if (DEMO_THINKING_DURATION_MS > 0) {
          pushTimeout(beginCombined, DEMO_THINKING_DURATION_MS)
        } else {
          pushTimeout(beginCombined, 0)
        }
        return
      }

      const firstFull = getAssistantFirstPlainText(copy, placement)
      const secondFull = getAssistantSecondPlainText(copy)

      const appendSecond = (onDone: () => void) => {
        const am = createAssistantMessage(
          "services_followup",
          false,
          "",
          false
        )
        setMessages((prev) => [...prev, am])
        runProgressiveReveal(
          secondFull,
          (t) => updateAssistant(am.id, { displayText: t }),
          () => {
            updateAssistant(am.id, { revealComplete: true })
            onDone()
          }
        )
      }

      const afterFirstComplete = () => {
        pushTimeout(() => {
          const pl = getSourceVariant(optsRef.current.sourceVariant).sourcesPlacement
          if (pl === "separate_message") {
            const v3 = createAssistantMessage("services_v3", true, "", true)
            setMessages((prev) => [...prev, v3])
            pushTimeout(() => appendSecond(done), DEMO_ASSISTANT_STAGGER_MS)
          } else {
            appendSecond(done)
          }
        }, DEMO_ASSISTANT_STAGGER_MS)
      }

      const beginFirstAssistant = () => {
        setShowThinking(false)
        setThinkingAfterUserId(null)

        const am = createAssistantMessage("services_first", false, "", false)
        setMessages((prev) => [...prev, am])
        runProgressiveReveal(
          firstFull,
          (t) => updateAssistant(am.id, { displayText: t }),
          () => {
            updateAssistant(am.id, { revealComplete: true })
            afterFirstComplete()
          }
        )
      }

      if (DEMO_THINKING_DURATION_MS > 0) {
        pushTimeout(beginFirstAssistant, DEMO_THINKING_DURATION_MS)
      } else {
        pushTimeout(beginFirstAssistant, 0)
      }
    },
    [optsRef, pushTimeout, runProgressiveReveal, updateAssistant]
  )

  const startParkingAssistantReply = useCallback(
    (afterUserId: string, done: () => void) => {
      const { locale: loc, sourceVariant: sv } = optsRef.current
      const copy = getParkingCopy(loc)
      const placement = getSourceVariant(sv).sourcesPlacement

      setParkingResponseInProgress(true)
      const completeParkingTurn = () => {
        setParkingResponseInProgress(false)
        done()
      }

      setThinkingAfterUserId(afterUserId)
      setShowThinking(true)

      const bodyFull = copy.body
      const followFull = copy.followUp

      if (placement === "combined_in_main") {
        const beginCombinedParking = () => {
          setShowThinking(false)
          setThinkingAfterUserId(null)
          const bodyMsg = createAssistantMessage(
            "parking_combined_v4",
            false,
            "",
            false
          )
          setMessages((prev) => [...prev, bodyMsg])
          runProgressiveReveal(
            bodyFull,
            (t) => updateAssistant(bodyMsg.id, { displayText: t }),
            () => {
              updateAssistant(bodyMsg.id, {
                revealComplete: true,
                combinedTailVisible: true,
              })
              pushTimeout(completeParkingTurn, DEMO_ASSISTANT_STAGGER_MS)
            }
          )
        }
        if (DEMO_THINKING_DURATION_MS > 0) {
          pushTimeout(beginCombinedParking, DEMO_THINKING_DURATION_MS)
        } else {
          pushTimeout(beginCombinedParking, 0)
        }
        return
      }

      const appendFollowUp = (onDone: () => void) => {
        const fu = createAssistantMessage("parking_followup", false, "", false)
        setMessages((prev) => [...prev, fu])
        runProgressiveReveal(
          followFull,
          (t) => updateAssistant(fu.id, { displayText: t }),
          () => {
            updateAssistant(fu.id, { revealComplete: true })
            onDone()
          }
        )
      }

      const appendParkingSource = (onDone: () => void) => {
        const src = createAssistantMessage("parking_source", true, "", true)
        setMessages((prev) => [...prev, src])
        pushTimeout(() => appendFollowUp(onDone), DEMO_ASSISTANT_STAGGER_MS)
      }

      const beginAfterThinking = () => {
        setShowThinking(false)
        setThinkingAfterUserId(null)

        const bodyMsg = createAssistantMessage("parking_body", false, "", false)
        setMessages((prev) => [...prev, bodyMsg])

        runProgressiveReveal(
          bodyFull,
          (t) => updateAssistant(bodyMsg.id, { displayText: t }),
          () => {
            updateAssistant(bodyMsg.id, { revealComplete: true })
            pushTimeout(() => appendParkingSource(completeParkingTurn), DEMO_ASSISTANT_STAGGER_MS)
          }
        )
      }

      if (DEMO_THINKING_DURATION_MS > 0) {
        pushTimeout(beginAfterThinking, DEMO_THINKING_DURATION_MS)
      } else {
        pushTimeout(beginAfterThinking, 0)
      }
    },
    [optsRef, pushTimeout, runProgressiveReveal, updateAssistant]
  )

  const runParkingTurn = useCallback(
    (typedUserText: string, done: () => void) => {
      const user = createUserMessage(typedUserText, "manual")
      setMessages((prev) => [...prev, user])
      startParkingAssistantReply(user.id, done)
    },
    [startParkingAssistantReply]
  )

  const startHospitalAddressAssistantReply = useCallback(
    (afterUserId: string, done: () => void) => {
      setParkingResponseInProgress(true)
      const completeTurn = () => {
        setParkingResponseInProgress(false)
        done()
      }

      setThinkingAfterUserId(afterUserId)
      setShowThinking(true)

      const beginAfterThinking = () => {
        const bodyFull = getHospitalAddressCopy(optsRef.current.locale)
        setShowThinking(false)
        setThinkingAfterUserId(null)

        const bodyMsg = createAssistantMessage("hospital_address", false, "", false)
        setMessages((prev) => [...prev, bodyMsg])

        runProgressiveReveal(
          bodyFull,
          (t) => updateAssistant(bodyMsg.id, { displayText: t }),
          () => {
            updateAssistant(bodyMsg.id, {
              revealComplete: true,
              playbackStructured: true,
            })
            pushTimeout(completeTurn, DEMO_ASSISTANT_STAGGER_MS)
          }
        )
      }

      if (DEMO_THINKING_DURATION_MS > 0) {
        pushTimeout(beginAfterThinking, DEMO_THINKING_DURATION_MS)
      } else {
        pushTimeout(beginAfterThinking, 0)
      }
    },
    [optsRef, pushTimeout, runProgressiveReveal, updateAssistant]
  )

  const runHospitalAddressTurn = useCallback(
    (typedUserText: string, done: () => void) => {
      const user = createUserMessage(typedUserText, "manual")
      setMessages((prev) => [...prev, user])
      startHospitalAddressAssistantReply(user.id, done)
    },
    [startHospitalAddressAssistantReply]
  )

  const onSuggestionSelect = useCallback(
    (suggestionId: string) => {
      const { locale: loc } = optsRef.current
      const copy = getChatCopy(loc)
      const parkingCopy = getParkingCopy(loc)

      if (suggestionId === SERVICES_SUGGESTION_ID) {
        enqueueTurn((done) => {
          runServicesTurn(done)
        })
        return
      }

      const initial = copy.initialSuggestions.find((s) => s.id === suggestionId)
      if (initial) {
        enqueueTurn((done) => {
          runHospitalAddressTurn(initial.label, done)
        })
        return
      }

      const follow = copy.followUpSuggestions.find((s) => s.id === suggestionId)
      if (follow) {
        enqueueTurn((done) => {
          runHospitalAddressTurn(follow.label, done)
        })
        return
      }

      const parkingFollow = parkingCopy.followUpSuggestions.find(
        (s) => s.id === suggestionId
      )
      if (parkingFollow) {
        enqueueTurn((done) => {
          runParkingTurn(parkingFollow.label, done)
        })
      }
    },
    [
      enqueueTurn,
      runHospitalAddressTurn,
      runParkingTurn,
      runServicesTurn,
      optsRef,
    ]
  )

  const onManualSubmit = useCallback(
    (text: string, options?: { submitSource?: "keyboard" | "voice" }) => {
      const t = text.trim()
      if (!t) return
      const submitSource = options?.submitSource ?? "keyboard"
      enqueueTurn((done) => {
        if (submitSource === "voice") {
          runParkingTurn(t, done)
        } else {
          runHospitalAddressTurn(t, done)
        }
      })
    },
    [enqueueTurn, runHospitalAddressTurn, runParkingTurn]
  )

  useEffect(() => () => clearTimers(), [clearTimers])

  const showFollowUpChips = messages.some(
    (m) =>
      m.kind === "assistant" &&
      (m.step === "services_followup" ||
        (m.step === "services_combined_v4" && m.revealComplete))
  )

  return {
    messages,
    showThinking,
    thinkingAfterUserId,
    typingIndicatorTallBubble: DEMO_THINKING_DURATION_MS > 0,
    parkingResponseInProgress,
    conversationBusy,
    onSuggestionSelect,
    onManualSubmit,
    showFollowUpChips,
    isProgressiveRevealActive: progressiveRevealDepth > 0,
  }
}
