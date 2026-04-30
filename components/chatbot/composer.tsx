"use client"

import { ArrowUp, Check, Mic, X } from "lucide-react"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react"
import { cn } from "@/lib/utils"
import { RecordingTimeline } from "./recording-timeline"

const inputShellBaseClass =
  "flex min-w-0 flex-1 items-end gap-2 rounded-2xl border border-border bg-card px-3 shadow-sm"
/** Collapsed row ≈ 60px tall: 1px borders + 11px×2 padding + 36px input track. */
const inputShellClass = cn(inputShellBaseClass, "py-[11px]")
const inputShellRecordingClass = cn(inputShellBaseClass, "py-3")

/** Matches footer send/mic (`h-9`); `py-2` + `leading-5` + `text-sm` ≈ 36px border-box. Floors auto-grow when `scrollHeight` is 0. */
const TEXTAREA_MIN_HEIGHT_PX = 36

function TranscriptionLoadingLabel({ text }: { text: string }) {
  return (
    <div className="flex min-w-0 items-baseline gap-0.5 text-sm text-muted-foreground">
      <span>{text.replace(/\u2026$/, "")}</span>
      <span
        className="inline-block animate-pulse font-normal text-muted-foreground"
        aria-hidden
      >
        …
      </span>
    </div>
  )
}

export interface ComposerProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  placeholder?: string
  transcriptionLoadingPlaceholder?: string
  /** Accessible name for the message field (SGQRI: not placeholder alone). */
  inputAriaLabel: string
  sendAriaLabel: string
  micAriaLabel: string
  /** When the combined primary control is disabled (e.g. busy, empty draft). */
  primaryActionUnavailableAriaLabel: string
  /** Optional polite announcement when switching to send mode (single control). */
  sendModeAnnouncement?: string
  /** Optional polite announcement when switching to voice mode (single control). */
  voiceModeAnnouncement?: string
  cancelRecordingAriaLabel?: string
  confirmRecordingAriaLabel?: string
  stopRecordingLabel?: string
  confirmRecordingLabel?: string
  disabled?: boolean
  className?: string
  isRecording: boolean
  isVoiceTranscribing?: boolean
  onMicClick: () => void
  micDisabled?: boolean
  micStream: MediaStream | null
  timelineVisualizationActive: boolean
  onRecordingCancel: () => void
  onRecordingConfirm: () => void
}

