"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { ChatLocale } from "./chatbot-copy"
import {
  getSpeechRecognitionConstructor,
  oppositeChatLocale,
  speechRecognitionLang,
} from "./speech-recognition-support"
import { isIOSLikeClient } from "@/lib/is-ios"
import {
  extensionForRecorderMime,
  pickMediaRecorderMimeType,
} from "@/lib/media-recorder-mime"

export type VoiceTranscriptSource = "web-speech" | "server"

export interface VoiceTranscriptMeta {
  source: VoiceTranscriptSource
}

interface UseVoiceInputOptions {
  locale: ChatLocale
  /** Same handler as the FR/EN header toggle; used when dual Web Speech picks the non-UI language. */
  onLocaleChange?: (locale: ChatLocale) => void
  onTranscript: (text: string, meta: VoiceTranscriptMeta) => void
  /** Shown while OpenAI transcription runs (MediaRecorder / iOS path). */
  onAwaitingServerTranscript?: (pending: boolean) => void
  messages: {
    noSpeechRecognized: string
    serverTranscriptionFailed: string
    serverNotConfigured: string
    recordingTooShort: string
  }
}

export interface UseVoiceInputResult {
  isRecording: boolean
  errorMessage: string | null
  micStream: MediaStream | null
  timelineVisualizationActive: boolean
  canUseVoice: boolean
  startRecording: () => Promise<void>
  cancelRecording: () => void
  confirmRecording: () => void
  clearError: () => void
}

const POST_END_TEXT_FLUSH_MS = 220
/** Chromium mobile often supports only one active SpeechRecognition; dual engines deadlock on confirm. */
const MOBILE_WEB_SPEECH_UA =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i

function shouldCollapseToSingleSpeechEngine(): boolean {
  if (typeof navigator === "undefined") return false
  return MOBILE_WEB_SPEECH_UA.test(navigator.userAgent)
}

/** If dual-engine confirm never reaches the merge, force teardown (ms). */
const WEB_SPEECH_CONFIRM_SAFETY_MS = 2800

function applySpeechResultToRefs(
  event: SpeechRecognitionEvent,
  finalAccRef: { current: string },
  liveRef: { current: string }
) {
  let interimPart = ""
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const r = event.results[i]!
    const piece = r[0]?.transcript ?? ""
    if (r.isFinal) finalAccRef.current += piece
    else interimPart += piece
  }
  const f = finalAccRef.current
  const gap = f && interimPart ? " " : ""
  liveRef.current = (f + gap + interimPart).trimEnd()
}

function formatUserMediaError(err: unknown): string {
  if (err && typeof err === "object" && "name" in err) {
    const n = (err as { name: string }).name
    if (n === "NotAllowedError" || n === "PermissionDeniedError") {
      return "Microphone access was denied."
    }
    if (n === "NotFoundError") {
      return "No microphone was found."
    }
  }
  return "Could not access the microphone."
}

/** iOS / no-SpeechRecognition: uses server STT with a single Whisper language (no dual-lang auto-detect). */
function preferMediaRecorderPath(): boolean {
  if (typeof window === "undefined") return false
  if (isIOSLikeClient()) return true
  return getSpeechRecognitionConstructor() == null
}