export function Composer({
  value,
  onChange,
  onSubmit,
  placeholder = "Posez votre question...",
  transcriptionLoadingPlaceholder = "Transcription en cours…",
  inputAriaLabel,
  sendAriaLabel,
  micAriaLabel,
  primaryActionUnavailableAriaLabel,
  sendModeAnnouncement,
  voiceModeAnnouncement,
  cancelRecordingAriaLabel = "Annuler l'enregistrement",
  confirmRecordingAriaLabel = "Confirmer la dictée",
  stopRecordingLabel = "Arrêter",
  confirmRecordingLabel = "Confirmer",
  disabled = false,
  className,
  isRecording,
  isVoiceTranscribing = false,
  onMicClick,
  micDisabled = false,
  micStream,
  timelineVisualizationActive,
  onRecordingCancel,
  onRecordingConfirm,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const confirmRecordingBtnRef = useRef<HTMLButtonElement | null>(null)
  const modeAnnouncerRef = useRef<HTMLDivElement | null>(null)
  const prevSendModeRef = useRef<boolean | null>(null)
  /** Outer width of the confirm control (icon + label); stop uses the same width. */
  const [recordingActionBtnWidthPx, setRecordingActionBtnWidthPx] = useState<
    number | null
  >(null)
  const inputLocked = disabled || isVoiceTranscribing
  const hasDraftText = value.trim().length > 0
  const canSend = !inputLocked && hasDraftText
  const canMic = !inputLocked && !micDisabled && !hasDraftText
  const primaryDisabled = !canSend && !canMic
  const primaryAriaLabel = primaryDisabled
    ? primaryActionUnavailableAriaLabel
    : canSend
      ? sendAriaLabel
      : micAriaLabel

  const syncTextareaHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    if (value.length === 0) {
      el.style.height = `${TEXTAREA_MIN_HEIGHT_PX}px`
      return
    }
    el.style.height = "0px"
    void el.offsetHeight
    el.style.height = `${Math.max(el.scrollHeight, TEXTAREA_MIN_HEIGHT_PX)}px`
  }, [value])

  useLayoutEffect(() => {
    syncTextareaHeight()
  }, [value, isVoiceTranscribing, syncTextareaHeight])

  useLayoutEffect(() => {
    if (!isRecording) {
      setRecordingActionBtnWidthPx(null)
      return
    }
    const node = confirmRecordingBtnRef.current
    if (!node) return
    const read = () => {
      setRecordingActionBtnWidthPx(
        Math.ceil(node.getBoundingClientRect().width),
      )
    }
    read()
    const ro = new ResizeObserver(read)
    ro.observe(node)
    return () => ro.disconnect()
  }, [isRecording, confirmRecordingLabel])

  const sendMode = canSend
  useEffect(() => {
    if (
      isRecording ||
      sendModeAnnouncement == null ||
      voiceModeAnnouncement == null
    ) {
      return
    }
    if (prevSendModeRef.current === null) {
      prevSendModeRef.current = sendMode
      return
    }
    if (prevSendModeRef.current === sendMode) return
    prevSendModeRef.current = sendMode
    const el = modeAnnouncerRef.current
    if (!el) return
    el.textContent = sendMode ? sendModeAnnouncement : voiceModeAnnouncement
  }, [isRecording, sendMode, sendModeAnnouncement, voiceModeAnnouncement])

  const handleTextareaKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (canSend) onSubmit()
    }
  }

  const handlePrimaryClick = () => {
    if (canSend) {
      onSubmit()
      return
    }
    if (canMic) {
      void onMicClick()
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        ref={modeAnnouncerRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
      <div
        className={cn(
          "flex min-w-0 gap-2 sm:gap-3",
          isRecording ? "items-center" : "items-end",
        )}
      >
        {isRecording ? (
          <>
            <button
              type="button"
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-[14px] border border-destructive/35 bg-destructive/15 px-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40 focus-visible:ring-offset-2"
              style={
                recordingActionBtnWidthPx != null
                  ? {
                      width: recordingActionBtnWidthPx,
                      minWidth: recordingActionBtnWidthPx,
                    }
                  : undefined
              }
              aria-label={cancelRecordingAriaLabel}
              onClick={onRecordingCancel}
            >
              <X className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
              <span className="truncate">{stopRecordingLabel}</span>
            </button>
            <div className={cn(inputShellRecordingClass, "min-h-[52px]")} aria-hidden>
              <RecordingTimeline
                mediaStream={micStream}
                visualizationActive={timelineVisualizationActive}
                className="h-9 w-full border-0 bg-transparent"
              />
            </div>
            <button
              ref={confirmRecordingBtnRef}
              type="button"
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-[14px] bg-primary px-2.5 text-sm font-medium text-primary-foreground shadow-md transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              style={
                recordingActionBtnWidthPx != null
                  ? {
                      width: recordingActionBtnWidthPx,
                      minWidth: recordingActionBtnWidthPx,
                    }
                  : undefined
              }
              aria-label={confirmRecordingAriaLabel}
              onClick={onRecordingConfirm}
            >
              <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
              <span className="truncate">{confirmRecordingLabel}</span>
            </button>
          </>
        ) : (
          <div className={cn(inputShellClass, "flex min-w-0 flex-1 gap-2 sm:gap-3")}>
            <form
              className="flex min-w-0 flex-1 items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (canSend) onSubmit()
              }}
            >
              <div className="relative flex min-h-[36px] min-w-0 flex-1 flex-col justify-center">
                <textarea
                  ref={textareaRef}
                  id="chat-composer-message"
                  rows={1}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  onInput={syncTextareaHeight}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder={isVoiceTranscribing ? "" : placeholder}
                  aria-label={inputAriaLabel}
                  className={cn(
                    "box-border max-h-[8rem] min-h-[36px] w-full resize-none overflow-y-auto bg-transparent py-2 text-sm leading-5 text-card-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                    isVoiceTranscribing &&
                      "text-transparent caret-transparent",
                  )}
                  disabled={inputLocked}
                  autoComplete="off"
                />
                {isVoiceTranscribing ? (
                  <div
                    className="pointer-events-none absolute inset-0 flex items-center"
                    aria-live="polite"
                  >
                    <TranscriptionLoadingLabel
                      text={transcriptionLoadingPlaceholder}
                    />
                  </div>
                ) : null}
              </div>
            </form>
            <button
              type="button"
              onClick={handlePrimaryClick}
              disabled={primaryDisabled}
              aria-label={primaryAriaLabel}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-primary text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:pointer-events-none disabled:opacity-50"
            >
              {canSend ? (
                <ArrowUp className="h-4 w-4" aria-hidden />
              ) : (
                <Mic className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