export function useVoiceInput({
  locale,
  onLocaleChange,
  onTranscript,
  onAwaitingServerTranscript,
  messages,
}: UseVoiceInputOptions): UseVoiceInputResult {
  const [isRecording, setIsRecording] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [micStream, setMicStream] = useState<MediaStream | null>(null)
  const [timelineVisualizationActive, setTimelineVisualizationActive] =
    useState(false)

  const primaryRecognitionRef = useRef<SpeechRecognition | null>(null)
  const secondaryRecognitionRef = useRef<SpeechRecognition | null>(null)
  const primaryFinalAccRef = useRef("")
  const secondaryFinalAccRef = useRef("")
  const primaryLiveRef = useRef("")
  const secondaryLiveRef = useRef("")
  const sessionLocaleRef = useRef<ChatLocale>(locale)
  const speechConfirmEndsRemainingRef = useRef(0)
  const unexpectedWebSpeechEndHandledRef = useRef(false)
  const pendingConfirmRef = useRef(false)
  const onTranscriptRef = useRef(onTranscript)
  onTranscriptRef.current = onTranscript
  const onLocaleChangeRef = useRef(onLocaleChange)
  onLocaleChangeRef.current = onLocaleChange
  const onAwaitingServerTranscriptRef = useRef(onAwaitingServerTranscript)
  onAwaitingServerTranscriptRef.current = onAwaitingServerTranscript

  const postEndFlushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  /** Incremented to invalidate a scheduled post-`onend` transcript flush. */
  const speechFlushGenRef = useRef(0)
  const confirmSafetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )

  const clearConfirmSafetyTimeout = useCallback(() => {
    if (confirmSafetyTimeoutRef.current != null) {
      clearTimeout(confirmSafetyTimeoutRef.current)
      confirmSafetyTimeoutRef.current = null
    }
  }, [])

  const clearPostEndTimerOnly = useCallback(() => {
    if (postEndFlushTimeoutRef.current != null) {
      clearTimeout(postEndFlushTimeoutRef.current)
      postEndFlushTimeoutRef.current = null
    }
  }, [])

  const invalidatePendingSpeechFlush = useCallback(() => {
    clearConfirmSafetyTimeout()
    clearPostEndTimerOnly()
    speechFlushGenRef.current += 1
  }, [clearConfirmSafetyTimeout, clearPostEndTimerOnly])

  const engineRef = useRef<"web-speech" | "media" | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaChunksRef = useRef<BlobPart[]>([])
  const mediaMimeRef = useRef<string | undefined>(undefined)
  const suppressNextMediaUploadRef = useRef(false)
  const mediaSessionIdRef = useRef(0)

  const canUseVoice =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    (getSpeechRecognitionConstructor() != null ||
      typeof MediaRecorder !== "undefined")

  const tearDownAudio = useCallback(() => {
    setTimelineVisualizationActive(false)
    setMicStream((prev) => {
      prev?.getTracks().forEach((t) => t.stop())
      return null
    })
  }, [])

  const detachRecognition = useCallback(() => {
    const detachOne = (rec: SpeechRecognition | null) => {
      if (!rec) return
      rec.onresult = null
      rec.onerror = null
      rec.onend = null
    }
    detachOne(primaryRecognitionRef.current)
    detachOne(secondaryRecognitionRef.current)
    primaryRecognitionRef.current = null
    secondaryRecognitionRef.current = null
  }, [])

  const mergedFinalizeSpeechConfirmFlush = useCallback(() => {
    if (engineRef.current !== "web-speech") return
    clearConfirmSafetyTimeout()
    clearPostEndTimerOnly()
    pendingConfirmRef.current = false
    unexpectedWebSpeechEndHandledRef.current = true
    detachRecognition()
    tearDownAudio()
    setIsRecording(false)
    engineRef.current = null
    const primaryText = primaryLiveRef.current.trim()
    const secondaryText = secondaryLiveRef.current.trim()
    if (primaryText) {
      onTranscriptRef.current(primaryText, { source: "web-speech" })
    } else if (secondaryText) {
      onLocaleChangeRef.current?.(
        oppositeChatLocale(sessionLocaleRef.current)
      )
      onTranscriptRef.current(secondaryText, { source: "web-speech" })
    } else {
      setErrorMessage(messages.noSpeechRecognized)
    }
  }, [
    clearConfirmSafetyTimeout,
    clearPostEndTimerOnly,
    detachRecognition,
    messages.noSpeechRecognized,
    tearDownAudio,
  ])

  /** OpenAI Whisper uses UI `locale` only; bilingual auto-detect is Web Speech–only. */
  const submitMediaTranscription = useCallback(
    async (blob: Blob, sessionId: number) => {
      const fail = (msg: string) => {
        if (sessionId === mediaSessionIdRef.current) {
          setErrorMessage(msg)
        }
        onAwaitingServerTranscriptRef.current?.(false)
        setIsRecording(false)
        engineRef.current = null
      }

      if (sessionId !== mediaSessionIdRef.current) {
        onAwaitingServerTranscriptRef.current?.(false)
        return
      }

      if (blob.size < 400) {
        fail(messages.recordingTooShort)
        return
      }

      const ext = extensionForRecorderMime(blob.type || mediaMimeRef.current)
      const fd = new FormData()
      fd.append("file", blob, `recording.${ext}`)
      fd.append("locale", locale)
      fd.append("filename", `recording.${ext}`)

      try {
        const res = await fetch("/api/transcribe", {
          method: "POST",
          body: fd,
        })
        const data = (await res.json()) as { text?: string; error?: string }

        if (sessionId !== mediaSessionIdRef.current) {
          onAwaitingServerTranscriptRef.current?.(false)
          return
        }

        if (res.status === 503 && data.error === "missing_api_key") {
          fail(messages.serverNotConfigured)
          return
        }

        if (!res.ok) {
          fail(messages.serverTranscriptionFailed)
          return
        }

        const text = typeof data.text === "string" ? data.text.trim() : ""
        if (!text) {
          fail(messages.noSpeechRecognized)
          return
        }

        onAwaitingServerTranscriptRef.current?.(false)
        setIsRecording(false)
        engineRef.current = null
        onTranscriptRef.current(text, { source: "server" })
      } catch {
        if (sessionId !== mediaSessionIdRef.current) {
          onAwaitingServerTranscriptRef.current?.(false)
          return
        }
        fail(messages.serverTranscriptionFailed)
      }
    },
    [
      locale,
      messages.noSpeechRecognized,
      messages.recordingTooShort,
      messages.serverNotConfigured,
      messages.serverTranscriptionFailed,
      tearDownAudio,
    ]
  )

  const beginWebSpeechSession = useCallback(async () => {
    engineRef.current = "web-speech"
    unexpectedWebSpeechEndHandledRef.current = false
    const Ctor = getSpeechRecognitionConstructor()
    if (!Ctor) {
      setErrorMessage("Speech recognition is not supported in this browser.")
      engineRef.current = null
      return
    }

    const sessionLoc: ChatLocale = locale
    sessionLocaleRef.current = sessionLoc

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      setErrorMessage(formatUserMediaError(e))
      engineRef.current = null
      return
    }

    setMicStream(stream)

    const scheduleMergingFlushAfterAllEnginesEnded = () => {
      clearPostEndTimerOnly()
      const gen = speechFlushGenRef.current
      postEndFlushTimeoutRef.current = setTimeout(() => {
        postEndFlushTimeoutRef.current = null
        if (gen !== speechFlushGenRef.current) return
        mergedFinalizeSpeechConfirmFlush()
      }, POST_END_TEXT_FLUSH_MS)
    }

    const fatalSpeechError = (message: string) => {
      unexpectedWebSpeechEndHandledRef.current = true
      invalidatePendingSpeechFlush()
      pendingConfirmRef.current = false
      try {
        primaryRecognitionRef.current?.abort()
      } catch {
        /* noop */
      }
      try {
        secondaryRecognitionRef.current?.abort()
      } catch {
        /* noop */
      }
      detachRecognition()
      tearDownAudio()
      setIsRecording(false)
      engineRef.current = null
      setErrorMessage(message)
    }

    const detachOneEngineSilently = (rec: SpeechRecognition | null) => {
      if (!rec) return
      rec.onresult = null
      rec.onerror = null
      rec.onend = null
      try {
        rec.abort()
      } catch {
        /* noop */
      }
    }

    const removeEngineAfterNonFatalError = (
      rec: SpeechRecognition,
      slot: "primary" | "secondary"
    ) => {
      if (slot === "primary") {
        if (primaryRecognitionRef.current === rec) primaryRecognitionRef.current = null
      } else if (secondaryRecognitionRef.current === rec) {
        secondaryRecognitionRef.current = null
      }
      detachOneEngineSilently(rec)
      if (
        primaryRecognitionRef.current == null &&
        secondaryRecognitionRef.current == null
      ) {
        unexpectedWebSpeechEndHandledRef.current = true
        invalidatePendingSpeechFlush()
        pendingConfirmRef.current = false
        tearDownAudio()
        setIsRecording(false)
        engineRef.current = null
      }
    }

    /**
     * Chromium only keeps one SpeechRecognition session active; starting the second can end the first.
     * Without confirm, we must not tear down the whole recording when one engine ends while the peer is still active.
     */
    const onEngineEnded = (rec: SpeechRecognition, slot: "primary" | "secondary") => {
      if (unexpectedWebSpeechEndHandledRef.current) return
      if (pendingConfirmRef.current) {
        speechConfirmEndsRemainingRef.current -= 1
        if (speechConfirmEndsRemainingRef.current > 0) return
        scheduleMergingFlushAfterAllEnginesEnded()
        return
      }
      if (slot === "primary") {
        if (primaryRecognitionRef.current === rec) primaryRecognitionRef.current = null
      } else if (secondaryRecognitionRef.current === rec) {
        secondaryRecognitionRef.current = null
      }
      detachOneEngineSilently(rec)
      if (
        primaryRecognitionRef.current == null &&
        secondaryRecognitionRef.current == null
      ) {
        unexpectedWebSpeechEndHandledRef.current = true
        invalidatePendingSpeechFlush()
        pendingConfirmRef.current = false
        tearDownAudio()
        setIsRecording(false)
        engineRef.current = null
      }
    }

    const wireRecognition = (
      rec: SpeechRecognition,
      slot: "primary" | "secondary",
      bcp47: string,
      finalAccRef: typeof primaryFinalAccRef,
      liveRef: typeof primaryLiveRef
    ) => {
      rec.lang = bcp47
      rec.continuous = true
      rec.interimResults = true
      rec.onresult = (event: SpeechRecognitionEvent) => {
        applySpeechResultToRefs(event, finalAccRef, liveRef)
      }
      rec.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === "aborted") return
        if (event.error === "no-speech" || event.error === "no-match") {
          removeEngineAfterNonFatalError(rec, slot)
          return
        }
        const msg =
          event.error === "not-allowed"
            ? "Microphone or speech recognition permission was denied."
            : `Speech recognition error: ${event.error}.`
        fatalSpeechError(msg)
      }
      rec.onend = () => {
        onEngineEnded(rec, slot)
      }
    }

    const recPrimary = new Ctor()
    wireRecognition(
      recPrimary,
      "primary",
      speechRecognitionLang(sessionLoc),
      primaryFinalAccRef,
      primaryLiveRef
    )
    primaryRecognitionRef.current = recPrimary

    try {
      recPrimary.start()
    } catch {
      setErrorMessage("Could not start speech recognition.")
      detachRecognition()
      tearDownAudio()
      engineRef.current = null
      return
    }

    if (!shouldCollapseToSingleSpeechEngine()) {
      const recSecondary = new Ctor()
      wireRecognition(
        recSecondary,
        "secondary",
        speechRecognitionLang(oppositeChatLocale(sessionLoc)),
        secondaryFinalAccRef,
        secondaryLiveRef
      )
      try {
        recSecondary.start()
        secondaryRecognitionRef.current = recSecondary
      } catch {
        detachOneEngineSilently(recSecondary)
        secondaryRecognitionRef.current = null
      }
    }

    setIsRecording(true)
    setTimelineVisualizationActive(true)
  }, [
    clearPostEndTimerOnly,
    detachRecognition,
    invalidatePendingSpeechFlush,
    locale,
    mergedFinalizeSpeechConfirmFlush,
    tearDownAudio,
  ])

  const beginMediaRecorderSession = useCallback(async () => {
    if (typeof MediaRecorder === "undefined") {
      setErrorMessage("Recording is not supported in this browser.")
      return
    }

    engineRef.current = "media"
    mediaSessionIdRef.current += 1
    const sessionId = mediaSessionIdRef.current

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      setErrorMessage(formatUserMediaError(e))
      engineRef.current = null
      return
    }

    setMicStream(stream)
    mediaChunksRef.current = []
    const mime = pickMediaRecorderMimeType()
    mediaMimeRef.current = mime

    let recorder: MediaRecorder
    try {
      recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream)
    } catch {
      setErrorMessage("Could not start audio recording.")
      tearDownAudio()
      engineRef.current = null
      return
    }

    suppressNextMediaUploadRef.current = false

    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) mediaChunksRef.current.push(e.data)
    }

    recorder.onerror = () => {
      if (mediaRecorderRef.current !== recorder) return
      mediaRecorderRef.current = null
      setErrorMessage(messages.serverTranscriptionFailed)
      tearDownAudio()
      setIsRecording(false)
      engineRef.current = null
      onAwaitingServerTranscriptRef.current?.(false)
    }

    recorder.onstop = () => {
      if (mediaRecorderRef.current !== recorder) return
      mediaRecorderRef.current = null

      const suppress = suppressNextMediaUploadRef.current
      suppressNextMediaUploadRef.current = false

      if (sessionId !== mediaSessionIdRef.current) return

      if (suppress) return

      const effectiveMime =
        recorder.mimeType || mediaMimeRef.current || "audio/webm"
      const blob = new Blob(mediaChunksRef.current, {
        type: effectiveMime || undefined,
      })
      mediaChunksRef.current = []

      tearDownAudio()
      setIsRecording(false)
      void submitMediaTranscription(blob, sessionId)
    }

    mediaRecorderRef.current = recorder
    try {
      recorder.start(250)
    } catch {
      setErrorMessage("Could not start audio recording.")
      mediaRecorderRef.current = null
      tearDownAudio()
      engineRef.current = null
      return
    }

    setIsRecording(true)
    setTimelineVisualizationActive(true)
  }, [messages.serverTranscriptionFailed, submitMediaTranscription, tearDownAudio])

  const beginSession = useCallback(async () => {
    setErrorMessage(null)
    primaryFinalAccRef.current = ""
    secondaryFinalAccRef.current = ""
    primaryLiveRef.current = ""
    secondaryLiveRef.current = ""
    pendingConfirmRef.current = false

    if (preferMediaRecorderPath()) {
      await beginMediaRecorderSession()
    } else {
      await beginWebSpeechSession()
    }
  }, [beginMediaRecorderSession, beginWebSpeechSession])

  const hardStopWithoutConfirm = useCallback(() => {
    invalidatePendingSpeechFlush()
    pendingConfirmRef.current = false
    unexpectedWebSpeechEndHandledRef.current = true
    mediaSessionIdRef.current += 1

    try {
      primaryRecognitionRef.current?.abort()
    } catch {
      /* noop */
    }
    try {
      secondaryRecognitionRef.current?.abort()
    } catch {
      /* noop */
    }
    detachRecognition()

    if (mediaRecorderRef.current) {
      suppressNextMediaUploadRef.current = true
      try {
        if (mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop()
        }
      } catch {
        /* noop */
      }
    }

    tearDownAudio()
    setIsRecording(false)
    engineRef.current = null
    onAwaitingServerTranscriptRef.current?.(false)
  }, [detachRecognition, invalidatePendingSpeechFlush, tearDownAudio])

  const startRecording = useCallback(async () => {
    if (!canUseVoice) {
      setErrorMessage("Voice input is not available in this environment.")
      return
    }
    hardStopWithoutConfirm()
    speechFlushGenRef.current += 1
    await beginSession()
  }, [beginSession, canUseVoice, hardStopWithoutConfirm])

  const cancelRecording = useCallback(() => {
    hardStopWithoutConfirm()
  }, [hardStopWithoutConfirm])

  const confirmRecording = useCallback(() => {
    if (engineRef.current === "media") {
      const mr = mediaRecorderRef.current
      if (!mr || mr.state === "inactive") return
      setTimelineVisualizationActive(false)
      onAwaitingServerTranscriptRef.current?.(true)
      try {
        mr.stop()
      } catch {
        pendingConfirmRef.current = false
        onAwaitingServerTranscriptRef.current?.(false)
        setErrorMessage("Could not finalize recording.")
        hardStopWithoutConfirm()
      }
      return
    }

    const recP = primaryRecognitionRef.current
    const recS = secondaryRecognitionRef.current
    if (!recP && !recS) {
      hardStopWithoutConfirm()
      return
    }
    pendingConfirmRef.current = true
    speechConfirmEndsRemainingRef.current =
      (recP ? 1 : 0) + (recS ? 1 : 0)
    setTimelineVisualizationActive(false)
    try {
      recP?.stop()
    } catch {
      pendingConfirmRef.current = false
      setErrorMessage("Could not finalize recording.")
      hardStopWithoutConfirm()
      return
    }
    try {
      recS?.stop()
    } catch {
      pendingConfirmRef.current = false
      setErrorMessage("Could not finalize recording.")
      hardStopWithoutConfirm()
      return
    }

    clearConfirmSafetyTimeout()
    confirmSafetyTimeoutRef.current = setTimeout(() => {
      confirmSafetyTimeoutRef.current = null
      if (engineRef.current !== "web-speech") return
      if (!pendingConfirmRef.current) return
      clearPostEndTimerOnly()
      mergedFinalizeSpeechConfirmFlush()
    }, WEB_SPEECH_CONFIRM_SAFETY_MS)
  }, [
    clearConfirmSafetyTimeout,
    clearPostEndTimerOnly,
    hardStopWithoutConfirm,
    mergedFinalizeSpeechConfirmFlush,
  ])

  const clearError = useCallback(() => setErrorMessage(null), [])

  useEffect(
    () => () => {
      hardStopWithoutConfirm()
    },
    [hardStopWithoutConfirm]
  )

  return {
    isRecording,
    errorMessage,
    micStream,
    timelineVisualizationActive,
    canUseVoice,
    startRecording,
    cancelRecording,
    confirmRecording,
    clearError,
  }
}
